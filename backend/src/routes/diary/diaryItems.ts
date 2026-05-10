import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { z } from 'zod';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  parseDiaryRouteParam,
  parseOptionalDiaryQueryString,
  requireDiaryReadAccess,
  requireDraftDiaryWriteAccess,
  requireLotInProject,
} from './diaryAccess.js';

const router = Router();

const DIARY_SHORT_TEXT_MAX_LENGTH = 120;
const DIARY_LONG_TEXT_MAX_LENGTH = 5000;
const DIARY_ID_MAX_LENGTH = 128;
const DIARY_QUANTITY_MAX = 1_000_000_000;
const DIARY_DAILY_HOURS_MAX = 24;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return value;
}

function normalizeRequiredString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
}

function requiredText(fieldName: string, maxLength = DIARY_SHORT_TEXT_MAX_LENGTH) {
  return z.preprocess(
    normalizeRequiredString,
    z
      .string({
        required_error: `${fieldName} is required`,
        invalid_type_error: `${fieldName} must be text`,
      })
      .min(1, `${fieldName} is required`)
      .max(maxLength, `${fieldName} is too long`),
  );
}

function optionalText(fieldName: string, maxLength = DIARY_SHORT_TEXT_MAX_LENGTH) {
  return z.preprocess(
    normalizeOptionalString,
    z
      .string({ invalid_type_error: `${fieldName} must be text` })
      .max(maxLength, `${fieldName} is too long`)
      .optional(),
  );
}

function optionalTime(fieldName: string) {
  return z.preprocess(
    normalizeOptionalString,
    z
      .string({ invalid_type_error: `${fieldName} must be a time` })
      .regex(TIME_PATTERN, `${fieldName} must be in HH:mm format`)
      .optional(),
  );
}

function optionalDailyHours(fieldName: string) {
  return z
    .number({ invalid_type_error: `${fieldName} must be a number` })
    .finite(`${fieldName} must be finite`)
    .gt(0, `${fieldName} must be greater than 0`)
    .max(DIARY_DAILY_HOURS_MAX, `${fieldName} cannot exceed ${DIARY_DAILY_HOURS_MAX}`)
    .optional();
}

function optionalNonNegativeQuantity(fieldName: string) {
  return z
    .number({ invalid_type_error: `${fieldName} must be a number` })
    .finite(`${fieldName} must be finite`)
    .min(0, `${fieldName} cannot be negative`)
    .max(DIARY_QUANTITY_MAX, `${fieldName} is too large`)
    .optional();
}

// Schemas
const addPersonnelSchema = z.object({
  name: requiredText('name'),
  company: optionalText('company'),
  role: optionalText('role'),
  startTime: optionalTime('startTime'),
  finishTime: optionalTime('finishTime'),
  hours: optionalDailyHours('hours'),
  lotId: optionalText('lotId', DIARY_ID_MAX_LENGTH),
});

const addPlantSchema = z.object({
  description: requiredText('description'),
  idRego: optionalText('idRego'),
  company: optionalText('company'),
  hoursOperated: optionalDailyHours('hoursOperated'),
  notes: optionalText('notes', DIARY_LONG_TEXT_MAX_LENGTH),
  lotId: optionalText('lotId', DIARY_ID_MAX_LENGTH),
});

const addActivitySchema = z.object({
  lotId: optionalText('lotId', DIARY_ID_MAX_LENGTH),
  description: requiredText('description', DIARY_LONG_TEXT_MAX_LENGTH),
  quantity: optionalNonNegativeQuantity('quantity'),
  unit: optionalText('unit'),
  notes: optionalText('notes', DIARY_LONG_TEXT_MAX_LENGTH),
});

const addDelaySchema = z.object({
  delayType: requiredText('delayType'),
  startTime: optionalTime('startTime'),
  endTime: optionalTime('endTime'),
  durationHours: optionalDailyHours('durationHours'),
  description: requiredText('description', DIARY_LONG_TEXT_MAX_LENGTH),
  impact: optionalText('impact', DIARY_LONG_TEXT_MAX_LENGTH),
  lotId: optionalText('lotId', DIARY_ID_MAX_LENGTH),
});

// Feature #477: Visitor recording schema
const addVisitorSchema = z.object({
  name: requiredText('name'),
  company: optionalText('company'),
  purpose: optionalText('purpose', DIARY_LONG_TEXT_MAX_LENGTH),
  timeInOut: optionalText('timeInOut'),
});

const addDeliverySchema = z.object({
  description: requiredText('description', DIARY_LONG_TEXT_MAX_LENGTH),
  supplier: optionalText('supplier'),
  docketNumber: optionalText('docketNumber'),
  quantity: optionalNonNegativeQuantity('quantity'),
  unit: optionalText('unit'),
  lotId: optionalText('lotId', DIARY_ID_MAX_LENGTH),
  notes: optionalText('notes', DIARY_LONG_TEXT_MAX_LENGTH),
});

const addEventSchema = z.object({
  eventType: z.enum(['visitor', 'safety', 'instruction', 'variation', 'other']),
  description: requiredText('description', DIARY_LONG_TEXT_MAX_LENGTH),
  notes: optionalText('notes', DIARY_LONG_TEXT_MAX_LENGTH),
  lotId: optionalText('lotId', DIARY_ID_MAX_LENGTH),
});

type RecentPlantSuggestion = {
  description: string;
  idRego: string | null;
  company: string | null;
  lastUsed: Date;
  usageCount: number;
};

// POST /api/diary/:diaryId/personnel - Add personnel to diary
router.post(
  '/:diaryId/personnel',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    if (!diary) {
      throw AppError.notFound('Diary not found');
    }

    const data = addPersonnelSchema.parse(req.body);
    await requireDraftDiaryWriteAccess(req.user!, diary);
    await requireLotInProject(data.lotId, diary.projectId);

    const personnel = await prisma.diaryPersonnel.create({
      data: {
        diaryId,
        ...data,
      },
    });

    res.status(201).json(personnel);
  }),
);

// DELETE /api/diary/:diaryId/personnel/:personnelId - Remove personnel
router.delete(
  '/:diaryId/personnel/:personnelId',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const personnelId = parseDiaryRouteParam(req.params.personnelId, 'personnelId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    if (!diary) {
      throw AppError.notFound('Diary not found');
    }

    await requireDraftDiaryWriteAccess(req.user!, diary);

    const result = await prisma.diaryPersonnel.deleteMany({ where: { id: personnelId, diaryId } });
    if (result.count === 0) {
      throw AppError.notFound('Personnel entry');
    }

    res.status(204).send();
  }),
);

// POST /api/diary/:diaryId/plant - Add plant to diary
router.post(
  '/:diaryId/plant',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    if (!diary) {
      throw AppError.notFound('Diary not found');
    }

    const data = addPlantSchema.parse(req.body);
    await requireDraftDiaryWriteAccess(req.user!, diary);
    await requireLotInProject(data.lotId, diary.projectId);

    const plant = await prisma.diaryPlant.create({
      data: {
        diaryId,
        ...data,
      },
    });

    res.status(201).json(plant);
  }),
);

// DELETE /api/diary/:diaryId/plant/:plantId - Remove plant
router.delete(
  '/:diaryId/plant/:plantId',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const plantId = parseDiaryRouteParam(req.params.plantId, 'plantId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    if (!diary) {
      throw AppError.notFound('Diary not found');
    }

    await requireDraftDiaryWriteAccess(req.user!, diary);

    const result = await prisma.diaryPlant.deleteMany({ where: { id: plantId, diaryId } });
    if (result.count === 0) {
      throw AppError.notFound('Plant entry');
    }

    res.status(204).send();
  }),
);

// Feature #477: POST /api/diary/:diaryId/visitors - Add visitor to diary
router.post(
  '/:diaryId/visitors',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    if (!diary) {
      throw AppError.notFound('Diary not found');
    }

    const data = addVisitorSchema.parse(req.body);
    await requireDraftDiaryWriteAccess(req.user!, diary);

    const visitor = await prisma.diaryVisitor.create({
      data: {
        diaryId,
        ...data,
      },
    });

    res.status(201).json(visitor);
  }),
);

// Feature #477: PUT /api/diary/:diaryId/visitors/:visitorId - Update visitor
router.put(
  '/:diaryId/visitors/:visitorId',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const visitorId = parseDiaryRouteParam(req.params.visitorId, 'visitorId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    if (!diary) {
      throw AppError.notFound('Diary not found');
    }

    const data = addVisitorSchema.partial().parse(req.body);
    await requireDraftDiaryWriteAccess(req.user!, diary);

    const existingVisitor = await prisma.diaryVisitor.findFirst({
      where: { id: visitorId, diaryId },
      select: { id: true },
    });

    if (!existingVisitor) {
      throw AppError.notFound('Visitor entry');
    }

    const visitor = await prisma.diaryVisitor.update({
      where: { id: visitorId },
      data,
    });

    res.json(visitor);
  }),
);

// Feature #477: DELETE /api/diary/:diaryId/visitors/:visitorId - Remove visitor
router.delete(
  '/:diaryId/visitors/:visitorId',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const visitorId = parseDiaryRouteParam(req.params.visitorId, 'visitorId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    if (!diary) {
      throw AppError.notFound('Diary not found');
    }

    await requireDraftDiaryWriteAccess(req.user!, diary);

    const result = await prisma.diaryVisitor.deleteMany({ where: { id: visitorId, diaryId } });
    if (result.count === 0) {
      throw AppError.notFound('Visitor entry');
    }

    res.status(204).send();
  }),
);

// GET /api/diary/project/:projectId/recent-plant - Get recently used plant for a project
router.get(
  '/project/:projectId/recent-plant',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseDiaryRouteParam(req.params.projectId, 'projectId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    await requireDiaryReadAccess(req.user!, projectId, 'Access denied');

    // Get plant from recent diaries (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentDiaries = await prisma.dailyDiary.findMany({
      where: {
        projectId,
        date: { gte: thirtyDaysAgo },
      },
      include: {
        plant: true,
      },
      orderBy: { date: 'desc' },
      take: 10,
    });

    // Collect unique plant items by description + company
    const plantMap = new Map<string, RecentPlantSuggestion>();
    for (const diary of recentDiaries) {
      for (const plant of diary.plant) {
        const key = `${plant.description}|${plant.company || ''}|${plant.idRego || ''}`;
        if (!plantMap.has(key)) {
          plantMap.set(key, {
            description: plant.description,
            idRego: plant.idRego,
            company: plant.company,
            lastUsed: diary.date,
            usageCount: 1,
          });
        } else {
          const existing = plantMap.get(key)!;
          existing.usageCount += 1;
        }
      }
    }

    // Convert to array and sort by usage count (most used first)
    const recentPlant = Array.from(plantMap.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 20); // Limit to top 20

    res.json({
      recentPlant,
      count: recentPlant.length,
    });
  }),
);

// GET /api/diary/project/:projectId/activity-suggestions - Get activity suggestions
router.get(
  '/project/:projectId/activity-suggestions',
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

    await requireDiaryReadAccess(req.user!, projectId, 'Access denied');

    const suggestions: Array<{ description: string; source: string; category?: string }> = [];

    // 1. Get checklist item descriptions from ITP templates for this project
    const itpTemplates = await prisma.iTPTemplate.findMany({
      where: { projectId },
      include: {
        checklistItems: {
          select: { description: true },
        },
      },
    });

    for (const template of itpTemplates) {
      for (const item of template.checklistItems) {
        suggestions.push({
          description: item.description,
          source: 'ITP Template',
          category: template.activityType ?? undefined,
        });
      }
    }

    // 2. Get recent activity descriptions from diaries
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivities = await prisma.diaryActivity.findMany({
      where: {
        diary: {
          projectId,
          date: { gte: thirtyDaysAgo },
        },
      },
      select: { description: true },
      distinct: ['description'],
      take: 50,
    });

    for (const activity of recentActivities) {
      // Only add if not already in suggestions
      if (!suggestions.some((s) => s.description === activity.description)) {
        suggestions.push({
          description: activity.description,
          source: 'Recent Activity',
        });
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
      'Site cleanup',
    ];

    for (const desc of commonActivities) {
      if (!suggestions.some((s) => s.description === desc)) {
        suggestions.push({
          description: desc,
          source: 'Common',
        });
      }
    }

    // Filter by search term if provided
    let filtered = suggestions;
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = suggestions.filter((s) => s.description.toLowerCase().includes(searchLower));
    }

    // Deduplicate and limit
    const unique = Array.from(new Map(filtered.map((s) => [s.description, s])).values());
    const limited = unique.slice(0, 20);

    res.json({
      suggestions: limited,
      count: limited.length,
      totalAvailable: unique.length,
    });
  }),
);

// POST /api/diary/:diaryId/activities - Add activity to diary
router.post(
  '/:diaryId/activities',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    if (!diary) {
      throw AppError.notFound('Diary not found');
    }

    const data = addActivitySchema.parse(req.body);
    await requireDraftDiaryWriteAccess(req.user!, diary);
    await requireLotInProject(data.lotId, diary.projectId);

    const activity = await prisma.diaryActivity.create({
      data: {
        diaryId,
        ...data,
      },
      include: {
        lot: { select: { id: true, lotNumber: true } },
      },
    });

    res.status(201).json(activity);
  }),
);

// DELETE /api/diary/:diaryId/activities/:activityId - Remove activity
router.delete(
  '/:diaryId/activities/:activityId',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const activityId = parseDiaryRouteParam(req.params.activityId, 'activityId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    if (!diary) {
      throw AppError.notFound('Diary not found');
    }

    await requireDraftDiaryWriteAccess(req.user!, diary);

    const result = await prisma.diaryActivity.deleteMany({ where: { id: activityId, diaryId } });
    if (result.count === 0) {
      throw AppError.notFound('Activity entry');
    }

    res.status(204).send();
  }),
);

// POST /api/diary/:diaryId/delays - Add delay to diary
router.post(
  '/:diaryId/delays',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    if (!diary) {
      throw AppError.notFound('Diary not found');
    }

    const data = addDelaySchema.parse(req.body);
    await requireDraftDiaryWriteAccess(req.user!, diary);
    await requireLotInProject(data.lotId, diary.projectId);

    const delay = await prisma.diaryDelay.create({
      data: {
        diaryId,
        ...data,
      },
    });

    res.status(201).json(delay);
  }),
);

// DELETE /api/diary/:diaryId/delays/:delayId - Remove delay
router.delete(
  '/:diaryId/delays/:delayId',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const delayId = parseDiaryRouteParam(req.params.delayId, 'delayId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    if (!diary) {
      throw AppError.notFound('Diary not found');
    }

    await requireDraftDiaryWriteAccess(req.user!, diary);

    const result = await prisma.diaryDelay.deleteMany({ where: { id: delayId, diaryId } });
    if (result.count === 0) {
      throw AppError.notFound('Delay entry');
    }

    res.status(204).send();
  }),
);

// POST /api/diary/:diaryId/deliveries - Add delivery to diary
router.post(
  '/:diaryId/deliveries',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    if (!userId) throw AppError.unauthorized('Unauthorized');
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const data = addDeliverySchema.parse(req.body);

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    if (!diary) throw AppError.notFound('Diary not found');
    await requireDraftDiaryWriteAccess(req.user!, diary);
    await requireLotInProject(data.lotId, diary.projectId);

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
    });

    res.status(201).json(delivery);
  }),
);

// DELETE /api/diary/:diaryId/deliveries/:deliveryId - Remove delivery
router.delete(
  '/:diaryId/deliveries/:deliveryId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    if (!userId) throw AppError.unauthorized('Unauthorized');
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const deliveryId = parseDiaryRouteParam(req.params.deliveryId, 'deliveryId');

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    if (!diary) throw AppError.notFound('Diary not found');
    await requireDraftDiaryWriteAccess(req.user!, diary);

    const result = await prisma.diaryDelivery.deleteMany({ where: { id: deliveryId, diaryId } });
    if (result.count === 0) {
      throw AppError.notFound('Delivery entry');
    }

    res.json({ message: 'Delivery removed' });
  }),
);

// POST /api/diary/:diaryId/events - Add event to diary
router.post(
  '/:diaryId/events',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    if (!userId) throw AppError.unauthorized('Unauthorized');
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const data = addEventSchema.parse(req.body);

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    if (!diary) throw AppError.notFound('Diary not found');
    await requireDraftDiaryWriteAccess(req.user!, diary);
    await requireLotInProject(data.lotId, diary.projectId);

    const event = await prisma.diaryEvent.create({
      data: {
        diaryId,
        eventType: data.eventType,
        description: data.description,
        notes: data.notes,
        lotId: data.lotId,
      },
      include: { lot: { select: { id: true, lotNumber: true } } },
    });

    res.status(201).json(event);
  }),
);

// DELETE /api/diary/:diaryId/events/:eventId - Remove event
router.delete(
  '/:diaryId/events/:eventId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    if (!userId) throw AppError.unauthorized('Unauthorized');
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const eventId = parseDiaryRouteParam(req.params.eventId, 'eventId');

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } });
    if (!diary) throw AppError.notFound('Diary not found');
    await requireDraftDiaryWriteAccess(req.user!, diary);

    const result = await prisma.diaryEvent.deleteMany({ where: { id: eventId, diaryId } });
    if (result.count === 0) {
      throw AppError.notFound('Event entry');
    }

    res.json({ message: 'Event removed' });
  }),
);

export { router as diaryItemsRouter };
