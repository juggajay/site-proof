// Feature #746: Webhook external integration
import { Router, Request, Response } from 'express';
import type { IncomingHttpHeaders } from 'http';
import type { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireScope } from './apiKeys.js';
import crypto from 'crypto';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AuditAction, createAuditLog } from '../lib/auditLog.js';
import { prisma } from '../lib/prisma.js';
import { encrypt } from '../lib/encryption.js';
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
  parseWebhookRouteId,
  serializeEvents,
} from './webhooks/validation.js';
import {
  clearWebhookStores,
  deliverWebhook,
  generateSignature,
  getWebhookConfig,
  getWebhookConfigMetadata,
  sanitizeWebhookUrlForLog,
  toPublicWebhookConfig,
  toWebhookConfig,
  toWebhookConfigMetadata,
  triggerWebhooks,
  verifySignature,
} from './webhooks/delivery.js';
import type { WebhookConfigMetadata } from './webhooks/delivery.js';

const router = Router();
const WEBHOOK_MANAGER_ROLES = ['owner', 'admin'];

type AuthUser = NonNullable<Express.Request['user']>;

// Test endpoint to receive webhooks (for internal testing)
const testWebhookReceived: Array<{
  id: string;
  timestamp: Date;
  headers: IncomingHttpHeaders;
  body: unknown;
  signature: string | null;
}> = [];

function encryptWebhookSecret(secret: string): string {
  return encrypt(secret);
}

function getWebhookAuditSnapshot(
  config: Pick<WebhookConfigMetadata, 'url' | 'events' | 'enabled'>,
) {
  return {
    url: sanitizeWebhookUrlForLog(config.url),
    events: config.events,
    enabled: config.enabled,
  };
}

function buildWebhookUpdateAuditChanges(
  before: WebhookConfigMetadata,
  after: WebhookConfigMetadata,
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
        configs.map((config) => toPublicWebhookConfig(toWebhookConfigMetadata(config))),
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

    const config = await getWebhookConfigMetadata(id);
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

    const config = await getWebhookConfigMetadata(id);
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

    const updatedConfig = toWebhookConfigMetadata(
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

    const config = await getWebhookConfigMetadata(id);
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

    const config = await getWebhookConfigMetadata(id);
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

export {
  clearWebhookStores,
  deliverWebhook,
  generateSignature,
  sanitizeWebhookUrlForLog,
  triggerWebhooks,
  verifySignature,
};
export default router;
