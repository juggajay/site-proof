import { Router, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import crypto from 'crypto'
import { z } from 'zod'
import { sendNotificationIfEnabled } from './notifications.js'
import { sendHPReleaseRequestEmail, sendHPChaseEmail, sendHPReleaseConfirmationEmail } from '../lib/email.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { createAuditLog, AuditAction } from '../lib/auditLog.js'
import { parsePagination, getPaginationMeta } from '../lib/pagination.js'

// Type for hold point list item
interface HoldPointListItem {
  id: string
  lotId: string
  lotNumber: string
  itpChecklistItemId: string
  description: string
  pointType: string | null
  status: string
  notificationSentAt: Date | null | undefined
  scheduledDate: Date | null | undefined
  releasedAt: Date | null | undefined
  releasedByName: string | null | undefined
  releaseNotes: string | null | undefined
  sequenceNumber: number
  isCompleted: boolean
  isVerified: boolean
  createdAt: Date
}

// Type for project settings related to hold points
interface HPProjectSettings {
  hpRecipients?: Array<{ email: string }>
  hpApprovalRequirement?: string
  holdPointMinimumNoticeDays?: number
}

// =============================================================================
// Zod Validation Schemas
// =============================================================================

const requestReleaseSchema = z.object({
  lotId: z.string().min(1, 'lotId is required'),
  itpChecklistItemId: z.string().min(1, 'itpChecklistItemId is required'),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  notificationSentTo: z.string().optional(),
  noticePeriodOverride: z.boolean().optional(),
  noticePeriodOverrideReason: z.string().optional()
})

const releaseHoldPointSchema = z.object({
  releasedByName: z.string().optional(),
  releasedByOrg: z.string().optional(),
  releaseMethod: z.string().optional(),
  releaseNotes: z.string().optional()
})

const escalateSchema = z.object({
  escalatedTo: z.string().optional(),
  escalationReason: z.string().optional()
})

const calculateNotificationTimeSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  requestedDateTime: z.string().min(1, 'requestedDateTime is required')
})

const previewEvidencePackageSchema = z.object({
  lotId: z.string().min(1, 'lotId is required'),
  itpChecklistItemId: z.string().min(1, 'itpChecklistItemId is required')
})

const publicReleaseSchema = z.object({
  releasedByName: z.string().min(1, 'Released by name is required'),
  releasedByOrg: z.string().optional(),
  releaseNotes: z.string().optional(),
  signatureDataUrl: z.string().optional()
})

// Secure link expiry time (48 hours)
const SECURE_LINK_EXPIRY_HOURS = 48

const holdpointsRouter = Router()

// Utility function to calculate appropriate notification time based on working hours
function calculateNotificationTime(
  requestedDate: Date,
  workingHoursStart: string = '07:00',
  workingHoursEnd: string = '17:00',
  workingDays: string = '1,2,3,4,5' // Mon-Fri by default
): { scheduledTime: Date; adjustedForWorkingHours: boolean; reason?: string } {
  const [startHour, startMin] = workingHoursStart.split(':').map(Number)
  const [endHour, endMin] = workingHoursEnd.split(':').map(Number)
  const workingDaysList = workingDays.split(',').map(Number) // 0=Sun, 1=Mon, etc.

  let notificationTime = new Date(requestedDate)
  let adjustedForWorkingHours = false
  let reason: string | undefined

  // Check if requested time is within working hours
  const requestedHour = notificationTime.getHours()
  const requestedMin = notificationTime.getMinutes()
  const requestedDay = notificationTime.getDay()

  const requestedTimeMinutes = requestedHour * 60 + requestedMin
  const startTimeMinutes = startHour * 60 + startMin
  const endTimeMinutes = endHour * 60 + endMin

  // Check if it's a working day
  if (!workingDaysList.includes(requestedDay)) {
    adjustedForWorkingHours = true
    reason = 'Scheduled for non-working day'

    // Find next working day
    let daysToAdd = 1
    while (!workingDaysList.includes((requestedDay + daysToAdd) % 7)) {
      daysToAdd++
      if (daysToAdd > 7) break // Safety to prevent infinite loop
    }
    notificationTime.setDate(notificationTime.getDate() + daysToAdd)
    notificationTime.setHours(startHour, startMin, 0, 0)
    reason = `Adjusted to next working day (${notificationTime.toDateString()}) at ${workingHoursStart}`
  }
  // Check if before working hours start
  else if (requestedTimeMinutes < startTimeMinutes) {
    adjustedForWorkingHours = true
    notificationTime.setHours(startHour, startMin, 0, 0)
    reason = `Adjusted to start of working hours (${workingHoursStart})`
  }
  // Check if after working hours end
  else if (requestedTimeMinutes >= endTimeMinutes) {
    adjustedForWorkingHours = true

    // Schedule for next working day
    let daysToAdd = 1
    while (!workingDaysList.includes((requestedDay + daysToAdd) % 7)) {
      daysToAdd++
      if (daysToAdd > 7) break
    }
    notificationTime.setDate(notificationTime.getDate() + daysToAdd)
    notificationTime.setHours(startHour, startMin, 0, 0)
    reason = `Scheduled after hours - moved to next working day (${notificationTime.toDateString()}) at ${workingHoursStart}`
  }

  return { scheduledTime: notificationTime, adjustedForWorkingHours, reason }
}

// Get all hold points for a project
holdpointsRouter.get('/project/:projectId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const user = req.user!

    // Build where clause for lots
    const lotsWhere: Prisma.LotWhereInput = { projectId }

    // Subcontractors can only see hold points on their assigned lots
    if (user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin') {
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: { userId: user.id },
        include: { subcontractorCompany: true }
      })

      if (subcontractorUser) {
        const subCompanyId = subcontractorUser.subcontractorCompanyId

        // Get lots assigned via LotSubcontractorAssignment
        const lotAssignments = await prisma.lotSubcontractorAssignment.findMany({
          where: {
            subcontractorCompanyId: subCompanyId,
            status: 'active',
            projectId,
          },
          select: { lotId: true }
        })
        const assignedLotIds = lotAssignments.map(a => a.lotId)

        // Include lots from both legacy field AND new assignment model
        lotsWhere.OR = [
          { assignedSubcontractorId: subCompanyId },
          ...(assignedLotIds.length > 0 ? [{ id: { in: assignedLotIds } }] : [])
        ]
      } else {
        // No subcontractor company - return empty
        return res.json({ holdPoints: [] })
      }
    }

    // Get all lots for the project that have ITP instances with hold points
    const lots = await prisma.lot.findMany({
      where: lotsWhere,
      include: {
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  where: { pointType: 'hold_point' },
                  orderBy: { sequenceNumber: 'asc' }
                }
              }
            },
            completions: true
          }
        },
        holdPoints: {
          include: {
            itpChecklistItem: true
          }
        }
      }
    })

    // Transform to hold point list
    const holdPoints: HoldPointListItem[] = []

    for (const lot of lots) {
      if (!lot.itpInstance?.template?.checklistItems) continue

      for (const item of lot.itpInstance.template.checklistItems) {
        // Find existing hold point record or create virtual one
        const existingHP = lot.holdPoints.find(hp => hp.itpChecklistItemId === item.id)

        // Find the completion status for this item
        const completion = lot.itpInstance.completions.find(c => c.checklistItemId === item.id)

        holdPoints.push({
          id: existingHP?.id || `virtual-${lot.id}-${item.id}`,
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          itpChecklistItemId: item.id,
          description: item.description,
          pointType: item.pointType,
          status: existingHP?.status || 'pending',
          notificationSentAt: existingHP?.notificationSentAt,
          scheduledDate: existingHP?.scheduledDate,
          releasedAt: existingHP?.releasedAt,
          releasedByName: existingHP?.releasedByName,
          releaseNotes: existingHP?.releaseNotes,
          sequenceNumber: item.sequenceNumber,
          isCompleted: completion?.status === 'completed',
          isVerified: completion?.verificationStatus === 'verified',
          createdAt: existingHP?.createdAt || lot.createdAt
        })
      }
    }

    // Sort by lot number, then sequence number
    holdPoints.sort((a, b) => {
      if (a.lotNumber !== b.lotNumber) return a.lotNumber.localeCompare(b.lotNumber)
      return a.sequenceNumber - b.sequenceNumber
    })

    // Apply pagination
    const { page, limit } = parsePagination(req.query)
    const total = holdPoints.length
    const start = (page - 1) * limit
    const paginatedHoldPoints = holdPoints.slice(start, start + limit)

    res.json({
      holdPoints: paginatedHoldPoints,
      pagination: getPaginationMeta(total, page, limit),
    })
  } catch (error) {
    console.error('Error fetching hold points:', error)
    res.status(500).json({ error: 'Failed to fetch hold points' })
  }
})

// Get hold point details with prerequisite status
holdpointsRouter.get('/lot/:lotId/item/:itemId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { lotId, itemId } = req.params

    // Get the lot with ITP instance and all checklist items
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        project: true, // Include project to get HP recipients from settings
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  orderBy: { sequenceNumber: 'asc' }
                }
              }
            },
            completions: true
          }
        },
        holdPoints: {
          where: { itpChecklistItemId: itemId },
          include: { itpChecklistItem: true }
        }
      }
    })

    if (!lot || !lot.itpInstance) {
      return res.status(404).json({ error: 'Lot or ITP instance not found' })
    }

    // Find the hold point item
    const holdPointItem = lot.itpInstance.template.checklistItems.find(i => i.id === itemId)
    if (!holdPointItem || holdPointItem.pointType !== 'hold_point') {
      return res.status(404).json({ error: 'Hold point item not found' })
    }

    // Get all preceding items (items with lower sequence number)
    const precedingItems = lot.itpInstance.template.checklistItems.filter(
      i => i.sequenceNumber < holdPointItem.sequenceNumber
    )

    // Check completion status of each preceding item
    const prerequisites = precedingItems.map(item => {
      const completion = lot.itpInstance!.completions.find(c => c.checklistItemId === item.id)
      return {
        id: item.id,
        description: item.description,
        sequenceNumber: item.sequenceNumber,
        isHoldPoint: item.pointType === 'hold_point',
        isCompleted: completion?.status === 'completed',
        isVerified: completion?.verificationStatus === 'verified',
        completedAt: completion?.completedAt
      }
    })

    // Check if all prerequisites are completed
    const incompletePrerequisites = prerequisites.filter(p => !p.isCompleted)
    const canRequestRelease = incompletePrerequisites.length === 0

    // Get existing hold point record
    const existingHP = lot.holdPoints[0]

    // Get HP default recipients from project settings (Feature #697)
    // Get HP approval requirement from project settings (Feature #698)
    let defaultRecipients: string[] = []
    let approvalRequirement = 'any'
    if (lot.project.settings) {
      try {
        const settings = JSON.parse(lot.project.settings)
        if (settings.hpRecipients && Array.isArray(settings.hpRecipients)) {
          defaultRecipients = (settings as HPProjectSettings).hpRecipients?.map((r) => r.email).filter(Boolean) || []
        }
        if (settings.hpApprovalRequirement) {
          approvalRequirement = settings.hpApprovalRequirement
        }
      } catch (e) {
        // Invalid JSON, use defaults
      }
    }

    res.json({
      holdPoint: {
        id: existingHP?.id || null,
        lotId,
        lotNumber: lot.lotNumber,
        itpChecklistItemId: itemId,
        description: holdPointItem.description,
        sequenceNumber: holdPointItem.sequenceNumber,
        status: existingHP?.status || 'pending',
        notificationSentAt: existingHP?.notificationSentAt,
        scheduledDate: existingHP?.scheduledDate,
        releasedAt: existingHP?.releasedAt,
        releasedByName: existingHP?.releasedByName,
        releaseNotes: existingHP?.releaseNotes
      },
      prerequisites,
      incompletePrerequisites,
      canRequestRelease,
      defaultRecipients, // Feature #697 - HP default recipients from project settings
      approvalRequirement // Feature #698 - HP approval requirement from project settings
    })
  } catch (error) {
    console.error('Error fetching hold point details:', error)
    res.status(500).json({ error: 'Failed to fetch hold point details' })
  }
})

// Utility function to calculate working days between two dates
function calculateWorkingDays(
  fromDate: Date,
  toDate: Date,
  workingDays: string = '1,2,3,4,5' // Mon-Fri by default
): number {
  const workingDaysList = workingDays.split(',').map(Number) // 0=Sun, 1=Mon, etc.
  let count = 0
  const current = new Date(fromDate)
  current.setHours(0, 0, 0, 0)
  const target = new Date(toDate)
  target.setHours(0, 0, 0, 0)

  while (current < target) {
    if (workingDaysList.includes(current.getDay())) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  return count
}

// Request hold point release - checks prerequisites first
holdpointsRouter.post('/request-release', requireAuth, async (req: Request, res: Response) => {
  try {
    const parseResult = requestReleaseSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      })
    }

    const { lotId, itpChecklistItemId, scheduledDate, scheduledTime, notificationSentTo, noticePeriodOverride, noticePeriodOverrideReason } = parseResult.data

    // Get the lot with ITP instance and project
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        project: true,
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  orderBy: { sequenceNumber: 'asc' }
                }
              }
            },
            completions: true
          }
        },
        holdPoints: {
          where: { itpChecklistItemId }
        }
      }
    })

    if (!lot || !lot.itpInstance) {
      return res.status(404).json({ error: 'Lot or ITP instance not found' })
    }

    // Find the hold point item
    const holdPointItem = lot.itpInstance.template.checklistItems.find(i => i.id === itpChecklistItemId)
    if (!holdPointItem || holdPointItem.pointType !== 'hold_point') {
      return res.status(400).json({ error: 'Item is not a hold point' })
    }

    // Get all preceding items
    const precedingItems = lot.itpInstance.template.checklistItems.filter(
      i => i.sequenceNumber < holdPointItem.sequenceNumber
    )

    // Check completion status of preceding items
    const incompleteItems = precedingItems.filter(item => {
      const completion = lot.itpInstance!.completions.find(c => c.checklistItemId === item.id)
      return !completion || completion.status !== 'completed'
    })

    // If there are incomplete prerequisites, return error with list
    if (incompleteItems.length > 0) {
      return res.status(400).json({
        error: 'Prerequisites not completed',
        message: 'Cannot request hold point release until all preceding checklist items are completed.',
        incompleteItems: incompleteItems.map(item => ({
          id: item.id,
          description: item.description,
          sequenceNumber: item.sequenceNumber,
          isHoldPoint: item.pointType === 'hold_point'
        }))
      })
    }

    // Check minimum notice period (Feature #180)
    let projectSettings: HPProjectSettings = {}
    if (lot.project.settings) {
      try {
        projectSettings = JSON.parse(lot.project.settings) as HPProjectSettings
      } catch (e) {
        // Invalid JSON, use defaults
      }
    }

    // Default minimum notice period is 1 working day
    const minimumNoticeDays = projectSettings.holdPointMinimumNoticeDays ?? 1

    if (scheduledDate && minimumNoticeDays > 0 && !noticePeriodOverride) {
      const today = new Date()
      const scheduled = new Date(scheduledDate)
      const workingDays = calculateWorkingDays(
        today,
        scheduled,
        lot.project.workingDays || '1,2,3,4,5'
      )

      if (workingDays < minimumNoticeDays) {
        return res.status(400).json({
          error: 'Notice period not met',
          code: 'NOTICE_PERIOD_WARNING',
          message: `The scheduled date is less than the minimum ${minimumNoticeDays} working day${minimumNoticeDays > 1 ? 's' : ''} notice period.`,
          details: {
            scheduledDate,
            workingDaysNotice: workingDays,
            minimumNoticeDays,
            requiresOverride: true
          }
        })
      }
    }

    // All prerequisites completed - create or update hold point request
    // If override was used, include the reason in notes
    const overrideNote = noticePeriodOverride && noticePeriodOverrideReason
      ? `[Notice period override: ${noticePeriodOverrideReason}]`
      : null

    let holdPoint
    if (lot.holdPoints.length > 0) {
      // Update existing
      holdPoint = await prisma.holdPoint.update({
        where: { id: lot.holdPoints[0].id },
        data: {
          status: 'notified',
          notificationSentAt: new Date(),
          notificationSentTo: notificationSentTo || null,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          scheduledTime: scheduledTime || null,
          ...(overrideNote && { releaseNotes: overrideNote })
        },
        include: { itpChecklistItem: true }
      })
    } else {
      // Create new
      holdPoint = await prisma.holdPoint.create({
        data: {
          lotId,
          itpChecklistItemId,
          pointType: 'hold_point',
          description: holdPointItem.description,
          status: 'notified',
          notificationSentAt: new Date(),
          notificationSentTo: notificationSentTo || null,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          scheduledTime: scheduledTime || null,
          ...(overrideNote && { releaseNotes: overrideNote })
        },
        include: { itpChecklistItem: true }
      })
    }

    // Feature #946 - Send HP release request email to superintendent
    try {
      // Get the requesting user's details
      const requestingUser = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { fullName: true, email: true }
      })

      // Get project users with superintendent role to notify
      const superintendents = await prisma.projectUser.findMany({
        where: {
          projectId: lot.project.id,
          role: 'superintendent',
          status: 'active'
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } }
        }
      })

      // If no superintendents, also check for project managers
      const recipientsToNotify = superintendents.length > 0 ? superintendents : await prisma.projectUser.findMany({
        where: {
          projectId: lot.project.id,
          role: 'project_manager',
          status: 'active'
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } }
        }
      })

      const requestedBy = requestingUser?.fullName || requestingUser?.email || 'Unknown'
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
      const releaseUrl = `${baseUrl}/projects/${lot.project.id}/lots/${lot.id}?tab=itp`
      const evidencePackageUrl = `${baseUrl}/projects/${lot.project.id}/lots/${lot.id}/evidence-preview?holdPointId=${holdPoint.id}`

      // Format scheduled date for display
      const formattedScheduledDate = scheduledDate
        ? new Date(scheduledDate).toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : undefined

      for (const recipient of recipientsToNotify) {
        // Feature #23 - Generate secure release token for each recipient
        const secureToken = crypto.randomBytes(32).toString('hex')
        const tokenExpiry = new Date(Date.now() + SECURE_LINK_EXPIRY_HOURS * 60 * 60 * 1000)

        // Store the secure token
        await prisma.holdPointReleaseToken.create({
          data: {
            holdPointId: holdPoint.id,
            recipientEmail: recipient.user.email,
            recipientName: recipient.user.fullName,
            token: secureToken,
            expiresAt: tokenExpiry
          }
        })

        // Generate secure release URL
        const secureReleaseUrl = `${baseUrl}/hp-release/${secureToken}`

        await sendHPReleaseRequestEmail({
          to: recipient.user.email,
          superintendentName: recipient.user.fullName || 'Superintendent',
          projectName: lot.project.name,
          lotNumber: lot.lotNumber,
          holdPointDescription: holdPointItem.description,
          scheduledDate: formattedScheduledDate,
          scheduledTime: scheduledTime || undefined,
          evidencePackageUrl,
          releaseUrl,
          secureReleaseUrl, // Feature #23 - Include secure release link
          requestedBy,
          noticeOverrideReason: noticePeriodOverrideReason || undefined
        })
      }

    } catch (emailError) {
      console.error('[HP Release Request] Failed to send superintendent email:', emailError)
      // Don't fail the main request
    }

    // Audit log for HP release request
    await createAuditLog({
      projectId: lot.project.id,
      userId: req.user!.userId,
      entityType: 'hold_point',
      entityId: holdPoint.id,
      action: AuditAction.HP_RELEASE_REQUESTED,
      changes: { lotId, itpChecklistItemId, scheduledDate, scheduledTime, noticePeriodOverride },
      req
    })

    res.json({
      success: true,
      message: 'Hold point release requested successfully',
      holdPoint
    })
  } catch (error) {
    console.error('Error requesting hold point release:', error)
    res.status(500).json({ error: 'Failed to request hold point release' })
  }
})

// Release a hold point
holdpointsRouter.post('/:id/release', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const parseResult = releaseHoldPointSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      })
    }

    const { releasedByName, releasedByOrg, releaseMethod, releaseNotes } = parseResult.data

    // Feature #698 - Check HP approval requirements from project settings
    const existingHP = await prisma.holdPoint.findUnique({
      where: { id },
      include: {
        lot: {
          include: {
            project: true
          }
        }
      }
    })

    if (!existingHP) {
      return res.status(404).json({ error: 'Hold point not found' })
    }

    // Check if project requires superintendent-only release
    let approvalRequirement = 'any'
    if (existingHP.lot.project.settings) {
      try {
        const settings = JSON.parse(existingHP.lot.project.settings)
        if (settings.hpApprovalRequirement) {
          approvalRequirement = settings.hpApprovalRequirement
        }
      } catch (e) {
        // Invalid JSON, use default
      }
    }

    // If superintendent-only, check user's role in the project
    if (approvalRequirement === 'superintendent') {
      const userId = req.user?.id
      if (userId) {
        const teamMember = await prisma.projectUser.findFirst({
          where: {
            projectId: existingHP.lot.projectId,
            userId: userId,
            status: 'active'
          }
        })
        const userRole = teamMember?.role || req.user?.role
        // Allow superintendent, admin, and project_manager roles
        const allowedRoles = ['superintendent', 'admin', 'project_manager', 'owner']
        if (!userRole || !allowedRoles.includes(userRole)) {
          return res.status(403).json({
            error: 'Unauthorized',
            message: 'This project requires superintendent approval to release hold points.',
            code: 'SUPERINTENDENT_REQUIRED'
          })
        }
      }
    }

    const holdPoint = await prisma.holdPoint.update({
      where: { id },
      data: {
        status: 'released',
        releasedAt: new Date(),
        releasedByName: releasedByName || null,
        releasedByOrg: releasedByOrg || null,
        releaseMethod: releaseMethod || null,
        releaseNotes: releaseNotes || null
      },
      include: {
        itpChecklistItem: true,
        lot: true
      }
    })

    // Also mark the ITP completion as verified
    const itpInstance = await prisma.iTPInstance.findUnique({
      where: { lotId: holdPoint.lotId }
    })

    if (itpInstance) {
      await prisma.iTPCompletion.updateMany({
        where: {
          itpInstanceId: itpInstance.id,
          checklistItemId: holdPoint.itpChecklistItemId
        },
        data: {
          verificationStatus: 'verified',
          verifiedAt: new Date()
        }
      })
    }

    // Feature #925 - HP release notification to team
    // Get project team members to notify about HP release
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: existingHP.lot.projectId
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true }
        }
      }
    })

    // Create in-app notifications for all project team members
    const notificationsToCreate = projectUsers.map(pu => ({
      userId: pu.userId,
      projectId: existingHP.lot.projectId,
      type: 'hold_point_release',
      title: 'Hold Point Released',
      message: `Hold point "${holdPoint.description}" on lot ${holdPoint.lot.lotNumber} has been released by ${releasedByName || 'Unknown'}.`,
      linkUrl: `/projects/${existingHP.lot.projectId}/hold-points`
    }))

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate
      })
    }

    // Send email notifications to team members (if configured)
    for (const pu of projectUsers) {
      try {
        await sendNotificationIfEnabled(pu.userId, 'holdPointRelease', {
          title: 'Hold Point Released',
          message: `Hold point "${holdPoint.description}" on lot ${holdPoint.lot.lotNumber} has been released by ${releasedByName || 'Unknown'}.\n\nProject: ${existingHP.lot.project.name}\nRelease Method: ${releaseMethod || 'Digital'}\nNotes: ${releaseNotes || 'None'}`,
          projectName: existingHP.lot.project.name,
          linkUrl: `/projects/${existingHP.lot.projectId}/hold-points`
        })
      } catch (emailError) {
        console.error(`[HP Release] Failed to send email to user ${pu.userId}:`, emailError)
        // Continue with other notifications even if one fails
      }
    }

    // Feature #948 - Send HP release confirmation emails to contractor and superintendent
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
      const lotUrl = `${baseUrl}/projects/${existingHP.lot.projectId}/lots/${existingHP.lot.id}`
      const releasedAt = new Date().toLocaleString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      // Send to contractors (site_engineer, foreman roles)
      const contractorRoles = ['site_engineer', 'foreman', 'engineer']
      const contractors = projectUsers.filter(pu => contractorRoles.includes(pu.role))

      for (const contractor of contractors) {
        await sendHPReleaseConfirmationEmail({
          to: contractor.user.email,
          recipientName: contractor.user.fullName || 'Site Team',
          recipientRole: 'contractor',
          projectName: existingHP.lot.project.name,
          lotNumber: holdPoint.lot.lotNumber,
          holdPointDescription: holdPoint.description || 'Hold Point',
          releasedByName: releasedByName || 'Unknown',
          releasedByOrg: releasedByOrg || undefined,
          releaseMethod: releaseMethod || undefined,
          releaseNotes: releaseNotes || undefined,
          releasedAt,
          lotUrl
        })
      }

      // Send to superintendents
      const superintendentRoles = ['superintendent', 'project_manager']
      const superintendents = projectUsers.filter(pu => superintendentRoles.includes(pu.role))

      for (const superintendent of superintendents) {
        await sendHPReleaseConfirmationEmail({
          to: superintendent.user.email,
          recipientName: superintendent.user.fullName || 'Superintendent',
          recipientRole: 'superintendent',
          projectName: existingHP.lot.project.name,
          lotNumber: holdPoint.lot.lotNumber,
          holdPointDescription: holdPoint.description || 'Hold Point',
          releasedByName: releasedByName || 'Unknown',
          releasedByOrg: releasedByOrg || undefined,
          releaseMethod: releaseMethod || undefined,
          releaseNotes: releaseNotes || undefined,
          releasedAt,
          lotUrl
        })
      }

    } catch (emailError) {
      console.error('[HP Release] Failed to send confirmation emails:', emailError)
      // Don't fail the main request
    }

    // Audit log for HP release
    await createAuditLog({
      projectId: existingHP.lot.projectId,
      userId: req.user!.userId,
      entityType: 'hold_point',
      entityId: id,
      action: AuditAction.HP_RELEASED,
      changes: { releasedByName, releasedByOrg, releaseMethod, releaseNotes },
      req
    })

    res.json({
      success: true,
      message: 'Hold point released successfully',
      holdPoint,
      notifiedUsers: projectUsers.map(pu => ({
        email: pu.user.email,
        fullName: pu.user.fullName
      }))
    })
  } catch (error) {
    console.error('Error releasing hold point:', error)
    res.status(500).json({ error: 'Failed to release hold point' })
  }
})

// Chase a hold point (send reminder)
holdpointsRouter.post('/:id/chase', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Get the hold point with lot and project details before updating
    const existingHP = await prisma.holdPoint.findUnique({
      where: { id },
      include: {
        lot: {
          include: {
            project: true
          }
        }
      }
    })

    if (!existingHP) {
      return res.status(404).json({ error: 'Hold point not found' })
    }

    const holdPoint = await prisma.holdPoint.update({
      where: { id },
      data: {
        chaseCount: { increment: 1 },
        lastChasedAt: new Date()
      }
    })

    // Feature #947 - Send HP chase email to superintendent
    try {
      // Get project users with superintendent role to notify
      const superintendents = await prisma.projectUser.findMany({
        where: {
          projectId: existingHP.lot.project.id,
          role: 'superintendent',
          status: 'active'
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } }
        }
      })

      // If no superintendents, also check for project managers
      const recipientsToNotify = superintendents.length > 0 ? superintendents : await prisma.projectUser.findMany({
        where: {
          projectId: existingHP.lot.project.id,
          role: 'project_manager',
          status: 'active'
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } }
        }
      })

      // Get the original requester info (from who created the HP request)
      const requestedBy = existingHP.notificationSentTo || 'Site Team'

      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
      const releaseUrl = `${baseUrl}/projects/${existingHP.lot.project.id}/lots/${existingHP.lot.id}?tab=itp`
      const evidencePackageUrl = `${baseUrl}/projects/${existingHP.lot.project.id}/lots/${existingHP.lot.id}/evidence-preview?holdPointId=${existingHP.id}`

      // Calculate days since original request
      const originalRequestDate = existingHP.notificationSentAt || existingHP.createdAt
      const daysSinceRequest = Math.floor((Date.now() - originalRequestDate.getTime()) / (1000 * 60 * 60 * 24))
      const formattedRequestDate = originalRequestDate.toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      for (const recipient of recipientsToNotify) {
        await sendHPChaseEmail({
          to: recipient.user.email,
          superintendentName: recipient.user.fullName || 'Superintendent',
          projectName: existingHP.lot.project.name,
          lotNumber: existingHP.lot.lotNumber,
          holdPointDescription: existingHP.description || 'Hold Point',
          originalRequestDate: formattedRequestDate,
          chaseCount: holdPoint.chaseCount || 1,
          daysSinceRequest,
          evidencePackageUrl,
          releaseUrl,
          requestedBy
        })
      }

    } catch (emailError) {
      console.error('[HP Chase] Failed to send chase email:', emailError)
      // Don't fail the main request
    }

    // Audit log for HP chase
    await createAuditLog({
      projectId: existingHP.lot.project.id,
      userId: req.user!.userId,
      entityType: 'hold_point',
      entityId: id,
      action: AuditAction.HP_CHASED,
      changes: { chaseCount: holdPoint.chaseCount },
      req
    })

    res.json({
      success: true,
      message: 'Chase notification sent',
      holdPoint
    })
  } catch (error) {
    console.error('Error chasing hold point:', error)
    res.status(500).json({ error: 'Failed to chase hold point' })
  }
})

// Escalate a hold point to QM/PM
holdpointsRouter.post('/:id/escalate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const parseResult = escalateSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      })
    }

    const { escalatedTo, escalationReason } = parseResult.data
    const userId = req.user!.userId

    // Get hold point with lot/project info
    const existingHP = await prisma.holdPoint.findUnique({
      where: { id },
      include: {
        lot: {
          include: {
            project: true
          }
        }
      }
    })

    if (!existingHP) {
      return res.status(404).json({ error: 'Hold point not found' })
    }

    // Update hold point with escalation info
    const holdPoint = await prisma.holdPoint.update({
      where: { id },
      data: {
        isEscalated: true,
        escalatedAt: new Date(),
        escalatedById: userId,
        escalatedTo: escalatedTo || 'QM,PM', // Default to QM and PM
        escalationReason: escalationReason || 'Stale hold point - no response received'
      },
      include: {
        lot: true,
        itpChecklistItem: true
      }
    })

    // Get QM/PM users from the project to notify
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: existingHP.lot.projectId,
        role: { in: ['admin', 'project_manager', 'qm', 'quality_manager'] }
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true }
        }
      }
    })

    // Create notifications for QM/PM users
    const notificationsToCreate = projectUsers.map(pu => ({
      userId: pu.userId,
      projectId: existingHP.lot.projectId,
      type: 'hold_point_escalation',
      title: 'Hold Point Escalated',
      message: `Hold point "${holdPoint.description}" on lot ${holdPoint.lot.lotNumber} has been escalated. Reason: ${holdPoint.escalationReason}`,
      linkUrl: `/projects/${existingHP.lot.projectId}/holdpoints/${id}`
    }))

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate
      })
    }

    // Audit log for HP escalation
    await createAuditLog({
      projectId: existingHP.lot.projectId,
      userId,
      entityType: 'hold_point',
      entityId: id,
      action: AuditAction.HP_ESCALATED,
      changes: { escalatedTo, escalationReason },
      req
    })

    res.json({
      success: true,
      message: 'Hold point escalated successfully',
      holdPoint,
      notifiedUsers: projectUsers.map(pu => ({
        email: pu.user.email,
        fullName: pu.user.fullName,
        role: pu.role
      }))
    })
  } catch (error) {
    console.error('Error escalating hold point:', error)
    res.status(500).json({ error: 'Failed to escalate hold point' })
  }
})

// Resolve an escalated hold point
holdpointsRouter.post('/:id/resolve-escalation', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const holdPoint = await prisma.holdPoint.update({
      where: { id },
      data: {
        escalationResolved: true,
        escalationResolvedAt: new Date()
      },
      include: { lot: { select: { projectId: true } } }
    })

    // Audit log for HP escalation resolved
    await createAuditLog({
      projectId: holdPoint.lot.projectId,
      userId: req.user!.userId,
      entityType: 'hold_point',
      entityId: id,
      action: AuditAction.HP_ESCALATION_RESOLVED,
      changes: { escalationResolved: true },
      req
    })

    res.json({
      success: true,
      message: 'Escalation resolved',
      holdPoint
    })
  } catch (error) {
    console.error('Error resolving escalation:', error)
    res.status(500).json({ error: 'Failed to resolve escalation' })
  }
})

// Generate evidence package for a hold point
holdpointsRouter.get('/:id/evidence-package', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Get the hold point with all related data
    const holdPoint = await prisma.holdPoint.findUnique({
      where: { id },
      include: {
        itpChecklistItem: true,
        lot: {
          include: {
            project: true,
            itpInstance: {
              include: {
                template: {
                  include: {
                    checklistItems: {
                      orderBy: { sequenceNumber: 'asc' }
                    }
                  }
                },
                completions: {
                  include: {
                    completedBy: {
                      select: { id: true, fullName: true, email: true }
                    },
                    verifiedBy: {
                      select: { id: true, fullName: true, email: true }
                    },
                    attachments: {
                      include: {
                        document: true
                      }
                    }
                  }
                }
              }
            },
            testResults: {
              include: {
                verifiedBy: {
                  select: { id: true, fullName: true, email: true }
                }
              }
            },
            documents: {
              where: {
                OR: [
                  { documentType: 'photo' },
                  { category: 'itp_evidence' }
                ]
              }
            }
          }
        }
      }
    })

    if (!holdPoint) {
      return res.status(404).json({ error: 'Hold point not found' })
    }

    const lot = holdPoint.lot
    const itpInstance = lot.itpInstance

    if (!itpInstance) {
      return res.status(400).json({ error: 'No ITP assigned to this lot' })
    }

    // Get all checklist items up to and including the hold point
    const holdPointItem = holdPoint.itpChecklistItem
    const itemsUpToHP = itpInstance.template.checklistItems.filter(
      item => item.sequenceNumber <= holdPointItem.sequenceNumber
    )

    // Map completions to items
    const checklistWithStatus = itemsUpToHP.map(item => {
      const completion = itpInstance.completions.find(c => c.checklistItemId === item.id)
      return {
        sequenceNumber: item.sequenceNumber,
        description: item.description,
        pointType: item.pointType,
        responsibleParty: item.responsibleParty,
        isCompleted: completion?.status === 'completed',
        completedAt: completion?.completedAt,
        completedBy: completion?.completedBy?.fullName || null,
        isVerified: completion?.verificationStatus === 'verified',
        verifiedAt: completion?.verifiedAt,
        verifiedBy: completion?.verifiedBy?.fullName || null,
        notes: completion?.notes,
        attachments: completion?.attachments?.map(a => ({
          id: a.id,
          filename: a.document.filename,
          fileUrl: a.document.fileUrl,
          caption: a.document.caption
        })) || []
      }
    })

    // Get test results
    const testResults = lot.testResults.map(t => ({
      id: t.id,
      testType: t.testType,
      testRequestNumber: t.testRequestNumber,
      laboratoryName: t.laboratoryName,
      resultValue: t.resultValue,
      resultUnit: t.resultUnit,
      passFail: t.passFail,
      status: t.status,
      isVerified: t.status === 'verified',
      verifiedBy: t.verifiedBy?.fullName || null,
      createdAt: t.createdAt
    }))

    // Get photos/evidence documents
    const photos = lot.documents.map(d => ({
      id: d.id,
      filename: d.filename,
      fileUrl: d.fileUrl,
      caption: d.caption,
      uploadedAt: d.uploadedAt
    }))

    // Build evidence package response
    const evidencePackage = {
      holdPoint: {
        id: holdPoint.id,
        description: holdPoint.description,
        status: holdPoint.status,
        notificationSentAt: holdPoint.notificationSentAt,
        scheduledDate: holdPoint.scheduledDate,
        releasedAt: holdPoint.releasedAt,
        releasedByName: holdPoint.releasedByName,
        releaseNotes: holdPoint.releaseNotes
      },
      lot: {
        id: lot.id,
        lotNumber: lot.lotNumber,
        description: lot.description,
        activityType: lot.activityType,
        chainageStart: lot.chainageStart,
        chainageEnd: lot.chainageEnd
      },
      project: {
        id: lot.project.id,
        name: lot.project.name,
        projectNumber: lot.project.projectNumber
      },
      itpTemplate: {
        id: itpInstance.template.id,
        name: itpInstance.template.name,
        activityType: itpInstance.template.activityType
      },
      checklist: checklistWithStatus,
      testResults,
      photos,
      summary: {
        totalChecklistItems: checklistWithStatus.length,
        completedItems: checklistWithStatus.filter(i => i.isCompleted).length,
        verifiedItems: checklistWithStatus.filter(i => i.isVerified).length,
        totalTestResults: testResults.length,
        passingTests: testResults.filter(t => t.passFail === 'pass').length,
        totalPhotos: photos.length,
        totalAttachments: checklistWithStatus.reduce((sum, i) => sum + i.attachments.length, 0)
      },
      generatedAt: new Date().toISOString()
    }

    res.json({ evidencePackage })
  } catch (error) {
    console.error('Error generating evidence package:', error)
    res.status(500).json({ error: 'Failed to generate evidence package' })
  }
})

// Get notification timing for a hold point request based on working hours
holdpointsRouter.post('/calculate-notification-time', requireAuth, async (req: Request, res: Response) => {
  try {
    const parseResult = calculateNotificationTimeSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      })
    }

    const { projectId, requestedDateTime } = parseResult.data

    // Get project working hours configuration
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        workingHoursStart: true,
        workingHoursEnd: true,
        workingDays: true
      }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const requestedDate = new Date(requestedDateTime)
    const result = calculateNotificationTime(
      requestedDate,
      project.workingHoursStart || '07:00',
      project.workingHoursEnd || '17:00',
      project.workingDays || '1,2,3,4,5'
    )

    res.json({
      requestedDateTime: requestedDate.toISOString(),
      scheduledNotificationTime: result.scheduledTime.toISOString(),
      adjustedForWorkingHours: result.adjustedForWorkingHours,
      adjustmentReason: result.reason,
      workingHours: {
        start: project.workingHoursStart || '07:00',
        end: project.workingHoursEnd || '17:00',
        days: project.workingDays || '1,2,3,4,5'
      }
    })
  } catch (error) {
    console.error('Error calculating notification time:', error)
    res.status(500).json({ error: 'Failed to calculate notification time' })
  }
})

// Get project working hours configuration
holdpointsRouter.get('/project/:projectId/working-hours', requireAuth, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        workingDays: true
      }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Parse working days to human-readable format
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const workingDaysList = (project.workingDays || '1,2,3,4,5').split(',').map(Number)
    const workingDayNames = workingDaysList.map(d => dayNames[d])

    res.json({
      projectId: project.id,
      projectName: project.name,
      workingHours: {
        start: project.workingHoursStart || '07:00',
        end: project.workingHoursEnd || '17:00',
        days: project.workingDays || '1,2,3,4,5',
        dayNames: workingDayNames
      }
    })
  } catch (error) {
    console.error('Error fetching working hours:', error)
    res.status(500).json({ error: 'Failed to fetch working hours' })
  }
})

// Preview evidence package before submitting HP release request (Feature #179)
holdpointsRouter.post('/preview-evidence-package', requireAuth, async (req: Request, res: Response) => {
  try {
    const parseResult = previewEvidencePackageSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      })
    }

    const { lotId, itpChecklistItemId } = parseResult.data

    // Get the lot with all related data
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        project: true,
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  orderBy: { sequenceNumber: 'asc' }
                }
              }
            },
            completions: {
              include: {
                completedBy: {
                  select: { id: true, fullName: true, email: true }
                },
                verifiedBy: {
                  select: { id: true, fullName: true, email: true }
                },
                attachments: {
                  include: {
                    document: true
                  }
                }
              }
            }
          }
        },
        testResults: {
          include: {
            verifiedBy: {
              select: { id: true, fullName: true, email: true }
            }
          }
        },
        documents: {
          where: {
            OR: [
              { documentType: 'photo' },
              { category: 'itp_evidence' }
            ]
          }
        }
      }
    })

    if (!lot) {
      return res.status(404).json({ error: 'Lot not found' })
    }

    const itpInstance = lot.itpInstance
    if (!itpInstance) {
      return res.status(400).json({ error: 'No ITP assigned to this lot' })
    }

    // Get the hold point checklist item
    const holdPointItem = itpInstance.template.checklistItems.find(
      item => item.id === itpChecklistItemId
    )

    if (!holdPointItem) {
      return res.status(404).json({ error: 'Hold point checklist item not found' })
    }

    // Get all checklist items up to and including the hold point
    const itemsUpToHP = itpInstance.template.checklistItems.filter(
      item => item.sequenceNumber <= holdPointItem.sequenceNumber
    )

    // Map completions to items
    const checklistWithStatus = itemsUpToHP.map(item => {
      const completion = itpInstance.completions.find(c => c.checklistItemId === item.id)
      return {
        sequenceNumber: item.sequenceNumber,
        description: item.description,
        pointType: item.pointType,
        responsibleParty: item.responsibleParty,
        isCompleted: completion?.status === 'completed',
        completedAt: completion?.completedAt,
        completedBy: completion?.completedBy?.fullName || null,
        isVerified: completion?.verificationStatus === 'verified',
        verifiedAt: completion?.verifiedAt,
        verifiedBy: completion?.verifiedBy?.fullName || null,
        notes: completion?.notes,
        attachments: completion?.attachments?.map(a => ({
          id: a.id,
          filename: a.document.filename,
          fileUrl: a.document.fileUrl,
          caption: a.document.caption
        })) || []
      }
    })

    // Get test results
    const testResults = lot.testResults.map(t => ({
      id: t.id,
      testType: t.testType,
      testRequestNumber: t.testRequestNumber,
      laboratoryName: t.laboratoryName,
      resultValue: t.resultValue,
      resultUnit: t.resultUnit,
      passFail: t.passFail,
      status: t.status,
      isVerified: t.status === 'verified',
      verifiedBy: t.verifiedBy?.fullName || null,
      createdAt: t.createdAt
    }))

    // Get photos/evidence documents
    const photos = lot.documents.map(d => ({
      id: d.id,
      filename: d.filename,
      fileUrl: d.fileUrl,
      caption: d.caption,
      uploadedAt: d.uploadedAt
    }))

    // Build preview evidence package response
    const evidencePackage = {
      holdPoint: {
        id: 'preview', // Placeholder for preview
        description: holdPointItem.description,
        status: 'pending',
        notificationSentAt: null,
        scheduledDate: null,
        releasedAt: null,
        releasedByName: null,
        releaseNotes: null
      },
      lot: {
        id: lot.id,
        lotNumber: lot.lotNumber,
        description: lot.description,
        activityType: lot.activityType,
        chainageStart: lot.chainageStart,
        chainageEnd: lot.chainageEnd
      },
      project: {
        id: lot.project.id,
        name: lot.project.name,
        projectNumber: lot.project.projectNumber
      },
      itpTemplate: {
        id: itpInstance.template.id,
        name: itpInstance.template.name,
        activityType: itpInstance.template.activityType
      },
      checklist: checklistWithStatus,
      testResults,
      photos,
      summary: {
        totalChecklistItems: checklistWithStatus.length,
        completedItems: checklistWithStatus.filter(i => i.isCompleted).length,
        verifiedItems: checklistWithStatus.filter(i => i.isVerified).length,
        totalTestResults: testResults.length,
        passingTests: testResults.filter(t => t.passFail === 'pass').length,
        totalPhotos: photos.length,
        totalAttachments: checklistWithStatus.reduce((sum, i) => sum + i.attachments.length, 0)
      },
      isPreview: true,
      generatedAt: new Date().toISOString()
    }

    res.json({ evidencePackage })
  } catch (error) {
    console.error('Error generating evidence package preview:', error)
    res.status(500).json({ error: 'Failed to generate evidence package preview' })
  }
})

// ============================================================================
// PUBLIC ENDPOINTS - No authentication required (Feature #23)
// These endpoints use secure time-limited tokens for superintendent access
// ============================================================================

// Get hold point and evidence package via secure link (no auth required)
holdpointsRouter.get('/public/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    // Find the token and validate it
    const releaseToken = await prisma.holdPointReleaseToken.findUnique({
      where: { token },
      include: {
        holdPoint: {
          include: {
            itpChecklistItem: true,
            lot: {
              include: {
                project: true,
                itpInstance: {
                  include: {
                    template: {
                      include: {
                        checklistItems: {
                          orderBy: { sequenceNumber: 'asc' }
                        }
                      }
                    },
                    completions: {
                      include: {
                        completedBy: {
                          select: { id: true, fullName: true, email: true }
                        },
                        verifiedBy: {
                          select: { id: true, fullName: true, email: true }
                        },
                        attachments: {
                          include: {
                            document: true
                          }
                        }
                      }
                    }
                  }
                },
                testResults: {
                  include: {
                    verifiedBy: {
                      select: { id: true, fullName: true, email: true }
                    }
                  }
                },
                documents: {
                  where: {
                    OR: [
                      { documentType: 'photo' },
                      { category: 'itp_evidence' }
                    ]
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!releaseToken) {
      return res.status(404).json({ error: 'Invalid or expired link' })
    }

    // Check if token has expired
    if (new Date() > releaseToken.expiresAt) {
      return res.status(410).json({
        error: 'Link has expired',
        code: 'TOKEN_EXPIRED',
        message: 'This secure release link has expired. Please contact the site team for a new link.'
      })
    }

    // Check if token has been used (hold point already released via this token)
    if (releaseToken.usedAt) {
      return res.status(410).json({
        error: 'Link already used',
        code: 'TOKEN_USED',
        message: 'This hold point has already been released using this link.',
        releasedAt: releaseToken.usedAt,
        releasedByName: releaseToken.releasedByName
      })
    }

    const holdPoint = releaseToken.holdPoint
    const lot = holdPoint.lot
    const itpInstance = lot.itpInstance

    if (!itpInstance) {
      return res.status(400).json({ error: 'No ITP assigned to this lot' })
    }

    // Get all checklist items up to and including the hold point
    const holdPointItem = holdPoint.itpChecklistItem
    const itemsUpToHP = itpInstance.template.checklistItems.filter(
      item => item.sequenceNumber <= holdPointItem.sequenceNumber
    )

    // Map completions to items
    const checklistWithStatus = itemsUpToHP.map(item => {
      const completion = itpInstance.completions.find(c => c.checklistItemId === item.id)
      return {
        sequenceNumber: item.sequenceNumber,
        description: item.description,
        pointType: item.pointType,
        responsibleParty: item.responsibleParty,
        isCompleted: completion?.status === 'completed',
        completedAt: completion?.completedAt,
        completedBy: completion?.completedBy?.fullName || null,
        isVerified: completion?.verificationStatus === 'verified',
        verifiedAt: completion?.verifiedAt,
        verifiedBy: completion?.verifiedBy?.fullName || null,
        notes: completion?.notes,
        attachments: completion?.attachments?.map(a => ({
          id: a.id,
          filename: a.document.filename,
          fileUrl: a.document.fileUrl,
          caption: a.document.caption
        })) || []
      }
    })

    // Get test results
    const testResults = lot.testResults.map(t => ({
      id: t.id,
      testType: t.testType,
      testRequestNumber: t.testRequestNumber,
      laboratoryName: t.laboratoryName,
      resultValue: t.resultValue,
      resultUnit: t.resultUnit,
      passFail: t.passFail,
      status: t.status,
      isVerified: t.status === 'verified',
      verifiedBy: t.verifiedBy?.fullName || null,
      createdAt: t.createdAt
    }))

    // Get photos/evidence documents
    const photos = lot.documents.map(d => ({
      id: d.id,
      filename: d.filename,
      fileUrl: d.fileUrl,
      caption: d.caption,
      uploadedAt: d.uploadedAt
    }))

    // Build evidence package response
    const evidencePackage = {
      holdPoint: {
        id: holdPoint.id,
        description: holdPoint.description,
        status: holdPoint.status,
        notificationSentAt: holdPoint.notificationSentAt,
        scheduledDate: holdPoint.scheduledDate,
        scheduledTime: holdPoint.scheduledTime,
        releasedAt: holdPoint.releasedAt,
        releasedByName: holdPoint.releasedByName,
        releaseNotes: holdPoint.releaseNotes
      },
      lot: {
        id: lot.id,
        lotNumber: lot.lotNumber,
        description: lot.description,
        activityType: lot.activityType,
        chainageStart: lot.chainageStart,
        chainageEnd: lot.chainageEnd
      },
      project: {
        id: lot.project.id,
        name: lot.project.name,
        projectNumber: lot.project.projectNumber
      },
      itpTemplate: {
        id: itpInstance.template.id,
        name: itpInstance.template.name,
        activityType: itpInstance.template.activityType
      },
      checklist: checklistWithStatus,
      testResults,
      photos,
      summary: {
        totalChecklistItems: checklistWithStatus.length,
        completedItems: checklistWithStatus.filter(i => i.isCompleted).length,
        verifiedItems: checklistWithStatus.filter(i => i.isVerified).length,
        totalTestResults: testResults.length,
        passingTests: testResults.filter(t => t.passFail === 'pass').length,
        totalPhotos: photos.length,
        totalAttachments: checklistWithStatus.reduce((sum, i) => sum + i.attachments.length, 0)
      },
      generatedAt: new Date().toISOString()
    }

    // Token info for the UI
    const tokenInfo = {
      recipientEmail: releaseToken.recipientEmail,
      recipientName: releaseToken.recipientName,
      expiresAt: releaseToken.expiresAt,
      canRelease: holdPoint.status !== 'released'
    }

    res.json({
      evidencePackage,
      tokenInfo,
      isPublicAccess: true
    })
  } catch (error) {
    console.error('Error fetching HP via secure link:', error)
    res.status(500).json({ error: 'Failed to fetch hold point details' })
  }
})

// Release hold point via secure link (no auth required)
holdpointsRouter.post('/public/:token/release', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const parseResult = publicReleaseSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      })
    }

    const { releasedByName, releasedByOrg, releaseNotes, signatureDataUrl } = parseResult.data

    // Find the token and validate it
    const releaseToken = await prisma.holdPointReleaseToken.findUnique({
      where: { token },
      include: {
        holdPoint: {
          include: {
            lot: {
              include: {
                project: true
              }
            },
            itpChecklistItem: true
          }
        }
      }
    })

    if (!releaseToken) {
      return res.status(404).json({ error: 'Invalid or expired link' })
    }

    // Check if token has expired
    if (new Date() > releaseToken.expiresAt) {
      return res.status(410).json({
        error: 'Link has expired',
        code: 'TOKEN_EXPIRED',
        message: 'This secure release link has expired. Please contact the site team for a new link.'
      })
    }

    // Check if token has been used
    if (releaseToken.usedAt) {
      return res.status(410).json({
        error: 'Link already used',
        code: 'TOKEN_USED',
        message: 'This hold point has already been released using this link.',
        releasedAt: releaseToken.usedAt,
        releasedByName: releaseToken.releasedByName
      })
    }

    // Check if hold point is already released
    if (releaseToken.holdPoint.status === 'released') {
      return res.status(400).json({
        error: 'Hold point already released',
        code: 'ALREADY_RELEASED',
        message: 'This hold point has already been released.',
        releasedAt: releaseToken.holdPoint.releasedAt,
        releasedByName: releaseToken.holdPoint.releasedByName
      })
    }

    // Update the release token as used
    await prisma.holdPointReleaseToken.update({
      where: { token },
      data: {
        usedAt: new Date(),
        releasedByName,
        releasedByOrg: releasedByOrg || null,
        releaseSignatureUrl: signatureDataUrl || null,
        releaseNotes: releaseNotes || null
      }
    })

    // Release the hold point
    const holdPoint = await prisma.holdPoint.update({
      where: { id: releaseToken.holdPoint.id },
      data: {
        status: 'released',
        releasedAt: new Date(),
        releasedByName,
        releasedByOrg: releasedByOrg || null,
        releaseMethod: 'secure_link',
        releaseSignatureUrl: signatureDataUrl || null,
        releaseNotes: releaseNotes || null
      },
      include: {
        lot: true,
        itpChecklistItem: true
      }
    })

    // Also mark the ITP completion as verified
    const itpInstance = await prisma.iTPInstance.findUnique({
      where: { lotId: holdPoint.lotId }
    })

    if (itpInstance) {
      await prisma.iTPCompletion.updateMany({
        where: {
          itpInstanceId: itpInstance.id,
          checklistItemId: holdPoint.itpChecklistItemId
        },
        data: {
          verificationStatus: 'verified',
          verifiedAt: new Date()
        }
      })
    }

    // Create in-app notifications for project team members
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: releaseToken.holdPoint.lot.projectId
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true }
        }
      }
    })

    const notificationsToCreate = projectUsers.map(pu => ({
      userId: pu.userId,
      projectId: releaseToken.holdPoint.lot.projectId,
      type: 'hold_point_release',
      title: 'Hold Point Released (via Secure Link)',
      message: `Hold point "${holdPoint.description}" on lot ${holdPoint.lot.lotNumber} has been released by ${releasedByName} via secure link.`,
      linkUrl: `/projects/${releaseToken.holdPoint.lot.projectId}/hold-points`
    }))

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate
      })
    }

    // Send confirmation emails
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
      const lotUrl = `${baseUrl}/projects/${releaseToken.holdPoint.lot.projectId}/lots/${releaseToken.holdPoint.lot.id}`
      const releasedAt = new Date().toLocaleString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      // Send to contractors (site_engineer, foreman roles)
      const contractorRoles = ['site_engineer', 'foreman', 'engineer']
      const contractors = projectUsers.filter(pu => contractorRoles.includes(pu.role))

      for (const contractor of contractors) {
        await sendHPReleaseConfirmationEmail({
          to: contractor.user.email,
          recipientName: contractor.user.fullName || 'Site Team',
          recipientRole: 'contractor',
          projectName: releaseToken.holdPoint.lot.project.name,
          lotNumber: holdPoint.lot.lotNumber,
          holdPointDescription: holdPoint.description || 'Hold Point',
          releasedByName,
          releasedByOrg: releasedByOrg || undefined,
          releaseMethod: 'secure_link',
          releaseNotes: releaseNotes || undefined,
          releasedAt,
          lotUrl
        })
      }

      // Send to superintendents
      const superintendentRoles = ['superintendent', 'project_manager']
      const superintendents = projectUsers.filter(pu => superintendentRoles.includes(pu.role))

      for (const superintendent of superintendents) {
        await sendHPReleaseConfirmationEmail({
          to: superintendent.user.email,
          recipientName: superintendent.user.fullName || 'Superintendent',
          recipientRole: 'superintendent',
          projectName: releaseToken.holdPoint.lot.project.name,
          lotNumber: holdPoint.lot.lotNumber,
          holdPointDescription: holdPoint.description || 'Hold Point',
          releasedByName,
          releasedByOrg: releasedByOrg || undefined,
          releaseMethod: 'secure_link',
          releaseNotes: releaseNotes || undefined,
          releasedAt,
          lotUrl
        })
      }

    } catch (emailError) {
      console.error('[HP Secure Release] Failed to send confirmation emails:', emailError)
      // Don't fail the main request
    }

    // Audit log for public HP release (no userId - public endpoint)
    await createAuditLog({
      projectId: releaseToken.holdPoint.lot.projectId,
      entityType: 'hold_point',
      entityId: holdPoint.id,
      action: AuditAction.HP_PUBLIC_RELEASED,
      changes: { releasedByName, releasedByOrg, releaseMethod: 'secure_link', tokenRecipient: releaseToken.recipientEmail },
      req
    })

    res.json({
      success: true,
      message: 'Hold point released successfully via secure link',
      holdPoint: {
        id: holdPoint.id,
        description: holdPoint.description,
        status: holdPoint.status,
        releasedAt: holdPoint.releasedAt,
        releasedByName: holdPoint.releasedByName,
        releaseMethod: holdPoint.releaseMethod
      },
      lot: {
        id: holdPoint.lot.id,
        lotNumber: holdPoint.lot.lotNumber
      }
    })
  } catch (error) {
    console.error('Error releasing HP via secure link:', error)
    res.status(500).json({ error: 'Failed to release hold point' })
  }
})

export { holdpointsRouter }
