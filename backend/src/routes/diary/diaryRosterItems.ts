import { Router, Request, Response } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { parseDiaryRouteParam, requireLotInProject } from './diaryAccess.js';
import { addPersonnelSchema, addPlantSchema, addVisitorSchema } from './diaryItemsValidation.js';
import { withEditableDiary } from './diaryItemMutation.js';

const router = Router();

// POST /api/diary/:diaryId/personnel - Add personnel to diary
router.post(
  '/:diaryId/personnel',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const data = addPersonnelSchema.parse(req.body);
    const personnel = await withEditableDiary(req.user!, diaryId, async (tx, diary) => {
      await requireLotInProject(data.lotId, diary.projectId, tx);

      return tx.diaryPersonnel.create({
        data: {
          diaryId,
          ...data,
        },
      });
    });

    res.status(201).json(personnel);
  }),
);

// PUT /api/diary/:diaryId/personnel/:personnelId - Update personnel in place
router.put(
  '/:diaryId/personnel/:personnelId',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const personnelId = parseDiaryRouteParam(req.params.personnelId, 'personnelId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const data = addPersonnelSchema.parse(req.body);
    const personnel = await withEditableDiary(req.user!, diaryId, async (tx, diary) => {
      await requireLotInProject(data.lotId, diary.projectId, tx);

      const existing = await tx.diaryPersonnel.findFirst({
        where: { id: personnelId, diaryId },
        select: { id: true },
      });
      if (!existing) {
        throw AppError.notFound('Personnel entry');
      }

      return tx.diaryPersonnel.update({
        where: { id: personnelId },
        data,
      });
    });

    res.json(personnel);
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

    await withEditableDiary(req.user!, diaryId, async (tx) => {
      const result = await tx.diaryPersonnel.deleteMany({ where: { id: personnelId, diaryId } });
      if (result.count === 0) {
        throw AppError.notFound('Personnel entry');
      }
    });

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

    const data = addPlantSchema.parse(req.body);
    const plant = await withEditableDiary(req.user!, diaryId, async (tx, diary) => {
      await requireLotInProject(data.lotId, diary.projectId, tx);

      return tx.diaryPlant.create({
        data: {
          diaryId,
          ...data,
        },
      });
    });

    res.status(201).json(plant);
  }),
);

// PUT /api/diary/:diaryId/plant/:plantId - Update plant in place
router.put(
  '/:diaryId/plant/:plantId',
  asyncHandler(async (req: Request, res: Response) => {
    const diaryId = parseDiaryRouteParam(req.params.diaryId, 'diaryId');
    const plantId = parseDiaryRouteParam(req.params.plantId, 'plantId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const data = addPlantSchema.parse(req.body);
    const plant = await withEditableDiary(req.user!, diaryId, async (tx, diary) => {
      await requireLotInProject(data.lotId, diary.projectId, tx);

      const existing = await tx.diaryPlant.findFirst({
        where: { id: plantId, diaryId },
        select: { id: true },
      });
      if (!existing) {
        throw AppError.notFound('Plant entry');
      }

      return tx.diaryPlant.update({
        where: { id: plantId },
        data,
      });
    });

    res.json(plant);
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

    await withEditableDiary(req.user!, diaryId, async (tx) => {
      const result = await tx.diaryPlant.deleteMany({ where: { id: plantId, diaryId } });
      if (result.count === 0) {
        throw AppError.notFound('Plant entry');
      }
    });

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

    const data = addVisitorSchema.parse(req.body);
    const visitor = await withEditableDiary(req.user!, diaryId, async (tx) => {
      return tx.diaryVisitor.create({
        data: {
          diaryId,
          ...data,
        },
      });
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

    const data = addVisitorSchema.partial().parse(req.body);
    const visitor = await withEditableDiary(req.user!, diaryId, async (tx) => {
      const existingVisitor = await tx.diaryVisitor.findFirst({
        where: { id: visitorId, diaryId },
        select: { id: true },
      });

      if (!existingVisitor) {
        throw AppError.notFound('Visitor entry');
      }

      return tx.diaryVisitor.update({
        where: { id: visitorId },
        data,
      });
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

    await withEditableDiary(req.user!, diaryId, async (tx) => {
      const result = await tx.diaryVisitor.deleteMany({ where: { id: visitorId, diaryId } });
      if (result.count === 0) {
        throw AppError.notFound('Visitor entry');
      }
    });

    res.status(204).send();
  }),
);

export { router as diaryRosterItemsRouter };
