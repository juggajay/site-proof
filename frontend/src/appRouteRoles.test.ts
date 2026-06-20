import { describe, expect, it } from 'vitest';
import { ADMIN_ROLES, COMPANY_ADMIN_ROLES } from './appRouteRoles';

describe('app route role groups', () => {
  it('keeps company settings aligned with backend owner/admin guards', () => {
    expect(COMPANY_ADMIN_ROLES).toEqual(['owner', 'admin']);
    expect(COMPANY_ADMIN_ROLES).not.toContain('project_manager');
  });

  it('keeps project-manager in the broader admin group for project admin routes', () => {
    expect(ADMIN_ROLES).toContain('project_manager');
  });
});
