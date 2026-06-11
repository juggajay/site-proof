import { describe, expect, it } from 'vitest';
import {
  getDashboardRole,
  getCompanyRole,
  getProjectScopedRole,
  hasSubcontractorPortalIdentity,
  isForemanDashboardUser,
  isSubcontractorUser,
} from './subcontractorIdentity';

describe('subcontractor identity helpers', () => {
  it('treats standalone portal users as subcontractor portal identities', () => {
    expect(
      hasSubcontractorPortalIdentity({
        companyId: null,
        hasSubcontractorPortalAccess: true,
        roleInCompany: 'subcontractor',
      }),
    ).toBe(true);
  });

  it('does not treat company accounts as subcontractor portal identities', () => {
    expect(
      hasSubcontractorPortalIdentity({
        companyId: 'company-1',
        hasSubcontractorPortalAccess: true,
        roleInCompany: 'owner',
      }),
    ).toBe(false);
  });

  it('normalizes legacy role fields for role checks', () => {
    expect(getCompanyRole({ role: 'foreman' })).toBe('foreman');
    expect(getCompanyRole({ role: 'viewer', roleInCompany: 'project_manager' })).toBe(
      'project_manager',
    );
    expect(isSubcontractorUser({ roleInCompany: 'subcontractor_admin' })).toBe(true);
    expect(isSubcontractorUser({ roleInCompany: 'project_manager' })).toBe(false);
  });

  it('uses dashboardRole for role-specific dashboard surfaces only', () => {
    const projectForeman = {
      role: 'member',
      roleInCompany: 'member',
      dashboardRole: 'foreman' as const,
    };

    expect(getCompanyRole(projectForeman)).toBe('member');
    expect(getDashboardRole(projectForeman)).toBe('foreman');
    expect(isForemanDashboardUser(projectForeman)).toBe(true);
  });

  it('falls dashboardRole helpers back to the company role when no project role is present', () => {
    expect(getDashboardRole({ role: 'viewer', roleInCompany: 'site_engineer' })).toBe(
      'site_engineer',
    );
    expect(isForemanDashboardUser({ role: 'viewer', roleInCompany: 'site_engineer' })).toBe(false);
  });

  it('uses dashboardRole as the coarse role for project-scoped routes without changing subcontractor identity', () => {
    expect(
      getProjectScopedRole({
        role: 'member',
        roleInCompany: 'member',
        dashboardRole: 'quality_manager',
      }),
    ).toBe('quality_manager');
    expect(
      getProjectScopedRole({
        roleInCompany: 'subcontractor',
        companyId: null,
        hasSubcontractorPortalAccess: true,
        dashboardRole: 'foreman',
      }),
    ).toBe('subcontractor');
  });
});
