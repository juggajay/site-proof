import { describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireEmailVerified } from './requireEmailVerified.js';

function run(user: { emailVerified?: boolean } | undefined) {
  const req = { user } as unknown as Request;
  const next = vi.fn() as unknown as NextFunction;
  requireEmailVerified(req, {} as Response, next);
  return next as unknown as ReturnType<typeof vi.fn>;
}

describe('requireEmailVerified (M1)', () => {
  it('passes a verified user through', () => {
    const next = run({ emailVerified: true });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('blocks an unverified user with a 403', () => {
    const next = run({ emailVerified: false });
    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeDefined();
    expect(error.statusCode ?? error.status).toBe(403);
  });

  it('blocks when there is no user', () => {
    const next = run(undefined);
    expect(next.mock.calls[0][0]).toBeDefined();
  });
});
