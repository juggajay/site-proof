/**
 * Centralized role definitions for SiteProof
 * Used for authorization and access control throughout the application
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
 * Role groups for permission checking.
 * Use these to check if a user belongs to a category of roles.
 */
export const ROLE_GROUPS = {
  COMMERCIAL: [ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER] as const,
  ADMIN: [ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER] as const,
  MANAGEMENT: [ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.SITE_MANAGER] as const,
  QUALITY: [ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.QUALITY_MANAGER] as const,
  SUBCONTRACTOR: [ROLES.SUBCONTRACTOR, ROLES.SUBCONTRACTOR_ADMIN] as const,
  FIELD: [ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.SITE_MANAGER, ROLES.SITE_ENGINEER, ROLES.FOREMAN] as const,
  VIEWER: [ROLES.VIEWER] as const,
}

/**
 * Check if a role is in a specific role group
 */
export function hasRoleInGroup(role: string, group: readonly string[]): boolean {
  return group.includes(role)
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
