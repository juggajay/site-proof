import { describe, expect, it } from 'vitest';
import type { Breadcrumb, ErrorEvent } from '@sentry/node';
import {
  captureServerError,
  isSentryEnabled,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from './sentry.js';

const RELEASE_TOKEN = 'sha256:abcdef0123456789';

describe('scrubSentryEvent', () => {
  it('redacts secrets in the event message', () => {
    const event = {
      message: 'Boom token=reset_secret using Bearer jwt_secret',
    } as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.message).toContain('token=[REDACTED]');
    expect(scrubbed.message).toContain('Bearer [REDACTED]');
    expect(scrubbed.message).not.toContain('reset_secret');
    expect(scrubbed.message).not.toContain('jwt_secret');
  });

  it('redacts secrets in exception values', () => {
    const event = {
      exception: { values: [{ type: 'Error', value: 'Database exploded token=db_secret' }] },
    } as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.exception?.values?.[0]?.value).toContain('token=[REDACTED]');
    expect(JSON.stringify(scrubbed)).not.toContain('db_secret');
  });

  it('drops cookies and auth headers from forwarded request data', () => {
    const event = {
      request: {
        cookies: { session: 'abc' },
        headers: {
          cookie: 'session=abc',
          authorization: 'Bearer xyz',
          'user-agent': 'vitest',
        },
      },
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.headers?.cookie).toBeUndefined();
    expect(scrubbed.request?.headers?.authorization).toBeUndefined();
    expect(scrubbed.request?.headers?.['user-agent']).toBe('vitest');
  });

  it('redacts the request url', () => {
    const event = {
      request: { url: `https://api.civos.com.au/api/holdpoints/public/${RELEASE_TOKEN}?sig=abc` },
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request?.url).toBe(
      'https://api.civos.com.au/api/holdpoints/public/[REDACTED]?sig=[REDACTED]',
    );
    expect(JSON.stringify(scrubbed)).not.toContain(RELEASE_TOKEN);
  });

  it('scrubs breadcrumbs attached directly to the event', () => {
    const event = {
      breadcrumbs: [
        { category: 'http', data: { url: `https://api.civos.com.au/hp-release/${RELEASE_TOKEN}` } },
      ],
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.breadcrumbs?.[0]?.data?.url).toBe(
      'https://api.civos.com.au/hp-release/[REDACTED]',
    );
    expect(JSON.stringify(scrubbed)).not.toContain(RELEASE_TOKEN);
  });
});

describe('scrubSentryBreadcrumb', () => {
  it('redacts a release token carried in the breadcrumb url path', () => {
    const breadcrumb = scrubSentryBreadcrumb({
      category: 'http',
      data: { url: `https://api.civos.com.au/api/holdpoints/public/batch/${RELEASE_TOKEN}` },
    } as Breadcrumb);

    expect(breadcrumb.data?.url).toBe(
      'https://api.civos.com.au/api/holdpoints/public/batch/[REDACTED]',
    );
  });

  it('redacts every query string value, not just sensitive keys', () => {
    const breadcrumb = scrubSentryBreadcrumb({
      category: 'fetch',
      data: { url: 'https://api.civos.com.au/api/lots?token=abc123&email=bob@example.com' },
    } as Breadcrumb);

    expect(breadcrumb.data?.url).toBe(
      'https://api.civos.com.au/api/lots?token=[REDACTED]&email=[REDACTED]',
    );
    expect(JSON.stringify(breadcrumb)).not.toContain('abc123');
    expect(JSON.stringify(breadcrumb)).not.toContain('bob@example.com');
  });

  it('redacts secrets in the breadcrumb message and other data fields', () => {
    const breadcrumb = scrubSentryBreadcrumb({
      category: 'console',
      message: 'auth failed with Bearer jwt_secret',
      data: { note: 'token=leaky_secret', status: 500 },
    } as Breadcrumb);

    expect(breadcrumb.message).toBe('auth failed with Bearer [REDACTED]');
    expect(breadcrumb.data?.note).toBe('token=[REDACTED]');
    expect(breadcrumb.data?.status).toBe(500);
  });

  it('leaves an ordinary breadcrumb untouched', () => {
    const breadcrumb = scrubSentryBreadcrumb({
      category: 'navigation',
      message: 'Opened lot list',
      data: { from: '/lots', to: '/lots/42' },
    } as Breadcrumb);

    expect(breadcrumb.message).toBe('Opened lot list');
    expect(breadcrumb.data?.from).toBe('/lots');
    expect(breadcrumb.data?.to).toBe('/lots/42');
  });
});

describe('captureServerError', () => {
  it('is a no-op and does not throw when Sentry is not configured', () => {
    expect(isSentryEnabled()).toBe(false);
    expect(() =>
      captureServerError(new Error('boom'), {
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        request: { method: 'GET', path: '/api/example', query: {}, authenticated: false },
      }),
    ).not.toThrow();
  });
});
