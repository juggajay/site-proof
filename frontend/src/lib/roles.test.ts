import { describe, expect, it } from 'vitest';
import {
  ROLE_GROUPS,
  canCreateLots,
  canDeleteLots,
  canDeleteProjects,
  canManageProjectSettings,
  describeRoleGroupRequirement,
  formatRoleDisplayList,
} from './roles';

describe('role permission helpers', () => {
  it('keeps lot setup actions off field-only foreman roles', () => {
    expect(canCreateLots('project_manager')).toBe(true);
    expect(canCreateLots('site_manager')).toBe(true);
    expect(canCreateLots('foreman')).toBe(false);
    expect(canCreateLots('viewer')).toBe(false);
  });

  it('keeps permanent project delete narrower than project settings access', () => {
    expect(canManageProjectSettings('project_manager')).toBe(true);
    expect(canDeleteProjects('project_manager')).toBe(false);

    expect(canManageProjectSettings('admin')).toBe(true);
    expect(canDeleteProjects('admin')).toBe(true);
  });

  it('matches lot delete roles to backend permissions', () => {
    expect(canDeleteLots('owner')).toBe(true);
    expect(canDeleteLots('project_manager')).toBe(true);
    expect(canDeleteLots('site_manager')).toBe(false);
    expect(canDeleteLots('foreman')).toBe(false);
  });
});

describe('formatRoleDisplayList', () => {
  it('joins role display names with commas and a trailing "or"', () => {
    expect(formatRoleDisplayList(ROLE_GROUPS.COMMERCIAL)).toBe(
      'Owner, Administrator or Project Manager',
    );
  });

  it('renders a single role without a separator', () => {
    expect(formatRoleDisplayList(['viewer'])).toBe('Viewer');
  });

  it('joins two roles with "or"', () => {
    expect(formatRoleDisplayList(['owner', 'admin'])).toBe('Owner or Administrator');
  });
});

describe('describeRoleGroupRequirement', () => {
  it('returns null when the role is in the group (nothing to explain)', () => {
    expect(
      describeRoleGroupRequirement('project_manager', ROLE_GROUPS.COMMERCIAL, 'a commercial role'),
    ).toBeNull();
  });

  it('names the required roles and the current role when denied', () => {
    expect(
      describeRoleGroupRequirement('site_engineer', ROLE_GROUPS.COMMERCIAL, 'a commercial role'),
    ).toBe(
      'Requires a commercial role (Owner, Administrator or Project Manager). Your role: Site Engineer.',
    );
  });

  it('handles a missing role gracefully', () => {
    expect(describeRoleGroupRequirement(null, ROLE_GROUPS.COMMERCIAL, 'a commercial role')).toBe(
      'Requires a commercial role (Owner, Administrator or Project Manager). Your role: no project role.',
    );
  });
});
