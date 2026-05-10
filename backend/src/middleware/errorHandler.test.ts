import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../lib/AppError.js';
import { errorHandler, sanitizeLogQuery, trimErrorLogContent } from './errorHandler.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

function mockRequest(): Request {
  return {
    method: 'GET',
    path: '/api/auth/validate-reset-token',
    query: {
      token: 'reset_secret',
      search: 'lot 123',
    },
    headers: {
      'user-agent': 'vitest',
      'x-request-id': 'request-1',
      origin: 'https://app.siteproof.example?token=origin_secret',
    },
    ip: '127.0.0.1',
    connection: {
      remoteAddress: '127.0.0.1',
    },
  } as unknown as Request;
}

function mockResponse(): {
  res: Response;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return {
    res: { status } as unknown as Response,
    status,
    json,
  };
}

function suppressErrorLogOutput() {
  process.env.ERROR_LOG_TO_FILE = 'false';
  return vi.spyOn(console, 'error').mockImplementation(() => undefined);
}

describe('sanitizeLogQuery', () => {
  it('redacts sensitive query fields before error logs are persisted', () => {
    expect(
      sanitizeLogQuery({
        token: 'reset-token',
        code: 'oauth-code',
        state: 'oauth-state',
        search: 'lot 123',
        projectId: 'project-1',
      }),
    ).toEqual({
      token: '[REDACTED]',
      code: '[REDACTED]',
      state: '[REDACTED]',
      search: 'lot 123',
      projectId: 'project-1',
    });
  });

  it('redacts sensitive nested query values without dropping safe filters', () => {
    expect(
      sanitizeLogQuery({
        filter: {
          status: ['open', 'closed'],
          apiKey: 'secret-key',
          nested: {
            password: 'password-value',
            safe: 'visible',
          },
        },
        include: ['lots', { signature: 'signed-value', section: 'summary' }],
      }),
    ).toEqual({
      filter: {
        status: ['open', 'closed'],
        apiKey: '[REDACTED]',
        nested: {
          password: '[REDACTED]',
          safe: 'visible',
        },
      },
      include: ['lots', { signature: '[REDACTED]', section: 'summary' }],
    });
  });
});

describe('errorHandler', () => {
  it('hides unexpected 500 messages in production and sanitizes logged text', () => {
    process.env.NODE_ENV = 'production';
    const consoleSpy = suppressErrorLogOutput();
    const { res, status, json } = mockResponse();

    errorHandler(
      new Error('Database exploded token=reset_secret while using Bearer jwt_secret'),
      mockRequest(),
      res,
      vi.fn() as NextFunction,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });

    const loggedText = consoleSpy.mock.calls
      .flat()
      .map((value) => String(value))
      .join('\n');
    expect(loggedText).toContain('token=[REDACTED]');
    expect(loggedText).toContain('Bearer [REDACTED]');
    expect(loggedText).not.toContain('reset_secret');
    expect(loggedText).not.toContain('jwt_secret');
  });

  it('continues to expose operational upstream errors to clients', () => {
    process.env.NODE_ENV = 'production';
    suppressErrorLogOutput();
    const { res, status, json } = mockResponse();

    errorHandler(
      new AppError(502, 'Support request could not be delivered', 'EXTERNAL_SERVICE_ERROR'),
      mockRequest(),
      res,
      vi.fn() as NextFunction,
    );

    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith({
      error: {
        message: 'Support request could not be delivered',
        code: 'EXTERNAL_SERVICE_ERROR',
      },
    });
  });

  it('does not touch the local log directory when file logging is disabled', () => {
    process.env.ERROR_LOG_TO_FILE = 'false';
    suppressErrorLogOutput();
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync');
    const { res, status } = mockResponse();

    errorHandler(new Error('Unexpected failure'), mockRequest(), res, vi.fn() as NextFunction);

    expect(status).toHaveBeenCalledWith(500);
    expect(mkdirSpy).not.toHaveBeenCalled();
  });

  it('still handles requests when the local error log directory cannot be created', () => {
    process.env.ERROR_LOG_TO_FILE = 'true';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw new Error('permission denied token=mkdir_secret');
    });
    const appendSpy = vi.spyOn(fs, 'appendFile');
    const { res, status, json } = mockResponse();

    errorHandler(new Error('Unexpected failure'), mockRequest(), res, vi.fn() as NextFunction);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalled();
    expect(appendSpy).not.toHaveBeenCalled();

    const loggedText = consoleSpy.mock.calls
      .flat()
      .map((value) => String(value))
      .join('\n');
    expect(loggedText).toContain('Failed to create error log directory');
    expect(loggedText).toContain('token=[REDACTED]');
    expect(loggedText).not.toContain('mkdir_secret');
  });

  it('trims oversized error logs to complete trailing entries', () => {
    expect(trimErrorLogContent('first\nsecond\nthird\n', 12)).toBe('third\n');
  });
});
