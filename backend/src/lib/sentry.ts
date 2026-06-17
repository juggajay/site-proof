// Sentry error monitoring for the backend (Express).
// Initialized once at startup (see index.ts). When SENTRY_DSN is unset
// (local/dev/test) every export here is a safe no-op.
import * as Sentry from '@sentry/node';
import { sanitizeLogText, sanitizeLogValue } from './logSanitization.js';

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
 * Scrub secrets out of outbound Sentry events. The previous webhook approach
 * sanitized every payload before forwarding; we preserve that guarantee here so
 * tokens/credentials that surface in error messages are never sent to Sentry.
 */
export function scrubSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
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
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = sanitizeLogText(event.request.query_string);
    }
    if (event.request.data) {
      event.request.data = sanitizeLogValue(event.request.data);
    }
    // Never forward cookies or auth headers to a third party.
    delete event.request.cookies;
    if (event.request.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
      delete event.request.headers.Authorization;
    }
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
