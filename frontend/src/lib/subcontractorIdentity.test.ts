import { describe, expect, it } from 'vitest';
import {
  getCompanyRole,
  hasSubcontractorPortalIdentity,
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
});
