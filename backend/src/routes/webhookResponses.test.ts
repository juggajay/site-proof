import { describe, expect, it } from 'vitest';
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

describe('webhookResponses', () => {
  it('builds test receiver responses', () => {
    const timestamp = new Date('2026-06-01T00:00:00.000Z');
    const logs = [{ id: 'log-1' }, { id: 'log-2' }];

    expect(buildTestWebhookReceivedResponse({ id: 'log-1', timestamp })).toEqual({
      received: true,
      id: 'log-1',
      timestamp: '2026-06-01T00:00:00.000Z',
    });
    expect(buildTestWebhookLogsResponse(logs, 12)).toEqual({
      logs,
      total: 12,
      message: 'Showing last 2 received webhooks',
    });
    expect(buildTestWebhookLogsClearedResponse()).toEqual({
      message: 'Test webhook logs cleared',
    });
  });

  it('builds webhook config list and create responses', () => {
    const webhooks = [{ id: 'webhook-1', secret: '****' }];
    const createdAt = new Date('2026-06-01T01:00:00.000Z');

    expect(buildWebhookConfigsResponse(webhooks)).toEqual({ webhooks });
    expect(
      buildWebhookCreatedResponse({
        id: 'webhook-1',
        url: 'https://example.test/webhook',
        secret: 'fake-secret',
        events: ['lot.created'],
        enabled: true,
        createdAt,
      }),
    ).toEqual({
      id: 'webhook-1',
      url: 'https://example.test/webhook',
      secret: 'fake-secret',
      events: ['lot.created'],
      enabled: true,
      createdAt: '2026-06-01T01:00:00.000Z',
      message: 'Webhook configured successfully. Save the secret - it will not be shown again.',
    });
  });

  it('builds webhook secret, delivery list, and test delivery responses', () => {
    const deliveries = [{ id: 'delivery-1' }];
    const delivery = {
      id: 'delivery-1',
      success: false,
      responseStatus: 500,
      responseBody: 'error',
      error: 'Failed',
    };

    expect(buildWebhookSecretRegeneratedResponse('webhook-1', 'fake-secret')).toEqual({
      id: 'webhook-1',
      secret: 'fake-secret',
      message: 'Secret regenerated. Save the new secret - it will not be shown again.',
    });
    expect(buildWebhookDeliveriesResponse(deliveries, 7)).toEqual({
      deliveries,
      total: 7,
    });
    expect(buildWebhookTestDeliveryResponse(delivery)).toEqual({
      success: false,
      deliveryId: 'delivery-1',
      responseStatus: 500,
      responseBody: 'error',
      error: 'Failed',
    });
  });
});
