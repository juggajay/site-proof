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
router.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
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

// POST /api/diary/:diaryId/submit - Submit diary
router.post('/:diaryId/submit', async (req: Request, res: Response) => {
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
      return res.status(400).json({ error: 'Diary already submitted' })
    }

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
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

    res.json(updatedDiary)
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

export default router
