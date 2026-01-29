import { useAuth } from '@/lib/auth'
import { ROLE_GROUPS, hasRoleInGroup } from '@/lib/roles'

/**
 * Hook to check if the current user is a subcontractor.
 * Subcontractors have limited access - they can only see lots assigned to their company.
 */
export function useSubcontractorAccess() {
  const { user } = useAuth()

  const isSubcontractor = hasRoleInGroup(user?.role, ROLE_GROUPS.SUBCONTRACTOR)

  // Subcontractors can only see lots assigned to their company
  const subcontractorCompanyId = isSubcontractor ? user?.companyId : null

  return {
    isSubcontractor,
    subcontractorCompanyId,
    subcontractorCompanyName: user?.companyName || null,
  }
}
