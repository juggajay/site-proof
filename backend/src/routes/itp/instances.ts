// ITP instance creation, listing, assignment to lots
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth } from '../../middleware/authMiddleware.js'
import type { TemplateSnapshot, ChecklistItem } from './helpers/witnessPoints.js'

// Type for ITP completion with attachments
interface CompletionWithAttachments {
  checklistItemId: string
  status: string
  verificationStatus?: string | null
  attachments?: Array<{
    id: string
    documentId: string
    document?: {
      id: string
      filename: string
      fileUrl: string
      caption?: string | null
    }
  }>
}

// Extended checklist item with frontend-friendly properties
interface TransformedChecklistItem extends Omit<ChecklistItem, 'sequenceNumber'> {
  category: string
  isHoldPoint: boolean
  order: number
  sequenceNumber?: number
}

// Type for transformed template data
interface TransformedTemplateData extends Omit<TemplateSnapshot, 'checklistItems'> {
  checklistItems: TransformedChecklistItem[]
}

// POST /instances - Create ITP instance (assign to lot)
const createInstanceSchema = z.object({
  lotId: z.string().uuid(),
  templateId: z.string().uuid()
})

export const instancesRouter = Router()

// Assign ITP template to lot (create ITP instance)
instancesRouter.post('/instances', requireAuth, async (req: Request, res: Response) => {
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
instancesRouter.get('/instances/lot/:lotId', requireAuth, async (req: Request, res: Response) => {
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
    let templateData: TransformedTemplateData
    if (instance.templateSnapshot) {
      // Parse the snapshot (template state at assignment time)
      const snapshot: TemplateSnapshot = JSON.parse(instance.templateSnapshot)
      templateData = {
        ...snapshot,
        checklistItems: snapshot.checklistItems.map((item) => ({
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
        (item) => item.responsibleParty === 'subcontractor'
      )
    }

    // Get item IDs for filtered items (used to filter completions)
    const filteredItemIds = new Set(templateData.checklistItems.map((item) => item.id))

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
          attachments: (c as unknown as CompletionWithAttachments).attachments?.map((a) => ({
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
