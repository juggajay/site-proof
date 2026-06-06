import { describe, expect, it } from 'vitest';
import {
  getSubscriptionId,
  isPrivatePushEndpointHost,
  parseEndpoint,
  parseNotificationUrl,
  parseOptionalData,
  parseOptionalSubscriptionId,
  parsePushSubscription,
  parseRequiredString,
} from './validation.js';

describe('push notification validation helpers', () => {
  it('normalizes allowed push endpoints and rejects unsafe endpoint hosts', () => {
    expect(parseEndpoint(' https://fcm.googleapis.com/fcm/send/abc ')).toBe(
      'https://fcm.googleapis.com/fcm/send/abc',
    );
    expect(parseEndpoint('https://web.push.apple.com/3/device/abc')).toBe(
      'https://web.push.apple.com/3/device/abc',
    );

    expect(() => parseEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toThrow(
      'Endpoint must be an HTTPS URL',
    );
    expect(() => parseEndpoint('https://user:pass@fcm.googleapis.com/fcm/send/abc')).toThrow(
      'Endpoint must not include credentials',
    );
    expect(() => parseEndpoint('https://localhost/fcm/send/abc')).toThrow(
      'Endpoint host is not allowed',
    );
    expect(() => parseEndpoint('https://example.com/fcm/send/abc')).toThrow(
      'Endpoint host is not allowed',
    );
  });

  it('detects private push endpoint hostnames', () => {
    expect(isPrivatePushEndpointHost('localhost')).toBe(true);
    expect(isPrivatePushEndpointHost('127.0.0.1')).toBe(true);
    expect(isPrivatePushEndpointHost('10.0.0.1')).toBe(true);
    expect(isPrivatePushEndpointHost('[::1]')).toBe(true);
    expect(isPrivatePushEndpointHost('fcm.googleapis.com')).toBe(false);
  });

  it('parses app-relative notification URLs only', () => {
    expect(parseNotificationUrl('/projects/p1/lots')).toBe('/projects/p1/lots');
    expect(parseNotificationUrl(undefined)).toBeUndefined();
    expect(() => parseNotificationUrl('https://example.com')).toThrow(
      'url must be an app-relative path',
    );
    expect(() => parseNotificationUrl('//example.com')).toThrow('url must be an app-relative path');
    expect(() => parseNotificationUrl('/bad\\path')).toThrow('url must be an app-relative path');
  });

  it('validates optional data shape and subscription ids', () => {
    expect(parseOptionalData({ lotId: 'lot-1', count: 1, flags: [true, null] })).toEqual({
      lotId: 'lot-1',
      count: 1,
      flags: [true, null],
    });
    expect(parseOptionalData(undefined)).toBeUndefined();
    expect(() => parseOptionalData(['bad'])).toThrow('data must be an object');
    const reservedKeyData = {};
    Object.defineProperty(reservedKeyData, '__proto__', { enumerable: true, value: 'bad' });
    expect(() => parseOptionalData(reservedKeyData)).toThrow('data contains a reserved key');
    expect(() => parseOptionalData({ bad: Number.NaN })).toThrow(
      'data must contain only finite numbers',
    );

    const id = 'A'.repeat(64);
    expect(parseOptionalSubscriptionId(id)).toBe(id.toLowerCase());
    expect(parseOptionalSubscriptionId('')).toBeUndefined();
    expect(() => parseOptionalSubscriptionId('not-valid')).toThrow(
      'subscriptionId must be a valid push subscription id',
    );
  });

  it('parses subscriptions and required strings', () => {
    expect(
      parsePushSubscription({
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        keys: { p256dh: ' key-1 ', auth: ' auth-1 ' },
      }),
    ).toEqual({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: { p256dh: 'key-1', auth: 'auth-1' },
    });
    expect(() => parsePushSubscription({ endpoint: '', keys: {} })).toThrow(
      'Invalid subscription object',
    );

    expect(parseRequiredString(' Title ', 'title', 120)).toBe('Title');
    expect(() => parseRequiredString('', 'title', 120)).toThrow('title is required');
    expect(getSubscriptionId('endpoint')).toMatch(/^[a-f0-9]{64}$/);
  });
});
