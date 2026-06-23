import { describe, expect, it } from 'vitest';
import {
  describeWebhookStatus,
  formatWebhookEvents,
  summarizeWebhookTest,
} from './companyWebhooksData';

describe('formatWebhookEvents', () => {
  it('summarises the wildcard subscription as all events', () => {
    expect(formatWebhookEvents(['*'])).toBe('All events');
  });

  it('lists specific events', () => {
    expect(formatWebhookEvents(['ncr.raised', 'lot.conformed'])).toBe('ncr.raised, lot.conformed');
  });

  it('handles an empty or missing subscription', () => {
    expect(formatWebhookEvents([])).toBe('No events');
    expect(formatWebhookEvents(undefined)).toBe('No events');
  });
});

describe('describeWebhookStatus', () => {
  it('labels enabled and disabled webhooks', () => {
    expect(describeWebhookStatus(true)).toBe('Enabled');
    expect(describeWebhookStatus(false)).toBe('Disabled');
  });
});

describe('summarizeWebhookTest', () => {
  it('reports a successful delivery with the status code', () => {
    expect(
      summarizeWebhookTest({
        success: true,
        deliveryId: 'd1',
        responseStatus: 200,
        responseBody: null,
        error: null,
      }),
    ).toBe('Test delivered (HTTP 200)');
  });

  it('reports a failure with the error message', () => {
    expect(
      summarizeWebhookTest({
        success: false,
        deliveryId: 'd2',
        responseStatus: null,
        responseBody: null,
        error: 'Connection refused',
      }),
    ).toBe('Test failed: Connection refused');
  });
});
