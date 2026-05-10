import type { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sanitizeLogPath, sanitizeLogUrl, sanitizeUrlValueForLog } from '../lib/logSanitization.js';
import { normalizeRequestMetricPath, requestLogger } from './requestLogger.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('request log sanitization', () => {
  it('redacts sensitive query parameters from request log URLs', () => {
    expect(
      sanitizeLogUrl(
        '/api/auth/validate-reset-token?token=reset_secret&search=lot%201&code=oauth-code',
      ),
    ).toBe('/api/auth/validate-reset-token?token=[REDACTED]&search=lot%201&code=[REDACTED]');

    expect(
      sanitizeLogUrl(
        '/api/auth/google/callback?state=oauth-state&scope=email&credential=jwt-value',
      ),
    ).toBe('/api/auth/google/callback?state=[REDACTED]&scope=email&credential=[REDACTED]');
  });

  it('redacts encoded nested secrets from otherwise safe query values', () => {
    expect(
      sanitizeLogUrl(
        '/login?redirect=https%3A%2F%2Fapp.example.com%2Fcallback%3Ftoken%3Dreset_secret&search=lot%201',
      ),
    ).toBe('/login?redirect=[REDACTED]&search=lot%201');

    expect(
      sanitizeLogUrl(
        '/webhook/test?callback=https%3A%2F%2Fhooks.example.com%2Fcb%3Fsignature%3Dsigned-value%26tenant%3Dsiteproof',
      ),
    ).toBe('/webhook/test?callback=[REDACTED]');
  });

  it('redacts one-time path tokens before logging or storing metrics', () => {
    expect(sanitizeLogPath('/api/holdpoints/public/hp_release_token/release')).toBe(
      '/api/holdpoints/public/[REDACTED]/release',
    );
    expect(normalizeRequestMetricPath('/api/holdpoints/public/hp_release_token/release')).toBe(
      '/api/holdpoints/public/[REDACTED]/release',
    );
  });

  it('redacts all query values when sanitizing URL values for logs', () => {
    expect(
      sanitizeUrlValueForLog(
        'https://files.example.com/api/holdpoints/public/release-token/report.pdf?token=secret&download=1',
      ),
    ).toBe(
      'https://files.example.com/api/holdpoints/public/[REDACTED]/report.pdf?token=[REDACTED]&download=[REDACTED]',
    );

    expect(sanitizeUrlValueForLog('/api/documents/download/doc-1?token=signed-token')).toBe(
      '/api/documents/download/doc-1?token=[REDACTED]',
    );
    expect(sanitizeUrlValueForLog('data:application/pdf;base64,secret-inline-doc')).toBe(
      '[REDACTED]',
    );
  });

  it('logs the sanitized URL from the middleware finish handler', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    let finishHandler: (() => void) | undefined;
    const req = {
      method: 'GET',
      originalUrl: '/api/auth/validate-reset-token?token=reset_secret&search=lot',
      path: '/api/auth/validate-reset-token',
    } as Request;
    const res = {
      statusCode: 200,
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'finish') {
          finishHandler = handler;
        }
        return res;
      }),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    requestLogger(req, res, next);
    finishHandler?.();

    expect(next).toHaveBeenCalledOnce();
    expect(consoleSpy).toHaveBeenCalledOnce();
    const loggedLine = String(consoleSpy.mock.calls[0][0]);
    expect(loggedLine).toContain('token=[REDACTED]');
    expect(loggedLine).not.toContain('reset_secret');
  });
});
