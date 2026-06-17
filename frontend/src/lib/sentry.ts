// Sentry error monitoring for the frontend (React).
// Initialized once before render (see main.tsx). When VITE_SENTRY_DSN is unset
// this is a safe no-op — the browser app never crashes for a missing DSN.
// Production builds enforce VITE_SENTRY_DSN at build time (see vite.config.ts).
import * as Sentry from '@sentry/react';

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
  });
}
