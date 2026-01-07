import { prisma } from './prisma.js'
import { Request } from 'express'

interface AuditLogParams {
  projectId?: string
  userId: string
  entityType: string
  entityId: string
  action: string
  changes?: Record<string, any>
  req?: Request
}

/**
 * Create an audit log entry
 * Used to track changes to important entities like users, roles, projects
 */
export async function createAuditLog({
  projectId,
  userId,
  entityType,
  entityId,
  action,
  changes,
  req
}: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        projectId,
        userId,
        entityType,
        entityId,
        action,
        changes: changes ? JSON.stringify(changes) : null,
        ipAddress: req?.ip || req?.connection?.remoteAddress || null,
        userAgent: req?.get('user-agent') || null
      }
    })
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('Failed to create audit log:', error)
  }
}

/**
 * Standard audit actions for user management
 */
export const AuditAction = {
  USER_INVITED: 'user_invited',
  USER_ROLE_CHANGED: 'user_role_changed',
  USER_REMOVED: 'user_removed',
  USER_APPROVED: 'user_approved',
  USER_SUSPENDED: 'user_suspended',
  USER_REGISTERED: 'user_registered',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  PASSWORD_CHANGED: 'password_changed',
  PROJECT_CREATED: 'project_created',
  PROJECT_UPDATED: 'project_updated',
  PROJECT_DELETED: 'project_deleted',
  LOT_CREATED: 'lot_created',
  LOT_UPDATED: 'lot_updated',
  LOT_STATUS_CHANGED: 'lot_status_changed',
  NCR_CREATED: 'ncr_created',
  NCR_STATUS_CHANGED: 'ncr_status_changed',
  DOCKET_SUBMITTED: 'docket_submitted',
  DOCKET_APPROVED: 'docket_approved',
  DOCKET_REJECTED: 'docket_rejected'
} as const

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction]
