import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  captureFatal,
  captureServerError,
  flushMonitoring,
  initMonitoring,
  isMonitoringEnabled,
} from './monitoring.js';

const SENTRY_ENV_KEYS = [
  'SENTRY_DSN',
  'SENTRY_TRACES_SAMPLE_RATE',
  'SENTRY_ENVIRONMENT',
  'SENTRY_RELEASE',
] as const;

describe('monitoring (unconfigured)', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of SENTRY_ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of SENTRY_ENV_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it('stays disabled when SENTRY_DSN is not set', async () => {
    await initMonitoring();
    expect(isMonitoringEnabled()).toBe(false);
  });

  it('treats reporting helpers as no-ops without throwing', async () => {
    await initMonitoring();

    expect(() =>
      captureServerError(new Error('boom'), {
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        method: 'GET',
        path: '/api/lots',
        userId: 'user-1',
        requestId: 'req-1',
      }),
    ).not.toThrow();

    expect(() => captureFatal('[FATAL] test', new Error('fatal'))).not.toThrow();

    await expect(flushMonitoring(10)).resolves.toBeUndefined();
  });

  it('ignores a blank/whitespace DSN', async () => {
    process.env.SENTRY_DSN = '   ';
    await initMonitoring();
    expect(isMonitoringEnabled()).toBe(false);
  });
});
