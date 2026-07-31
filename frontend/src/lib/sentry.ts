// Sentry error monitoring for the frontend (React).
// Initialized once before render (see main.tsx). When VITE_SENTRY_DSN is unset
// this is a safe no-op — the browser app never crashes for a missing DSN.
// Production builds enforce VITE_SENTRY_DSN at build time (see vite.config.ts).
import * as Sentry from '@sentry/react';
import { redactSensitiveText, redactUrl } from './logger';

// Breadcrumb data keys holding a URL: `url` for fetch/xhr, `from`/`to` for
// navigation breadcrumbs (which is where an hp-release token would land).
const BREADCRUMB_URL_KEYS = ['url', 'from', 'to'];

/** Scrub secrets out of an outbound event. Mirrors the backend beforeSend. */
export function scrubSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.message) {
    event.message = redactSensitiveText(event.message);
  }

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = redactSensitiveText(exception.value);
    }
  }

  if (typeof event.request?.url === 'string') {
    event.request.url = redactUrl(event.request.url);
  }

  if (event.breadcrumbs) {
    // beforeBreadcrumb covers SDK-recorded crumbs; this covers crumbs attached
    // straight onto an event, which never pass through that hook.
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => scrubSentryBreadcrumb(breadcrumb));
  }

  return event;
}

/**
 * Scrub a single breadcrumb. The browser SDK auto-records navigation, fetch and
 * xhr breadcrumbs with full URLs, so without this a public hold-point release
 * token (carried in the path) would reach Sentry unredacted.
 */
export function scrubSentryBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb {
  if (breadcrumb.message) {
    breadcrumb.message = redactSensitiveText(breadcrumb.message);
  }

  if (breadcrumb.data) {
    for (const [key, value] of Object.entries(breadcrumb.data)) {
      if (typeof value !== 'string') {
        continue;
      }
      breadcrumb.data[key] = BREADCRUMB_URL_KEYS.includes(key)
        ? redactUrl(value)
        : redactSensitiveText(value);
    }
  }

  return breadcrumb;
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE?.trim() || undefined,
    // Conservative for launch: capture errors only, no tracing/replay sampling.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: (event) => scrubSentryEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubSentryBreadcrumb(breadcrumb),
  });
}
