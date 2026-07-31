import { describe, expect, it } from 'vitest';
import type { Breadcrumb, ErrorEvent } from '@sentry/react';

import { scrubSentryBreadcrumb, scrubSentryEvent } from './sentry';

const RELEASE_TOKEN = 'sha256:abcdef0123456789';

describe('scrubSentryBreadcrumb', () => {
  it('redacts a release token carried in the breadcrumb url path', () => {
    const breadcrumb = scrubSentryBreadcrumb({
      category: 'fetch',
      data: { url: `https://api.civos.com.au/api/holdpoints/public/${RELEASE_TOKEN}` },
    } as Breadcrumb);

    expect(breadcrumb.data?.url).toBe('https://api.civos.com.au/api/holdpoints/public/[redacted]');
  });

  it('redacts a release token in a navigation breadcrumb', () => {
    const breadcrumb = scrubSentryBreadcrumb({
      category: 'navigation',
      data: { from: '/lots', to: `/hp-release/batch/${RELEASE_TOKEN}` },
    } as Breadcrumb);

    expect(breadcrumb.data?.from).toBe('/lots');
    expect(breadcrumb.data?.to).toBe('/hp-release/batch/[redacted]');
  });

  it('redacts every query string value, not just sensitive keys', () => {
    const breadcrumb = scrubSentryBreadcrumb({
      category: 'fetch',
      data: { url: 'https://api.civos.com.au/api/lots?token=abc123&email=bob@example.com' },
    } as Breadcrumb);

    expect(breadcrumb.data?.url).toBe(
      'https://api.civos.com.au/api/lots?token=[redacted]&email=[redacted]',
    );
    expect(JSON.stringify(breadcrumb)).not.toContain('abc123');
    expect(JSON.stringify(breadcrumb)).not.toContain('bob@example.com');
  });

  it('redacts secrets in the breadcrumb message and non-url data fields', () => {
    const breadcrumb = scrubSentryBreadcrumb({
      category: 'console',
      message: 'auth failed with Bearer jwt_secret',
      data: { note: 'token=leaky_secret', status: 500 },
    } as Breadcrumb);

    expect(breadcrumb.message).toBe('auth failed with Bearer [redacted]');
    expect(breadcrumb.data?.note).toBe('token=[redacted]');
    expect(breadcrumb.data?.status).toBe(500);
  });

  it('leaves an ordinary page-view breadcrumb untouched', () => {
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

describe('scrubSentryEvent', () => {
  it('redacts secrets in the message and exception values', () => {
    const event = scrubSentryEvent({
      message: 'Boom token=reset_secret using Bearer jwt_secret',
      exception: { values: [{ type: 'Error', value: `failed at /hp-release/${RELEASE_TOKEN}` }] },
    } as ErrorEvent);

    expect(event.message).toContain('token=[redacted]');
    expect(event.message).toContain('Bearer [redacted]');
    expect(event.exception?.values?.[0]?.value).toBe('failed at /hp-release/[redacted]');
    expect(JSON.stringify(event)).not.toContain('jwt_secret');
    expect(JSON.stringify(event)).not.toContain(RELEASE_TOKEN);
  });

  it('redacts the request url', () => {
    const event = scrubSentryEvent({
      request: { url: `https://app.civos.com.au/hp-release/${RELEASE_TOKEN}?sig=abc` },
    } as ErrorEvent);

    expect(event.request?.url).toBe(
      'https://app.civos.com.au/hp-release/[redacted]?sig=[redacted]',
    );
  });

  it('scrubs breadcrumbs attached directly to the event', () => {
    const event = scrubSentryEvent({
      breadcrumbs: [
        {
          category: 'fetch',
          data: { url: `https://app.civos.com.au/hp-release/${RELEASE_TOKEN}` },
        },
      ],
    } as unknown as ErrorEvent);

    expect(event.breadcrumbs?.[0]?.data?.url).toBe(
      'https://app.civos.com.au/hp-release/[redacted]',
    );
    expect(JSON.stringify(event)).not.toContain(RELEASE_TOKEN);
  });
});
