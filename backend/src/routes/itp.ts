// Feature #592 trigger - ITP instance snapshot from template
// Feature #175 - Auto-notification before witness point
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { type AuthUser } from '../lib/auth.js'

// ============== Zod Schemas ==============

// Checklist item schema (used in template creation/update)
const checklistItemSchema = z.object({
  description: z.string().min(1),
  pointType: z.string().optional(),
  isHoldPoint: z.boolean().optional(),
  category: z.string().optional(),
  responsibleParty: z.string().optional(),
  evidenceRequired: z.string().optional(),
  acceptanceCriteria: z.string().optional().nullable(),
  testType: z.string().optional().nullable()
})

// POST /templates - Create ITP template
const createTemplateSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  activityType: z.string().min(1),
  checklistItems: z.array(checklistItemSchema).optional()
})

// POST /templates/:id/clone - Clone template
const cloneTemplateSchema = z.object({
  projectId: z.string().uuid().optional(),
  name: z.string().optional()
})

// PATCH /templates/:id - Update template
const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  activityType: z.string().optional(),
  checklistItems: z.array(checklistItemSchema).optional(),
  isActive: z.boolean().optional()
})

// POST /templates/:id/propagate - Propagate template changes
const propagateTemplateSchema = z.object({
  instanceIds: z.array(z.string().uuid()).min(1, 'instanceIds array is required')
})

// POST /instances - Create ITP instance (assign to lot)
const createInstanceSchema = z.object({
  lotId: z.string().uuid(),
  templateId: z.string().uuid()
})

// POST /completions - Complete/update checklist item
const createCompletionSchema = z.object({
  itpInstanceId: z.string().uuid(),
  checklistItemId: z.string().uuid(),
  isCompleted: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  status: z.enum(['pending', 'completed', 'not_applicable', 'failed']).optional(),
  // NCR details for failed status
  ncrDescription: z.string().optional(),
  ncrCategory: z.string().optional(),
  ncrSeverity: z.enum(['minor', 'major', 'critical']).optional(),
  // Witness point details
  witnessPresent: z.boolean().optional(),
  witnessName: z.string().optional().nullable(),
  witnessCompany: z.string().optional().nullable(),
  // Feature #463: Signature capture
  signatureDataUrl: z.string().optional().nullable()
})

// POST /completions/:id/reject - Reject completion
const rejectCompletionSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required')
})

// POST /completions/:completionId/attachments - Add attachment
const addAttachmentSchema = z.object({
  filename: z.string().min(1),
  fileUrl: z.string().min(1),
  caption: z.string().optional(),
  gpsLatitude: z.union([z.string(), z.number()]).optional(),
  gpsLongitude: z.union([z.string(), z.number()]).optional(),
  mimeType: z.string().optional()
})

const itpRouter = Router()

/**
 * Check for upcoming witness points and send notifications
 * Called after an ITP item is completed to check if the next item is a witness point
 */
async function checkAndNotifyWitnessPoint(
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
    let checklistItems: any[]
    if (instance.templateSnapshot) {
      const snapshot = JSON.parse(instance.templateSnapshot)
      checklistItems = snapshot.checklistItems || []
    } else {
      checklistItems = instance.template.checklistItems
    }

    // Find the completed item's sequence number
    const completedItem = checklistItems.find((item: any) => item.id === completedItemId)
    if (!completedItem) {
      return null
    }

    const completedSequence = completedItem.sequenceNumber

    // Check project settings for witness point notification configuration
    const project = instance.lot.project
    let settings: any = {}
    if (project.settings) {
      try {
        settings = JSON.parse(project.settings)
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
    const nextItem = checklistItems.find((item: any) => item.sequenceNumber === targetSequence)
    if (!nextItem) {
      return null
    }

    // Check if it's a witness point (pointType can be 'witness' or 'witness_point')
    if (nextItem.pointType !== 'witness' && nextItem.pointType !== 'witness_point') {
      return null
    }

    // Check if the witness point is already completed (no need to notify)
    const witnessPointCompletion = instance.completions.find(
      (c: any) => c.checklistItemId === nextItem.id && (c.status === 'completed' || c.status === 'not_applicable')
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

    // Log the notification for console/email integration
    console.log(`\n========================================`)
    console.log(`WITNESS POINT NOTIFICATION`)
    console.log(`========================================`)
    console.log(`Project: ${project.name}`)
    console.log(`Lot: ${instance.lot.lotNumber}`)
    console.log(`Approaching Witness Point: ${nextItem.description}`)
    console.log(`Triggered by: ${userName} completing "${completedItem.description}"`)
    if (clientEmail) {
      console.log(`Client to notify: ${clientName} <${clientEmail}>`)
    }
    console.log(`----------------------------------------`)
    console.log(`Notifications sent to ${notificationsCreated.length} project team members`)
    console.log(`========================================\n`)

    return {
      witnessPoint: nextItem,
      notificationsSent: notificationsCreated.length,
      clientEmail,
      clientName
    }
  } catch (error) {
    console.error('Error checking witness point notification:', error)
    return null
  }
}

/**
 * Auto-progress lot status based on ITP completion state
 * - NOT_STARTED -> IN_PROGRESS: When first ITP item is completed
 * - IN_PROGRESS -> AWAITING_TEST: When all non-test items are complete but test items remain
 * - AWAITING_TEST -> COMPLETED: When all items including tests are complete
 */
async function updateLotStatusFromITP(itpInstanceId: string) {
  try {
    // Get the ITP instance with lot and all completion data
    const instance = await prisma.iTPInstance.findUnique({
      where: { id: itpInstanceId },
      include: {
        lot: true,
        template: {
          include: {
            checklistItems: true
          }
        },
        completions: true
      }
    })

    if (!instance || !instance.lot) {
      return
    }

    const lot = instance.lot

    // Don't auto-progress lots that are conformed, claimed, or have NCRs
    if (['conformed', 'claimed', 'ncr_raised'].includes(lot.status)) {
      return
    }

    // Get checklist items from snapshot or template
    let checklistItems: any[]
    if (instance.templateSnapshot) {
      const snapshot = JSON.parse(instance.templateSnapshot)
      checklistItems = snapshot.checklistItems || []
    } else {
      checklistItems = instance.template.checklistItems
    }

    const totalItems = checklistItems.length
    if (totalItems === 0) {
      return
    }

    // Count completed items (including N/A items as "finished")
    const completedItemIds = new Set(
      instance.completions
        .filter(c => c.status === 'completed' || c.status === 'not_applicable')
        .map(c => c.checklistItemId)
    )

    const completedCount = completedItemIds.size

    // Identify test items (items with evidenceRequired === 'test' or testType set)
    const testItems = checklistItems.filter((item: any) => item.evidenceRequired === 'test' || item.testType)
    const nonTestItems = checklistItems.filter((item: any) => item.evidenceRequired !== 'test' && !item.testType)

    // Count completed non-test items
    const completedNonTestCount = nonTestItems.filter((item: any) =>
      completedItemIds.has(item.id)
    ).length

    // Count completed test items
    const completedTestCount = testItems.filter((item: any) =>
      completedItemIds.has(item.id)
    ).length

    // Determine new status
    let newStatus: string | null = null

    if (lot.status === 'not_started' && completedCount > 0) {
      // First item completed - transition to in_progress
      newStatus = 'in_progress'
    } else if (lot.status === 'in_progress' || lot.status === 'not_started') {
      // Check if all non-test items are complete
      if (nonTestItems.length > 0 && completedNonTestCount === nonTestItems.length) {
        if (testItems.length > 0 && completedTestCount < testItems.length) {
          // All non-test items done, but test items remain
          newStatus = 'awaiting_test'
        } else if (testItems.length === 0 || completedTestCount === testItems.length) {
          // All items complete (or no test items)
          newStatus = 'completed'
        }
      }
    } else if (lot.status === 'awaiting_test') {
      // Check if all test items are now complete
      if (testItems.length > 0 && completedTestCount === testItems.length) {
        newStatus = 'completed'
      }
    }

    // Update lot status if changed
    if (newStatus && newStatus !== lot.status) {
      await prisma.lot.update({
        where: { id: lot.id },
        data: { status: newStatus }
      })
      console.log(`Auto-progressed lot ${lot.lotNumber} from ${lot.status} to ${newStatus}`)
    }
  } catch (error) {
    // Log but don't throw - status update is not critical
    console.error('Error auto-progressing lot status:', error)
  }
}

// Get ITP templates from other projects (for cross-project import - Feature #682)
itpRouter.get('/templates/cross-project', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { currentProjectId } = req.query

    if (!currentProjectId) {
      return res.status(400).json({ error: 'currentProjectId is required' })
    }

    // Get all projects the user has access to
    const userProjects = await prisma.projectUser.findMany({
      where: { userId: user.userId },
      include: {
        project: {
          select: { id: true, name: true, projectNumber: true }
        }
      }
    })

    // Get templates from other projects (not the current one and not global templates)
    const otherProjectIds = userProjects
      .filter(pu => pu.project && pu.project.id !== currentProjectId)
      .map(pu => pu.project.id)

    if (otherProjectIds.length === 0) {
      return res.json({ projects: [], templates: [] })
    }

    // Get templates from other projects
    const templates = await prisma.iTPTemplate.findMany({
      where: {
        projectId: { in: otherProjectIds },
        isActive: true
      },
      include: {
        project: {
          select: { id: true, name: true, projectNumber: true }
        },
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Group templates by project
    const projectsWithTemplates = userProjects
      .filter(pu => pu.project && pu.project.id !== currentProjectId)
      .map(pu => ({
        id: pu.project.id,
        name: pu.project.name,
        code: pu.project.projectNumber,
        templates: templates
          .filter(t => t.projectId === pu.project.id)
          .map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
            activityType: t.activityType,
            checklistItemCount: t.checklistItems.length,
            holdPointCount: t.checklistItems.filter(item => item.pointType === 'hold_point').length
          }))
      }))
      .filter(p => p.templates.length > 0)

    res.json({
      projects: projectsWithTemplates,
      totalTemplates: templates.length
    })
  } catch (error) {
    console.error('Error fetching cross-project templates:', error)
    res.status(500).json({ error: 'Failed to fetch templates from other projects' })
  }
})

// Get ITP templates for a project
itpRouter.get('/templates', requireAuth, async (req: any, res) => {
  try {
    const { projectId, includeGlobal } = req.query

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' })
    }

    // Get the project's specification set
    const project = await prisma.project.findUnique({
      where: { id: projectId as string },
      select: { specificationSet: true }
    })

    // Build the query - include project templates and optionally global templates matching spec
    const whereClause = includeGlobal === 'true' && project?.specificationSet
      ? {
          OR: [
            { projectId: projectId as string },
            {
              projectId: null,
              stateSpec: project.specificationSet
            }
          ]
        }
      : { projectId: projectId as string }

    const templates = await prisma.iTPTemplate.findMany({
      where: whereClause,
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Transform to frontend-friendly format
    const transformedTemplates = templates.map(t => ({
      ...t,
      isGlobalTemplate: t.projectId === null,
      isActive: t.isActive,
      stateSpec: t.stateSpec,
      checklistItems: t.checklistItems.map(item => ({
        id: item.id,
        description: item.description,
        category: item.responsibleParty || 'general',
        responsibleParty: item.responsibleParty || 'contractor',
        isHoldPoint: item.pointType === 'hold_point',
        pointType: item.pointType || 'standard',
        evidenceRequired: item.evidenceRequired || 'none',
        order: item.sequenceNumber,
        acceptanceCriteria: item.acceptanceCriteria
      }))
    }))

    res.json({
      templates: transformedTemplates,
      projectSpecificationSet: project?.specificationSet || null
    })
  } catch (error) {
    console.error('Error fetching ITP templates:', error)
    res.status(500).json({ error: 'Failed to fetch templates' })
  }
})

// Get single ITP template
itpRouter.get('/templates/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params

    const template = await prisma.iTPTemplate.findUnique({
      where: { id },
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' }
        }
      }
    })

    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }

    // Transform to frontend-friendly format
    const transformedTemplate = {
      ...template,
      checklistItems: template.checklistItems.map(item => ({
        id: item.id,
        description: item.description,
        category: item.responsibleParty || 'general',
        responsibleParty: item.responsibleParty || 'contractor',
        isHoldPoint: item.pointType === 'hold_point',
        pointType: item.pointType || 'standard',
        evidenceRequired: item.evidenceRequired || 'none',
        order: item.sequenceNumber,
        acceptanceCriteria: item.acceptanceCriteria
      }))
    }

    res.json({ template: transformedTemplate })
  } catch (error) {
    console.error('Error fetching ITP template:', error)
    res.status(500).json({ error: 'Failed to fetch template' })
  }
})

// Create ITP template
itpRouter.post('/templates', requireAuth, async (req: any, res) => {
  try {
    const parseResult = createTemplateSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid request body' })
    }
    const { projectId, name, description, activityType, checklistItems } = parseResult.data

    const template = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name,
        description: description || null,
        activityType,
        checklistItems: {
          create: (checklistItems || []).map((item: any, index: number) => ({
            description: item.description,
            sequenceNumber: index + 1,
            pointType: item.pointType || (item.isHoldPoint ? 'hold_point' : 'standard'),
            responsibleParty: item.category || 'contractor',
            evidenceRequired: item.evidenceRequired || 'none',
            acceptanceCriteria: item.acceptanceCriteria || null,
            testType: item.testType || null
          }))
        }
      },
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' }
        }
      }
    })

    // Transform to frontend-friendly format
    const transformedTemplate = {
      ...template,
      checklistItems: template.checklistItems.map(item => ({
        id: item.id,
        description: item.description,
        category: item.responsibleParty || 'general',
        responsibleParty: item.responsibleParty || 'contractor',
        isHoldPoint: item.pointType === 'hold_point',
        pointType: item.pointType || 'standard',
        evidenceRequired: item.evidenceRequired || 'none',
        order: item.sequenceNumber,
        acceptanceCriteria: item.acceptanceCriteria
      }))
    }

    res.status(201).json({ template: transformedTemplate })
  } catch (error) {
    console.error('Error creating ITP template:', error)
    res.status(500).json({ error: 'Failed to create template' })
  }
})

// Clone ITP template
itpRouter.post('/templates/:id/clone', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params
    const parseResult = cloneTemplateSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid request body' })
    }
    const { projectId, name } = parseResult.data

    // Get the source template with all checklist items
    const sourceTemplate = await prisma.iTPTemplate.findUnique({
      where: { id },
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' }
        }
      }
    })

    if (!sourceTemplate) {
      return res.status(404).json({ error: 'Template not found' })
    }

    // Create the cloned template
    const clonedTemplate = await prisma.iTPTemplate.create({
      data: {
        projectId: projectId || sourceTemplate.projectId,
        name: name || `${sourceTemplate.name} (Copy)`,
        description: sourceTemplate.description,
        activityType: sourceTemplate.activityType,
        specificationReference: sourceTemplate.specificationReference,
        stateSpec: sourceTemplate.stateSpec,
        isActive: true,
        checklistItems: {
          create: sourceTemplate.checklistItems.map((item, index) => ({
            description: item.description,
            sequenceNumber: index + 1,
            pointType: item.pointType,
            responsibleParty: item.responsibleParty,
            evidenceRequired: item.evidenceRequired,
            acceptanceCriteria: item.acceptanceCriteria,
            testType: item.testType
          }))
        }
      },
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' }
        }
      }
    })

    // Transform response
    const transformedTemplate = {
      ...clonedTemplate,
      isActive: clonedTemplate.isActive,
      checklistItems: clonedTemplate.checklistItems.map(item => ({
        id: item.id,
        description: item.description,
        category: item.responsibleParty || 'general',
        responsibleParty: item.responsibleParty || 'contractor',
        isHoldPoint: item.pointType === 'hold_point',
        pointType: item.pointType || 'standard',
        evidenceRequired: item.evidenceRequired || 'none',
        order: item.sequenceNumber,
        acceptanceCriteria: item.acceptanceCriteria
      }))
    }

    res.status(201).json({ template: transformedTemplate })
  } catch (error) {
    console.error('Error cloning ITP template:', error)
    res.status(500).json({ error: 'Failed to clone template' })
  }
})

// Update ITP template
itpRouter.patch('/templates/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params
    const parseResult = updateTemplateSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Invalid request body' })
    }
    const { name, description, activityType, checklistItems, isActive } = parseResult.data

    // First, delete existing checklist items and recreate (simplest approach)
    if (checklistItems) {
      await prisma.iTPChecklistItem.deleteMany({
        where: { templateId: id }
      })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (activityType !== undefined) updateData.activityType = activityType
    if (isActive !== undefined) updateData.isActive = isActive
    if (checklistItems) {
      updateData.checklistItems = {
        create: checklistItems.map((item: any, index: number) => ({
          description: item.description,
          sequenceNumber: index + 1,
          pointType: item.pointType || 'standard',
          responsibleParty: item.responsibleParty || item.category || 'contractor',
          evidenceRequired: item.evidenceRequired || 'none',
          acceptanceCriteria: item.acceptanceCriteria || null
        }))
      }
    }

    const template = await prisma.iTPTemplate.update({
      where: { id },
      data: updateData,
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' }
        }
      }
    })

    // Transform to frontend-friendly format
    const transformedTemplate = {
      ...template,
      isActive: template.isActive,
      checklistItems: template.checklistItems.map(item => ({
        id: item.id,
        description: item.description,
        category: item.responsibleParty || 'general',
        responsibleParty: item.responsibleParty || 'contractor',
        isHoldPoint: item.pointType === 'hold_point',
        pointType: item.pointType || 'standard',
        evidenceRequired: item.evidenceRequired || 'none',
        order: item.sequenceNumber,
        acceptanceCriteria: item.acceptanceCriteria
      }))
    }

    res.json({ template: transformedTemplate })
  } catch (error) {
    console.error('Error updating ITP template:', error)
    res.status(500).json({ error: 'Failed to update template' })
  }
})

// Get lots using a template (for propagation feature)
itpRouter.get('/templates/:id/lots', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params

    const instances = await prisma.iTPInstance.findMany({
      where: { templateId: id },
      include: {
        lot: {
          select: {
            id: true,
            lotNumber: true,
            description: true,
            status: true
          }
        }
      }
    })

    // Filter to in-progress lots (not completed)
    const lotsUsingTemplate = instances
      .filter(inst => inst.lot.status !== 'conformed')
      .map(inst => ({
        instanceId: inst.id,
        lotId: inst.lot.id,
        lotNumber: inst.lot.lotNumber,
        description: inst.lot.description,
        status: inst.lot.status,
        hasSnapshot: !!inst.templateSnapshot
      }))

    res.json({ lots: lotsUsingTemplate, total: lotsUsingTemplate.length })
  } catch (error) {
    console.error('Error fetching lots using template:', error)
    res.status(500).json({ error: 'Failed to fetch lots' })
  }
})

// Delete ITP template with usage validation (Feature #575)
itpRouter.delete('/templates/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params
    const { force } = req.query // If force=true, delete even if in use

    // Check if template exists
    const template = await prisma.iTPTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: { itpInstances: true }
        }
      }
    })

    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }

    // Check if template is in use by any lots
    const instanceCount = template._count.itpInstances

    if (instanceCount > 0 && force !== 'true') {
      // Get the lots using this template for the warning message
      const instances = await prisma.iTPInstance.findMany({
        where: { templateId: id },
        include: {
          lot: {
            select: {
              id: true,
              lotNumber: true,
              description: true,
              status: true
            }
          }
        },
        take: 5 // Limit to first 5 for the warning
      })

      const lotsInUse = instances.map(inst => ({
        id: inst.lot.id,
        lotNumber: inst.lot.lotNumber,
        description: inst.lot.description,
        status: inst.lot.status
      }))

      return res.status(409).json({
        error: 'Template is in use',
        message: `This template is assigned to ${instanceCount} lot(s). You can archive it instead, or force delete to remove the template (lots will keep their snapshots).`,
        usageCount: instanceCount,
        lotsInUse,
        canArchive: true,
        canForceDelete: true
      })
    }

    // If force delete, first unlink all instances (they keep their snapshots)
    if (instanceCount > 0 && force === 'true') {
      // We don't delete the instances - they keep working with their snapshots
      // Just remove the template reference
      console.log(`Force deleting template ${template.name} - ${instanceCount} instances will retain their snapshots`)
    }

    // Delete checklist items first
    await prisma.iTPChecklistItem.deleteMany({
      where: { templateId: id }
    })

    // Delete the template
    await prisma.iTPTemplate.delete({
      where: { id }
    })

    res.json({
      success: true,
      message: force === 'true' && instanceCount > 0
        ? `Template deleted. ${instanceCount} lot(s) will continue using their snapshots.`
        : 'Template deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting ITP template:', error)
    res.status(500).json({ error: 'Failed to delete template' })
  }
})

// Archive ITP template (soft delete alternative) (Feature #575)
itpRouter.post('/templates/:id/archive', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params

    const template = await prisma.iTPTemplate.update({
      where: { id },
      data: { isActive: false },
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' }
        }
      }
    })

    // Transform response
    const transformedTemplate = {
      ...template,
      isActive: template.isActive,
      checklistItems: template.checklistItems.map(item => ({
        id: item.id,
        description: item.description,
        category: item.responsibleParty || 'general',
        responsibleParty: item.responsibleParty || 'contractor',
        isHoldPoint: item.pointType === 'hold_point',
        pointType: item.pointType || 'standard',
        evidenceRequired: item.evidenceRequired || 'none',
        order: item.sequenceNumber,
        acceptanceCriteria: item.acceptanceCriteria
      }))
    }

    res.json({
      success: true,
      message: 'Template archived. It will no longer appear in template selection but existing lots will continue working.',
      template: transformedTemplate
    })
  } catch (error) {
    console.error('Error archiving ITP template:', error)
    res.status(500).json({ error: 'Failed to archive template' })
  }
})

// Restore archived ITP template (Feature #575)
itpRouter.post('/templates/:id/restore', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params

    const template = await prisma.iTPTemplate.update({
      where: { id },
      data: { isActive: true },
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' }
        }
      }
    })

    // Transform response
    const transformedTemplate = {
      ...template,
      isActive: template.isActive,
      checklistItems: template.checklistItems.map(item => ({
        id: item.id,
        description: item.description,
        category: item.responsibleParty || 'general',
        responsibleParty: item.responsibleParty || 'contractor',
        isHoldPoint: item.pointType === 'hold_point',
        pointType: item.pointType || 'standard',
        evidenceRequired: item.evidenceRequired || 'none',
        order: item.sequenceNumber,
        acceptanceCriteria: item.acceptanceCriteria
      }))
    }

    res.json({
      success: true,
      message: 'Template restored and is now active.',
      template: transformedTemplate
    })
  } catch (error) {
    console.error('Error restoring ITP template:', error)
    res.status(500).json({ error: 'Failed to restore template' })
  }
})

// Propagate template changes to selected lots
itpRouter.post('/templates/:id/propagate', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params
    const parseResult = propagateTemplateSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || 'instanceIds array is required' })
    }
    const { instanceIds } = parseResult.data

    // Get the current template state
    const template = await prisma.iTPTemplate.findUnique({
      where: { id },
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' }
        }
      }
    })

    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }

    // Create new snapshot
    const newSnapshot = {
      id: template.id,
      name: template.name,
      description: template.description,
      activityType: template.activityType,
      checklistItems: template.checklistItems.map(item => ({
        id: item.id,
        description: item.description,
        sequenceNumber: item.sequenceNumber,
        pointType: item.pointType,
        responsibleParty: item.responsibleParty,
        evidenceRequired: item.evidenceRequired,
        acceptanceCriteria: item.acceptanceCriteria,
        testType: item.testType
      }))
    }

    // Update snapshots for selected instances
    const updateResult = await prisma.iTPInstance.updateMany({
      where: {
        id: { in: instanceIds },
        templateId: id
      },
      data: {
        templateSnapshot: JSON.stringify(newSnapshot)
      }
    })

    res.json({
      success: true,
      updatedCount: updateResult.count,
      message: `Updated ${updateResult.count} lot(s) with latest template`
    })
  } catch (error) {
    console.error('Error propagating template changes:', error)
    res.status(500).json({ error: 'Failed to propagate changes' })
  }
})

// Assign ITP template to lot (create ITP instance)
itpRouter.post('/instances', requireAuth, async (req: any, res) => {
  try {
    const parseResult = createInstanceSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || 'lotId and templateId are required' })
    }
    const { lotId, templateId } = parseResult.data

    // Check if lot already has an ITP instance
    const existingInstance = await prisma.iTPInstance.findUnique({
      where: { lotId }
    })

    if (existingInstance) {
      return res.status(400).json({ error: 'Lot already has an ITP assigned' })
    }

    // Get the template with checklist items
    const template = await prisma.iTPTemplate.findUnique({
      where: { id: templateId },
      include: {
        checklistItems: {
          orderBy: { sequenceNumber: 'asc' }
        }
      }
    })

    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }

    // Create a snapshot of the template at assignment time
    const templateSnapshot = {
      id: template.id,
      name: template.name,
      description: template.description,
      activityType: template.activityType,
      checklistItems: template.checklistItems.map(item => ({
        id: item.id,
        description: item.description,
        sequenceNumber: item.sequenceNumber,
        pointType: item.pointType,
        responsibleParty: item.responsibleParty,
        evidenceRequired: item.evidenceRequired,
        acceptanceCriteria: item.acceptanceCriteria,
        testType: item.testType
      }))
    }

    // Create instance with snapshot
    const instance = await prisma.iTPInstance.create({
      data: {
        lotId,
        templateId,
        templateSnapshot: JSON.stringify(templateSnapshot)
      },
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
    })

    // Update the lot to link to the template
    await prisma.lot.update({
      where: { id: lotId },
      data: { itpTemplateId: templateId }
    })

    // Transform to frontend-friendly format
    const transformedInstance = {
      ...instance,
      template: {
        ...instance.template,
        checklistItems: instance.template.checklistItems.map(item => ({
          id: item.id,
          description: item.description,
          category: item.responsibleParty || 'general',
        responsibleParty: item.responsibleParty || 'contractor',
          isHoldPoint: item.pointType === 'hold_point',
          pointType: item.pointType || 'standard',
          evidenceRequired: item.evidenceRequired || 'none',
          order: item.sequenceNumber,
          acceptanceCriteria: item.acceptanceCriteria
        }))
      }
    }

    res.status(201).json({ instance: transformedInstance })
  } catch (error) {
    console.error('Error creating ITP instance:', error)
    res.status(500).json({ error: 'Failed to assign ITP to lot' })
  }
})

// Feature #271: Get ITP instance for a lot with subcontractor filtering
// Subcontractors only see items where responsibleParty = 'subcontractor'
itpRouter.get('/instances/lot/:lotId', requireAuth, async (req: any, res) => {
  // User available on req.user for future permission checks
  const { subcontractorView } = req.query // If true, filter to subcontractor items only

  try {
    const { lotId } = req.params

    const instance = await prisma.iTPInstance.findUnique({
      where: { lotId },
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
                document: {
                  include: {
                    uploadedBy: {
                      select: { id: true, fullName: true, email: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!instance) {
      return res.status(404).json({ error: 'No ITP assigned to this lot' })
    }

    // Use snapshot if available, otherwise fall back to live template
    let templateData: any
    if (instance.templateSnapshot) {
      // Parse the snapshot (template state at assignment time)
      const snapshot = JSON.parse(instance.templateSnapshot)
      templateData = {
        ...snapshot,
        checklistItems: snapshot.checklistItems.map((item: any) => ({
          id: item.id,
          description: item.description,
          category: item.responsibleParty || 'general',
          responsibleParty: item.responsibleParty || 'contractor',
          isHoldPoint: item.pointType === 'hold_point',
          pointType: item.pointType || 'standard',
          evidenceRequired: item.evidenceRequired || 'none',
          order: item.sequenceNumber,
          acceptanceCriteria: item.acceptanceCriteria,
          testType: item.testType || null
        }))
      }
    } else {
      // Fall back to live template for backwards compatibility
      templateData = {
        ...instance.template,
        checklistItems: instance.template.checklistItems.map(item => ({
          id: item.id,
          description: item.description,
          category: item.responsibleParty || 'general',
          responsibleParty: item.responsibleParty || 'contractor',
          isHoldPoint: item.pointType === 'hold_point',
          pointType: item.pointType || 'standard',
          evidenceRequired: item.evidenceRequired || 'none',
          order: item.sequenceNumber,
          acceptanceCriteria: item.acceptanceCriteria,
          testType: item.testType || null
        }))
      }
    }

    // Feature #271: Filter to subcontractor-assigned items only if subcontractorView is true
    if (subcontractorView === 'true') {
      templateData.checklistItems = templateData.checklistItems.filter(
        (item: any) => item.responsibleParty === 'subcontractor'
      )
    }

    // Get item IDs for filtered items (used to filter completions)
    const filteredItemIds = new Set(templateData.checklistItems.map((item: any) => item.id))

    // Transform to frontend-friendly format
    const transformedInstance = {
      ...instance,
      template: templateData,
      completions: instance.completions
        .filter(c => subcontractorView !== 'true' || filteredItemIds.has(c.checklistItemId))
        .map(c => ({
          ...c,
          isCompleted: c.status === 'completed' || c.status === 'not_applicable',
          isNotApplicable: c.status === 'not_applicable',
          isFailed: c.status === 'failed',
          isVerified: c.verificationStatus === 'verified',
          isPendingVerification: c.verificationStatus === 'pending_verification',
          attachments: (c as any).attachments?.map((a: any) => ({
            id: a.id,
            documentId: a.documentId,
            document: a.document
          })) || []
        }))
    }

    res.json({ instance: transformedInstance })
  } catch (error) {
    console.error('Error fetching ITP instance:', error)
    res.status(500).json({ error: 'Failed to fetch ITP instance' })
  }
})

// Complete/update a checklist item (supports N/A and Failed status with reason)
itpRouter.post('/completions', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const parseResult = createCompletionSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || 'itpInstanceId and checklistItemId are required' })
    }
    const {
      itpInstanceId,
      checklistItemId,
      isCompleted,
      notes,
      status: directStatus,
      // NCR details for failed status
      ncrDescription,
      ncrCategory,
      ncrSeverity,
      // Witness point details
      witnessPresent,
      witnessName,
      witnessCompany,
      // Feature #463: Signature capture
      signatureDataUrl
    } = parseResult.data

    // Validate N/A status requires a reason
    if (directStatus === 'not_applicable' && !notes?.trim()) {
      return res.status(400).json({ error: 'A reason is required when marking an item as N/A' })
    }

    // Validate failed status requires NCR description
    if (directStatus === 'failed' && !ncrDescription?.trim()) {
      return res.status(400).json({ error: 'NCR description is required when marking an item as Failed' })
    }

    // Determine status - direct status takes precedence, then isCompleted flag
    let newStatus: string
    if (directStatus) {
      newStatus = directStatus
    } else {
      newStatus = isCompleted ? 'completed' : 'pending'
    }

    // Feature #271: Check if user is a subcontractor
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.userId },
      include: { subcontractorCompany: { select: { id: true, companyName: true } } }
    })
    const isSubcontractor = !!subcontractorUser

    // Check if completion already exists
    const existingCompletion = await prisma.iTPCompletion.findFirst({
      where: {
        itpInstanceId,
        checklistItemId
      }
    })

    // Determine completedAt and completedById based on status
    const isFinished = newStatus === 'completed' || newStatus === 'not_applicable' || newStatus === 'failed'

    // Feature #271: Subcontractor completions - check lot assignment for ITP permissions
    let verificationStatus: string | undefined
    if (isSubcontractor && isFinished && newStatus === 'completed') {
      // Get the ITP instance to find the lot and project
      const itpInstanceForPermCheck = await prisma.iTPInstance.findUnique({
        where: { id: itpInstanceId },
        select: {
          lotId: true,
          lot: {
            select: {
              project: {
                select: { id: true, settings: true }
              }
            }
          }
        }
      })

      if (itpInstanceForPermCheck?.lotId && subcontractorUser) {
        // Check if subcontractor has ITP completion permission for this lot
        const assignment = await prisma.lotSubcontractorAssignment.findFirst({
          where: {
            lotId: itpInstanceForPermCheck.lotId,
            subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
            status: 'active',
            canCompleteITP: true
          }
        })

        if (!assignment) {
          return res.status(403).json({
            error: 'Not authorized to complete ITP items on this lot'
          })
        }

        // Check project-level setting for subcontractor verification
        let projectRequiresVerification = false // Default: no verification needed
        const projectSettings = itpInstanceForPermCheck.lot?.project?.settings
        if (projectSettings) {
          try {
            const settings = typeof projectSettings === 'string'
              ? JSON.parse(projectSettings)
              : projectSettings
            projectRequiresVerification = settings.requireSubcontractorVerification === true
          } catch (e) {
            // Invalid JSON, use default (no verification)
          }
        }

        // Set verification status: project setting controls default, lot assignment can override
        // If project doesn't require verification, auto-verify
        // If project requires verification, use lot assignment setting
        if (!projectRequiresVerification) {
          verificationStatus = 'verified'
        } else {
          verificationStatus = assignment.itpRequiresVerification
            ? 'pending_verification'
            : 'verified'
        }
      } else {
        // Fallback to auto-verify if no assignment found (project default is no verification)
        verificationStatus = 'verified'
      }
    }

    // Build witness data object (only include if values provided)
    const witnessData: Record<string, unknown> = {}
    if (witnessPresent !== undefined) {
      witnessData.witnessPresent = witnessPresent
    }
    if (witnessName !== undefined) {
      witnessData.witnessName = witnessName || null
    }
    if (witnessCompany !== undefined) {
      witnessData.witnessCompany = witnessCompany || null
    }

    let completion
    if (existingCompletion) {
      // Update existing completion
      completion = await prisma.iTPCompletion.update({
        where: { id: existingCompletion.id },
        data: {
          status: newStatus,
          notes: notes ?? existingCompletion.notes,
          completedAt: isFinished ? new Date() : null,
          completedById: isFinished ? user.userId : null,
          // Feature #463: Signature capture
          ...(signatureDataUrl !== undefined ? { signatureUrl: signatureDataUrl } : {}),
          // Feature #271: Set pending_verification for subcontractor completions
          ...(verificationStatus ? { verificationStatus } : {}),
          ...witnessData
        },
        include: {
          completedBy: {
            select: { id: true, fullName: true, email: true }
          },
          verifiedBy: {
            select: { id: true, fullName: true, email: true }
          },
          attachments: true,
          checklistItem: true
        }
      })
    } else {
      // Create new completion
      completion = await prisma.iTPCompletion.create({
        data: {
          itpInstanceId,
          checklistItemId,
          status: newStatus,
          notes: notes || null,
          completedAt: isFinished ? new Date() : null,
          completedById: isFinished ? user.userId : null,
          // Feature #463: Signature capture
          signatureUrl: signatureDataUrl || null,
          // Feature #271: Set pending_verification for subcontractor completions
          ...(verificationStatus ? { verificationStatus } : {}),
          ...witnessData
        },
        include: {
          completedBy: {
            select: { id: true, fullName: true, email: true }
          },
          verifiedBy: {
            select: { id: true, fullName: true, email: true }
          },
          attachments: true,
          checklistItem: true
        }
      })
    }

    // If status is 'failed', create an NCR linked to the lot
    let createdNcr = null
    if (newStatus === 'failed') {
      // Get the ITP instance to find the lot and project
      const itpInstance = await prisma.iTPInstance.findUnique({
        where: { id: itpInstanceId },
        include: {
          lot: true,
          template: true
        }
      })

      if (itpInstance && itpInstance.lot) {
        const lot = itpInstance.lot

        // Get checklist item description for NCR context
        const checklistItemDescription = (completion as any).checklistItem?.description || 'ITP checklist item'

        // Generate NCR number
        const existingNcrCount = await prisma.nCR.count({
          where: { projectId: lot.projectId }
        })
        const ncrNumber = `NCR-${String(existingNcrCount + 1).padStart(4, '0')}`

        // Determine if major NCR requires QM approval
        const isMajor = ncrSeverity === 'major'

        // Create the NCR
        createdNcr = await prisma.nCR.create({
          data: {
            projectId: lot.projectId,
            ncrNumber,
            description: ncrDescription || `ITP item failed: ${checklistItemDescription}`,
            specificationReference: itpInstance.template?.specificationReference || null,
            category: ncrCategory || 'workmanship',
            severity: ncrSeverity || 'minor',
            qmApprovalRequired: isMajor,
            raisedById: user.userId,
            // Store ITP item reference in rectification notes for traceability
            rectificationNotes: `Raised from ITP checklist item: ${checklistItemDescription} (Item ID: ${checklistItemId})`,
            ncrLots: {
              create: [{
                lotId: lot.id
              }]
            }
          },
          include: {
            project: { select: { name: true } },
            raisedBy: { select: { fullName: true, email: true } },
            ncrLots: {
              include: {
                lot: { select: { lotNumber: true } }
              }
            }
          }
        })

        // Update lot status to ncr_raised
        await prisma.lot.update({
          where: { id: lot.id },
          data: { status: 'ncr_raised' }
        })

        console.log(`Created NCR ${ncrNumber} for failed ITP item: ${checklistItemDescription}`)
      }
    }

    // Auto-progress lot status based on ITP completion state (but not for failed items)
    if (isFinished && newStatus !== 'failed') {
      await updateLotStatusFromITP(itpInstanceId)
    }

    // Check for approaching witness points and send notifications (Feature #175)
    let witnessPointNotification = null
    if (isFinished && newStatus === 'completed') {
      witnessPointNotification = await checkAndNotifyWitnessPoint(
        itpInstanceId,
        checklistItemId,
        user.userId
      )
    }

    // Feature #271: Notify head contractor when subcontractor completes an item (only if verification required)
    let subbieCompletionNotification = null
    if (isSubcontractor && isFinished && newStatus === 'completed' && verificationStatus === 'pending_verification') {
      try {
        // Get the ITP instance with lot and project info
        const itpInstance = await prisma.iTPInstance.findUnique({
          where: { id: itpInstanceId },
          include: {
            lot: {
              include: {
                project: { select: { id: true, name: true } }
              }
            }
          }
        })

        if (itpInstance && itpInstance.lot && itpInstance.lot.project) {
          const lot = itpInstance.lot
          const project = lot.project
          const itemDescription = (completion as any).checklistItem?.description || 'ITP item'
          const subbieName = subcontractorUser?.subcontractorCompany?.companyName || 'Subcontractor'

          // Find project managers and superintendents to notify
          const projectManagers = await prisma.projectUser.findMany({
            where: {
              projectId: project.id,
              role: { in: ['project_manager', 'admin', 'superintendent'] }
            },
            select: { userId: true }
          })

          // Create notifications for head contractor team
          if (projectManagers.length > 0) {
            await prisma.notification.createMany({
              data: projectManagers.map(pm => ({
                userId: pm.userId,
                projectId: project.id,
                type: 'itp_subbie_completion',
                title: 'Subcontractor ITP Item Completed',
                message: `${subbieName} has completed ITP item "${itemDescription}" on lot ${lot.lotNumber}. Verification required.`,
                linkUrl: `/projects/${project.id}/lots/${lot.id}?tab=itp&highlight=${checklistItemId}`
              }))
            })

            subbieCompletionNotification = {
              notificationsSent: projectManagers.length,
              subcontractorCompany: subbieName,
              lotNumber: lot.lotNumber,
              itemDescription
            }

            console.log(`Feature #271: Notified ${projectManagers.length} head contractor users about subcontractor ITP completion`)
          }
        }
      } catch (notifError) {
        console.error('Failed to send subcontractor completion notification:', notifError)
      }
    }

    // Transform to frontend-friendly format
    const transformedCompletion = {
      ...completion,
      isCompleted: completion.status === 'completed' || completion.status === 'not_applicable',
      isNotApplicable: completion.status === 'not_applicable',
      isFailed: completion.status === 'failed',
      isVerified: completion.verificationStatus === 'verified',
      isPendingVerification: completion.verificationStatus === 'pending_verification',
      attachments: (completion as any).attachments || [],
      linkedNcr: createdNcr
    }

    res.json({
      completion: transformedCompletion,
      ncr: createdNcr,
      witnessPointNotification,
      subbieCompletionNotification
    })
  } catch (error) {
    console.error('Error updating ITP completion:', error)
    res.status(500).json({ error: 'Failed to update completion' })
  }
})

// Verify a completed checklist item (for hold points)
itpRouter.post('/completions/:id/verify', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { id } = req.params

    const completion = await prisma.iTPCompletion.update({
      where: { id },
      data: {
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        verifiedById: user.userId
      },
      include: {
        completedBy: {
          select: { id: true, fullName: true, email: true }
        },
        verifiedBy: {
          select: { id: true, fullName: true, email: true }
        },
        itpInstance: {
          include: {
            lot: {
              select: { id: true, lotNumber: true, projectId: true }
            }
          }
        },
        checklistItem: {
          select: { description: true }
        }
      }
    })

    // Create notification for the user who completed the item (Feature #633)
    if (completion.completedById && completion.completedById !== user.userId) {
      try {
        await prisma.notification.create({
          data: {
            userId: completion.completedById,
            projectId: completion.itpInstance?.lot?.projectId,
            type: 'itp_verification',
            title: 'ITP Item Verified',
            message: `Your ITP item "${completion.checklistItem?.description}" for Lot ${completion.itpInstance?.lot?.lotNumber} has been verified`,
            linkUrl: `/projects/${completion.itpInstance?.lot?.projectId}/lots/${completion.itpInstance?.lotId}?tab=itp`,
          }
        })
      } catch (notifError) {
        console.error('Failed to create verification notification:', notifError)
      }
    }

    // Transform to frontend-friendly format
    const transformedCompletion = {
      ...completion,
      isCompleted: completion.status === 'completed',
      isVerified: completion.verificationStatus === 'verified'
    }

    res.json({ completion: transformedCompletion })
  } catch (error) {
    console.error('Error verifying ITP completion:', error)
    res.status(500).json({ error: 'Failed to verify completion' })
  }
})

// Reject a completed checklist item (Feature #634)
itpRouter.post('/completions/:id/reject', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { id } = req.params
    const parseResult = rejectCompletionSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Rejection reason is required' })
    }
    const { reason } = parseResult.data

    const completion = await prisma.iTPCompletion.update({
      where: { id },
      data: {
        verificationStatus: 'rejected',
        verifiedAt: new Date(),
        verifiedById: user.userId,
        verificationNotes: reason.trim()
      },
      include: {
        completedBy: {
          select: { id: true, fullName: true, email: true }
        },
        verifiedBy: {
          select: { id: true, fullName: true, email: true }
        },
        itpInstance: {
          include: {
            lot: {
              select: { id: true, lotNumber: true, projectId: true }
            }
          }
        },
        checklistItem: {
          select: { description: true }
        }
      }
    })

    // Create notification for the user who completed the item
    if (completion.completedById && completion.completedById !== user.userId) {
      try {
        await prisma.notification.create({
          data: {
            userId: completion.completedById,
            projectId: completion.itpInstance?.lot?.projectId,
            type: 'itp_rejection',
            title: 'ITP Item Rejected',
            message: `Your ITP item "${completion.checklistItem?.description}" for Lot ${completion.itpInstance?.lot?.lotNumber} was rejected. Reason: ${reason.trim()}`,
            linkUrl: `/projects/${completion.itpInstance?.lot?.projectId}/lots/${completion.itpInstance?.lotId}?tab=itp`,
          }
        })
      } catch (notifError) {
        console.error('Failed to create rejection notification:', notifError)
      }
    }

    // Transform to frontend-friendly format
    const transformedCompletion = {
      ...completion,
      isCompleted: completion.status === 'completed',
      isVerified: false,
      isRejected: true,
      rejectionReason: reason.trim()
    }

    res.json({ completion: transformedCompletion })
  } catch (error) {
    console.error('Error rejecting ITP completion:', error)
    res.status(500).json({ error: 'Failed to reject completion' })
  }
})

// Feature #272: Get pending verifications for a project
// Head contractor can view all ITP items completed by subcontractors that need verification
itpRouter.get('/pending-verifications', requireAuth, async (req: any, res) => {
  try {
    const { projectId } = req.query

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' })
    }

    // Find all completions with pending_verification status for this project
    const pendingCompletions = await prisma.iTPCompletion.findMany({
      where: {
        verificationStatus: 'pending_verification',
        itpInstance: {
          lot: {
            projectId: projectId as string
          }
        }
      },
      include: {
        completedBy: {
          select: { id: true, fullName: true, email: true }
        },
        checklistItem: {
          select: { id: true, description: true, responsibleParty: true }
        },
        itpInstance: {
          include: {
            lot: {
              select: { id: true, lotNumber: true, description: true, assignedSubcontractorId: true },
              include: {
                assignedSubcontractor: {
                  select: { id: true, companyName: true }
                }
              }
            },
            template: {
              select: { id: true, name: true }
            }
          }
        },
        attachments: {
          include: {
            document: {
              select: { id: true, filename: true, fileUrl: true, caption: true }
            }
          }
        }
      },
      orderBy: { completedAt: 'asc' }
    })

    // Transform for frontend
    const transformed = pendingCompletions.map(c => ({
      id: c.id,
      status: c.status,
      verificationStatus: c.verificationStatus,
      completedAt: c.completedAt,
      notes: c.notes,
      completedBy: c.completedBy,
      checklistItem: c.checklistItem,
      lot: c.itpInstance.lot,
      template: c.itpInstance.template,
      subcontractor: (c.itpInstance.lot as any)?.assignedSubcontractor || null,
      attachments: c.attachments.map(a => ({
        id: a.id,
        document: a.document
      }))
    }))

    res.json({
      pendingVerifications: transformed,
      count: transformed.length
    })
  } catch (error) {
    console.error('Error fetching pending verifications:', error)
    res.status(500).json({ error: 'Failed to fetch pending verifications' })
  }
})

// Add photo attachment to ITP completion
itpRouter.post('/completions/:completionId/attachments', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { completionId } = req.params
    const parseResult = addAttachmentSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || 'filename and fileUrl are required' })
    }
    const { filename, fileUrl, caption, gpsLatitude, gpsLongitude, mimeType } = parseResult.data

    // Determine mimeType from various sources
    let determinedMimeType: string | null = mimeType || null
    if (!determinedMimeType) {
      // Try to extract from base64 data URL
      const dataUrlMatch = fileUrl.match(/^data:([^;]+);base64,/)
      if (dataUrlMatch) {
        determinedMimeType = dataUrlMatch[1]
      } else {
        // Try to determine from filename extension
        const ext = filename.split('.').pop()?.toLowerCase()
        const mimeMap: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp'
        }
        determinedMimeType = mimeMap[ext || ''] || null
      }
    }

    // Get the completion to find projectId
    const completion = await prisma.iTPCompletion.findUnique({
      where: { id: completionId },
      include: {
        itpInstance: {
          include: {
            template: {
              include: {
                project: true
              }
            }
          }
        },
        checklistItem: true
      }
    })

    if (!completion) {
      return res.status(404).json({ error: 'Completion not found' })
    }

    // Get the lot from the ITP instance
    const itpInstance = await prisma.iTPInstance.findUnique({
      where: { id: completion.itpInstanceId },
      include: { lot: true }
    })

    // Use the lot's projectId (important for cross-project template imports)
    // Fall back to template's projectId if lot is not found
    const documentProjectId = itpInstance?.lot?.projectId || completion.itpInstance.template.projectId

    if (!documentProjectId) {
      return res.status(400).json({ error: 'Unable to determine project for attachment' })
    }

    // Create a document record for the photo
    const document = await prisma.document.create({
      data: {
        projectId: documentProjectId,
        lotId: itpInstance?.lotId ?? undefined,
        documentType: 'photo',
        category: 'itp_evidence',
        filename,
        fileUrl,
        mimeType: determinedMimeType,
        uploadedById: user.userId,
        caption: caption || `ITP Evidence: ${completion.checklistItem.description}`,
        gpsLatitude: gpsLatitude ? parseFloat(String(gpsLatitude)) : null,
        gpsLongitude: gpsLongitude ? parseFloat(String(gpsLongitude)) : null
      }
    })

    // Create the attachment link
    const attachment = await prisma.iTPCompletionAttachment.create({
      data: {
        completionId,
        documentId: document.id
      },
      include: {
        document: true
      }
    })

    res.status(201).json({
      attachment: {
        id: attachment.id,
        documentId: attachment.documentId,
        document: attachment.document
      }
    })
  } catch (error) {
    console.error('Error adding attachment to ITP completion:', error)
    res.status(500).json({ error: 'Failed to add attachment' })
  }
})

// Get attachments for an ITP completion
itpRouter.get('/completions/:completionId/attachments', requireAuth, async (req: any, res) => {
  try {
    const { completionId } = req.params

    const attachments = await prisma.iTPCompletionAttachment.findMany({
      where: { completionId },
      include: {
        document: {
          include: {
            uploadedBy: {
              select: { id: true, fullName: true, email: true }
            }
          }
        }
      }
    })

    res.json({
      attachments: attachments.map(a => ({
        id: a.id,
        documentId: a.documentId,
        document: a.document
      }))
    })
  } catch (error) {
    console.error('Error fetching ITP completion attachments:', error)
    res.status(500).json({ error: 'Failed to fetch attachments' })
  }
})

// Delete an attachment from ITP completion
itpRouter.delete('/completions/:completionId/attachments/:attachmentId', requireAuth, async (req: any, res) => {
  try {
    const { completionId, attachmentId } = req.params

    // Verify the attachment belongs to this completion
    const attachment = await prisma.iTPCompletionAttachment.findFirst({
      where: {
        id: attachmentId,
        completionId
      }
    })

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' })
    }

    // Delete the attachment (document remains for record keeping)
    await prisma.iTPCompletionAttachment.delete({
      where: { id: attachmentId }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting ITP completion attachment:', error)
    res.status(500).json({ error: 'Failed to delete attachment' })
  }
})

export { itpRouter }
