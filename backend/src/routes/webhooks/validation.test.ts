import { afterEach, describe, expect, it } from 'vitest';
import {
  normalizeEvents,
  normalizeWebhookUrl,
  parseLimit,
  parseStoredEvents,
  parseWebhookRouteId,
  serializeEvents,
} from './validation.js';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('webhook validation helpers', () => {
  describe('parseLimit', () => {
    it('defaults, clamps, and rejects invalid limits with the existing message', () => {
      expect(parseLimit(undefined, 10)).toBe(10);
      expect(parseLimit('', 10)).toBe(10);
      expect(parseLimit('500', 10, 100)).toBe(100);
      expect(parseLimit('25', 10)).toBe(25);
      expect(() => parseLimit('0', 10)).toThrow('limit must be a positive integer');
      expect(() => parseLimit('1.5', 10)).toThrow('limit must be a positive integer');
    });
  });

  describe('parseWebhookRouteId', () => {
    it('trims route ids and preserves existing validation messages', () => {
      expect(parseWebhookRouteId('  wh_123  ')).toBe('wh_123');
      expect(() => parseWebhookRouteId(undefined)).toThrow('id must be a string');
      expect(() => parseWebhookRouteId('   ')).toThrow('id is required');
      expect(() => parseWebhookRouteId('x'.repeat(121))).toThrow(
        'id must be 120 characters or less',
      );
    });
  });

  describe('events', () => {
    it('normalizes, deduplicates, serializes, and parses stored events', () => {
      const events = normalizeEvents([' lot.created ', 'lot.created', 'ncr.closed']);

      expect(events).toEqual(['lot.created', 'ncr.closed']);
      expect(serializeEvents(events)).toBe('["lot.created","ncr.closed"]');
      expect(parseStoredEvents(serializeEvents(events))).toEqual(events);
      expect(parseStoredEvents('not-json')).toEqual(['*']);
    });

    it('preserves existing event validation messages', () => {
      expect(normalizeEvents(undefined)).toEqual(['*']);
      expect(() => normalizeEvents('lot.created')).toThrow('events must be an array of strings');
      expect(() => normalizeEvents([])).toThrow('events must include at least one event name');
      expect(() => normalizeEvents(['bad event'])).toThrow('events contains an invalid event name');
      expect(() =>
        normalizeEvents(Array.from({ length: 51 }, (_, index) => `event.${index}`)),
      ).toThrow('events cannot include more than 50 entries');
    });
  });

  describe('normalizeWebhookUrl', () => {
    it('normalizes HTTP URLs outside production and rejects malformed or credentialed values', () => {
      process.env.NODE_ENV = 'test';

      expect(normalizeWebhookUrl(' https://example.com/hooks ')).toBe('https://example.com/hooks');
      expect(normalizeWebhookUrl('http://localhost/hooks')).toBe('http://localhost/hooks');
      expect(() => normalizeWebhookUrl(undefined)).toThrow('URL is required');
      expect(() => normalizeWebhookUrl('not-a-url')).toThrow('Invalid URL format');
      expect(() => normalizeWebhookUrl('ftp://example.com/hooks')).toThrow('Invalid URL protocol');
      expect(() => normalizeWebhookUrl('https://user:pass@example.com/hooks')).toThrow(
        'Webhook URL credentials are not allowed',
      );
    });

    it('requires HTTPS and public hosts in production', () => {
      process.env.NODE_ENV = 'production';

      expect(normalizeWebhookUrl('https://example.com/hooks')).toBe('https://example.com/hooks');
      expect(() => normalizeWebhookUrl('http://example.com/hooks')).toThrow(
        'Webhook URLs must use HTTPS in production',
      );
      expect(() => normalizeWebhookUrl('https://localhost/hooks')).toThrow(
        'Webhook URL host is not allowed',
      );
      expect(() => normalizeWebhookUrl('https://192.168.0.1/hooks')).toThrow(
        'Webhook URL host is not allowed',
      );
      expect(() => normalizeWebhookUrl('https://[::1]/hooks')).toThrow(
        'Webhook URL host is not allowed',
      );
    });
  });
});
