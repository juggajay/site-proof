import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../lib/AppError.js';

vi.mock('../lib/auth.js', () => ({
  AuthVerificationError: class AuthVerificationError extends Error {
    constructor(message = 'Authentication verification failed') {
      super(message);
      this.name = 'AuthVerificationError';
    }
  },
  verifyToken: vi.fn(),
}));

const { AuthVerificationError, verifyToken } = await import('../lib/auth.js');
const { requireAuth, requireMinRole } = await import('./authMiddleware.js');

function requestForRole(roleInCompany?: string): Request {
  return {
    user: roleInCompany ? { roleInCompany } : undefined,
  } as Request;
}

function runRequireMinRole(userRole: string | undefined, minimumRole: string) {
  const next = vi.fn();
  const middleware = requireMinRole(minimumRole);

  middleware(requestForRole(userRole), {} as Response, next as NextFunction);

  return next;
}

describe('requireMinRole', () => {
  it('allows quality_manager through quality-manager gates', () => {
    const next = runRequireMinRole('quality_manager', 'quality_manager');

    expect(next).toHaveBeenCalledOnce();
  });

  it('keeps quality_manager above site_manager in minimum-role checks', () => {
    const next = runRequireMinRole('quality_manager', 'site_manager');

    expect(next).toHaveBeenCalledOnce();
  });

  it('allows project_manager through quality-manager gates', () => {
    const next = runRequireMinRole('project_manager', 'quality_manager');

    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects site_manager from quality-manager gates', () => {
    expect(() => runRequireMinRole('site_manager', 'quality_manager')).toThrow(AppError);
  });

  it('rejects unauthenticated requests', () => {
    expect(() => runRequireMinRole(undefined, 'viewer')).toThrow(AppError);
  });
});

describe('requireAuth', () => {
  it('returns a server error when token verification infrastructure fails', async () => {
    vi.mocked(verifyToken).mockRejectedValueOnce(
      new AuthVerificationError('Authentication verification unavailable'),
    );
    const next = vi.fn();
    const req = {
      headers: { authorization: 'Bearer valid-format-token' },
    } as unknown as Request;

    await requireAuth(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]?.[0]).toMatchObject({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
  });
});
