// Feature #746: Webhook external integration
import { Router, Request, Response } from 'express';
import type { IncomingHttpHeaders } from 'http';
import { promises as dns } from 'node:dns';
import type { Prisma, WebhookConfig as WebhookConfigRecord } from '@prisma/client';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireScope } from './apiKeys.js';
import crypto from 'crypto';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { prisma } from '../lib/prisma.js';
import { decrypt, encrypt } from '../lib/encryption.js';
import { sanitizeUrlValueForLog } from '../lib/logSanitization.js';
import { logError } from '../lib/serverLogger.js';

const router = Router();
const WEBHOOK_MANAGER_ROLES = ['owner', 'admin'];
const LOCAL_WEBHOOK_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
const DEFAULT_WEBHOOK_DELIVERY_TIMEOUT_MS = 10000;
const MAX_WEBHOOK_DELIVERY_TIMEOUT_MS = 30000;
const MAX_WEBHOOK_RESPONSE_BODY_CHARS = 4096;
const MAX_WEBHOOK_URL_LENGTH = 2048;
const MAX_WEBHOOK_ID_LENGTH = 120;
const MAX_WEBHOOK_EVENTS = 50;
const MAX_WEBHOOK_EVENT_LENGTH = 100;
const WEBHOOK_EVENT_PATTERN = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)*$/i;

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

function parseLimit(value: unknown, defaultValue: number, maxValue = 100): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw AppError.badRequest('limit must be a positive integer');
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw AppError.badRequest('limit must be a positive integer');
  }

  return Math.min(parsed, maxValue);
}

function parseWebhookRouteId(value: unknown, fieldName = 'id'): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > MAX_WEBHOOK_ID_LENGTH) {
    throw AppError.badRequest(`${fieldName} must be ${MAX_WEBHOOK_ID_LENGTH} characters or less`);
  }

  return trimmed;
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

function toResponseBodyPreview(responseBody: string): string {
  if (responseBody.length <= MAX_WEBHOOK_RESPONSE_BODY_CHARS) {
    return responseBody;
  }

  return `${responseBody.slice(0, MAX_WEBHOOK_RESPONSE_BODY_CHARS)}... [truncated]`;
}

function parseStoredEvents(events: string): string[] {
  try {
    const parsed: unknown = JSON.parse(events);
    if (Array.isArray(parsed) && parsed.every((event) => typeof event === 'string')) {
      return parsed;
    }
  } catch {
    // Fall through to the safest subscription.
  }
  return ['*'];
}

function normalizeEvents(events: unknown): string[] {
  if (events === undefined) {
    return ['*'];
  }
  if (!Array.isArray(events)) {
    throw AppError.badRequest('events must be an array of strings');
  }
  const normalized = events
    .map((event) => (typeof event === 'string' ? event.trim() : ''))
    .filter(Boolean);

  if (normalized.length === 0) {
    throw AppError.badRequest('events must include at least one event name');
  }
  if (normalized.length > MAX_WEBHOOK_EVENTS) {
    throw AppError.badRequest(`events cannot include more than ${MAX_WEBHOOK_EVENTS} entries`);
  }
  if (
    normalized.some(
      (event) =>
        event !== '*' &&
        (event.length > MAX_WEBHOOK_EVENT_LENGTH || !WEBHOOK_EVENT_PATTERN.test(event)),
    )
  ) {
    throw AppError.badRequest('events contains an invalid event name');
  }

  return Array.from(new Set(normalized));
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number.parseInt(part, 10));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!normalized.includes(':')) {
    return false;
  }

  if (normalized.startsWith('::ffff:')) {
    return isPrivateIpv4(normalized.slice('::ffff:'.length));
  }

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff')
  );
}

function isPrivateWebhookHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    LOCAL_WEBHOOK_HOSTS.includes(normalized) ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    isPrivateIpv4(normalized) ||
    isPrivateIpv6(normalized)
  );
}

function normalizeWebhookUrl(value: unknown): string {
  if (!value || typeof value !== 'string') {
    throw AppError.badRequest('URL is required');
  }

  const trimmed = value.trim();
  if (trimmed.length > MAX_WEBHOOK_URL_LENGTH) {
    throw AppError.badRequest(`URL must be ${MAX_WEBHOOK_URL_LENGTH} characters or less`);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw AppError.badRequest('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw AppError.badRequest('Invalid URL protocol');
  }

  if (parsed.username || parsed.password) {
    throw AppError.badRequest('Webhook URL credentials are not allowed');
  }

  if (process.env.NODE_ENV === 'production') {
    if (parsed.protocol !== 'https:') {
      throw AppError.badRequest('Webhook URLs must use HTTPS in production');
    }
    if (isPrivateWebhookHost(parsed.hostname)) {
      throw AppError.badRequest('Webhook URL host is not allowed');
    }
  }

  return parsed.toString();
}

async function assertWebhookDestinationResolvesPublicly(webhookUrl: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const parsed = new URL(webhookUrl);
  if (isPrivateWebhookHost(parsed.hostname)) {
    throw AppError.badRequest('Webhook URL host is not allowed');
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
  } catch {
    throw AppError.badRequest('Webhook URL host could not be resolved');
  }

  if (addresses.some(({ address }) => isPrivateWebhookHost(address))) {
    throw AppError.badRequest('Webhook URL host resolved to a private address');
  }
}

function serializeEvents(events: string[]): string {
  return JSON.stringify(events);
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

  res.status(200).json({
    received: true,
    id: received.id,
    timestamp: received.timestamp.toISOString(),
  });
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

    res.json({
      logs,
      total: testWebhookReceived.length,
      message: `Showing last ${logs.length} received webhooks`,
    });
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
    res.json({ message: 'Test webhook logs cleared' });
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

    res.json({ webhooks: configs.map((config) => toPublicWebhookConfig(toWebhookConfig(config))) });
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

    res.status(201).json({
      id: config.id,
      url: config.url,
      secret: config.secret, // Return secret only on creation
      events: config.events,
      enabled: config.enabled,
      createdAt: config.createdAt.toISOString(),
      message: 'Webhook configured successfully. Save the secret - it will not be shown again.',
    });
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

    res.status(204).send();
  }),
);

// POST /api/webhooks/:id/regenerate-secret - Regenerate webhook secret
router.post(
  '/:id/regenerate-secret',
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

    const secret = crypto.randomBytes(32).toString('hex');
    const configWithNewSecret = toWebhookConfig(
      await prisma.webhookConfig.update({
        where: { id },
        data: { secret: encryptWebhookSecret(secret) },
      }),
    );

    res.json({
      id: configWithNewSecret.id,
      secret: configWithNewSecret.secret,
      message: 'Secret regenerated. Save the new secret - it will not be shown again.',
    });
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

    res.json({
      deliveries,
      total,
    });
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

    res.json({
      success: delivery.success,
      deliveryId: delivery.id,
      responseStatus: delivery.responseStatus,
      responseBody: delivery.responseBody,
      error: delivery.error,
    });
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
    delivery.success = response.status >= 200 && response.status < 300;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      delivery.error = `Webhook delivery timed out after ${timeoutMs}ms`;
    } else {
      delivery.error = error instanceof Error ? error.message : 'Unknown error';
    }
    delivery.success = false;
    logError(
      `[Webhook Delivery] ${event} -> ${sanitizeWebhookUrlForLog(config.url)}: ERROR - ${delivery.error}`,
    );
  } finally {
    clearTimeout(timeout);
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
