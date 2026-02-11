import { Router, Request, Response } from 'express'
import { prisma } from '../../lib/prisma.js'
import { checkProjectAccess } from '../../lib/projectAccess.js'
import { AppError } from '../../lib/AppError.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

// GET /api/diary/:diaryId/validate - Validate diary before submission
router.get('/:diaryId/validate', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const diary = await prisma.dailyDiary.findUnique({
    where: { id: diaryId },
    include: {
      personnel: true,
      plant: true,
      activities: true,
      delays: true,
      visitors: true,
      deliveries: true,
      events: true,
    }
  })

  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
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
  
}))

// POST /api/diary/:diaryId/submit - Submit diary
router.post('/:diaryId/submit', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId } = req.params
  const { acknowledgeWarnings } = req.body
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  const diary = await prisma.dailyDiary.findUnique({
    where: { id: diaryId },
    include: {
      personnel: true,
      plant: true,
      activities: true,
      delays: true,
      deliveries: true,
      events: true,
    }
  })
  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  if (diary.status === 'submitted') {
    throw AppError.badRequest('Diary already submitted')
  }

  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
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
    throw new AppError(422, 'Diary has warnings that need acknowledgement', 'VALIDATION_ERROR', {
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
      personnel: { include: { lot: { select: { id: true, lotNumber: true } } } },
      plant: { include: { lot: { select: { id: true, lotNumber: true } } } },
      activities: { include: { lot: { select: { id: true, lotNumber: true } } } },
      visitors: true,
      delays: { include: { lot: { select: { id: true, lotNumber: true } } } },
      deliveries: { include: { lot: { select: { id: true, lotNumber: true } } } },
      events: { include: { lot: { select: { id: true, lotNumber: true } } } },
    }
  })

  res.json({
    diary: updatedDiary,
    warningsAcknowledged: warnings.length > 0
  })
  
}))

// POST /api/diary/:diaryId/addendum - Add addendum to submitted diary
router.post('/:diaryId/addendum', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId } = req.params
  const { content } = req.body
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  if (!content || content.trim().length === 0) {
    throw AppError.badRequest('Addendum content is required')
  }

  // Find the diary
  const diary = await prisma.dailyDiary.findUnique({
    where: { id: diaryId }
  })

  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  // Check access
  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
  }

  // Verify diary is submitted
  if (diary.status !== 'submitted') {
    throw AppError.badRequest('Addendums can only be added to submitted diaries')
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
  
}))

// GET /api/diary/:diaryId/addendums - Get addendums for a diary
router.get('/:diaryId/addendums', asyncHandler(async (req: Request, res: Response) => {

  const { diaryId } = req.params
  const userId = req.user!.id

  if (!userId) {
    throw AppError.unauthorized('Unauthorized')
  }

  // Find the diary
  const diary = await prisma.dailyDiary.findUnique({
    where: { id: diaryId }
  })

  if (!diary) {
    throw AppError.notFound('Diary not found')
  }

  // Check access
  const hasAccess = await checkProjectAccess(userId, diary.projectId)
  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
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
  
}))

export { router as diarySubmissionRouter }
