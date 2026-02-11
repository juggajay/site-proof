/**
 * Role-based filtering utilities for backend routes.
 * Centralizes common permission and filtering logic.
 */

import { prisma } from './prisma.js'
import { ROLE_GROUPS, hasRoleInGroup } from './roles.js'

interface AuthUser {
  id: string
  roleInCompany: string
  companyId?: string
}

/**
 * Get the subcontractor company ID for a user if they are a subcontractor.
 * Returns null if the user is not a subcontractor or has no company assigned.
 *
 * @param user - The authenticated user
 * @returns The subcontractor company ID or null
 *
 * @example
 * const subcontractorId = await getSubcontractorCompanyId(req.user)
 * if (isSubcontractor(req.user) && !subcontractorId) {
 *   return res.json({ items: [] }) // No access
 * }
 * if (subcontractorId) {
 *   whereClause.assignedSubcontractorId = subcontractorId
 * }
 */
export async function getSubcontractorCompanyId(user: AuthUser): Promise<string | null> {
  if (!isSubcontractor(user)) {
    return null
  }

  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: { userId: user.id },
    select: { subcontractorCompanyId: true }
  })

  return subcontractorUser?.subcontractorCompanyId || null
}

/**
 * Check if a user has a subcontractor role.
 */
export function isSubcontractor(user: AuthUser): boolean {
  return hasRoleInGroup(user.roleInCompany, ROLE_GROUPS.SUBCONTRACTOR)
}

/**
 * Check if a user has commercial access (can view budgets, rates, claims).
 */
export function hasCommercialAccess(user: AuthUser): boolean {
  return hasRoleInGroup(user.roleInCompany, ROLE_GROUPS.COMMERCIAL)
}

/**
 * Check if a user has admin access.
 */
export function hasAdminAccess(user: AuthUser): boolean {
  return hasRoleInGroup(user.roleInCompany, ROLE_GROUPS.ADMIN)
}

/**
 * Check if a user has quality management access.
 */
export function hasQualityAccess(user: AuthUser): boolean {
  return hasRoleInGroup(user.roleInCompany, ROLE_GROUPS.QUALITY)
}

/**
 * Check if a user has management access (can manage subcontractors, site operations).
 */
export function hasManagementAccess(user: AuthUser): boolean {
  return hasRoleInGroup(user.roleInCompany, ROLE_GROUPS.MANAGEMENT)
}

/**
 * Apply subcontractor filtering to a where clause.
 * Returns the modified where clause and a flag indicating if the user should see empty results.
 *
 * @param user - The authenticated user
 * @param whereClause - The existing where clause
 * @param fieldName - The field to filter by (default: 'assignedSubcontractorId')
 * @returns Object with the modified where clause and empty flag
 *
 * @example
 * const { whereClause: filtered, returnEmpty } = await applySubcontractorFilter(
 *   req.user,
 *   { projectId },
 *   'assignedSubcontractorId'
 * )
 * if (returnEmpty) return res.json({ items: [] })
 */
export async function applySubcontractorFilter<T extends Record<string, unknown>>(
  user: AuthUser,
  whereClause: T,
  fieldName: string = 'assignedSubcontractorId'
): Promise<{ whereClause: T; returnEmpty: boolean }> {
  if (!isSubcontractor(user)) {
    return { whereClause, returnEmpty: false }
  }

  const subcontractorId = await getSubcontractorCompanyId(user)

  if (!subcontractorId) {
    // User is subcontractor but has no company - return empty
    return { whereClause, returnEmpty: true }
  }

  return {
    whereClause: { ...whereClause, [fieldName]: subcontractorId },
    returnEmpty: false
  }
}
