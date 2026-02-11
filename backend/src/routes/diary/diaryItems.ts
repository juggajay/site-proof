import { Router, Request, Response } from 'express'
import { prisma } from '../../lib/prisma.js'
import { z } from 'zod'
import { checkProjectAccess } from '../../lib/projectAccess.js'
import { AppError } from '../../lib/AppError.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

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
router.post('/:diaryId/personnel', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  if (diary.status === 'submitted') {
    throw AppError.badRequest('Cannot modify submitted diary')
  }

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
  }

  const data = addPersonnelSchema.parse(req.body)

  const personnel = await prisma.diaryPersonnel.create({
    data: {
      diaryId,
      ...data,
    }
  })

  res.status(201).json(personnel)
  
}))

// DELETE /api/diary/:diaryId/personnel/:personnelId - Remove personnel
router.delete('/:diaryId/personnel/:personnelId', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId, personnelId } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  if (diary.status === 'submitted') {
    throw AppError.badRequest('Cannot modify submitted diary')
  }

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
  }

  await prisma.diaryPersonnel.delete({ where: { id: personnelId } })
  res.status(204).send()
  
}))

// POST /api/diary/:diaryId/plant - Add plant to diary
router.post('/:diaryId/plant', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  if (diary.status === 'submitted') {
    throw AppError.badRequest('Cannot modify submitted diary')
  }

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
  }

  const data = addPlantSchema.parse(req.body)

  const plant = await prisma.diaryPlant.create({
    data: {
      diaryId,
      ...data,
    }
  })

  res.status(201).json(plant)
  
}))

// DELETE /api/diary/:diaryId/plant/:plantId - Remove plant
router.delete('/:diaryId/plant/:plantId', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId, plantId } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  if (diary.status === 'submitted') {
    throw AppError.badRequest('Cannot modify submitted diary')
  }

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
  }

  await prisma.diaryPlant.delete({ where: { id: plantId } })
  res.status(204).send()
  
}))

// Feature #477: POST /api/diary/:diaryId/visitors - Add visitor to diary
router.post('/:diaryId/visitors', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  if (diary.status === 'submitted') {
    throw AppError.badRequest('Cannot modify submitted diary')
  }

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
  }

  const data = addVisitorSchema.parse(req.body)

  const visitor = await prisma.diaryVisitor.create({
    data: {
      diaryId,
      ...data,
    }
  })

  res.status(201).json(visitor)
  
}))

// Feature #477: PUT /api/diary/:diaryId/visitors/:visitorId - Update visitor
router.put('/:diaryId/visitors/:visitorId', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId, visitorId } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  if (diary.status === 'submitted') {
    throw AppError.badRequest('Cannot modify submitted diary')
  }

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
  }

  const data = addVisitorSchema.partial().parse(req.body)

  const visitor = await prisma.diaryVisitor.update({
    where: { id: visitorId },
    data,
  })

  res.json(visitor)
  
}))

// Feature #477: DELETE /api/diary/:diaryId/visitors/:visitorId - Remove visitor
router.delete('/:diaryId/visitors/:visitorId', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId, visitorId } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  if (diary.status === 'submitted') {
    throw AppError.badRequest('Cannot modify submitted diary')
  }

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
  }

  await prisma.diaryVisitor.delete({ where: { id: visitorId } })
  res.status(204).send()
  
}))

// GET /api/diary/project/:projectId/recent-plant - Get recently used plant for a project
router.get('/project/:projectId/recent-plant', asyncHandler(async (req: Request, res: Response) => {

  const { projectId } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const hasAccess = await checkProjectAccess(userId, projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
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
  
}))

// GET /api/diary/project/:projectId/activity-suggestions - Get activity suggestions
router.get('/project/:projectId/activity-suggestions', asyncHandler(async (req: Request, res: Response) => {

  const { projectId } = req.params
  const { search } = req.query
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const hasAccess = await checkProjectAccess(userId, projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
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
  
}))

// POST /api/diary/:diaryId/activities - Add activity to diary
router.post('/:diaryId/activities', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  if (diary.status === 'submitted') {
    throw AppError.badRequest('Cannot modify submitted diary')
  }

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
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
  
}))

// DELETE /api/diary/:diaryId/activities/:activityId - Remove activity
router.delete('/:diaryId/activities/:activityId', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId, activityId } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  if (diary.status === 'submitted') {
    throw AppError.badRequest('Cannot modify submitted diary')
  }

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
  }

  await prisma.diaryActivity.delete({ where: { id: activityId } })
  res.status(204).send()
  
}))

// POST /api/diary/:diaryId/delays - Add delay to diary
router.post('/:diaryId/delays', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  if (diary.status === 'submitted') {
    throw AppError.badRequest('Cannot modify submitted diary')
  }

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
  }

  const data = addDelaySchema.parse(req.body)

  const delay = await prisma.diaryDelay.create({
    data: {
      diaryId,
      ...data,
    }
  })

  res.status(201).json(delay)
  
}))

// DELETE /api/diary/:diaryId/delays/:delayId - Remove delay
router.delete('/:diaryId/delays/:delayId', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId, delayId } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  if (diary.status === 'submitted') {
    throw AppError.badRequest('Cannot modify submitted diary')
  }

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
  }

  await prisma.diaryDelay.delete({ where: { id: delayId } })
  res.status(204).send()
  
}))

// POST /api/diary/:diaryId/deliveries - Add delivery to diary
router.post('/:diaryId/deliveries', asyncHandler(async (req: Request, res: Response) => {

  const userId = req.user!.id
  if (!userId) throw AppError.unauthorized('Unauthorized')
  const { diaryId } = req.params
  const data = addDeliverySchema.parse(req.body)

  const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
  if (!diary) throw AppError.notFound('Diary not found')
  if (diary.status === 'submitted') throw AppError.badRequest('Cannot modify submitted diary')

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) throw AppError.forbidden('Access denied')

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
  
}))

// DELETE /api/diary/:diaryId/deliveries/:deliveryId - Remove delivery
router.delete('/:diaryId/deliveries/:deliveryId', asyncHandler(async (req: Request, res: Response) => {

  const userId = req.user!.id
  if (!userId) throw AppError.unauthorized('Unauthorized')
  const { diaryId, deliveryId } = req.params

  const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
  if (!diary) throw AppError.notFound('Diary not found')
  if (diary.status === 'submitted') throw AppError.badRequest('Cannot modify submitted diary')

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) throw AppError.forbidden('Access denied')

  await prisma.diaryDelivery.delete({ where: { id: deliveryId } })
  res.json({ message: 'Delivery removed' })
  
}))

// POST /api/diary/:diaryId/events - Add event to diary
router.post('/:diaryId/events', asyncHandler(async (req: Request, res: Response) => {

  const userId = req.user!.id
  if (!userId) throw AppError.unauthorized('Unauthorized')
  const { diaryId } = req.params
  const data = addEventSchema.parse(req.body)

  const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
  if (!diary) throw AppError.notFound('Diary not found')
  if (diary.status === 'submitted') throw AppError.badRequest('Cannot modify submitted diary')

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) throw AppError.forbidden('Access denied')

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
  
}))

// DELETE /api/diary/:diaryId/events/:eventId - Remove event
router.delete('/:diaryId/events/:eventId', asyncHandler(async (req: Request, res: Response) => {

  const userId = req.user!.id
  if (!userId) throw AppError.unauthorized('Unauthorized')
  const { diaryId, eventId } = req.params

  const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
  if (!diary) throw AppError.notFound('Diary not found')
  if (diary.status === 'submitted') throw AppError.badRequest('Cannot modify submitted diary')

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) throw AppError.forbidden('Access denied')

  await prisma.diaryEvent.delete({ where: { id: eventId } })
  res.json({ message: 'Event removed' })
  
}))

export { router as diaryItemsRouter }
