import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  canViewDocketAmounts,
  isDocketEntryEditable,
  requireApprovedDocketResource,
  requireDocketReadAccess,
  requireLotAllocationsInProject,
  requireDocketSubcontractorAccess,
} from './access.js';
import {
  addPlantEntrySchema,
  parseDocketRouteParam,
  updatePlantEntrySchema,
} from './validation.js';
import { lockEditableDocketForEntryMutation, refreshPlantSubmittedTotals } from './entryTotals.js';
import { buildDocketPlantEntryMutationResponse } from './entryMutationResponses.js';
import {
  buildDocketEntryDeletedResponse,
  buildDocketPlantEntriesResponse,
  mapDocketPlantEntry,
} from './presentation.js';
import {
  assertLotAllocationHoursWithinEntry,
  buildPlantLotAllocationCreate,
  buildPlantLotAllocationRows,
  calculatePlantEntryCost,
} from './entryCalculations.js';

export const plantDocketEntriesRouter = Router();
// ============================================================================
// Feature #262 - Plant Entry Management
// ============================================================================

// GET /api/dockets/:id/plant - Get plant entries for a docket
plantDocketEntriesRouter.get(
  '/:id/plant',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        plantEntries: {
          include: {
            plant: {
              select: {
                id: true,
                type: true,
                description: true,
                idRego: true,
                dryRate: true,
                wetRate: true,
              },
            },
            lotAllocations: {
              include: {
                lot: { select: { id: true, lotNumber: true } },
              },
            },
          },
          orderBy: { hoursOperated: 'desc' },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketReadAccess(req.user!, docket);
    const includeCommercialAmounts = await canViewDocketAmounts(req.user!, docket.projectId);

    // Format plant entries
    const plantEntries = docket.plantEntries.map((entry) =>
      mapDocketPlantEntry(entry, { includeAdjustmentReason: true, includeCommercialAmounts }),
    );

    res.json(buildDocketPlantEntriesResponse(plantEntries, { includeCommercialAmounts }));
  }),
);

// POST /api/dockets/:id/plant - Add a plant entry to a docket
plantDocketEntriesRouter.post(
  '/:id/plant',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');

    // Validate request body
    const parseResult = addPlantEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { plantId, hoursOperated, wetOrDry, lotAllocations } = parseResult.data;

    // Get docket
    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: { select: { id: true } },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);

    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }
    await requireLotAllocationsInProject(
      docket.projectId,
      docket.subcontractorCompanyId,
      lotAllocations,
    );

    // Get plant from register
    const plant = await prisma.plantRegister.findFirst({
      where: {
        id: plantId,
        subcontractorCompanyId: docket.subcontractorCompanyId,
      },
    });

    if (!plant) {
      throw AppError.notFound('Plant in register');
    }
    requireApprovedDocketResource(plant.status, 'Plant');

    const plantCost = calculatePlantEntryCost(hoursOperated, wetOrDry, plant);
    assertLotAllocationHoursWithinEntry(plantCost.hours, lotAllocations);

    const { entry, totals } = await prisma.$transaction(async (tx) => {
      await lockEditableDocketForEntryMutation(tx, id);

      const created = await tx.docketPlant.create({
        data: {
          docketId: id,
          plantId,
          hoursOperated: plantCost.hours,
          wetOrDry: wetOrDry || 'dry',
          hourlyRate: plantCost.hourlyRate,
          submittedCost: plantCost.cost,
          lotAllocations: buildPlantLotAllocationCreate(lotAllocations),
        },
        include: {
          plant: {
            select: {
              id: true,
              type: true,
              description: true,
              idRego: true,
              dryRate: true,
              wetRate: true,
            },
          },
          lotAllocations: {
            include: {
              lot: { select: { id: true, lotNumber: true } },
            },
          },
        },
      });

      return {
        entry: created,
        totals: await refreshPlantSubmittedTotals(tx, id),
      };
    });

    res.status(201).json(buildDocketPlantEntryMutationResponse(entry, totals));
  }),
);

// PUT /api/dockets/:id/plant/:entryId - Update a plant entry
plantDocketEntriesRouter.put(
  '/:id/plant/:entryId',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const entryId = parseDocketRouteParam(req.params.entryId, 'entryId');

    // Validate request body
    const parseResult = updatePlantEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { hoursOperated, wetOrDry, lotAllocations } = parseResult.data;

    const entry = await prisma.docketPlant.findFirst({
      where: { id: entryId, docketId: id },
      include: {
        plant: { select: { dryRate: true, wetRate: true, status: true } },
        lotAllocations: {
          select: { lotId: true, hours: true },
        },
      },
    });

    if (!entry) {
      throw AppError.notFound('Plant entry');
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } });
    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);
    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }
    requireApprovedDocketResource(entry.plant.status, 'Plant');

    const hours = hoursOperated !== undefined ? Number(hoursOperated) : Number(entry.hoursOperated);
    const effectiveLotAllocations =
      lotAllocations ??
      entry.lotAllocations.map((allocation) => ({
        lotId: allocation.lotId,
        hours: Number(allocation.hours),
      }));

    await requireLotAllocationsInProject(
      docket.projectId,
      docket.subcontractorCompanyId,
      effectiveLotAllocations,
    );
    assertLotAllocationHoursWithinEntry(hours, effectiveLotAllocations);

    const plantCost = calculatePlantEntryCost(hours, wetOrDry || entry.wetOrDry, entry.plant);

    const updated = await prisma.$transaction(async (tx) => {
      await lockEditableDocketForEntryMutation(tx, id);

      await tx.docketPlant.update({
        where: { id: entryId },
        data: {
          hoursOperated: hours,
          wetOrDry: wetOrDry || entry.wetOrDry,
          hourlyRate: plantCost.hourlyRate,
          submittedCost: plantCost.cost,
        },
      });

      if (lotAllocations) {
        await tx.docketPlantLot.deleteMany({ where: { docketPlantId: entryId } });
        if (lotAllocations.length > 0) {
          await tx.docketPlantLot.createMany({
            data: buildPlantLotAllocationRows(entryId, lotAllocations),
          });
        }
      }

      await refreshPlantSubmittedTotals(tx, id);

      const refreshed = await tx.docketPlant.findUnique({
        where: { id: entryId },
        include: {
          plant: {
            select: {
              id: true,
              type: true,
              description: true,
              idRego: true,
              dryRate: true,
              wetRate: true,
            },
          },
          lotAllocations: {
            include: {
              lot: { select: { id: true, lotNumber: true } },
            },
          },
        },
      });

      if (!refreshed) {
        throw AppError.notFound('Plant entry');
      }
      return refreshed;
    });

    res.json(buildDocketPlantEntryMutationResponse(updated));
  }),
);

// DELETE /api/dockets/:id/plant/:entryId - Delete a plant entry
plantDocketEntriesRouter.delete(
  '/:id/plant/:entryId',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const entryId = parseDocketRouteParam(req.params.entryId, 'entryId');

    const entry = await prisma.docketPlant.findFirst({
      where: { id: entryId, docketId: id },
    });

    if (!entry) {
      throw AppError.notFound('Plant entry');
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } });
    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);
    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }

    const totals = await prisma.$transaction(async (tx) => {
      await lockEditableDocketForEntryMutation(tx, id);

      // Delete entry
      await tx.docketPlant.delete({ where: { id: entryId } });
      return refreshPlantSubmittedTotals(tx, id);
    });

    res.json(buildDocketEntryDeletedResponse('Plant entry deleted', totals));
  }),
);
