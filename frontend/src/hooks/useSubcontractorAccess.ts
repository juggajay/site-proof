import { useAuth } from '@/lib/auth'

// Roles that are considered subcontractor roles
const SUBCONTRACTOR_ROLES = ['subcontractor', 'subcontractor_admin']

export function useSubcontractorAccess() {
  const { user } = useAuth()

  const isSubcontractor = user?.role ? SUBCONTRACTOR_ROLES.includes(user.role) : false

  // Get the company ID for filtering lots
  // Subcontractors can only see lots assigned to their company
  const subcontractorCompanyId = isSubcontractor ? user?.companyId : null

  return {
    isSubcontractor,
    subcontractorCompanyId,
    // For convenience, the company name if available
    subcontractorCompanyName: user?.companyName || null,
  }
}
