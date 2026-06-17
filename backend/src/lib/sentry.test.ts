import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/node';
import { captureServerError, isSentryEnabled, scrubSentryEvent } from './sentry.js';

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
