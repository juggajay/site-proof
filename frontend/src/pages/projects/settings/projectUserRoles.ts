// Project role catalogue and the per-row permission derivation shared by the
// desktop team table and its phone card fallback — both must gate identically.
import {
  canAssignProjectRole,
  canRemoveProjectUser,
  isLastActiveProjectTeamLead,
  type ProjectUserGuardRecord,
} from './projectUsersGuards';
import { isProtectedProjectManagementRole } from './projectPageAccess';

export const PROJECT_ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full project access' },
  {
    value: 'project_manager',
    label: 'Project Manager',
    description: 'Manage project settings and team',
  },
  { value: 'quality_manager', label: 'Quality Manager', description: 'Manage quality, ITPs, NCRs' },
  { value: 'site_manager', label: 'Site Manager', description: 'Coordinate site operations' },
  { value: 'site_engineer', label: 'Site Engineer', description: 'Field quality and testing' },
  { value: 'foreman', label: 'Foreman', description: 'Manage lots and daily activities' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
];

export const PROJECT_TEAM_LEAD_GUARD_COPY =
  'Add another active admin or project manager before changing this role.';

export function projectUserRoleLabel(role: string): string {
  return PROJECT_ROLES.find((r) => r.value === role)?.label || role.replace('_', ' ');
}

export function projectUserRowState(
  user: ProjectUserGuardRecord,
  users: ProjectUserGuardRecord[],
  canManageProtectedProjectRoles: boolean,
) {
  return {
    lastActiveTeamLead: isLastActiveProjectTeamLead(user, users),
    canManageThisUser:
      canManageProtectedProjectRoles || !isProtectedProjectManagementRole(user.role),
    roleOptions: PROJECT_ROLES.filter(
      (role) =>
        canAssignProjectRole(user, role.value, users) &&
        (canManageProtectedProjectRoles || !isProtectedProjectManagementRole(role.value)),
    ),
    canRemove: canRemoveProjectUser(user, users),
  };
}
