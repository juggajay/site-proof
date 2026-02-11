import { prisma } from './prisma.js'
import { Request } from 'express'

interface AuditLogParams {
  projectId?: string
  userId?: string
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
  DOCKET_REJECTED: 'docket_rejected',
  // ITP
  ITP_ITEM_COMPLETED: 'itp_item_completed',
  ITP_ITEM_VERIFIED: 'itp_item_verified',
  ITP_ITEM_REJECTED: 'itp_item_rejected',
  // Hold Points
  HP_RELEASE_REQUESTED: 'hp_release_requested',
  HP_RELEASED: 'hp_released',
  HP_CHASED: 'hp_chased',
  HP_ESCALATED: 'hp_escalated',
  HP_ESCALATION_RESOLVED: 'hp_escalation_resolved',
  HP_PUBLIC_RELEASED: 'hp_public_released',
  // Documents
  DOCUMENT_DELETED: 'document_deleted',
  // Test Results
  TEST_RESULT_CREATED: 'test_result_created',
  TEST_RESULT_UPDATED: 'test_result_updated',
  TEST_RESULT_STATUS_CHANGED: 'test_result_status_changed',
  TEST_RESULT_DELETED: 'test_result_deleted',
  TEST_RESULT_VERIFIED: 'test_result_verified',
  TEST_RESULT_REJECTED: 'test_result_rejected',
  // Claims
  CLAIM_CREATED: 'claim_created',
  CLAIM_STATUS_CHANGED: 'claim_status_changed',
  CLAIM_CERTIFIED: 'claim_certified',
  CLAIM_PAYMENT_RECORDED: 'claim_payment_recorded',
  // Subcontractors
  SUBCONTRACTOR_INVITATION_ACCEPTED: 'subcontractor_invitation_accepted',
  SUBCONTRACTOR_STATUS_CHANGED: 'subcontractor_status_changed',
  SUBCONTRACTOR_EMPLOYEE_RATE_APPROVED: 'subcontractor_employee_rate_approved',
  SUBCONTRACTOR_PLANT_RATE_APPROVED: 'subcontractor_plant_rate_approved',
  SUBCONTRACTOR_PORTAL_ACCESS_UPDATED: 'subcontractor_portal_access_updated'
} as const

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction]
