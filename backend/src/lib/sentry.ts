// Sentry error monitoring for the backend (Express).
// Initialized once at startup (see index.ts). When SENTRY_DSN is unset
// (local/dev/test) every export here is a safe no-op.
import * as Sentry from '@sentry/node';
import { sanitizeLogText, sanitizeLogValue, sanitizeUrlValueForLog } from './logSanitization.js';

// Breadcrumb data keys that hold a URL. `url` is used by the http/fetch
// instrumentation, `from`/`to` by navigation breadcrumbs. These get the
// URL-aware scrubber (redacts every query value, not just sensitive keys).
const BREADCRUMB_URL_KEYS = ['url', 'from', 'to'];

let sentryEnabled = false;

function parseSampleRate(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }
  return parsed;
}

function getEnvironment(): string {
  return process.env.SENTRY_ENVIRONMENT?.trim() || process.env.NODE_ENV || 'development';
}

function getRelease(): string | undefined {
  return (
    process.env.SENTRY_RELEASE?.trim() ||
    process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
    process.env.SOURCE_VERSION?.trim() ||
    undefined
  );
}

/**
 * Scrub a single breadcrumb. Node's HTTP auto-instrumentation records request
 * URLs here, so without this the public hold-point release tokens (which ride
 * in the path) and any query string would reach Sentry unredacted.
 */
export function scrubSentryBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb {
  if (breadcrumb.message) {
    breadcrumb.message = sanitizeLogText(breadcrumb.message);
  }

  if (breadcrumb.data) {
    const data = sanitizeLogValue(breadcrumb.data) as Record<string, unknown>;
    for (const key of BREADCRUMB_URL_KEYS) {
      if (typeof data[key] === 'string') {
        data[key] = sanitizeUrlValueForLog(data[key] as string);
      }
    }
    breadcrumb.data = data;
  }

  return breadcrumb;
}

function scrubSentryRequest(request: NonNullable<Sentry.ErrorEvent['request']>): void {
  if (typeof request.url === 'string') {
    request.url = sanitizeUrlValueForLog(request.url);
  }
  if (typeof request.query_string === 'string') {
    request.query_string = sanitizeLogText(request.query_string);
  }
  if (request.data) {
    request.data = sanitizeLogValue(request.data);
  }
  // Never forward cookies or auth headers to a third party.
  delete request.cookies;
  if (request.headers) {
    delete request.headers.cookie;
    delete request.headers.authorization;
    delete request.headers.Authorization;
  }
}

/**
 * Scrub secrets out of outbound Sentry events. The previous webhook approach
 * sanitized every payload before forwarding; we preserve that guarantee here so
 * tokens/credentials that surface in error messages are never sent to Sentry.
 */
export function scrubSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.breadcrumbs) {
    // beforeBreadcrumb covers SDK-recorded crumbs; this covers crumbs attached
    // straight onto an event, which never pass through that hook.
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => scrubSentryBreadcrumb(breadcrumb));
  }

  if (event.message) {
    event.message = sanitizeLogText(event.message);
  }

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = sanitizeLogText(exception.value);
    }
  }

  if (event.extra) {
    event.extra = sanitizeLogValue(event.extra) as Record<string, unknown>;
  }

  if (event.request) {
    scrubSentryRequest(event.request);
  }

  return event;
}

export function initSentry(): void {
  if (sentryEnabled) {
    return;
  }

  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    // Optional outside production; production startup is gated separately in
    // runtimeConfig.validateRuntimeConfig().
    return;
  }

  Sentry.init({
    dsn,
    environment: getEnvironment(),
    release: getRelease(),
    // Conservative for launch: errors only by default, no perf sampling.
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0),
    sendDefaultPii: false,
    beforeSend: (event) => scrubSentryEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubSentryBreadcrumb(breadcrumb),
  });

  sentryEnabled = true;
}

export function isSentryEnabled(): boolean {
  return sentryEnabled;
}

export interface ServerErrorContext {
  code: string;
  statusCode: number;
  request: {
    method: string;
    path: string;
    query: Record<string, unknown>;
    requestId?: unknown;
    authenticated: boolean;
  };
}

/**
 * Report a server-side (5xx) error to Sentry with sanitized request context.
 * No-op when Sentry is not configured.
 */
export function captureServerError(error: unknown, context: ServerErrorContext): void {
  if (!sentryEnabled) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel('error');
    scope.setTag('error_code', context.code);
    scope.setTag('status_code', String(context.statusCode));
    scope.setContext('request', {
      method: context.request.method,
      path: context.request.path,
      query: context.request.query,
      requestId: context.request.requestId ?? null,
      authenticated: context.request.authenticated,
    });
    Sentry.captureException(error);
  });
}
