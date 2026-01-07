import { useAuth } from '@/lib/auth'

// Roles that have quality management access
// QM can: manage ITP templates, verify test results, close NCRs, conform lots
const QUALITY_MANAGEMENT_ROLES = ['owner', 'admin', 'project_manager', 'quality_manager']

// Roles that can conform lots
const LOT_CONFORMANCE_ROLES = ['owner', 'admin', 'project_manager', 'quality_manager']

// Roles that can verify test results
const TEST_VERIFICATION_ROLES = ['owner', 'admin', 'project_manager', 'quality_manager']

// Roles that can close NCRs
const NCR_CLOSURE_ROLES = ['owner', 'admin', 'project_manager', 'quality_manager']

// Roles that can manage ITP templates
const ITP_MANAGEMENT_ROLES = ['owner', 'admin', 'project_manager', 'quality_manager']

export function useQualityAccess() {
  const { user } = useAuth()
  const userRole = user?.role || ''

  const hasQualityAccess = QUALITY_MANAGEMENT_ROLES.includes(userRole)
  const canConformLots = LOT_CONFORMANCE_ROLES.includes(userRole)
  const canVerifyTestResults = TEST_VERIFICATION_ROLES.includes(userRole)
  const canCloseNCRs = NCR_CLOSURE_ROLES.includes(userRole)
  const canManageITPTemplates = ITP_MANAGEMENT_ROLES.includes(userRole)

  return {
    hasQualityAccess,
    canConformLots,
    canVerifyTestResults,
    canCloseNCRs,
    canManageITPTemplates,
    isQualityManager: userRole === 'quality_manager',
  }
}
