import { isSubcontractorRole } from './roles';

type RoleUser =
  | {
      role?: string;
      roleInCompany?: string;
      companyId?: string | null;
      hasSubcontractorPortalAccess?: boolean;
    }
  | null
  | undefined;

export function getCompanyRole(user: RoleUser): string {
  return user?.roleInCompany || user?.role || '';
}

export function isSubcontractorUser(user: RoleUser): boolean {
  return isSubcontractorRole(getCompanyRole(user));
}

export function hasSubcontractorPortalIdentity(user: RoleUser): boolean {
  if (!user || user.companyId) {
    return false;
  }

  return isSubcontractorUser(user) || user?.hasSubcontractorPortalAccess === true;
}
