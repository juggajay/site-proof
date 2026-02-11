import { Router, Request, Response } from 'express'
import { prisma } from '../../lib/prisma.js'
import { z } from 'zod'
import { parsePagination, getPrismaSkipTake, getPaginationMeta } from '../../lib/pagination.js'
import { checkProjectAccess } from '../../lib/projectAccess.js'
import { AppError } from '../../lib/AppError.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

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

// GET /api/diary/:projectId - List diaries for a project with pagination
// Supports ?search=text, ?page=1, ?limit=20
router.get('/:projectId', asyncHandler(async (req: Request, res: Response) => {

  const { projectId } = req.params
  const { search } = req.query
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const hasAccess = await checkProjectAccess(userId, projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied to this project')
  }

  const pagination = parsePagination(req.query)
  const { skip, take } = getPrismaSkipTake(pagination.page, pagination.limit)

  // Build where clause with search pushed to database level where possible
  const where: any = { projectId }

  if (search && typeof search === 'string' && search.trim()) {
    const searchTerm = search.trim()
    where.OR = [
      { generalNotes: { contains: searchTerm, mode: 'insensitive' } },
      { weatherNotes: { contains: searchTerm, mode: 'insensitive' } },
      { weatherConditions: { contains: searchTerm, mode: 'insensitive' } },
      { personnel: { some: { OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { company: { contains: searchTerm, mode: 'insensitive' } },
        { role: { contains: searchTerm, mode: 'insensitive' } },
      ]}}},
      { activities: { some: { OR: [
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { notes: { contains: searchTerm, mode: 'insensitive' } },
      ]}}},
      { delays: { some: { OR: [
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { delayType: { contains: searchTerm, mode: 'insensitive' } },
        { impact: { contains: searchTerm, mode: 'insensitive' } },
      ]}}},
    ]
  }

  const [diaries, total] = await Promise.all([
    prisma.dailyDiary.findMany({
      where,
      include: {
        submittedBy: { select: { id: true, fullName: true, email: true } },
        personnel: { include: { lot: { select: { id: true, lotNumber: true } } } },
        plant: { include: { lot: { select: { id: true, lotNumber: true } } } },
        activities: { include: { lot: { select: { id: true, lotNumber: true } } } },
        delays: { include: { lot: { select: { id: true, lotNumber: true } } } },
        deliveries: { include: { lot: { select: { id: true, lotNumber: true } } } },
        events: { include: { lot: { select: { id: true, lotNumber: true } } } },
      },
      orderBy: { date: 'desc' },
      skip,
      take,
    }),
    prisma.dailyDiary.count({ where }),
  ])

  res.json({
    data: diaries,
    pagination: getPaginationMeta(total, pagination.page, pagination.limit),
  })
  
}))

// GET /api/diary/:projectId/:date - Get diary for specific date
// IMPORTANT: This catch-all two-segment route must skip literal sub-routes
// defined later (validate, addendums, timeline) to avoid shadowing them.
router.get('/:projectId/:date', asyncHandler(async (req: Request, res: Response, next) => {
  const literalSubRoutes = ['validate', 'addendums', 'timeline']
  if (literalSubRoutes.includes(req.params.date)) {
    return next()
  }

  const { projectId, date } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const hasAccess = await checkProjectAccess(userId, projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied to this project')
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
      personnel: { include: { lot: { select: { id: true, lotNumber: true } } } },
      plant: { include: { lot: { select: { id: true, lotNumber: true } } } },
      activities: { include: { lot: { select: { id: true, lotNumber: true } } } },
      visitors: true,
      delays: { include: { lot: { select: { id: true, lotNumber: true } } } },
      deliveries: { include: { lot: { select: { id: true, lotNumber: true } } } },
      events: { include: { lot: { select: { id: true, lotNumber: true } } } },
    }
  })

  if (!diary) {
    throw AppError.notFound('No diary entry for this date')
  }

  res.json(diary)
}))

// POST /api/diary - Create or update diary entry
router.post('/', asyncHandler(async (req: Request, res: Response) => {

  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const data = createDiarySchema.parse(req.body)

  const hasAccess = await checkProjectAccess(userId, data.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied to this project')
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
        personnel: { include: { lot: { select: { id: true, lotNumber: true } } } },
        plant: { include: { lot: { select: { id: true, lotNumber: true } } } },
        activities: { include: { lot: { select: { id: true, lotNumber: true } } } },
        visitors: true,
        delays: { include: { lot: { select: { id: true, lotNumber: true } } } },
        deliveries: { include: { lot: { select: { id: true, lotNumber: true } } } },
        events: { include: { lot: { select: { id: true, lotNumber: true } } } },
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
        personnel: { include: { lot: { select: { id: true, lotNumber: true } } } },
        plant: { include: { lot: { select: { id: true, lotNumber: true } } } },
        activities: { include: { lot: { select: { id: true, lotNumber: true } } } },
        visitors: true,
        delays: { include: { lot: { select: { id: true, lotNumber: true } } } },
        deliveries: { include: { lot: { select: { id: true, lotNumber: true } } } },
        events: { include: { lot: { select: { id: true, lotNumber: true } } } },
      }
    })
  }

  res.status(existing ? 200 : 201).json(diary)
  
}))

// GET /api/diary/:projectId/:date/previous-personnel - Get personnel from previous day's diary
router.get('/:projectId/:date/previous-personnel', asyncHandler(async (req: Request, res: Response) => {

  const { projectId, date } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const hasAccess = await checkProjectAccess(userId, projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied to this project')
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
  
}))

// GET /api/diary/entry/:diaryId - Get diary by ID
router.get('/entry/:diaryId', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const diary = await prisma.dailyDiary.findUnique({
    where: { id: diaryId },
    include: {
      submittedBy: { select: { id: true, fullName: true, email: true } },
      personnel: { include: { lot: { select: { id: true, lotNumber: true } } } },
      plant: { include: { lot: { select: { id: true, lotNumber: true } } } },
      activities: { include: { lot: { select: { id: true, lotNumber: true } } } },
      visitors: true,
      delays: { include: { lot: { select: { id: true, lotNumber: true } } } },
      deliveries: { include: { lot: { select: { id: true, lotNumber: true } } } },
      events: { include: { lot: { select: { id: true, lotNumber: true } } } },
    }
  })

  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
  }

  res.json(diary)
  
}))

export { router as diaryCoreRouter }
