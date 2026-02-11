// Feature #175 - Auto-notification before witness point
import { prisma } from '../../../lib/prisma.js'

// Type for checklist items from snapshot or template
export interface ChecklistItem {
  id: string
  description: string
  sequenceNumber: number
  pointType?: string | null
  responsibleParty?: string | null
  evidenceRequired?: string | null
  acceptanceCriteria?: string | null
  testType?: string | null
}

// Type for template snapshot
export interface TemplateSnapshot {
  id: string
  name: string
  description?: string | null
  activityType: string | null
  checklistItems: ChecklistItem[]
}

// Type for project settings
export interface ProjectSettings {
  witnessPointNotificationTrigger?: string
  witnessPointNotificationEnabled?: boolean
  witnessPointClientEmail?: string | null
  witnessPointClientName?: string
  requireSubcontractorVerification?: boolean
  hpRecipients?: Array<{ email: string }>
  hpApprovalRequirement?: string
}

/**
 * Check for upcoming witness points and send notifications
 * Called after an ITP item is completed to check if the next item is a witness point
 */
export async function checkAndNotifyWitnessPoint(
  itpInstanceId: string,
  completedItemId: string,
  userId: string
) {
  try {
    // Get the ITP instance with template and lot info
    const instance = await prisma.iTPInstance.findUnique({
      where: { id: itpInstanceId },
      include: {
        lot: {
          include: {
            project: true
          }
        },
        template: {
          include: {
            checklistItems: {
              orderBy: { sequenceNumber: 'asc' }
            }
          }
        },
        completions: true
      }
    })

    if (!instance || !instance.lot || !instance.lot.project) {
      return null
    }

    // Get checklist items from snapshot or template
    let checklistItems: ChecklistItem[]
    if (instance.templateSnapshot) {
      const snapshot: TemplateSnapshot = JSON.parse(instance.templateSnapshot)
      checklistItems = snapshot.checklistItems || []
    } else {
      checklistItems = instance.template.checklistItems
    }

    // Find the completed item's sequence number
    const completedItem = checklistItems.find((item) => item.id === completedItemId)
    if (!completedItem) {
      return null
    }

    const completedSequence = completedItem.sequenceNumber

    // Check project settings for witness point notification configuration
    const project = instance.lot.project
    let settings: ProjectSettings = {}
    if (project.settings) {
      try {
        settings = JSON.parse(project.settings) as ProjectSettings
      } catch (e) {
        // Invalid JSON, use defaults
      }
    }

    // Default: notify when previous item is completed
    const notificationTrigger = settings.witnessPointNotificationTrigger || 'previous_item'
    const witnessNotificationEnabled = settings.witnessPointNotificationEnabled !== false // default true
    const clientEmail = settings.witnessPointClientEmail || null
    const clientName = settings.witnessPointClientName || 'Client Representative'

    if (!witnessNotificationEnabled) {
      return null
    }

    // Determine the sequence number to check for witness point
    let targetSequence: number
    if (notificationTrigger === '2_items_before') {
      targetSequence = completedSequence + 2
    } else {
      // previous_item (default)
      targetSequence = completedSequence + 1
    }

    // Find the target item
    const nextItem = checklistItems.find((item) => item.sequenceNumber === targetSequence)
    if (!nextItem) {
      return null
    }

    // Check if it's a witness point (pointType can be 'witness' or 'witness_point')
    if (nextItem.pointType !== 'witness' && nextItem.pointType !== 'witness_point') {
      return null
    }

    // Check if the witness point is already completed (no need to notify)
    const witnessPointCompletion = instance.completions.find(
      (c) => c.checklistItemId === nextItem.id && (c.status === 'completed' || c.status === 'not_applicable')
    )
    if (witnessPointCompletion) {
      return null // Witness point already passed
    }

    // Check if notification was already sent for this witness point
    const existingNotification = await prisma.notification.findFirst({
      where: {
        projectId: project.id,
        type: 'witness_point_approaching',
        linkUrl: { contains: nextItem.id }
      }
    })

    if (existingNotification) {
      return null // Already notified
    }

    // Get the user who completed the item to attribute the notification
    const completingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true }
    })

    const userName = completingUser?.fullName || completingUser?.email || 'A team member'

    // Create notifications for project managers and superintendents
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: project.id,
        role: { in: ['project_manager', 'admin', 'superintendent'] }
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } }
      }
    })

    const notificationsCreated = []

    for (const pu of projectUsers) {
      const notification = await prisma.notification.create({
        data: {
          userId: pu.user.id,
          projectId: project.id,
          type: 'witness_point_approaching',
          title: `Witness Point Approaching: ${nextItem.description}`,
          message: `${userName} completed "${completedItem.description}" on lot ${instance.lot.lotNumber}. The next item is a witness point that requires client notification.`,
          linkUrl: `/projects/${project.id}/lots/${instance.lot.id}?tab=itp&highlight=${nextItem.id}`
        }
      })
      notificationsCreated.push(notification)
    }

    return {
      witnessPoint: nextItem,
      notificationsSent: notificationsCreated.length,
      clientEmail,
      clientName
    }
  } catch (error) {
    // Note: This helper intentionally catches errors since notification is non-critical
    console.error('Error checking witness point notification:', error)
    return null
  }
}
