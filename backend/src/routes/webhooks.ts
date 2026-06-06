// Feature #746: Webhook external integration
import { Router, Request, Response } from 'express';
import type { IncomingHttpHeaders } from 'http';
import type { Prisma, WebhookConfig as WebhookConfigRecord } from '@prisma/client';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireScope } from './apiKeys.js';
import crypto from 'crypto';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AuditAction, createAuditLog } from '../lib/auditLog.js';
import { prisma } from '../lib/prisma.js';
import { decrypt, encrypt } from '../lib/encryption.js';
import { sanitizeUrlValueForLog } from '../lib/logSanitization.js';
import { logError } from '../lib/serverLogger.js';
import {
  buildTestWebhookLogsClearedResponse,
  buildTestWebhookLogsResponse,
  buildTestWebhookReceivedResponse,
  buildWebhookConfigsResponse,
  buildWebhookCreatedResponse,
  buildWebhookDeliveriesResponse,
  buildWebhookSecretRegeneratedResponse,
  buildWebhookTestDeliveryResponse,
} from './webhookResponses.js';
import {
  assertWebhookDestinationResolvesPublicly,
  normalizeEvents,
  normalizeWebhookUrl,
  parseLimit,
  parseStoredEvents,
  parseWebhookRouteId,
  serializeEvents,
} from './webhooks/validation.js';

const router = Router();
const WEBHOOK_MANAGER_ROLES = ['owner', 'admin'];
const DEFAULT_WEBHOOK_DELIVERY_TIMEOUT_MS = 10000;
const MAX_WEBHOOK_DELIVERY_TIMEOUT_MS = 30000;
const DEFAULT_WEBHOOK_DELIVERY_MAX_ATTEMPTS = 3;
const MAX_WEBHOOK_DELIVERY_MAX_ATTEMPTS = 5;
const DEFAULT_WEBHOOK_DELIVERY_RETRY_DELAY_MS = 250;
const MAX_WEBHOOK_DELIVERY_RETRY_DELAY_MS = 5000;
const MAX_WEBHOOK_RESPONSE_BODY_CHARS = 4096;

interface WebhookConfig {
  id: string;
  companyId: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: Prisma.JsonValue;
  responseStatus: number | null;
  responseBody: string | null;
  error: string | null;
  deliveredAt: Date;
  success: boolean;
}

type AuthUser = NonNullable<Express.Request['user']>;

// Test endpoint to receive webhooks (for internal testing)
const testWebhookReceived: Array<{
  id: string;
  timestamp: Date;
  headers: IncomingHttpHeaders;
  body: unknown;
  signature: string | null;
}> = [];

// Generate HMAC signature for webhook payload
function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// Verify webhook signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = generateSignature(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

export function sanitizeWebhookUrlForLog(rawUrl: string): string {
  return sanitizeUrlValueForLog(rawUrl);
}

function getWebhookDeliveryTimeoutMs(): number {
  const parsed = Number.parseInt(
    String(process.env.WEBHOOK_DELIVERY_TIMEOUT_MS ?? DEFAULT_WEBHOOK_DELIVERY_TIMEOUT_MS),
    10,
  );
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_WEBHOOK_DELIVERY_TIMEOUT_MS;
  }
  return Math.min(parsed, MAX_WEBHOOK_DELIVERY_TIMEOUT_MS);
}

function getWebhookDeliveryMaxAttempts(): number {
  const parsed = Number.parseInt(
    String(process.env.WEBHOOK_DELIVERY_MAX_ATTEMPTS ?? DEFAULT_WEBHOOK_DELIVERY_MAX_ATTEMPTS),
    10,
  );
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_WEBHOOK_DELIVERY_MAX_ATTEMPTS;
  }
  return Math.min(parsed, MAX_WEBHOOK_DELIVERY_MAX_ATTEMPTS);
}

function getWebhookDeliveryRetryDelayMs(): number {
  const parsed = Number.parseInt(
    String(process.env.WEBHOOK_DELIVERY_RETRY_DELAY_MS ?? DEFAULT_WEBHOOK_DELIVERY_RETRY_DELAY_MS),
    10,
  );
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_WEBHOOK_DELIVERY_RETRY_DELAY_MS;
  }
  return Math.min(parsed, MAX_WEBHOOK_DELIVERY_RETRY_DELAY_MS);
}

function shouldRetryWebhookStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function waitForRetryDelay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toResponseBodyPreview(responseBody: string): string {
  if (responseBody.length <= MAX_WEBHOOK_RESPONSE_BODY_CHARS) {
    return responseBody;
  }

  return `${responseBody.slice(0, MAX_WEBHOOK_RESPONSE_BODY_CHARS)}... [truncated]`;
}

function encryptWebhookSecret(secret: string): string {
  return encrypt(secret);
}

function decryptWebhookSecret(storedSecret: string): string {
  return decrypt(storedSecret);
}

function toWebhookConfig(record: WebhookConfigRecord): WebhookConfig {
  return {
    id: record.id,
    companyId: record.companyId,
    url: record.url,
    secret: decryptWebhookSecret(record.secret),
    events: parseStoredEvents(record.events),
    enabled: record.enabled,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdById: record.createdById,
  };
}

function toPublicWebhookConfig(config: WebhookConfig, includeSecret = false) {
  return {
    ...config,
    secret: includeSecret ? config.secret : '****',
  };
}

function getWebhookAuditSnapshot(config: Pick<WebhookConfig, 'url' | 'events' | 'enabled'>) {
  return {
    url: sanitizeWebhookUrlForLog(config.url),
    events: config.events,
    enabled: config.enabled,
  };
}

function buildWebhookUpdateAuditChanges(
  before: WebhookConfig,
  after: WebhookConfig,
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};

  if (before.url !== after.url) {
    changes.url = {
      from: sanitizeWebhookUrlForLog(before.url),
      to: sanitizeWebhookUrlForLog(after.url),
    };
  }

  if (JSON.stringify(before.events) !== JSON.stringify(after.events)) {
    changes.events = { from: before.events, to: after.events };
  }

  if (before.enabled !== after.enabled) {
    changes.enabled = { from: before.enabled, to: after.enabled };
  }

  return changes;
}

async function getWebhookConfig(id: string): Promise<WebhookConfig | null> {
  const record = await prisma.webhookConfig.findUnique({ where: { id } });
  return record ? toWebhookConfig(record) : null;
}

async function pruneOldDeliveries(webhookId: string): Promise<void> {
  const staleDeliveries = await prisma.webhookDelivery.findMany({
    where: { webhookId },
    orderBy: { deliveredAt: 'desc' },
    skip: 100,
    select: { id: true },
  });

  if (staleDeliveries.length > 0) {
    await prisma.webhookDelivery.deleteMany({
      where: { id: { in: staleDeliveries.map((delivery) => delivery.id) } },
    });
  }
}

async function recordWebhookDelivery(delivery: WebhookDelivery): Promise<void> {
  await prisma.webhookDelivery.create({
    data: {
      id: delivery.id,
      webhookId: delivery.webhookId,
      event: delivery.event,
      payload: delivery.payload as Prisma.InputJsonValue,
      responseStatus: delivery.responseStatus,
      responseBody: delivery.responseBody,
      error: delivery.error,
      deliveredAt: delivery.deliveredAt,
      success: delivery.success,
    },
  });

  await pruneOldDeliveries(delivery.webhookId);
}

interface ClearWebhookStoresOptions {
  companyId?: string;
  createdById?: string;
}

export async function clearWebhookStores(options?: ClearWebhookStoresOptions): Promise<void> {
  if (!options) {
    await prisma.webhookDelivery.deleteMany();
    await prisma.webhookConfig.deleteMany();
    return;
  }

  const scoped = Boolean(options.companyId || options.createdById);
  if (!scoped) {
    return;
  }

  const where: Prisma.WebhookConfigWhereInput = {};
  if (options.companyId) {
    where.companyId = options.companyId;
  }
  if (options.createdById) {
    where.createdById = options.createdById;
  }

  const configs = await prisma.webhookConfig.findMany({
    where,
    select: { id: true },
  });
  const webhookIds = configs.map((config) => config.id);

  if (webhookIds.length > 0) {
    await prisma.webhookDelivery.deleteMany({
      where: { webhookId: { in: webhookIds } },
    });
  }

  await prisma.webhookConfig.deleteMany({ where });
}

function requireWebhookManager(user: AuthUser): void {
  if (!user.companyId) {
    throw AppError.forbidden('Company context required');
  }

  if (!WEBHOOK_MANAGER_ROLES.includes(user.roleInCompany)) {
    throw AppError.forbidden('Webhook management access required');
  }
}

function assertTestReceiverAvailable(): void {
  if (process.env.NODE_ENV === 'production') {
    throw AppError.forbidden('Test webhook receiver is not available in production');
  }
}

// ================================
// PUBLIC ENDPOINT - Webhook receiver for testing
// This is placed BEFORE auth middleware so it can receive external webhook posts
// ================================

// POST /api/webhooks/test-receiver - Test endpoint to receive webhooks
router.post('/test-receiver', (req: Request, res: Response) => {
  assertTestReceiverAvailable();

  const signature = req.headers['x-webhook-signature'] as string | undefined;

  // Strip sensitive headers before storing
  const sanitizedHeaders = { ...req.headers };
  delete sanitizedHeaders.authorization;
  delete sanitizedHeaders.cookie;

  const received = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    headers: sanitizedHeaders,
    body: req.body,
    signature: signature || null,
  };

  testWebhookReceived.push(received);

  // Keep only last 100 webhooks
  if (testWebhookReceived.length > 100) {
    testWebhookReceived.shift();
  }

  res.status(200).json(buildTestWebhookReceivedResponse(received));
});

// GET /api/webhooks/test-receiver/logs - Get received test webhooks (for verification)
router.get(
  '/test-receiver/logs',
  requireAuth,
  requireScope('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    assertTestReceiverAvailable();
    requireWebhookManager(req.user!);

    const { limit } = req.query;
    const logs = testWebhookReceived.slice(-parseLimit(limit, 10)).reverse();

    res.json(buildTestWebhookLogsResponse(logs, testWebhookReceived.length));
  }),
);

// Clear test logs
router.delete(
  '/test-receiver/logs',
  requireAuth,
  requireScope('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    assertTestReceiverAvailable();
    requireWebhookManager(req.user!);

    testWebhookReceived.length = 0;
    res.json(buildTestWebhookLogsClearedResponse());
  }),
);

// ================================
// PROTECTED ENDPOINTS - Require authentication
// ================================
router.use(requireAuth);
router.use(requireScope('admin'));

// GET /api/webhooks - List webhook configurations for the company
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    requireWebhookManager(user);

    const configs = await prisma.webhookConfig.findMany({
      where: { companyId: user.companyId! },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      buildWebhookConfigsResponse(
        configs.map((config) => toPublicWebhookConfig(toWebhookConfig(config))),
      ),
    );
  }),
);

// POST /api/webhooks - Create webhook configuration
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    requireWebhookManager(user);

    const { url, events } = req.body;
    const webhookUrl = normalizeWebhookUrl(url);
    await assertWebhookDestinationResolvesPublicly(webhookUrl);

    const eventList = normalizeEvents(events);
    const secret = crypto.randomBytes(32).toString('hex');
    const config = toWebhookConfig(
      await prisma.webhookConfig.create({
        data: {
          companyId: user.companyId!,
          url: webhookUrl,
          secret: encryptWebhookSecret(secret),
          events: serializeEvents(eventList),
          enabled: true,
          createdById: user.id,
        },
      }),
    );
    await createAuditLog({
      userId: user.id,
      entityType: 'webhook',
      entityId: config.id,
      action: AuditAction.WEBHOOK_CREATED,
      changes: getWebhookAuditSnapshot(config),
      req,
    });

    res.status(201).json(buildWebhookCreatedResponse(config));
  }),
);

// GET /api/webhooks/:id - Get specific webhook config
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseWebhookRouteId(req.params.id);
    const user = req.user!;
    requireWebhookManager(user);

    const config = await getWebhookConfig(id);
    if (!config) {
      throw AppError.notFound('Webhook not found');
    }

    if (config.companyId !== user.companyId) {
      throw AppError.forbidden('Access denied');
    }

    res.json(toPublicWebhookConfig(config));
  }),
);

// PATCH /api/webhooks/:id - Update webhook config
router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseWebhookRouteId(req.params.id);
    const user = req.user!;
    requireWebhookManager(user);
    const { url, events, enabled } = req.body;

    const config = await getWebhookConfig(id);
    if (!config) {
      throw AppError.notFound('Webhook not found');
    }

    if (config.companyId !== user.companyId) {
      throw AppError.forbidden('Access denied');
    }

    const data: Prisma.WebhookConfigUpdateInput = {};

    // Update allowed fields
    if (url !== undefined) {
      const webhookUrl = normalizeWebhookUrl(url);
      await assertWebhookDestinationResolvesPublicly(webhookUrl);
      data.url = webhookUrl;
    }
    if (events !== undefined) {
      data.events = serializeEvents(normalizeEvents(events));
    }
    if (enabled !== undefined) {
      if (typeof enabled !== 'boolean') {
        throw AppError.badRequest('enabled must be a boolean');
      }
      data.enabled = enabled;
    }

    const updatedConfig = toWebhookConfig(
      await prisma.webhookConfig.update({
        where: { id },
        data,
      }),
    );
    const auditChanges = buildWebhookUpdateAuditChanges(config, updatedConfig);
    if (Object.keys(auditChanges).length > 0) {
      await createAuditLog({
        userId: user.id,
        entityType: 'webhook',
        entityId: updatedConfig.id,
        action: AuditAction.WEBHOOK_UPDATED,
        changes: auditChanges,
        req,
      });
    }

    res.json(toPublicWebhookConfig(updatedConfig));
  }),
);

// DELETE /api/webhooks/:id - Delete webhook config
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseWebhookRouteId(req.params.id);
    const user = req.user!;
    requireWebhookManager(user);

    const config = await getWebhookConfig(id);
    if (!config) {
      throw AppError.notFound('Webhook not found');
    }

    if (config.companyId !== user.companyId) {
      throw AppError.forbidden('Access denied');
    }

    await prisma.webhookConfig.delete({ where: { id } });
    await createAuditLog({
      userId: user.id,
      entityType: 'webhook',
      entityId: config.id,
      action: AuditAction.WEBHOOK_DELETED,
      changes: getWebhookAuditSnapshot(config),
      req,
    });

    res.status(204).send();
  }),
);

// POST /api/webhooks/:id/regenerate-secret - Regenerate webhook secret
//
// Intentionally does NOT decrypt the existing secret: regenerating is the
// recovery path when ENCRYPTION_KEY has been rotated and the stored
// ciphertext can no longer be authenticated. We only need the row's
// companyId for authorization before overwriting.
router.post(
  '/:id/regenerate-secret',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseWebhookRouteId(req.params.id);
    const user = req.user!;
    requireWebhookManager(user);

    const record = await prisma.webhookConfig.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    });
    if (!record) {
      throw AppError.notFound('Webhook not found');
    }

    if (record.companyId !== user.companyId) {
      throw AppError.forbidden('Access denied');
    }

    const secret = crypto.randomBytes(32).toString('hex');
    await prisma.webhookConfig.update({
      where: { id },
      data: { secret: encryptWebhookSecret(secret) },
    });
    await createAuditLog({
      userId: user.id,
      entityType: 'webhook',
      entityId: record.id,
      action: AuditAction.WEBHOOK_SECRET_REGENERATED,
      changes: { regenerated: true },
      req,
    });

    res.json(buildWebhookSecretRegeneratedResponse(record.id, secret));
  }),
);

// GET /api/webhooks/:id/deliveries - Get delivery history for a webhook
router.get(
  '/:id/deliveries',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseWebhookRouteId(req.params.id);
    const { limit } = req.query;
    const user = req.user!;
    requireWebhookManager(user);

    const config = await getWebhookConfig(id);
    if (!config) {
      throw AppError.notFound('Webhook not found');
    }

    if (config.companyId !== user.companyId) {
      throw AppError.forbidden('Access denied');
    }

    const take = parseLimit(limit, 20);
    const [deliveries, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where: { webhookId: id },
        orderBy: { deliveredAt: 'desc' },
        take,
      }),
      prisma.webhookDelivery.count({ where: { webhookId: id } }),
    ]);

    res.json(buildWebhookDeliveriesResponse(deliveries, total));
  }),
);

// POST /api/webhooks/:id/test - Send test webhook
router.post(
  '/:id/test',
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseWebhookRouteId(req.params.id);
    const user = req.user!;
    requireWebhookManager(user);

    const config = await getWebhookConfig(id);
    if (!config) {
      throw AppError.notFound('Webhook not found');
    }

    if (config.companyId !== user.companyId) {
      throw AppError.forbidden('Access denied');
    }

    // Create test payload
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        triggeredBy: user.email,
      },
    };

    // Deliver the webhook
    const delivery = await deliverWebhook(config, 'test', testPayload);

    res.json(buildWebhookTestDeliveryResponse(delivery));
  }),
);

// ================================
// WEBHOOK DELIVERY FUNCTION (exported for use by other routes)
// ================================
export async function deliverWebhook(
  config: WebhookConfig,
  event: string,
  data: unknown,
): Promise<WebhookDelivery> {
  const deliveryId = crypto.randomUUID();
  const payload = JSON.stringify({
    id: deliveryId,
    event,
    timestamp: new Date().toISOString(),
    data,
  });

  const signature = generateSignature(payload, config.secret);

  const delivery: WebhookDelivery = {
    id: deliveryId,
    webhookId: config.id,
    event,
    payload: JSON.parse(payload) as Prisma.JsonValue,
    responseStatus: null,
    responseBody: null,
    error: null,
    deliveredAt: new Date(),
    success: false,
  };

  let deliveryUrl: string;
  try {
    deliveryUrl = normalizeWebhookUrl(config.url);
    await assertWebhookDestinationResolvesPublicly(deliveryUrl);
  } catch (error: unknown) {
    delivery.error = error instanceof Error ? error.message : 'Invalid webhook URL';
    await recordWebhookDelivery(delivery);
    return delivery;
  }

  const timeoutMs = getWebhookDeliveryTimeoutMs();
  const maxAttempts = getWebhookDeliveryMaxAttempts();
  const retryDelayMs = getWebhookDeliveryRetryDelayMs();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const response = await fetch(deliveryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
          'X-Webhook-ID': deliveryId,
        },
        body: payload,
        redirect: 'error',
        signal: abortController.signal,
      });

      delivery.responseStatus = response.status;
      delivery.responseBody = toResponseBodyPreview(await response.text());
      delivery.error = null;
      delivery.success = response.status >= 200 && response.status < 300;

      if (
        delivery.success ||
        !shouldRetryWebhookStatus(response.status) ||
        attempt === maxAttempts
      ) {
        break;
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        delivery.error = `Webhook delivery timed out after ${timeoutMs}ms`;
      } else {
        delivery.error = error instanceof Error ? error.message : 'Unknown error';
      }
      delivery.success = false;

      if (attempt === maxAttempts) {
        logError(
          `[Webhook Delivery] ${event} -> ${sanitizeWebhookUrlForLog(config.url)}: ERROR - ${delivery.error}`,
        );
        break;
      }
    } finally {
      clearTimeout(timeout);
    }

    await waitForRetryDelay(retryDelayMs);
  }

  await recordWebhookDelivery(delivery);
  return delivery;
}

// ================================
// HELPER: Trigger webhooks for an event
// ================================
export async function triggerWebhooks(
  companyId: string,
  event: string,
  data: unknown,
): Promise<void> {
  const configs = await prisma.webhookConfig.findMany({
    where: { companyId, enabled: true },
  });

  for (const record of configs) {
    const config = toWebhookConfig(record);
    if (!config.events.includes('*') && !config.events.includes(event)) {
      continue;
    }

    // Fire and forget - don't block the main request
    deliverWebhook(config, event, data).catch((err) => {
      logError(
        `[Webhook] Failed to deliver ${event} to ${sanitizeWebhookUrlForLog(config.url)}:`,
        err,
      );
    });
  }
}

export { generateSignature, verifySignature };
export default router;
