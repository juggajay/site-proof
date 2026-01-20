import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAuth } from '../middleware/authMiddleware.js'

const prisma = new PrismaClient()
const router = Router()

// Apply auth middleware to all diary routes
router.use(requireAuth)

// Schemas
const createDiarySchema = z.object({
  projectId: z.string(),
  date: z.string(), // ISO date string
  weatherConditions: z.string().optional(),
  temperatureMin: z.number().optional(),
  temperatureMax: z.number().optional(),
  rainfallMm: z.number().optional(),
  weatherNotes: z.string().optional(),
  generalNotes: z.string().optional(),
})

const addPersonnelSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  role: z.string().optional(),
  startTime: z.string().optional(),
  finishTime: z.string().optional(),
  hours: z.number().optional(),
})

const addPlantSchema = z.object({
  description: z.string().min(1),
  idRego: z.string().optional(),
  company: z.string().optional(),
  hoursOperated: z.number().optional(),
  notes: z.string().optional(),
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
})

// Feature #477: Visitor recording schema
const addVisitorSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  purpose: z.string().optional(),
  timeInOut: z.string().optional(),
})

// Helper to check project access
async function checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return false

  // Admins and owners can access all projects in their company
  if (user.roleInCompany === 'admin' || user.roleInCompany === 'owner') {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    return project?.companyId === user.companyId
  }

  // Check if user is a member of the project
  const projectUser = await prisma.projectUser.findUnique({
    where: { projectId_userId: { projectId, userId } }
  })
  return !!projectUser
}

// GET /api/diary/:projectId - List all diaries for a project
// Supports ?search=text to filter by content
router.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const { search } = req.query
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' })
    }

    const diaries = await prisma.dailyDiary.findMany({
      where: { projectId },
      include: {
        submittedBy: { select: { id: true, fullName: true, email: true } },
        personnel: true,
        plant: true,
        activities: { include: { lot: { select: { id: true, lotNumber: true } } } },
        delays: true,
      },
      orderBy: { date: 'desc' }
    })

    // Feature #240: Filter by search term if provided
    if (search && typeof search === 'string' && search.trim()) {
      const searchLower = search.toLowerCase().trim()
      const filteredDiaries = diaries.filter(diary => {
        // Search in general notes
        if (diary.generalNotes?.toLowerCase().includes(searchLower)) return true
        // Search in weather notes
        if (diary.weatherNotes?.toLowerCase().includes(searchLower)) return true
        // Search in weather conditions
        if (diary.weatherConditions?.toLowerCase().includes(searchLower)) return true
        // Search in personnel names and companies
        if (diary.personnel.some(p =>
          p.name?.toLowerCase().includes(searchLower) ||
          p.company?.toLowerCase().includes(searchLower) ||
          p.role?.toLowerCase().includes(searchLower)
        )) return true
        // Search in plant descriptions
        if (diary.plant.some(p =>
          p.description?.toLowerCase().includes(searchLower) ||
          p.company?.toLowerCase().includes(searchLower) ||
          p.notes?.toLowerCase().includes(searchLower)
        )) return true
        // Search in activities
        if (diary.activities.some(a =>
          a.description?.toLowerCase().includes(searchLower) ||
          a.notes?.toLowerCase().includes(searchLower)
        )) return true
        // Search in delays
        if (diary.delays.some(d =>
          d.description?.toLowerCase().includes(searchLower) ||
          d.delayType?.toLowerCase().includes(searchLower) ||
          d.impact?.toLowerCase().includes(searchLower)
        )) return true
        return false
      })
      return res.json(filteredDiaries)
    }

    res.json(diaries)
  } catch (error) {
    console.error('Error fetching diaries:', error)
    res.status(500).json({ error: 'Failed to fetch diaries' })
  }
})

// GET /api/diary/:projectId/:date - Get diary for specific date
router.get('/:projectId/:date', async (req: Request, res: Response) => {
  try {
    const { projectId, date } = req.params
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' })
    }

    // Parse date and search for diary on that day (handle timezone issues)
    const searchDate = new Date(date)
    const startOfDay = new Date(searchDate)
    startOfDay.setUTCHours(0, 0, 0, 0)
    const endOfDay = new Date(searchDate)
    endOfDay.setUTCHours(23, 59, 59, 999)

    const diary = await prisma.dailyDiary.findFirst({
      where: {
        projectId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        }
      },
      include: {
        submittedBy: { select: { id: true, fullName: true, email: true } },
        personnel: true,
        plant: true,
        activities: { include: { lot: { select: { id: true, lotNumber: true } } } },
        visitors: true,
        delays: true,
      }
    })

    if (!diary) {
      return res.status(404).json({ error: 'No diary entry for this date' })
    }

    res.json(diary)
  } catch (error) {
    console.error('Error fetching diary:', error)
    res.status(500).json({ error: 'Failed to fetch diary' })
  }
})

// POST /api/diary - Create or update diary entry
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const data = createDiarySchema.parse(req.body)

    const hasAccess = await checkProjectAccess(userId, data.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' })
    }

    const diaryDate = new Date(data.date)
    diaryDate.setHours(0, 0, 0, 0) // Normalize to start of day

    // Check if diary already exists for this date
    const existing = await prisma.dailyDiary.findFirst({
      where: {
        projectId: data.projectId,
        date: diaryDate
      }
    })

    let diary
    if (existing) {
      // Update existing diary
      diary = await prisma.dailyDiary.update({
        where: { id: existing.id },
        data: {
          weatherConditions: data.weatherConditions,
          temperatureMin: data.temperatureMin,
          temperatureMax: data.temperatureMax,
          rainfallMm: data.rainfallMm,
          weatherNotes: data.weatherNotes,
          generalNotes: data.generalNotes,
        },
        include: {
          personnel: true,
          plant: true,
          activities: { include: { lot: { select: { id: true, lotNumber: true } } } },
          visitors: true,
          delays: true,
        }
      })
    } else {
      // Create new diary
      diary = await prisma.dailyDiary.create({
        data: {
          projectId: data.projectId,
          date: diaryDate,
          status: 'draft',
          weatherConditions: data.weatherConditions,
          temperatureMin: data.temperatureMin,
          temperatureMax: data.temperatureMax,
          rainfallMm: data.rainfallMm,
          weatherNotes: data.weatherNotes,
          generalNotes: data.generalNotes,
        },
        include: {
          personnel: true,
          plant: true,
          activities: { include: { lot: { select: { id: true, lotNumber: true } } } },
          visitors: true,
          delays: true,
        }
      })
    }

    res.status(existing ? 200 : 201).json(diary)
  } catch (error) {
    console.error('Error creating/updating diary:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors })
    }
    res.status(500).json({ error: 'Failed to create/update diary' })
  }
})

// POST /api/diary/:diaryId/personnel - Add personnel to diary
router.post('/:diaryId/personnel', async (req: Request, res: Response) => {
  try {
    const { diaryId } = req.params
    const userId = (req as any).user?.id

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
    const userId = (req as any).user?.id

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
    const userId = (req as any).user?.id

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
    const userId = (req as any).user?.id

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
    const userId = (req as any).user?.id

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
    const userId = (req as any).user?.id

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
    const userId = (req as any).user?.id

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
    const userId = (req as any).user?.id

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
    const userId = (req as any).user?.id

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
          category: template.activityType
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
    const userId = (req as any).user?.id

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
    const userId = (req as any).user?.id

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
    const userId = (req as any).user?.id

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
    const userId = (req as any).user?.id

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

// GET /api/diary/:diaryId/validate - Validate diary before submission
router.get('/:diaryId/validate', async (req: Request, res: Response) => {
  try {
    const { diaryId } = req.params
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const diary = await prisma.dailyDiary.findUnique({
      where: { id: diaryId },
      include: {
        personnel: true,
        plant: true,
        activities: true,
        delays: true,
        visitors: true,
      }
    })

    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const warnings: Array<{ section: string; message: string; severity: 'warning' | 'info' }> = []
    const errors: Array<{ section: string; message: string }> = []

    // Check weather data
    if (!diary.weatherConditions && diary.temperatureMax === null) {
      warnings.push({
        section: 'weather',
        message: 'Weather information is not filled in',
        severity: 'warning'
      })
    }

    // Check personnel
    if (diary.personnel.length === 0) {
      warnings.push({
        section: 'personnel',
        message: 'No personnel entries recorded',
        severity: 'warning'
      })
    }

    // Check activities
    if (diary.activities.length === 0) {
      warnings.push({
        section: 'activities',
        message: 'No activities recorded for this day',
        severity: 'warning'
      })
    }

    // Check if late submission
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (diary.date < today) {
      warnings.push({
        section: 'submission',
        message: 'This diary is being submitted late',
        severity: 'info'
      })
    }

    // Check for incomplete personnel hours
    const personnelWithoutHours = diary.personnel.filter(p => p.hours === null)
    if (personnelWithoutHours.length > 0) {
      warnings.push({
        section: 'personnel',
        message: `${personnelWithoutHours.length} personnel entries are missing hours`,
        severity: 'warning'
      })
    }

    // Check for incomplete delays
    const delaysWithoutDuration = diary.delays.filter(d => d.durationHours === null)
    if (delaysWithoutDuration.length > 0) {
      warnings.push({
        section: 'delays',
        message: `${delaysWithoutDuration.length} delay entries are missing duration`,
        severity: 'warning'
      })
    }

    const isValid = errors.length === 0
    const hasWarnings = warnings.length > 0

    res.json({
      isValid,
      hasWarnings,
      canSubmit: isValid,
      errors,
      warnings,
      summary: {
        personnel: diary.personnel.length,
        activities: diary.activities.length,
        plant: diary.plant.length,
        delays: diary.delays.length,
        visitors: diary.visitors.length,
        hasWeather: diary.weatherConditions !== null || diary.temperatureMax !== null,
      }
    })
  } catch (error) {
    console.error('Error validating diary:', error)
    res.status(500).json({ error: 'Failed to validate diary' })
  }
})

// POST /api/diary/:diaryId/submit - Submit diary
router.post('/:diaryId/submit', async (req: Request, res: Response) => {
  try {
    const { diaryId } = req.params
    const { acknowledgeWarnings } = req.body
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const diary = await prisma.dailyDiary.findUnique({
      where: { id: diaryId },
      include: {
        personnel: true,
        plant: true,
        activities: true,
        delays: true,
      }
    })
    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    if (diary.status === 'submitted') {
      return res.status(400).json({ error: 'Diary already submitted' })
    }

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Check for warnings and require acknowledgement
    const warnings: string[] = []
    if (!diary.weatherConditions && diary.temperatureMax === null) {
      warnings.push('Weather information is not filled in')
    }
    if (diary.personnel.length === 0) {
      warnings.push('No personnel entries recorded')
    }
    if (diary.activities.length === 0) {
      warnings.push('No activities recorded')
    }

    // If there are warnings and user hasn't acknowledged them, return warnings
    if (warnings.length > 0 && !acknowledgeWarnings) {
      return res.status(422).json({
        error: 'Diary has warnings that need acknowledgement',
        warnings,
        requiresAcknowledgement: true
      })
    }

    // Check if diary date is in the past (late submission)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const isLate = diary.date < today

    const updatedDiary = await prisma.dailyDiary.update({
      where: { id: diaryId },
      data: {
        status: 'submitted',
        submittedById: userId,
        submittedAt: new Date(),
        isLate,
      },
      include: {
        submittedBy: { select: { id: true, fullName: true, email: true } },
        personnel: true,
        plant: true,
        activities: { include: { lot: { select: { id: true, lotNumber: true } } } },
        visitors: true,
        delays: true,
      }
    })

    res.json({
      diary: updatedDiary,
      warningsAcknowledged: warnings.length > 0
    })
  } catch (error) {
    console.error('Error submitting diary:', error)
    res.status(500).json({ error: 'Failed to submit diary' })
  }
})

// GET /api/diary/:projectId/:date/previous-personnel - Get personnel from previous day's diary
router.get('/:projectId/:date/previous-personnel', async (req: Request, res: Response) => {
  try {
    const { projectId, date } = req.params
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' })
    }

    // First, find the current diary entry to get its actual stored date
    const currentDate = new Date(date)
    const startOfDay = new Date(currentDate)
    startOfDay.setUTCHours(0, 0, 0, 0)
    const endOfDay = new Date(currentDate)
    endOfDay.setUTCHours(23, 59, 59, 999)

    const currentDiary = await prisma.dailyDiary.findFirst({
      where: {
        projectId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        }
      }
    })

    // Find the most recent diary BEFORE the current one that has personnel
    // Use the actual stored date if available, otherwise use the input date
    const referenceDate = currentDiary?.date || endOfDay

    const previousDiary = await prisma.dailyDiary.findFirst({
      where: {
        projectId,
        date: {
          lt: referenceDate,
        },
        personnel: {
          some: {} // Only find diaries that have at least one personnel entry
        }
      },
      include: {
        personnel: true,
      },
      orderBy: {
        date: 'desc'
      }
    })

    if (!previousDiary || previousDiary.personnel.length === 0) {
      return res.json({ personnel: [], message: 'No personnel from previous day' })
    }

    // Return personnel without IDs (so they can be added as new entries)
    const personnelToCopy = previousDiary.personnel.map(p => ({
      name: p.name,
      company: p.company,
      role: p.role,
      startTime: p.startTime,
      finishTime: p.finishTime,
      hours: p.hours,
    }))

    res.json({
      personnel: personnelToCopy,
      previousDate: previousDiary.date.toISOString().split('T')[0],
      message: `Copied ${personnelToCopy.length} personnel from previous diary`
    })
  } catch (error) {
    console.error('Error fetching previous personnel:', error)
    res.status(500).json({ error: 'Failed to fetch previous day personnel' })
  }
})

// GET /api/diary/:diaryId - Get diary by ID
router.get('/entry/:diaryId', async (req: Request, res: Response) => {
  try {
    const { diaryId } = req.params
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const diary = await prisma.dailyDiary.findUnique({
      where: { id: diaryId },
      include: {
        submittedBy: { select: { id: true, fullName: true, email: true } },
        personnel: true,
        plant: true,
        activities: { include: { lot: { select: { id: true, lotNumber: true } } } },
        visitors: true,
        delays: true,
      }
    })

    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    res.json(diary)
  } catch (error) {
    console.error('Error fetching diary:', error)
    res.status(500).json({ error: 'Failed to fetch diary' })
  }
})

// POST /api/diary/:diaryId/addendum - Add addendum to submitted diary
router.post('/:diaryId/addendum', async (req: Request, res: Response) => {
  try {
    const { diaryId } = req.params
    const { content } = req.body
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Addendum content is required' })
    }

    // Find the diary
    const diary = await prisma.dailyDiary.findUnique({
      where: { id: diaryId }
    })

    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    // Check access
    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Verify diary is submitted
    if (diary.status !== 'submitted') {
      return res.status(400).json({ error: 'Addendums can only be added to submitted diaries' })
    }

    // Create the addendum
    const addendum = await prisma.diaryAddendum.create({
      data: {
        diaryId,
        content: content.trim(),
        addedById: userId,
      },
      include: {
        addedBy: { select: { id: true, fullName: true, email: true } }
      }
    })

    res.status(201).json(addendum)
  } catch (error) {
    console.error('Error adding addendum:', error)
    res.status(500).json({ error: 'Failed to add addendum' })
  }
})

// GET /api/diary/:diaryId/addendums - Get addendums for a diary
router.get('/:diaryId/addendums', async (req: Request, res: Response) => {
  try {
    const { diaryId } = req.params
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Find the diary
    const diary = await prisma.dailyDiary.findUnique({
      where: { id: diaryId }
    })

    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' })
    }

    // Check access
    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get addendums
    const addendums = await prisma.diaryAddendum.findMany({
      where: { diaryId },
      include: {
        addedBy: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { addedAt: 'asc' }
    })

    res.json(addendums)
  } catch (error) {
    console.error('Error fetching addendums:', error)
    res.status(500).json({ error: 'Failed to fetch addendums' })
  }
})

// GET /api/diary/:projectId/weather/:date - Get weather for project location
// Uses Open-Meteo API (free, no API key required)
router.get('/:projectId/weather/:date', async (req: Request, res: Response) => {
  try {
    const { projectId, date } = req.params
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' })
    }

    // Get project location
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { latitude: true, longitude: true, state: true }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    let latitude = project.latitude ? Number(project.latitude) : null
    let longitude = project.longitude ? Number(project.longitude) : null

    // If no coordinates, use default coordinates based on Australian state
    if (!latitude || !longitude) {
      const stateCoords: Record<string, { lat: number; lon: number }> = {
        'NSW': { lat: -33.8688, lon: 151.2093 },    // Sydney
        'VIC': { lat: -37.8136, lon: 144.9631 },    // Melbourne
        'QLD': { lat: -27.4698, lon: 153.0251 },    // Brisbane
        'WA': { lat: -31.9505, lon: 115.8605 },     // Perth
        'SA': { lat: -34.9285, lon: 138.6007 },     // Adelaide
        'TAS': { lat: -42.8821, lon: 147.3272 },    // Hobart
        'NT': { lat: -12.4634, lon: 130.8456 },     // Darwin
        'ACT': { lat: -35.2809, lon: 149.1300 },    // Canberra
      }

      const state = project.state?.toUpperCase() || 'NSW'
      const coords = stateCoords[state] || stateCoords['NSW']
      latitude = coords.lat
      longitude = coords.lon
    }

    // Fetch weather from Open-Meteo API
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Australia%2FSydney&start_date=${date}&end_date=${date}`

    const weatherResponse = await fetch(weatherUrl)

    if (!weatherResponse.ok) {
      console.error('Weather API error:', weatherResponse.status, await weatherResponse.text())
      return res.status(502).json({ error: 'Failed to fetch weather data' })
    }

    const weatherData = await weatherResponse.json() as {
      daily?: {
        time?: string[]
        weather_code?: number[]
        temperature_2m_min?: number[]
        temperature_2m_max?: number[]
        precipitation_sum?: number[]
      }
    }

    if (!weatherData.daily || !weatherData.daily.time || weatherData.daily.time.length === 0) {
      return res.status(404).json({ error: 'No weather data available for this date' })
    }

    // Map WMO weather codes to conditions
    const weatherCodeMap: Record<number, string> = {
      0: 'Fine',
      1: 'Fine',
      2: 'Partly Cloudy',
      3: 'Cloudy',
      45: 'Fog',
      48: 'Fog',
      51: 'Rain',
      53: 'Rain',
      55: 'Rain',
      56: 'Rain',
      57: 'Rain',
      61: 'Rain',
      63: 'Rain',
      65: 'Heavy Rain',
      66: 'Rain',
      67: 'Heavy Rain',
      71: 'Rain',
      73: 'Rain',
      75: 'Heavy Rain',
      77: 'Rain',
      80: 'Rain',
      81: 'Rain',
      82: 'Heavy Rain',
      85: 'Rain',
      86: 'Heavy Rain',
      95: 'Storm',
      96: 'Storm',
      99: 'Storm',
    }

    const weatherCode = weatherData.daily.weather_code?.[0] ?? 0
    const weatherCondition = weatherCodeMap[weatherCode] || 'Partly Cloudy'

    res.json({
      date: weatherData.daily.time?.[0],
      weatherConditions: weatherCondition,
      temperatureMin: weatherData.daily.temperature_2m_min?.[0],
      temperatureMax: weatherData.daily.temperature_2m_max?.[0],
      rainfallMm: weatherData.daily.precipitation_sum?.[0] || 0,
      source: 'Open-Meteo',
      location: {
        latitude,
        longitude,
        fromProjectState: !project.latitude || !project.longitude
      }
    })
  } catch (error) {
    console.error('Error fetching weather:', error)
    res.status(500).json({ error: 'Failed to fetch weather data' })
  }
})

// Feature #242: GET /api/diary/project/:projectId/delays - Get all delays for a project
router.get('/project/:projectId/delays', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const { delayType, startDate, endDate } = req.query
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' })
    }

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDate && typeof startDate === 'string') {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate && typeof endDate === 'string') {
      dateFilter.lte = new Date(endDate)
    }

    // Get all diaries with delays
    const diaries = await prisma.dailyDiary.findMany({
      where: {
        projectId,
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
      include: {
        delays: true,
      },
    })

    // Flatten delays and add diary info
    let delays = diaries.flatMap(diary =>
      diary.delays.map(delay => ({
        id: delay.id,
        diaryId: diary.id,
        diaryDate: diary.date,
        diaryStatus: diary.status,
        delayType: delay.delayType,
        startTime: delay.startTime,
        endTime: delay.endTime,
        durationHours: delay.durationHours ? Number(delay.durationHours) : null,
        description: delay.description,
        impact: delay.impact,
      }))
    )

    // Filter by delay type if provided
    if (delayType && typeof delayType === 'string') {
      delays = delays.filter(d => d.delayType === delayType)
    }

    // Calculate summary by type
    const summaryByType: Record<string, { count: number; totalHours: number }> = {}
    for (const delay of delays) {
      if (!summaryByType[delay.delayType]) {
        summaryByType[delay.delayType] = { count: 0, totalHours: 0 }
      }
      summaryByType[delay.delayType].count++
      summaryByType[delay.delayType].totalHours += delay.durationHours || 0
    }

    // Calculate totals
    const totalDelays = delays.length
    const totalHours = delays.reduce((sum, d) => sum + (d.durationHours || 0), 0)

    res.json({
      delays: delays.sort((a, b) => new Date(b.diaryDate).getTime() - new Date(a.diaryDate).getTime()),
      summary: {
        totalDelays,
        totalHours,
        byType: summaryByType,
      },
    })
  } catch (error) {
    console.error('Error fetching delays:', error)
    res.status(500).json({ error: 'Failed to fetch delays' })
  }
})

// Feature #242: GET /api/diary/project/:projectId/delays/export - Export delays to CSV
router.get('/project/:projectId/delays/export', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const { delayType, startDate, endDate } = req.query
    const userId = (req as any).user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' })
    }

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDate && typeof startDate === 'string') {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate && typeof endDate === 'string') {
      dateFilter.lte = new Date(endDate)
    }

    // Get all diaries with delays
    const diaries = await prisma.dailyDiary.findMany({
      where: {
        projectId,
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
      include: {
        delays: true,
      },
    })

    // Flatten delays
    let delays = diaries.flatMap(diary =>
      diary.delays.map(delay => ({
        diaryDate: diary.date,
        delayType: delay.delayType,
        startTime: delay.startTime,
        endTime: delay.endTime,
        durationHours: delay.durationHours ? Number(delay.durationHours) : null,
        description: delay.description,
        impact: delay.impact,
      }))
    )

    // Filter by delay type if provided
    if (delayType && typeof delayType === 'string') {
      delays = delays.filter(d => d.delayType === delayType)
    }

    // Sort by date descending
    delays.sort((a, b) => new Date(b.diaryDate).getTime() - new Date(a.diaryDate).getTime())

    // Generate CSV
    const csvHeaders = ['Date', 'Delay Type', 'Start Time', 'End Time', 'Duration (Hours)', 'Description', 'Impact']
    const csvRows = delays.map(d => [
      new Date(d.diaryDate).toLocaleDateString('en-AU'),
      d.delayType,
      d.startTime || '',
      d.endTime || '',
      d.durationHours?.toFixed(1) || '',
      `"${(d.description || '').replace(/"/g, '""')}"`,
      `"${(d.impact || '').replace(/"/g, '""')}"`,
    ])

    const csv = [csvHeaders.join(','), ...csvRows.map(r => r.join(','))].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=delay-register.csv')
    res.send(csv)
  } catch (error) {
    console.error('Error exporting delays:', error)
    res.status(500).json({ error: 'Failed to export delays' })
  }
})

export default router
