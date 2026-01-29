/**
 * Centralized role definitions for SiteProof (Frontend)
 * MUST be kept in sync with backend/src/lib/roles.ts
 */

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  PROJECT_MANAGER: 'project_manager',
  QUALITY_MANAGER: 'quality_manager',
  SITE_MANAGER: 'site_manager',
  FOREMAN: 'foreman',
  SITE_ENGINEER: 'site_engineer',
  SUBCONTRACTOR_ADMIN: 'subcontractor_admin',
  SUBCONTRACTOR: 'subcontractor',
  VIEWER: 'viewer',
  MEMBER: 'member',
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

/**
 * Role hierarchy for permission checking
 * Higher numbers = more permissions
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.OWNER]: 100,
  [ROLES.ADMIN]: 90,
  [ROLES.PROJECT_MANAGER]: 80,
  [ROLES.QUALITY_MANAGER]: 75,
  [ROLES.SITE_MANAGER]: 70,
  [ROLES.FOREMAN]: 60,
  [ROLES.SITE_ENGINEER]: 50,
  [ROLES.SUBCONTRACTOR_ADMIN]: 40,
  [ROLES.SUBCONTRACTOR]: 30,
  [ROLES.VIEWER]: 20,
  [ROLES.MEMBER]: 10,
}

/**
 * Check if a role has at least the specified minimum permission level
 */
export function hasMinimumRole(userRole: string, minimumRole: Role): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as Role] ?? 0
  const minimumLevel = ROLE_HIERARCHY[minimumRole]
  return userLevel >= minimumLevel
}

/**
 * Check if a role is an admin-level role (owner or admin)
 */
export function isAdminRole(role: string): boolean {
  return role === ROLES.OWNER || role === ROLES.ADMIN
}

/**
 * Check if a role can manage projects
 */
export function canManageProjects(role: string): boolean {
  return hasMinimumRole(role, ROLES.PROJECT_MANAGER)
}

/**
 * Check if a role can approve items (NCRs, holdpoints, etc.)
 */
export function canApproveItems(role: string): boolean {
  return hasMinimumRole(role, ROLES.QUALITY_MANAGER)
}

/**
 * Get the display name for a role
 */
export function getRoleDisplayName(role: string): string {
  const displayNames: Record<string, string> = {
    [ROLES.OWNER]: 'Owner',
    [ROLES.ADMIN]: 'Administrator',
    [ROLES.PROJECT_MANAGER]: 'Project Manager',
    [ROLES.QUALITY_MANAGER]: 'Quality Manager',
    [ROLES.SITE_MANAGER]: 'Site Manager',
    [ROLES.FOREMAN]: 'Foreman',
    [ROLES.SITE_ENGINEER]: 'Site Engineer',
    [ROLES.SUBCONTRACTOR_ADMIN]: 'Subcontractor Admin',
    [ROLES.SUBCONTRACTOR]: 'Subcontractor',
    [ROLES.VIEWER]: 'Viewer',
    [ROLES.MEMBER]: 'Member',
  }
  return displayNames[role] || role
}

/**
 * All available roles as options for select inputs
 */
export const ROLE_OPTIONS = [
  { value: ROLES.OWNER, label: 'Owner' },
  { value: ROLES.ADMIN, label: 'Administrator' },
  { value: ROLES.PROJECT_MANAGER, label: 'Project Manager' },
  { value: ROLES.QUALITY_MANAGER, label: 'Quality Manager' },
  { value: ROLES.SITE_MANAGER, label: 'Site Manager' },
  { value: ROLES.FOREMAN, label: 'Foreman' },
  { value: ROLES.SITE_ENGINEER, label: 'Site Engineer' },
  { value: ROLES.SUBCONTRACTOR_ADMIN, label: 'Subcontractor Admin' },
  { value: ROLES.SUBCONTRACTOR, label: 'Subcontractor' },
  { value: ROLES.VIEWER, label: 'Viewer' },
  { value: ROLES.MEMBER, label: 'Member' },
] as const

/**
 * Role groups for permission checking.
 * Use these to check if a user belongs to a category of roles.
 */
export const ROLE_GROUPS = {
  // Can view commercial data (contract values, budgets, rates, claims)
  COMMERCIAL: [ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER] as const,

  // Admin-level access
  ADMIN: [ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER] as const,

  // Can manage site operations and subcontractors
  MANAGEMENT: [ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.SITE_MANAGER] as const,

  // Can perform quality actions (conformance, ITP verification)
  QUALITY: [ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.QUALITY_MANAGER] as const,

  // Subcontractor roles
  SUBCONTRACTOR: [ROLES.SUBCONTRACTOR, ROLES.SUBCONTRACTOR_ADMIN] as const,

  // Can view subcontractor rates
  RATE_VIEWERS: [ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER] as const,

  // Can view docket amounts
  DOCKET_AMOUNT_VIEWERS: [ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER] as const,

  // Read-only access
  VIEWER: [ROLES.VIEWER] as const,
}

/**
 * Check if a role is in a specific role group
 */
export function hasRoleInGroup(
  userRole: string | undefined | null,
  group: readonly string[]
): boolean {
  if (!userRole) return false
  return group.includes(userRole)
}

/**
 * Check if user has commercial access
 */
export function hasCommercialAccess(role: string | undefined | null): boolean {
  return hasRoleInGroup(role, ROLE_GROUPS.COMMERCIAL)
}

/**
 * Check if user is a subcontractor
 */
export function isSubcontractorRole(role: string | undefined | null): boolean {
  return hasRoleInGroup(role, ROLE_GROUPS.SUBCONTRACTOR)
}

/**
 * Check if user is a viewer (read-only)
 */
export function isViewerRole(role: string | undefined | null): boolean {
  return hasRoleInGroup(role, ROLE_GROUPS.VIEWER)
}

/**
 * Check if user has quality management access
 */
export function hasQualityAccess(role: string | undefined | null): boolean {
  return hasRoleInGroup(role, ROLE_GROUPS.QUALITY)
}
