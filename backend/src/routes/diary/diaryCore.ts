import { Router, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { z } from 'zod';
import { parsePagination, getPrismaSkipTake, getPaginationMeta } from '../../lib/pagination.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  DIARY_DATE_INPUT_MAX_LENGTH,
  DIARY_ROUTE_PARAM_MAX_LENGTH,
  getUtcDayRange,
  normalizeDiaryDate,
  parseOptionalDiaryQueryString,
  parseDiaryRouteParam,
  requireDiaryReadAccess,
  requireDiaryWriteAccess,
} from './diaryAccess.js';

const router = Router();
const DIARY_SHORT_TEXT_MAX_LENGTH = 120;
const DIARY_LONG_TEXT_MAX_LENGTH = 5000;
const DIARY_TEMPERATURE_MIN = -80;
const DIARY_TEMPERATURE_MAX = 80;
const DIARY_RAINFALL_MAX = 2000;

// Schemas
const createDiarySchema = z
  .object({
    projectId: z
      .string()
      .trim()
      .min(1, 'projectId is required')
      .max(DIARY_ROUTE_PARAM_MAX_LENGTH, 'projectId is too long'),
    date: z
      .string()
      .trim()
      .min(1, 'date is required')
      .max(DIARY_DATE_INPUT_MAX_LENGTH, 'date is too long'),
    weatherConditions: z.string().trim().max(DIARY_SHORT_TEXT_MAX_LENGTH).optional(),
    temperatureMin: z
      .number()
      .finite()
      .min(DIARY_TEMPERATURE_MIN)
      .max(DIARY_TEMPERATURE_MAX)
      .optional(),
    temperatureMax: z
      .number()
      .finite()
      .min(DIARY_TEMPERATURE_MIN)
      .max(DIARY_TEMPERATURE_MAX)
      .optional(),
    rainfallMm: z.number().finite().min(0).max(DIARY_RAINFALL_MAX).optional(),
    weatherNotes: z.string().trim().max(DIARY_LONG_TEXT_MAX_LENGTH).optional(),
    generalNotes: z.string().trim().max(DIARY_LONG_TEXT_MAX_LENGTH).optional(),
  })
  .refine(
    (data) =>
      data.temperatureMin === undefined ||
      data.temperatureMax === undefined ||
      data.temperatureMin <= data.temperatureMax,
    {
      message: 'temperatureMin must be less than or equal to temperatureMax',
      path: ['temperatureMin'],
    },
  );

// GET /api/diary/:projectId - List diaries for a project with pagination
// Supports ?search=text, ?page=1, ?limit=20
router.get(
  '/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseDiaryRouteParam(req.params.projectId, 'projectId');
    const search = parseOptionalDiaryQueryString(
      req.query.search,
      'search',
      DIARY_SHORT_TEXT_MAX_LENGTH,
    );
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    await requireDiaryReadAccess(req.user!, projectId);

    const pagination = parsePagination(req.query);
    const { skip, take } = getPrismaSkipTake(pagination.page, pagination.limit);

    // Build where clause with search pushed to database level where possible
    const where: Prisma.DailyDiaryWhereInput = { projectId };

    if (search) {
      const searchTerm = search;
      where.OR = [
        { generalNotes: { contains: searchTerm, mode: 'insensitive' } },
        { weatherNotes: { contains: searchTerm, mode: 'insensitive' } },
        { weatherConditions: { contains: searchTerm, mode: 'insensitive' } },
        {
          personnel: {
            some: {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { company: { contains: searchTerm, mode: 'insensitive' } },
                { role: { contains: searchTerm, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          activities: {
            some: {
              OR: [
                { description: { contains: searchTerm, mode: 'insensitive' } },
                { notes: { contains: searchTerm, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          delays: {
            some: {
              OR: [
                { description: { contains: searchTerm, mode: 'insensitive' } },
                { delayType: { contains: searchTerm, mode: 'insensitive' } },
                { impact: { contains: searchTerm, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
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
    ]);

    res.json({
      data: diaries,
      pagination: getPaginationMeta(total, pagination.page, pagination.limit),
    });
  }),
);

// GET /api/diary/entry/:diaryId - Get diary by ID
router.get(
  '/entry/:diaryId',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
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
      },
    });

    if (!diary) {
      throw AppError.notFound('Diary not found');
    }

    await requireDiaryReadAccess(req.user!, diary.projectId, 'Access denied');

    res.json(diary);
  }),
);

// GET /api/diary/:projectId/:date - Get diary for specific date
// IMPORTANT: This catch-all two-segment route must skip literal sub-routes
// defined later (validate, addendums, timeline) to avoid shadowing them.
router.get(
  '/:projectId/:date',
  asyncHandler(async (req: Request, res: Response, next) => {
    const literalSubRoutes = ['validate', 'addendums', 'timeline'];
    if (literalSubRoutes.includes(req.params.date)) {
      return next();
    }

    const projectId = parseDiaryRouteParam(req.params.projectId, 'projectId');
    const { startOfDay, endOfDay } = getUtcDayRange(req.params.date);
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    await requireDiaryReadAccess(req.user!, projectId);

    const diary = await prisma.dailyDiary.findFirst({
      where: {
        projectId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
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
      },
    });

    if (!diary) {
      throw AppError.notFound('No diary entry for this date');
    }

    res.json(diary);
  }),
);

// POST /api/diary - Create or update diary entry
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const data = createDiarySchema.parse(req.body);

    await requireDiaryWriteAccess(req.user!, data.projectId);

    const diaryDate = normalizeDiaryDate(data.date);

    // Check if diary already exists for this date
    const existing = await prisma.dailyDiary.findFirst({
      where: {
        projectId: data.projectId,
        date: diaryDate,
      },
    });

    let diary;
    if (existing) {
      if (existing.status === 'submitted') {
        throw AppError.badRequest('Cannot modify submitted diary');
      }

      if (existing.lockedAt) {
        throw AppError.badRequest('Cannot modify locked diary');
      }

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
        },
      });
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
        },
      });
    }

    res.status(existing ? 200 : 201).json(diary);
  }),
);

// GET /api/diary/:projectId/:date/previous-personnel - Get personnel from previous day's diary
router.get(
  '/:projectId/:date/previous-personnel',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseDiaryRouteParam(req.params.projectId, 'projectId');
    const { startOfDay, endOfDay } = getUtcDayRange(req.params.date);
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    await requireDiaryReadAccess(req.user!, projectId);

    const currentDiary = await prisma.dailyDiary.findFirst({
      where: {
        projectId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Find the most recent diary BEFORE the current one that has personnel
    // Use the actual stored date if available, otherwise use the input date
    const referenceDate = currentDiary?.date || endOfDay;

    const previousDiary = await prisma.dailyDiary.findFirst({
      where: {
        projectId,
        date: {
          lt: referenceDate,
        },
        personnel: {
          some: {}, // Only find diaries that have at least one personnel entry
        },
      },
      include: {
        personnel: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    if (!previousDiary || previousDiary.personnel.length === 0) {
      return res.json({ personnel: [], message: 'No personnel from previous day' });
    }

    // Return personnel without IDs (so they can be added as new entries)
    const personnelToCopy = previousDiary.personnel.map((p) => ({
      name: p.name,
      company: p.company,
      role: p.role,
      startTime: p.startTime,
      finishTime: p.finishTime,
      hours: p.hours,
    }));

    res.json({
      personnel: personnelToCopy,
      previousDate: previousDiary.date.toISOString().split('T')[0],
      message: `Copied ${personnelToCopy.length} personnel from previous diary`,
    });
  }),
);

export { router as diaryCoreRouter };
