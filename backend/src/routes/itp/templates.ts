// Feature #592 trigger - ITP template CRUD and management
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth } from '../../middleware/authMiddleware.js'

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

export const templatesRouter = Router()

// Get ITP templates from other projects (for cross-project import - Feature #682)
templatesRouter.get('/templates/cross-project', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any
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
templatesRouter.get('/templates', requireAuth, async (req: Request, res: Response) => {
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
templatesRouter.get('/templates/:id', requireAuth, async (req: Request, res: Response) => {
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
templatesRouter.post('/templates', requireAuth, async (req: Request, res: Response) => {
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
          create: (checklistItems || []).map((item, index: number) => ({
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
templatesRouter.post('/templates/:id/clone', requireAuth, async (req: Request, res: Response) => {
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
templatesRouter.patch('/templates/:id', requireAuth, async (req: Request, res: Response) => {
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
        create: checklistItems.map((item, index: number) => ({
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
templatesRouter.get('/templates/:id/lots', requireAuth, async (req: Request, res: Response) => {
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
templatesRouter.delete('/templates/:id', requireAuth, async (req: Request, res: Response) => {
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
    // We don't delete the instances - they keep working with their snapshots

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
templatesRouter.post('/templates/:id/archive', requireAuth, async (req: Request, res: Response) => {
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
templatesRouter.post('/templates/:id/restore', requireAuth, async (req: Request, res: Response) => {
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
templatesRouter.post('/templates/:id/propagate', requireAuth, async (req: Request, res: Response) => {
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
