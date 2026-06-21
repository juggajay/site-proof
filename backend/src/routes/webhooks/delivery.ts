import crypto from 'crypto';
import type { Prisma, WebhookConfig as WebhookConfigRecord } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import { decrypt } from '../../lib/encryption.js';
import { sanitizeUrlValueForLog } from '../../lib/logSanitization.js';
import { logError } from '../../lib/serverLogger.js';
import {
  assertWebhookDestinationResolvesPublicly,
  normalizeWebhookUrl,
  parseStoredEvents,
} from './validation.js';

const DEFAULT_WEBHOOK_DELIVERY_TIMEOUT_MS = 10000;
const MAX_WEBHOOK_DELIVERY_TIMEOUT_MS = 30000;
const DEFAULT_WEBHOOK_DELIVERY_MAX_ATTEMPTS = 3;
const MAX_WEBHOOK_DELIVERY_MAX_ATTEMPTS = 5;
const DEFAULT_WEBHOOK_DELIVERY_RETRY_DELAY_MS = 250;
const MAX_WEBHOOK_DELIVERY_RETRY_DELAY_MS = 5000;
const MAX_WEBHOOK_RESPONSE_BODY_CHARS = 4096;

export interface WebhookConfig {
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

export type WebhookConfigMetadata = Omit<WebhookConfig, 'secret'>;

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

export function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifySignature(payload: string, signature: string, secret: string): boolean {
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

function decryptWebhookSecret(storedSecret: string): string {
  return decrypt(storedSecret);
}

export function toWebhookConfigMetadata(record: WebhookConfigRecord): WebhookConfigMetadata {
  return {
    id: record.id,
    companyId: record.companyId,
    url: record.url,
    events: parseStoredEvents(record.events),
    enabled: record.enabled,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdById: record.createdById,
  };
}

export function toWebhookConfig(record: WebhookConfigRecord): WebhookConfig {
  return {
    ...toWebhookConfigMetadata(record),
    secret: decryptWebhookSecret(record.secret),
  };
}

export function toPublicWebhookConfig(
  config: WebhookConfig | WebhookConfigMetadata,
  includeSecret = false,
) {
  return {
    ...config,
    secret: includeSecret && 'secret' in config ? config.secret : '****',
  };
}

export async function getWebhookConfig(id: string): Promise<WebhookConfig | null> {
  const record = await prisma.webhookConfig.findUnique({ where: { id } });
  return record ? toWebhookConfig(record) : null;
}

export async function getWebhookConfigMetadata(id: string): Promise<WebhookConfigMetadata | null> {
  const record = await prisma.webhookConfig.findUnique({ where: { id } });
  return record ? toWebhookConfigMetadata(record) : null;
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

    deliverWebhook(config, event, data).catch((err) => {
      logError(
        `[Webhook] Failed to deliver ${event} to ${sanitizeWebhookUrlForLog(config.url)}:`,
        err,
      );
    });
  }
}
