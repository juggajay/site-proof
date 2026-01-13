import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()
const itpRouter = Router()

interface AuthUser {
  userId: string
  email: string
}

// Auth middleware
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as AuthUser
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Get ITP templates for a project
itpRouter.get('/templates', requireAuth, async (req: any, res) => {
  try {
    const { projectId } = req.query

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' })
    }

    const templates = await prisma.iTPTemplate.findMany({
      where: { projectId: projectId as string },
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
      checklistItems: t.checklistItems.map(item => ({
        id: item.id,
        description: item.description,
        category: item.responsibleParty || 'general',
        isHoldPoint: item.pointType === 'hold_point',
        order: item.sequenceNumber,
        acceptanceCriteria: item.acceptanceCriteria
      }))
    }))

    res.json({ templates: transformedTemplates })
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
        isHoldPoint: item.pointType === 'hold_point',
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
    const { projectId, name, description, activityType, checklistItems } = req.body

    if (!projectId || !name || !activityType) {
      return res.status(400).json({ error: 'projectId, name, and activityType are required' })
    }

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
            pointType: item.isHoldPoint ? 'hold_point' : 'standard',
            responsibleParty: item.category || 'contractor',
            acceptanceCriteria: item.acceptanceCriteria || null
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
        isHoldPoint: item.pointType === 'hold_point',
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

// Assign ITP template to lot (create ITP instance)
itpRouter.post('/instances', requireAuth, async (req: any, res) => {
  try {
    const { lotId, templateId } = req.body

    if (!lotId || !templateId) {
      return res.status(400).json({ error: 'lotId and templateId are required' })
    }

    // Check if lot already has an ITP instance
    const existingInstance = await prisma.iTPInstance.findUnique({
      where: { lotId }
    })

    if (existingInstance) {
      return res.status(400).json({ error: 'Lot already has an ITP assigned' })
    }

    // Get the template
    const template = await prisma.iTPTemplate.findUnique({
      where: { id: templateId },
      include: { checklistItems: true }
    })

    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }

    // Create instance
    const instance = await prisma.iTPInstance.create({
      data: {
        lotId,
        templateId
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
          isHoldPoint: item.pointType === 'hold_point',
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

// Get ITP instance for a lot
itpRouter.get('/instances/lot/:lotId', requireAuth, async (req: any, res) => {
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
            }
          }
        }
      }
    })

    if (!instance) {
      return res.status(404).json({ error: 'No ITP assigned to this lot' })
    }

    // Transform to frontend-friendly format
    const transformedInstance = {
      ...instance,
      template: {
        ...instance.template,
        checklistItems: instance.template.checklistItems.map(item => ({
          id: item.id,
          description: item.description,
          category: item.responsibleParty || 'general',
          isHoldPoint: item.pointType === 'hold_point',
          order: item.sequenceNumber,
          acceptanceCriteria: item.acceptanceCriteria
        }))
      },
      completions: instance.completions.map(c => ({
        ...c,
        isCompleted: c.status === 'completed',
        isVerified: c.verificationStatus === 'verified'
      }))
    }

    res.json({ instance: transformedInstance })
  } catch (error) {
    console.error('Error fetching ITP instance:', error)
    res.status(500).json({ error: 'Failed to fetch ITP instance' })
  }
})

// Complete/update a checklist item
itpRouter.post('/completions', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { itpInstanceId, checklistItemId, isCompleted, notes } = req.body

    if (!itpInstanceId || !checklistItemId) {
      return res.status(400).json({ error: 'itpInstanceId and checklistItemId are required' })
    }

    // Determine status based on isCompleted flag
    const newStatus = isCompleted ? 'completed' : 'pending'

    // Check if completion already exists
    const existingCompletion = await prisma.iTPCompletion.findFirst({
      where: {
        itpInstanceId,
        checklistItemId
      }
    })

    let completion
    if (existingCompletion) {
      // Update existing completion
      completion = await prisma.iTPCompletion.update({
        where: { id: existingCompletion.id },
        data: {
          status: isCompleted !== undefined ? newStatus : existingCompletion.status,
          notes: notes ?? existingCompletion.notes,
          completedAt: isCompleted ? new Date() : (isCompleted === false ? null : existingCompletion.completedAt),
          completedById: isCompleted ? user.userId : (isCompleted === false ? null : existingCompletion.completedById)
        },
        include: {
          completedBy: {
            select: { id: true, fullName: true, email: true }
          },
          verifiedBy: {
            select: { id: true, fullName: true, email: true }
          }
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
          completedAt: isCompleted ? new Date() : null,
          completedById: isCompleted ? user.userId : null
        },
        include: {
          completedBy: {
            select: { id: true, fullName: true, email: true }
          },
          verifiedBy: {
            select: { id: true, fullName: true, email: true }
          }
        }
      })
    }

    // Transform to frontend-friendly format (add isCompleted and isVerified)
    const transformedCompletion = {
      ...completion,
      isCompleted: completion.status === 'completed',
      isVerified: completion.verificationStatus === 'verified'
    }

    res.json({ completion: transformedCompletion })
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
        }
      }
    })

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

export { itpRouter }
