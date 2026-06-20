import { isSubcontractorRole } from './roles';

export type DashboardRole =
  | 'project_manager'
  | 'quality_manager'
  | 'foreman'
  | 'site_engineer'
  | 'viewer';

type RoleUser =
  | {
      role?: string;
      roleInCompany?: string;
      dashboardRole?: DashboardRole | null;
      companyId?: string | null;
      hasSubcontractorPortalAccess?: boolean;
    }
  | null
  | undefined;

export function getCompanyRole(user: RoleUser): string {
  return user?.roleInCompany || user?.role || '';
}

export function getDashboardRole(user: RoleUser): string {
  return user?.dashboardRole || getCompanyRole(user);
}

export function isForemanDashboardUser(user: RoleUser): boolean {
  return getDashboardRole(user) === 'foreman';
}

export function getProjectScopedRole(user: RoleUser): string {
  const companyRole = getCompanyRole(user);

  if (isSubcontractorRole(companyRole) || hasSubcontractorPortalIdentity(user)) {
    return companyRole;
  }

  return user?.dashboardRole || companyRole;
}

export function isSubcontractorUser(user: RoleUser): boolean {
  return isSubcontractorRole(getCompanyRole(user));
}

export function hasSubcontractorPortalIdentity(user: RoleUser): boolean {
  if (!user || user.companyId) {
    return false;
  }

  return user.hasSubcontractorPortalAccess === true;
}
