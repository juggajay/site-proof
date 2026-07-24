import { useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { ROLE_GROUPS, hasRoleInGroup, describeRoleGroupRequirement } from '@/lib/roles';
import { getProjectScopedRole } from '@/lib/subcontractorIdentity';
import { useCurrentProjectRole } from './useCurrentProjectRole';

/**
 * Hook to check if the current user has commercial access.
 * Commercial access allows viewing contract values, budgets, rates, and claims.
 */
export function useCommercialAccess() {
  const { user } = useAuth();
  const { projectId } = useParams();
  const currentProjectRole = useCurrentProjectRole(projectId);
  const role = projectId ? currentProjectRole : getProjectScopedRole(user);

  const hasCommercialAccess = hasRoleInGroup(role, ROLE_GROUPS.COMMERCIAL);
  const canViewSubcontractorRates = hasRoleInGroup(role, ROLE_GROUPS.RATE_VIEWERS);
  const canViewDocketAmounts = hasRoleInGroup(role, ROLE_GROUPS.DOCKET_AMOUNT_VIEWERS);

  // Human "why can't I?" string for the commercial gate, derived from the SAME
  // `role` the booleans use — so it reflects a RoleSwitcher override, not the
  // global actual role. null when access is granted (nothing to explain).
  const commercialAccessReason = describeRoleGroupRequirement(
    role,
    ROLE_GROUPS.COMMERCIAL,
    'a commercial role',
  );

  return {
    hasCommercialAccess,
    canViewBudgets: hasCommercialAccess,
    canViewRates: hasCommercialAccess,
    canViewClaims: hasCommercialAccess,
    canViewContractValues: hasCommercialAccess,
    canViewSubcontractorRates,
    canViewDocketAmounts,
    commercialAccessReason,
  };
}
