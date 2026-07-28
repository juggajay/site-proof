import { Router, Request, Response } from 'express';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { isUniqueConstraintOn } from '../ncrs/ncrCoreValidation.js';
import { parseDiaryRouteParam, requireLotInProject } from './diaryAccess.js';
import { buildDiaryItemRemovedResponse } from './diaryItemsResponses.js';
import {
  addActivitySchema,
  addDelaySchema,
  addDeliverySchema,
  addEventSchema,
} from './diaryItemsValidation.js';
import { withEditableDiary } from './diaryItemMutation.js';
import { diaryRosterItemsRouter } from './diaryRosterItems.js';
import { diarySuggestionsRouter } from './diarySuggestions.js';

const router = Router();

const DIARY_ITEM_LOT_INCLUDE = { lot: { select: { id: true, lotNumber: true } } };

// H5 — offline-retry idempotency for the diary quick-add writes.
//
// A queued delivery/event whose POST committed but whose response never
// arrived is retried by the sync worker with the SAME requestKey; without this
// the retry wrote a second, identical row. Two layers:
//   - the pre-check answers the ordinary retry, and answers it even when the
//     diary has since been submitted (the editability gate inside `create`
//     would otherwise reject a row that already exists);
//   - the @@unique([diaryId, requestKey]) index + this P2002 branch answers the
//     loser of a same-key race with the winner's row rather than a 500.
async function createDiaryItemOnce<T>(
  requestKey: string | undefined,
  find: () => Promise<T | null>,
  create: () => Promise<T>,
): Promise<T> {
  if (!requestKey) {
    return create();
  }

  const existing = await find();
  if (existing) {
    return existing;
  }

  try {
    return await create();
  } catch (error) {
    if (!isUniqueConstraintOn(error, ['diaryId', 'requestKey'])) {
      throw error;
    }
    const winner = await find();
    if (!winner) {
      throw error;
    }
    return winner;
  }
}

router.use(diaryRosterItemsRouter);
router.use(diarySuggestionsRouter);

// POST /api/diary/:diaryId/activities - Add activity to diary
router.post(
  '/:diaryId/activities',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const data = addActivitySchema.parse(req.body);
    const activity = await withEditableDiary(req.user!, diaryId, async (tx, diary) => {
      await requireLotInProject(data.lotId, diary.projectId, tx);

      return tx.diaryActivity.create({
        data: {
          diaryId,
          ...data,
        },
        include: {
          lot: { select: { id: true, lotNumber: true } },
        },
      });
    });

    res.status(201).json(activity);
  }),
);

// PUT /api/diary/:diaryId/activities/:activityId - Update activity in place
router.put(
  '/:diaryId/activities/:activityId',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const activityId = parseDiaryRouteParam(req.params.activityId, 'activityId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const data = addActivitySchema.parse(req.body);
    const activity = await withEditableDiary(req.user!, diaryId, async (tx, diary) => {
      await requireLotInProject(data.lotId, diary.projectId, tx);

      const existing = await tx.diaryActivity.findFirst({
        where: { id: activityId, diaryId },
        select: { id: true },
      });
      if (!existing) {
        throw AppError.notFound('Activity entry');
      }

      return tx.diaryActivity.update({
        where: { id: activityId },
        data,
        include: {
          lot: { select: { id: true, lotNumber: true } },
        },
      });
    });

    res.json(activity);
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

    await withEditableDiary(req.user!, diaryId, async (tx) => {
      const result = await tx.diaryActivity.deleteMany({ where: { id: activityId, diaryId } });
      if (result.count === 0) {
        throw AppError.notFound('Activity entry');
      }
    });

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

    const data = addDelaySchema.parse(req.body);
    const delay = await withEditableDiary(req.user!, diaryId, async (tx, diary) => {
      await requireLotInProject(data.lotId, diary.projectId, tx);

      return tx.diaryDelay.create({
        data: {
          diaryId,
          ...data,
        },
      });
    });

    res.status(201).json(delay);
  }),
);

// PUT /api/diary/:diaryId/delays/:delayId - Update delay in place
router.put(
  '/:diaryId/delays/:delayId',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const delayId = parseDiaryRouteParam(req.params.delayId, 'delayId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const data = addDelaySchema.parse(req.body);
    const delay = await withEditableDiary(req.user!, diaryId, async (tx, diary) => {
      await requireLotInProject(data.lotId, diary.projectId, tx);

      const existing = await tx.diaryDelay.findFirst({
        where: { id: delayId, diaryId },
        select: { id: true },
      });
      if (!existing) {
        throw AppError.notFound('Delay entry');
      }

      return tx.diaryDelay.update({
        where: { id: delayId },
        data,
      });
    });

    res.json(delay);
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

    await withEditableDiary(req.user!, diaryId, async (tx) => {
      const result = await tx.diaryDelay.deleteMany({ where: { id: delayId, diaryId } });
      if (result.count === 0) {
        throw AppError.notFound('Delay entry');
      }
    });

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

    const delivery = await createDiaryItemOnce(
      data.requestKey,
      () =>
        prisma.diaryDelivery.findFirst({
          where: { diaryId, requestKey: data.requestKey },
          include: DIARY_ITEM_LOT_INCLUDE,
        }),
      () =>
        withEditableDiary(req.user!, diaryId, async (tx, diary) => {
          await requireLotInProject(data.lotId, diary.projectId, tx);

          return tx.diaryDelivery.create({
            data: {
              diaryId,
              description: data.description,
              supplier: data.supplier,
              docketNumber: data.docketNumber,
              quantity: data.quantity,
              unit: data.unit,
              lotId: data.lotId,
              notes: data.notes,
              requestKey: data.requestKey,
            },
            include: DIARY_ITEM_LOT_INCLUDE,
          });
        }),
    );

    res.status(201).json(delivery);
  }),
);

// PUT /api/diary/:diaryId/deliveries/:deliveryId - Update delivery in place
router.put(
  '/:diaryId/deliveries/:deliveryId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    if (!userId) throw AppError.unauthorized('Unauthorized');
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const deliveryId = parseDiaryRouteParam(req.params.deliveryId, 'deliveryId');
    const data = addDeliverySchema.parse(req.body);

    const delivery = await withEditableDiary(req.user!, diaryId, async (tx, diary) => {
      await requireLotInProject(data.lotId, diary.projectId, tx);

      const existing = await tx.diaryDelivery.findFirst({
        where: { id: deliveryId, diaryId },
        select: { id: true },
      });
      if (!existing) {
        throw AppError.notFound('Delivery entry');
      }

      return tx.diaryDelivery.update({
        where: { id: deliveryId },
        data: {
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
    });

    res.json(delivery);
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

    await withEditableDiary(req.user!, diaryId, async (tx) => {
      const result = await tx.diaryDelivery.deleteMany({ where: { id: deliveryId, diaryId } });
      if (result.count === 0) {
        throw AppError.notFound('Delivery entry');
      }
    });

    res.json(buildDiaryItemRemovedResponse('Delivery removed'));
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

    const event = await createDiaryItemOnce(
      data.requestKey,
      () =>
        prisma.diaryEvent.findFirst({
          where: { diaryId, requestKey: data.requestKey },
          include: DIARY_ITEM_LOT_INCLUDE,
        }),
      () =>
        withEditableDiary(req.user!, diaryId, async (tx, diary) => {
          await requireLotInProject(data.lotId, diary.projectId, tx);

          return tx.diaryEvent.create({
            data: {
              diaryId,
              eventType: data.eventType,
              description: data.description,
              notes: data.notes,
              lotId: data.lotId,
              requestKey: data.requestKey,
            },
            include: DIARY_ITEM_LOT_INCLUDE,
          });
        }),
    );

    res.status(201).json(event);
  }),
);

// PUT /api/diary/:diaryId/events/:eventId - Update event in place
router.put(
  '/:diaryId/events/:eventId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    if (!userId) throw AppError.unauthorized('Unauthorized');
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const eventId = parseDiaryRouteParam(req.params.eventId, 'eventId');
    const data = addEventSchema.parse(req.body);

    const event = await withEditableDiary(req.user!, diaryId, async (tx, diary) => {
      await requireLotInProject(data.lotId, diary.projectId, tx);

      const existing = await tx.diaryEvent.findFirst({
        where: { id: eventId, diaryId },
        select: { id: true },
      });
      if (!existing) {
        throw AppError.notFound('Event entry');
      }

      return tx.diaryEvent.update({
        where: { id: eventId },
        data: {
          eventType: data.eventType,
          description: data.description,
          notes: data.notes,
          lotId: data.lotId,
        },
        include: { lot: { select: { id: true, lotNumber: true } } },
      });
    });

    res.json(event);
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

    await withEditableDiary(req.user!, diaryId, async (tx) => {
      const result = await tx.diaryEvent.deleteMany({ where: { id: eventId, diaryId } });
      if (result.count === 0) {
        throw AppError.notFound('Event entry');
      }
    });

    res.json(buildDiaryItemRemovedResponse('Event removed'));
  }),
);

export { router as diaryItemsRouter };
