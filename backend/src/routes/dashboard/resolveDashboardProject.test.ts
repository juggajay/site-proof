import { describe, expect, it } from 'vitest';

import { resolveDashboardProject } from './access.js';
import type { DashboardProjectAccess } from './access.js';

function access(id: string, status = 'active'): DashboardProjectAccess {
  return {
    projectId: id,
    role: 'project_manager',
    project: { id, name: `Project ${id}`, projectNumber: `P-${id}`, status },
  };
}

describe('resolveDashboardProject (M71 sticky project switcher)', () => {
  it('returns the active projects as the switchable list and the first as primary', () => {
    const result = resolveDashboardProject([access('a'), access('b')]);
    expect(result.projects.map((p) => p.id)).toEqual(['a', 'b']);
    expect(result.primaryProject?.id).toBe('a');
  });

  it('honors a requested projectId the user has access to', () => {
    const result = resolveDashboardProject([access('a'), access('b'), access('c')], 'b');
    expect(result.primaryProject?.id).toBe('b');
  });

  it('honors a requested project even if it is not active', () => {
    const result = resolveDashboardProject(
      [access('a'), access('archived', 'archived')],
      'archived',
    );
    expect(result.primaryProject?.id).toBe('archived');
  });

  it('ignores a requested projectId outside the eligible set and falls back to the first active', () => {
    const result = resolveDashboardProject([access('a'), access('b')], 'not-mine');
    expect(result.primaryProject?.id).toBe('a');
  });

  it('falls back to the first eligible project when none are active', () => {
    const result = resolveDashboardProject([access('a', 'archived'), access('b', 'on_hold')]);
    expect(result.primaryProject?.id).toBe('a');
    expect(result.projects).toEqual([]);
  });

  it('returns a null primary and empty list when there is no access', () => {
    const result = resolveDashboardProject([]);
    expect(result.primaryProject).toBeNull();
    expect(result.projects).toEqual([]);
  });
});
