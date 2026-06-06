import { describe, expect, it } from 'vitest';

import {
  generateSignature,
  sanitizeWebhookUrlForLog,
  toPublicWebhookConfig,
  verifySignature,
} from './delivery.js';

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
});
