// Feature #750: External error monitoring (Sentry) integration.
//
// This module is a thin, dependency-optional wrapper. When `SENTRY_DSN` is not
// set it is a complete no-op, so local, test, and not-yet-configured production
// environments behave exactly as before. The `@sentry/node` package is loaded
// through a runtime-resolved specifier so the backend still type-checks and
// boots even when the package is not installed — monitoring simply stays
// disabled in that case.
import { logError, logInfo } from './serverLogger.js';

// Minimal surface of the Sentry SDK we depend on. Keeping our own interface
// (rather than importing the package's types) is what lets this integration be
// optional at compile time.
interface SentryScope {
  setLevel(level: string): void;
  setTag(key: string, value: string): void;
  setTags(tags: Record<string, string>): void;
  setUser(user: { id?: string } | null): void;
  setContext(name: string, context: Record<string, unknown> | null): void;
}

interface SentryLike {
  init(options: Record<string, unknown>): void;
  withScope(callback: (scope: SentryScope) => void): void;
  captureException(exception: unknown): string;
  captureMessage(message: string, level?: string): string;
  flush(timeout?: number): Promise<boolean>;
}

export interface MonitoringErrorContext {
  code: string;
  statusCode: number;
  method: string;
  path: string;
  userId?: string;
  apiKeyId?: string;
  requestId?: string;
}

let sentry: SentryLike | null = null;
let enabled = false;

function parseSampleRate(raw: string | undefined): number {
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

function resolveEnvironment(): string {
  return process.env.SENTRY_ENVIRONMENT?.trim() || process.env.NODE_ENV || 'development';
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Initialise error monitoring if SENTRY_DSN is configured. Safe to call once at
 * startup; repeated calls are ignored. Never throws — a monitoring failure must
 * not prevent the API from starting.
 */
export async function initMonitoring(): Promise<void> {
  if (enabled) return;

  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return; // Monitoring disabled by design when no DSN is set.

  try {
    // Non-literal specifier: keeps the optional package out of static module
    // resolution so the build does not require it to be installed.
    const moduleName: string = '@sentry/node';
    const imported = (await import(moduleName)) as Partial<SentryLike>;
    if (typeof imported.init !== 'function') {
      logError('Error monitoring package did not expose init(); continuing without it');
      return;
    }

    const candidate = imported as SentryLike;
    candidate.init({
      dsn,
      environment: resolveEnvironment(),
      release: process.env.SENTRY_RELEASE?.trim() || undefined,
      tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
      // We attach our own sanitised context; do not let the SDK collect PII.
      sendDefaultPii: false,
      // The app owns its own uncaught-exception / unhandled-rejection handling
      // (see src/index.ts) and exits fail-fast. Drop Sentry's equivalents so the
      // two do not race to call process.exit().
      integrations: (defaults: Array<{ name: string }>) =>
        defaults.filter(
          (integration) =>
            integration.name !== 'OnUncaughtException' &&
            integration.name !== 'OnUnhandledRejection',
        ),
    });

    sentry = candidate;
    enabled = true;
    logInfo(`Error monitoring (Sentry) initialised for environment "${resolveEnvironment()}"`);
  } catch (error) {
    // Most likely the optional package is not installed. Stay disabled.
    logError('Failed to initialise error monitoring; continuing without it', error);
    sentry = null;
    enabled = false;
  }
}

export function isMonitoringEnabled(): boolean {
  return enabled;
}

/**
 * Report a server-side (5xx) error with sanitised request context. No-op when
 * monitoring is disabled. Never throws.
 */
export function captureServerError(error: unknown, context: MonitoringErrorContext): void {
  if (!enabled || !sentry) return;

  const activeSentry = sentry;
  try {
    activeSentry.withScope((scope) => {
      scope.setLevel('error');
      scope.setTags({
        code: context.code,
        statusCode: String(context.statusCode),
        method: context.method,
        path: context.path,
      });
      if (context.requestId) scope.setTag('requestId', context.requestId);
      if (context.apiKeyId) scope.setTag('apiKeyId', context.apiKeyId);
      if (context.userId) scope.setUser({ id: context.userId });
      scope.setContext('request', {
        method: context.method,
        path: context.path,
        statusCode: context.statusCode,
        code: context.code,
        requestId: context.requestId ?? null,
      });

      if (error instanceof Error) {
        activeSentry.captureException(error);
      } else {
        activeSentry.captureMessage(
          typeof error === 'string' ? error : 'Non-error value thrown',
          'error',
        );
      }
    });
  } catch {
    // Monitoring must never break request handling.
  }
}

/**
 * Report a fatal startup/crash error before the process exits. No-op when
 * monitoring is disabled. Never throws.
 */
export function captureFatal(message: string, details: unknown): void {
  if (!enabled || !sentry) return;

  const activeSentry = sentry;
  try {
    activeSentry.withScope((scope) => {
      scope.setLevel('fatal');
      scope.setTag('fatal', 'true');
      if (details instanceof Error) {
        activeSentry.captureException(details);
      } else {
        activeSentry.captureException(new Error(`${message} ${safeStringify(details)}`));
      }
    });
  } catch {
    // Best-effort; the process is already exiting.
  }
}

/**
 * Flush buffered monitoring events. Call before the process exits so in-flight
 * reports are delivered. No-op when monitoring is disabled. Never throws.
 */
export async function flushMonitoring(timeoutMs = 2000): Promise<void> {
  if (!enabled || !sentry) return;

  try {
    await sentry.flush(timeoutMs);
  } catch {
    // Ignore flush failures during shutdown.
  }
}
