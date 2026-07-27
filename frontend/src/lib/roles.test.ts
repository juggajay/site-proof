import { describe, expect, it } from 'vitest';
import {
  ROLE_GROUPS,
  canCreateLots,
  canDeleteLots,
  canEditLots,
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

  // F8 (external review 2026-07-27): the "Set Testing Attributes" bulk action
  // was gated on LOT_CREATORS while the backend route enforces LOT_EDITORS, so
  // a site manager saw a button that always 403'd. This pins the exact backend
  // list from backend/src/routes/lots/updateFields.ts — if either side drifts,
  // that file's own test and this one disagree with each other.
  it('mirrors the backend LOT_EDITORS role set exactly', () => {
    expect([...ROLE_GROUPS.LOT_EDITORS].sort()).toEqual([
      'admin',
      'owner',
      'project_manager',
      'quality_manager',
      'site_engineer',
    ]);
  });

  it('separates lot editing from lot creation in the same way the backend does', () => {
    // site_manager can create lots but the backend refuses its edits…
    expect(canCreateLots('site_manager')).toBe(true);
    expect(canEditLots('site_manager')).toBe(false);
    // …and quality_manager/site_engineer can edit but not create.
    expect(canCreateLots('quality_manager')).toBe(false);
    expect(canEditLots('quality_manager')).toBe(true);
    expect(canCreateLots('site_engineer')).toBe(false);
    expect(canEditLots('site_engineer')).toBe(true);
    // Field and portal roles are out of both.
    expect(canEditLots('foreman')).toBe(false);
    expect(canEditLots('subcontractor')).toBe(false);
    expect(canEditLots('viewer')).toBe(false);
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
