import { describe, expect, it } from 'vitest';
import {
  canAssignProjectRole,
  canRemoveProjectUser,
  countActiveProjectTeamLeads,
  isLastActiveProjectTeamLead,
  type ProjectUserGuardRecord,
} from './projectUsersGuards';

function user(overrides: Partial<ProjectUserGuardRecord>): ProjectUserGuardRecord {
  return {
    id: overrides.id ?? 'user-1',
    role: overrides.role ?? 'viewer',
    status: overrides.status ?? 'active',
  };
}

describe('project user guard helpers', () => {
  it('counts only active admins and project managers as project team leads', () => {
    const users = [
      user({ id: 'admin', role: 'admin' }),
      user({ id: 'pm', role: 'project_manager' }),
      user({ id: 'pending-admin', role: 'admin', status: 'pending' }),
      user({ id: 'viewer', role: 'viewer' }),
    ];

    expect(countActiveProjectTeamLeads(users)).toBe(2);
  });

  it('blocks removing or demoting the last active project team lead', () => {
    const lead = user({ id: 'lead', role: 'admin' });
    const users = [lead, user({ id: 'viewer', role: 'viewer' })];

    expect(isLastActiveProjectTeamLead(lead, users)).toBe(true);
    expect(canRemoveProjectUser(lead, users)).toBe(false);
    expect(canAssignProjectRole(lead, 'viewer', users)).toBe(false);
    expect(canAssignProjectRole(lead, 'project_manager', users)).toBe(true);
  });

  it('allows changing or removing a team lead when another active lead remains', () => {
    const lead = user({ id: 'lead', role: 'admin' });
    const users = [lead, user({ id: 'pm', role: 'project_manager' })];

    expect(isLastActiveProjectTeamLead(lead, users)).toBe(false);
    expect(canRemoveProjectUser(lead, users)).toBe(true);
    expect(canAssignProjectRole(lead, 'viewer', users)).toBe(true);
  });
});
