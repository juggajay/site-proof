import { describe, expect, it } from 'vitest';
import { canCreateLots, canDeleteLots, canDeleteProjects, canManageProjectSettings } from './roles';

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
