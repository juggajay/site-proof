import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('react-router-dom', () => ({ useParams: vi.fn() }));
vi.mock('./useCurrentProjectRole', () => ({ useCurrentProjectRole: vi.fn() }));

import { useAuth } from '@/lib/auth';
import { useParams } from 'react-router-dom';
import { useCurrentProjectRole } from './useCurrentProjectRole';
import { useCommercialAccess } from './useCommercialAccess';

const useAuthMock = vi.mocked(useAuth);
const useParamsMock = vi.mocked(useParams);
const useCurrentProjectRoleMock = vi.mocked(useCurrentProjectRole);

type MockUser = {
  role?: string;
  roleInCompany?: string;
  dashboardRole?: 'project_manager' | 'quality_manager' | 'foreman' | 'viewer' | null;
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
  useParamsMock.mockReturnValue({});
  useCurrentProjectRoleMock.mockReturnValue(null);
});

describe('useCommercialAccess', () => {
  it('uses the project-scoped role instead of the global actual role', () => {
    setAuth({ role: 'foreman', roleInCompany: 'foreman', dashboardRole: null }, 'admin');

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

  it('uses the current project role instead of an aggregate project-manager dashboard role', () => {
    useParamsMock.mockReturnValue({ projectId: 'project-2' });
    useCurrentProjectRoleMock.mockReturnValue('viewer');
    setAuth(
      { role: 'member', roleInCompany: 'member', dashboardRole: 'project_manager' },
      'member',
    );

    const { result } = renderHook(() => useCommercialAccess());

    expect(result.current.hasCommercialAccess).toBe(false);
    expect(result.current.canViewBudgets).toBe(false);
    expect(result.current.canViewDocketAmounts).toBe(false);
  });

  it('does not grant commercial access while the current project role is loading', () => {
    useParamsMock.mockReturnValue({ projectId: 'project-2' });
    useCurrentProjectRoleMock.mockReturnValue(null);
    setAuth(
      { role: 'member', roleInCompany: 'member', dashboardRole: 'project_manager' },
      'member',
    );

    const { result } = renderHook(() => useCommercialAccess());

    expect(result.current.hasCommercialAccess).toBe(false);
    expect(result.current.canViewClaims).toBe(false);
    expect(result.current.canViewSubcontractorRates).toBe(false);
  });

  it('grants commercial access from the loaded current project role', () => {
    useParamsMock.mockReturnValue({ projectId: 'project-2' });
    useCurrentProjectRoleMock.mockReturnValue('project_manager');
    setAuth({ role: 'member', roleInCompany: 'member', dashboardRole: 'viewer' }, 'member');

    const { result } = renderHook(() => useCommercialAccess());

    expect(result.current.hasCommercialAccess).toBe(true);
    expect(result.current.canViewBudgets).toBe(true);
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
