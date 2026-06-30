import { promises as dns } from 'node:dns';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deliverWebhook,
  generateSignature,
  sanitizeWebhookUrlForLog,
  toPublicWebhookConfig,
  verifySignature,
  type WebhookConfig,
} from './delivery.js';

const prismaMock = vi.hoisted(() => ({
  webhookDelivery: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  webhookConfig: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../../lib/serverLogger.js', () => ({ logError: vi.fn() }));

const originalNodeEnv = process.env.NODE_ENV;

function makeWebhookConfig(url = 'https://hooks.example.com/webhook'): WebhookConfig {
  return {
    id: 'webhook-1',
    companyId: 'company-1',
    url,
    secret: 'plain-secret',
    events: ['*'],
    enabled: true,
    createdAt: new Date('2026-06-06T00:00:00.000Z'),
    updatedAt: new Date('2026-06-06T00:00:00.000Z'),
    createdById: 'user-1',
  };
}

beforeEach(() => {
  prismaMock.webhookDelivery.create.mockResolvedValue({});
  prismaMock.webhookDelivery.findMany.mockResolvedValue([]);
  prismaMock.webhookDelivery.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.webhookDelivery.update.mockResolvedValue({});
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('webhook delivery helpers', () => {
  it('generates and verifies matching webhook signatures', () => {
    const payload = JSON.stringify({ event: 'lot.updated', data: { lotId: 'lot-1' } });
    const signature = generateSignature(payload, 'webhook-secret');

    expect(verifySignature(payload, signature, 'webhook-secret')).toBe(true);
    expect(verifySignature(payload, signature, 'different-secret')).toBe(false);
  });

  it('rejects malformed signature lengths without throwing', () => {
    expect(verifySignature('{"event":"test"}', 'short', 'webhook-secret')).toBe(false);
  });

  it('redacts webhook URL query values for logs', () => {
    expect(
      sanitizeWebhookUrlForLog('https://example.com/hooks/path?sig=abc&tenant=siteproof'),
    ).toBe('https://example.com/hooks/path?sig=[REDACTED]&tenant=[REDACTED]');
  });

  it('masks webhook secrets unless explicitly included', () => {
    const config = {
      id: 'webhook-1',
      companyId: 'company-1',
      url: 'https://example.com/webhook',
      secret: 'plain-secret',
      events: ['lot.updated'],
      enabled: true,
      createdAt: new Date('2026-06-06T00:00:00.000Z'),
      updatedAt: new Date('2026-06-06T00:00:00.000Z'),
      createdById: 'user-1',
    };

    expect(toPublicWebhookConfig(config)).toMatchObject({ secret: '****' });
    expect(toPublicWebhookConfig(config, true)).toMatchObject({ secret: 'plain-secret' });
  });

  it('blocks production delivery when DNS rebinds to a private address after validation', async () => {
    process.env.NODE_ENV = 'production';
    const lookupSpy = vi
      .spyOn(dns, 'lookup')
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }] as never)
      .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }] as never);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('accepted', { status: 200 }));

    const delivery = await deliverWebhook(makeWebhookConfig(), 'lot.updated', { lotId: 'lot-1' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(delivery.success).toBe(false);
    expect(delivery.error).toContain('resolved to a private address');
    expect(lookupSpy).toHaveBeenCalledTimes(2);
    expect(prismaMock.webhookDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          error: 'Delivery started but no final response has been recorded',
          success: false,
        }),
      }),
    );
    expect(prismaMock.webhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: delivery.id },
        data: expect.objectContaining({
          error: expect.stringContaining('resolved to a private address'),
          success: false,
        }),
      }),
    );
  });

  it('creates a visible pending delivery before sending and redacts sensitive response text', async () => {
    process.env.NODE_ENV = 'test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('token=receiver-secret&ok=true', { status: 200 }),
    );

    const delivery = await deliverWebhook(makeWebhookConfig(), 'lot.updated', { lotId: 'lot-1' });

    expect(delivery.success).toBe(true);
    expect(prismaMock.webhookDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: delivery.id,
          error: 'Delivery started but no final response has been recorded',
          success: false,
        }),
      }),
    );
    expect(prismaMock.webhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: delivery.id },
        data: expect.objectContaining({
          responseStatus: 200,
          responseBody: 'token=[REDACTED]&ok=true',
          error: null,
          success: true,
        }),
      }),
    );
  });
});
