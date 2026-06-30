export type ProjectUserGuardRecord = {
  id: string;
  role: string;
  status: string;
};

export const PROJECT_TEAM_LEAD_ROLES = new Set(['admin', 'project_manager']);

export function isActiveProjectTeamLead(user: Pick<ProjectUserGuardRecord, 'role' | 'status'>) {
  return user.status === 'active' && PROJECT_TEAM_LEAD_ROLES.has(user.role);
}

export function countActiveProjectTeamLeads(users: ProjectUserGuardRecord[]) {
  return users.filter(isActiveProjectTeamLead).length;
}

export function isLastActiveProjectTeamLead(
  user: ProjectUserGuardRecord,
  users: ProjectUserGuardRecord[],
) {
  return isActiveProjectTeamLead(user) && countActiveProjectTeamLeads(users) <= 1;
}

export function canRemoveProjectUser(
  user: ProjectUserGuardRecord,
  users: ProjectUserGuardRecord[],
) {
  return !isLastActiveProjectTeamLead(user, users);
}

export function canAssignProjectRole(
  user: ProjectUserGuardRecord,
  nextRole: string,
  users: ProjectUserGuardRecord[],
) {
  if (!isLastActiveProjectTeamLead(user, users)) {
    return true;
  }

  return PROJECT_TEAM_LEAD_ROLES.has(nextRole);
}
