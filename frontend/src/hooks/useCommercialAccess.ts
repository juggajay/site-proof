import { useAuth } from '@/lib/auth';
import { ROLE_GROUPS, hasRoleInGroup } from '@/lib/roles';
import {
  getProjectScopedRole,
  hasSubcontractorPortalIdentity,
  isSubcontractorUser,
} from '@/lib/subcontractorIdentity';

/**
 * Hook to check if the current user has commercial access.
 * Commercial access allows viewing contract values, budgets, rates, and claims.
 */
export function useCommercialAccess() {
  const { user, actualRole } = useAuth();
  const projectScopedRole = getProjectScopedRole(user);
  const actualRoleHasCommercialAccess = hasRoleInGroup(actualRole, ROLE_GROUPS.COMMERCIAL);
  const role =
    isSubcontractorUser(user) || hasSubcontractorPortalIdentity(user)
      ? projectScopedRole
      : actualRoleHasCommercialAccess
        ? actualRole
        : projectScopedRole;

  const hasCommercialAccess = hasRoleInGroup(role, ROLE_GROUPS.COMMERCIAL);
  const canViewSubcontractorRates = hasRoleInGroup(role, ROLE_GROUPS.RATE_VIEWERS);
  const canViewDocketAmounts = hasRoleInGroup(role, ROLE_GROUPS.DOCKET_AMOUNT_VIEWERS);

  return {
    hasCommercialAccess,
    canViewBudgets: hasCommercialAccess,
    canViewRates: hasCommercialAccess,
    canViewClaims: hasCommercialAccess,
    canViewContractValues: hasCommercialAccess,
    canViewSubcontractorRates,
    canViewDocketAmounts,
  };
}
