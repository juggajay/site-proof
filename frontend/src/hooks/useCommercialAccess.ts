import { useAuth } from '@/lib/auth'

// Roles that can view commercial data (contract values, budgets, rates, claims)
const COMMERCIAL_ROLES = ['owner', 'admin', 'project_manager']

// Roles that can view subcontractor rates specifically
// Foremen and site engineers cannot see hourly rates for subcontractors
const RATE_VIEW_ROLES = ['owner', 'admin', 'project_manager']

// Roles that can view docket amounts
const DOCKET_AMOUNT_ROLES = ['owner', 'admin', 'project_manager']

export function useCommercialAccess() {
  const { user } = useAuth()

  const hasCommercialAccess = user?.role ? COMMERCIAL_ROLES.includes(user.role) : false
  const canViewSubcontractorRates = user?.role ? RATE_VIEW_ROLES.includes(user.role) : false
  const canViewDocketAmounts = user?.role ? DOCKET_AMOUNT_ROLES.includes(user.role) : false

  return {
    hasCommercialAccess,
    canViewBudgets: hasCommercialAccess,
    canViewRates: hasCommercialAccess,
    canViewClaims: hasCommercialAccess,
    canViewContractValues: hasCommercialAccess,
    // Subcontractor-specific rate visibility
    canViewSubcontractorRates,
    canViewDocketAmounts,
  }
}
