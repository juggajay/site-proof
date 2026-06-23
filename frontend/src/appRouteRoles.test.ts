import { describe, expect, it } from 'vitest';
import { ADMIN_ROLES, AUDIT_LOG_PAGE_ROLES, COMPANY_ADMIN_ROLES } from './appRouteRoles';

describe('app route role groups', () => {
  it('keeps company settings aligned with backend owner/admin guards', () => {
    expect(COMPANY_ADMIN_ROLES).toEqual(['owner', 'admin']);
    expect(COMPANY_ADMIN_ROLES).not.toContain('project_manager');
  });

  it('keeps project-manager in the broader admin group for project admin routes', () => {
    expect(ADMIN_ROLES).toContain('project_manager');
  });

  it('lets quality managers reach the audit log without widening ADMIN_ROLES (M75)', () => {
    expect(AUDIT_LOG_PAGE_ROLES).toContain('quality_manager');
    expect(AUDIT_LOG_PAGE_ROLES).toEqual([...ADMIN_ROLES, 'quality_manager']);
    // The shared admin group must stay unchanged so other admin-only routes
    // aren't accidentally opened to quality managers.
    expect(ADMIN_ROLES).not.toContain('quality_manager');
  });
});
