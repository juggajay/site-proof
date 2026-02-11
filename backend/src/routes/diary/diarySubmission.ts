import { Router, Request, Response } from 'express'
import { prisma } from '../../lib/prisma.js'
import { checkProjectAccess } from '../../lib/projectAccess.js'

const router = Router()

// GET /api/diary/:diaryId/validate - Validate diary before submission
router.get('/:diaryId/validate', async (req: Request, res: Response) => {
  try {
    const { diaryId } = req.params
    const userId = req.user!.id

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
        deliveries: true,
        events: true,
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
    const userId = req.user!.id

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
        deliveries: true,
        events: true,
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
  } catch (error) {
    console.error('Error submitting diary:', error)
    res.status(500).json({ error: 'Failed to submit diary' })
  }
})

// POST /api/diary/:diaryId/addendum - Add addendum to submitted diary
router.post('/:diaryId/addendum', async (req: Request, res: Response) => {
  try {
    const { diaryId } = req.params
    const { content } = req.body
    const userId = req.user!.id

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
    const userId = req.user!.id

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

export { router as diarySubmissionRouter }
