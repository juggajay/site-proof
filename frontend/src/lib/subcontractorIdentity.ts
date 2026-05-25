import { isSubcontractorRole } from './roles';

type RoleUser =
  | {
      role?: string;
      roleInCompany?: string;
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
  return isSubcontractorUser(user) || user?.hasSubcontractorPortalAccess === true;
}
