import type { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getClientIp } from './rateLimiter.js';

const ORIGINAL_ENV = { ...process.env };

function mockRequest({
  forwardedFor,
  ip,
  remoteAddress,
}: {
  forwardedFor?: string | string[];
  ip?: string;
  remoteAddress?: string;
}): Request {
  return {
    headers: forwardedFor === undefined ? {} : { 'x-forwarded-for': forwardedFor },
    ip,
    socket: { remoteAddress },
  } as unknown as Request;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe('getClientIp', () => {
  it('uses the first forwarded address outside production for local route tests', () => {
    process.env.NODE_ENV = 'test';

    expect(
      getClientIp(
        mockRequest({
          forwardedFor: '198.51.100.17, 10.0.0.8',
          ip: '127.0.0.1',
          remoteAddress: '127.0.0.1',
        }),
      ),
    ).toBe('198.51.100.17');
  });

  it('does not trust raw forwarded headers in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.TRUST_PROXY = '1';

    expect(
      getClientIp(
        mockRequest({
          forwardedFor: '198.51.100.17',
          ip: '10.0.0.8',
          remoteAddress: '10.0.0.9',
        }),
      ),
    ).toBe('10.0.0.8');
  });

  it('falls back to the socket address and then unknown', () => {
    process.env.NODE_ENV = 'production';

    expect(getClientIp(mockRequest({ remoteAddress: '10.0.0.9' }))).toBe('10.0.0.9');
    expect(getClientIp(mockRequest({}))).toBe('unknown');
  });
});

function mockRateLimitRequest({
  method,
  path,
  ip,
}: {
  method: string;
  path: string;
  ip: string;
}): Request {
  return {
    method,
    path,
    originalUrl: `/api/auth${path}`,
    baseUrl: '/api/auth',
    headers: {},
    ip,
    socket: { remoteAddress: ip },
  } as unknown as Request;
}

function mockResponse(): Response {
  return {
    setHeader: vi.fn(),
  } as unknown as Response;
}

async function runMiddleware(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  req: Request,
): Promise<unknown> {
  return new Promise((resolve) => {
    middleware(req, mockResponse(), (error?: unknown) => resolve(error));
  });
}

describe('authRateLimiter', () => {
  async function loadProductionMemoryAuthRateLimiter() {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.RATE_LIMIT_STORE = 'memory';
    process.env.AUTH_RATE_LIMIT_MAX = '2';
    return import('./rateLimiter.js');
  }

  it('does not count GET /me session hydration against strict auth attempts', async () => {
    const { authRateLimiter } = await loadProductionMemoryAuthRateLimiter();
    const req = mockRateLimitRequest({
      method: 'GET',
      path: '/me',
      ip: '198.51.100.44',
    });

    for (let i = 0; i < 4; i++) {
      await expect(runMiddleware(authRateLimiter, req)).resolves.toBeUndefined();
    }
  });

  it.each([
    ['POST', '/onboarding/complete', '198.51.100.101'],
    ['POST', '/logout', '198.51.100.102'],
    ['POST', '/logout-all-devices', '198.51.100.103'],
    ['PATCH', '/profile', '198.51.100.104'],
    ['POST', '/avatar', '198.51.100.105'],
    ['DELETE', '/avatar', '198.51.100.106'],
  ])(
    'does not count routine authenticated %s %s requests against strict auth attempts',
    async (method, path, ip) => {
      const { authRateLimiter } = await loadProductionMemoryAuthRateLimiter();
      const req = mockRateLimitRequest({
        method,
        path,
        ip,
      });

      for (let i = 0; i < 4; i++) {
        await expect(runMiddleware(authRateLimiter, req)).resolves.toBeUndefined();
      }
    },
  );

  it('still rate limits login attempts', async () => {
    const { authRateLimiter } = await loadProductionMemoryAuthRateLimiter();
    const req = mockRateLimitRequest({
      method: 'POST',
      path: '/login',
      ip: '198.51.100.45',
    });

    await expect(runMiddleware(authRateLimiter, req)).resolves.toBeUndefined();
    await expect(runMiddleware(authRateLimiter, req)).resolves.toBeUndefined();

    const error = await runMiddleware(authRateLimiter, req);
    expect(error).toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMITED',
    });
  });
});
