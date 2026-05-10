import type { Request } from 'express';
import { afterEach, describe, expect, it } from 'vitest';
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
    process.env.TRUST_PROXY = 'true';

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
