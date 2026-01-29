import { useAuth } from '@/lib/auth'
import { ROLE_GROUPS, hasRoleInGroup } from '@/lib/roles'

/**
 * Hook to check if the current user has commercial access.
 * Commercial access allows viewing contract values, budgets, rates, and claims.
 */
export function useCommercialAccess() {
  const { user } = useAuth()
  const role = user?.role

  const hasCommercialAccess = hasRoleInGroup(role, ROLE_GROUPS.COMMERCIAL)
  const canViewSubcontractorRates = hasRoleInGroup(role, ROLE_GROUPS.RATE_VIEWERS)
  const canViewDocketAmounts = hasRoleInGroup(role, ROLE_GROUPS.DOCKET_AMOUNT_VIEWERS)

  return {
    hasCommercialAccess,
    canViewBudgets: hasCommercialAccess,
    canViewRates: hasCommercialAccess,
    canViewClaims: hasCommercialAccess,
    canViewContractValues: hasCommercialAccess,
    canViewSubcontractorRates,
    canViewDocketAmounts,
  }
}
