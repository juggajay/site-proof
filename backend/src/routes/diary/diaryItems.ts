import { Router, Request, Response } from 'express'
import { prisma } from '../../lib/prisma.js'
import { z } from 'zod'
import { checkProjectAccess } from '../../lib/projectAccess.js'

const router = Router()

// Schemas
const addPersonnelSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  role: z.string().optional(),
  startTime: z.string().optional(),
  finishTime: z.string().optional(),
  hours: z.number().optional(),
  lotId: z.string().optional(),
})

const addPlantSchema = z.object({
  description: z.string().min(1),
  idRego: z.string().optional(),
  company: z.string().optional(),
  hoursOperated: z.number().optional(),
  notes: z.string().optional(),
  lotId: z.string().optional(),
})

const addActivitySchema = z.object({
  lotId: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
})

const addDelaySchema = z.object({
  delayType: z.string().min(1),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  durationHours: z.number().optional(),
  description: z.string().min(1),
  impact: z.string().optional(),
  lotId: z.string().optional(),
})

// Feature #477: Visitor recording schema
const addVisitorSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  purpose: z.string().optional(),
  timeInOut: z.string().optional(),
})

const addDeliverySchema = z.object({
  description: z.string().min(1),
  supplier: z.string().optional(),
  docketNumber: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  lotId: z.string().optional(),
  notes: z.string().optional(),
})

const addEventSchema = z.object({
  eventType: z.enum(['visitor', 'safety', 'instruction', 'variation', 'other']),
  description: z.string().min(1),
  notes: z.string().optional(),
  lotId: z.string().optional(),
})

// POST /api/diary/:diaryId/personnel - Add personnel to diary
router.post('/:diaryId/personnel', async (req: Request, res: Response) => {
  try {
    const { diaryId } = req.params
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    if (diary.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot modify submitted diary' })
    }

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const data = addPersonnelSchema.parse(req.body)

    const personnel = await prisma.diaryPersonnel.create({
      data: {
        diaryId,
        ...data,
      }
    })

    res.status(201).json(personnel)
  } catch (error) {
    console.error('Error adding personnel:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors })
    }
    res.status(500).json({ error: 'Failed to add personnel' })
  }
})

// DELETE /api/diary/:diaryId/personnel/:personnelId - Remove personnel
router.delete('/:diaryId/personnel/:personnelId', async (req: Request, res: Response) => {
  try {
    const { diaryId, personnelId } = req.params
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    if (diary.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot modify submitted diary' })
    }

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await prisma.diaryPersonnel.delete({ where: { id: personnelId } })
    res.status(204).send()
  } catch (error) {
    console.error('Error removing personnel:', error)
    res.status(500).json({ error: 'Failed to remove personnel' })
  }
})

// POST /api/diary/:diaryId/plant - Add plant to diary
router.post('/:diaryId/plant', async (req: Request, res: Response) => {
  try {
    const { diaryId } = req.params
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    if (diary.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot modify submitted diary' })
    }

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const data = addPlantSchema.parse(req.body)

    const plant = await prisma.diaryPlant.create({
      data: {
        diaryId,
        ...data,
      }
    })

    res.status(201).json(plant)
  } catch (error) {
    console.error('Error adding plant:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors })
    }
    res.status(500).json({ error: 'Failed to add plant' })
  }
})

// DELETE /api/diary/:diaryId/plant/:plantId - Remove plant
router.delete('/:diaryId/plant/:plantId', async (req: Request, res: Response) => {
  try {
    const { diaryId, plantId } = req.params
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    if (diary.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot modify submitted diary' })
    }

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await prisma.diaryPlant.delete({ where: { id: plantId } })
    res.status(204).send()
  } catch (error) {
    console.error('Error removing plant:', error)
    res.status(500).json({ error: 'Failed to remove plant' })
  }
})

// Feature #477: POST /api/diary/:diaryId/visitors - Add visitor to diary
router.post('/:diaryId/visitors', async (req: Request, res: Response) => {
  try {
    const { diaryId } = req.params
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    if (diary.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot modify submitted diary' })
    }

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const data = addVisitorSchema.parse(req.body)

    const visitor = await prisma.diaryVisitor.create({
      data: {
        diaryId,
        ...data,
      }
    })

    res.status(201).json(visitor)
  } catch (error) {
    console.error('Error adding visitor:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors })
    }
    res.status(500).json({ error: 'Failed to add visitor' })
  }
})

// Feature #477: PUT /api/diary/:diaryId/visitors/:visitorId - Update visitor
router.put('/:diaryId/visitors/:visitorId', async (req: Request, res: Response) => {
  try {
    const { diaryId, visitorId } = req.params
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    if (diary.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot modify submitted diary' })
    }

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const data = addVisitorSchema.partial().parse(req.body)

    const visitor = await prisma.diaryVisitor.update({
      where: { id: visitorId },
      data,
    })

    res.json(visitor)
  } catch (error) {
    console.error('Error updating visitor:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors })
    }
    res.status(500).json({ error: 'Failed to update visitor' })
  }
})

// Feature #477: DELETE /api/diary/:diaryId/visitors/:visitorId - Remove visitor
router.delete('/:diaryId/visitors/:visitorId', async (req: Request, res: Response) => {
  try {
    const { diaryId, visitorId } = req.params
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    if (diary.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot modify submitted diary' })
    }

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await prisma.diaryVisitor.delete({ where: { id: visitorId } })
    res.status(204).send()
  } catch (error) {
    console.error('Error removing visitor:', error)
    res.status(500).json({ error: 'Failed to remove visitor' })
  }
})

// GET /api/diary/project/:projectId/recent-plant - Get recently used plant for a project
router.get('/project/:projectId/recent-plant', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get plant from recent diaries (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentDiaries = await prisma.dailyDiary.findMany({
      where: {
        projectId,
        date: { gte: thirtyDaysAgo }
      },
      include: {
        plant: true
      },
      orderBy: { date: 'desc' },
      take: 10
    })

    // Collect unique plant items by description + company
    const plantMap = new Map<string, any>()
    for (const diary of recentDiaries) {
      for (const plant of diary.plant) {
        const key = `${plant.description}|${plant.company || ''}|${plant.idRego || ''}`
        if (!plantMap.has(key)) {
          plantMap.set(key, {
            description: plant.description,
            idRego: plant.idRego,
            company: plant.company,
            lastUsed: diary.date,
            usageCount: 1
          })
        } else {
          const existing = plantMap.get(key)!
          existing.usageCount += 1
        }
      }
    }

    // Convert to array and sort by usage count (most used first)
    const recentPlant = Array.from(plantMap.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 20) // Limit to top 20

    res.json({
      recentPlant,
      count: recentPlant.length
    })
  } catch (error) {
    console.error('Error getting recent plant:', error)
    res.status(500).json({ error: 'Failed to get recent plant' })
  }
})

// GET /api/diary/project/:projectId/activity-suggestions - Get activity suggestions
router.get('/project/:projectId/activity-suggestions', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const { search } = req.query
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const suggestions: Array<{ description: string; source: string; category?: string }> = []

    // 1. Get checklist item descriptions from ITP templates for this project
    const itpTemplates = await prisma.iTPTemplate.findMany({
      where: { projectId },
      include: {
        checklistItems: {
          select: { description: true }
        }
      }
    })

    for (const template of itpTemplates) {
      for (const item of template.checklistItems) {
        suggestions.push({
          description: item.description,
          source: 'ITP Template',
          category: template.activityType ?? undefined
        })
      }
    }

    // 2. Get recent activity descriptions from diaries
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentActivities = await prisma.diaryActivity.findMany({
      where: {
        diary: {
          projectId,
          date: { gte: thirtyDaysAgo }
        }
      },
      select: { description: true },
      distinct: ['description'],
      take: 50
    })

    for (const activity of recentActivities) {
      // Only add if not already in suggestions
      if (!suggestions.some(s => s.description === activity.description)) {
        suggestions.push({
          description: activity.description,
          source: 'Recent Activity'
        })
      }
    }

    // 3. Add common construction activities as fallback
    const commonActivities = [
      'Site setup and establishment',
      'Excavation works',
      'Backfilling and compaction',
      'Concrete pour',
      'Formwork installation',
      'Reinforcement installation',
      'Survey and setout',
      'Quality testing',
      'Material delivery',
      'Site cleanup'
    ]

    for (const desc of commonActivities) {
      if (!suggestions.some(s => s.description === desc)) {
        suggestions.push({
          description: desc,
          source: 'Common'
        })
      }
    }

    // Filter by search term if provided
    let filtered = suggestions
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase()
      filtered = suggestions.filter(s =>
        s.description.toLowerCase().includes(searchLower)
      )
    }

    // Deduplicate and limit
    const unique = Array.from(new Map(filtered.map(s => [s.description, s])).values())
    const limited = unique.slice(0, 20)

    res.json({
      suggestions: limited,
      count: limited.length,
      totalAvailable: unique.length
    })
  } catch (error) {
    console.error('Error getting activity suggestions:', error)
    res.status(500).json({ error: 'Failed to get activity suggestions' })
  }
})

// POST /api/diary/:diaryId/activities - Add activity to diary
router.post('/:diaryId/activities', async (req: Request, res: Response) => {
  try {
    const { diaryId } = req.params
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    if (diary.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot modify submitted diary' })
    }

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const data = addActivitySchema.parse(req.body)

    const activity = await prisma.diaryActivity.create({
      data: {
        diaryId,
        ...data,
      },
      include: {
        lot: { select: { id: true, lotNumber: true } }
      }
    })

    res.status(201).json(activity)
  } catch (error) {
    console.error('Error adding activity:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors })
    }
    res.status(500).json({ error: 'Failed to add activity' })
  }
})

// DELETE /api/diary/:diaryId/activities/:activityId - Remove activity
router.delete('/:diaryId/activities/:activityId', async (req: Request, res: Response) => {
  try {
    const { diaryId, activityId } = req.params
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    if (diary.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot modify submitted diary' })
    }

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await prisma.diaryActivity.delete({ where: { id: activityId } })
    res.status(204).send()
  } catch (error) {
    console.error('Error removing activity:', error)
    res.status(500).json({ error: 'Failed to remove activity' })
  }
})

// POST /api/diary/:diaryId/delays - Add delay to diary
router.post('/:diaryId/delays', async (req: Request, res: Response) => {
  try {
    const { diaryId } = req.params
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    if (diary.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot modify submitted diary' })
    }

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const data = addDelaySchema.parse(req.body)

    const delay = await prisma.diaryDelay.create({
      data: {
        diaryId,
        ...data,
      }
    })

    res.status(201).json(delay)
  } catch (error) {
    console.error('Error adding delay:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors })
    }
    res.status(500).json({ error: 'Failed to add delay' })
  }
})

// DELETE /api/diary/:diaryId/delays/:delayId - Remove delay
router.delete('/:diaryId/delays/:delayId', async (req: Request, res: Response) => {
  try {
    const { diaryId, delayId } = req.params
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    if (diary.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot modify submitted diary' })
    }

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await prisma.diaryDelay.delete({ where: { id: delayId } })
    res.status(204).send()
  } catch (error) {
    console.error('Error removing delay:', error)
    res.status(500).json({ error: 'Failed to remove delay' })
  }
})

// POST /api/diary/:diaryId/deliveries - Add delivery to diary
router.post('/:diaryId/deliveries', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const { diaryId } = req.params
    const data = addDeliverySchema.parse(req.body)

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) return res.status(404).json({ error: 'Diary not found' })
    if (diary.status === 'submitted') return res.status(400).json({ error: 'Cannot modify submitted diary' })

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' })

    const delivery = await prisma.diaryDelivery.create({
      data: {
        diaryId,
        description: data.description,
        supplier: data.supplier,
        docketNumber: data.docketNumber,
        quantity: data.quantity,
        unit: data.unit,
        lotId: data.lotId,
        notes: data.notes,
      },
      include: { lot: { select: { id: true, lotNumber: true } } },
    })

    res.status(201).json(delivery)
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: error.errors })
    console.error('Add delivery error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/diary/:diaryId/deliveries/:deliveryId - Remove delivery
router.delete('/:diaryId/deliveries/:deliveryId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const { diaryId, deliveryId } = req.params

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) return res.status(404).json({ error: 'Diary not found' })
    if (diary.status === 'submitted') return res.status(400).json({ error: 'Cannot modify submitted diary' })

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' })

    await prisma.diaryDelivery.delete({ where: { id: deliveryId } })
    res.json({ message: 'Delivery removed' })
  } catch (error) {
    console.error('Remove delivery error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/diary/:diaryId/events - Add event to diary
router.post('/:diaryId/events', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const { diaryId } = req.params
    const data = addEventSchema.parse(req.body)

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) return res.status(404).json({ error: 'Diary not found' })
    if (diary.status === 'submitted') return res.status(400).json({ error: 'Cannot modify submitted diary' })

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' })

    const event = await prisma.diaryEvent.create({
      data: {
        diaryId,
        eventType: data.eventType,
        description: data.description,
        notes: data.notes,
        lotId: data.lotId,
      },
      include: { lot: { select: { id: true, lotNumber: true } } },
    })

    res.status(201).json(event)
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: error.errors })
    console.error('Add event error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/diary/:diaryId/events/:eventId - Remove event
router.delete('/:diaryId/events/:eventId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const { diaryId, eventId } = req.params

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) return res.status(404).json({ error: 'Diary not found' })
    if (diary.status === 'submitted') return res.status(400).json({ error: 'Cannot modify submitted diary' })

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' })

    await prisma.diaryEvent.delete({ where: { id: eventId } })
    res.json({ message: 'Event removed' })
  } catch (error) {
    console.error('Remove event error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export { router as diaryItemsRouter }
