import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));

import { useAuth } from '@/lib/auth';
import { useCommercialAccess } from './useCommercialAccess';

const useAuthMock = vi.mocked(useAuth);

type MockUser = {
  role?: string;
  roleInCompany?: string;
  dashboardRole?: 'project_manager' | 'quality_manager' | 'foreman' | null;
  companyId?: string | null;
  hasSubcontractorPortalAccess?: boolean;
};

function setAuth(user: MockUser | null, actualRole: string | null = user?.role ?? null) {
  useAuthMock.mockReturnValue({
    user,
    actualRole,
  } as unknown as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  useAuthMock.mockReset();
});

describe('useCommercialAccess', () => {
  it('uses the actual role when the displayed role has been overridden', () => {
    setAuth({ role: 'foreman', roleInCompany: 'foreman', dashboardRole: null }, 'admin');

    const { result } = renderHook(() => useCommercialAccess());

    expect(result.current).toMatchObject({
      hasCommercialAccess: true,
      canViewBudgets: true,
      canViewRates: true,
      canViewClaims: true,
      canViewContractValues: true,
      canViewSubcontractorRates: true,
      canViewDocketAmounts: true,
    });
  });

  it('uses the project-scoped dashboard role for project managers whose company role is member', () => {
    setAuth(
      { role: 'member', roleInCompany: 'member', dashboardRole: 'project_manager' },
      'member',
    );

    const { result } = renderHook(() => useCommercialAccess());

    expect(result.current.hasCommercialAccess).toBe(true);
    expect(result.current.canViewClaims).toBe(true);
    expect(result.current.canViewDocketAmounts).toBe(true);
  });

  it('does not grant commercial access to field roles', () => {
    setAuth({ role: 'foreman', roleInCompany: 'foreman', dashboardRole: 'foreman' }, 'foreman');

    const { result } = renderHook(() => useCommercialAccess());

    expect(result.current).toMatchObject({
      hasCommercialAccess: false,
      canViewBudgets: false,
      canViewRates: false,
      canViewClaims: false,
      canViewContractValues: false,
      canViewSubcontractorRates: false,
      canViewDocketAmounts: false,
    });
  });

  it('falls back to the company role when actual role is unavailable in tests or mocks', () => {
    setAuth({ role: 'member', roleInCompany: 'project_manager' }, null);

    const { result } = renderHook(() => useCommercialAccess());

    expect(result.current.hasCommercialAccess).toBe(true);
    expect(result.current.canViewSubcontractorRates).toBe(true);
  });

  it('does not let subcontractor portal users borrow a project dashboard role for commercial access', () => {
    setAuth(
      {
        role: 'subcontractor',
        roleInCompany: 'subcontractor',
        dashboardRole: 'project_manager',
        companyId: null,
        hasSubcontractorPortalAccess: true,
      },
      null,
    );

    const { result } = renderHook(() => useCommercialAccess());

    expect(result.current.hasCommercialAccess).toBe(false);
    expect(result.current.canViewDocketAmounts).toBe(false);
  });
});
