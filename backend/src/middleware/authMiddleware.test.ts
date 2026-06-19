import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../lib/AppError.js';

vi.mock('../lib/auth.js', () => ({
  verifyToken: vi.fn(),
}));

const { requireMinRole } = await import('./authMiddleware.js');

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
