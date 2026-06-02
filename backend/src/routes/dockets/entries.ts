import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  isDocketEntryEditable,
  requireApprovedDocketResource,
  requireDocketReadAccess,
  requireDocketSubcontractorAccess,
  requireLotAllocationsInProject,
} from './access.js';
import {
  addLabourEntrySchema,
  addPlantEntrySchema,
  parseDocketRouteParam,
  updateLabourEntrySchema,
  updatePlantEntrySchema,
} from './validation.js';
import {
  lockDocketForEntryMutation,
  refreshLabourSubmittedTotals,
  refreshPlantSubmittedTotals,
} from './entryTotals.js';
import {
  buildDocketLabourEntryMutationResponse,
  buildDocketPlantEntryMutationResponse,
} from './entryMutationResponses.js';
import {
  buildDocketEntryDeletedResponse,
  buildDocketLabourEntriesResponse,
  buildDocketPlantEntriesResponse,
  mapDocketLabourEntry,
  mapDocketPlantEntry,
} from './presentation.js';

export const docketEntriesRouter = Router();

// ============================================================================
// Feature #261 - Labour Entry Management
// ============================================================================

// GET /api/dockets/:id/labour - Get labour entries for a docket
docketEntriesRouter.get(
  '/:id/labour',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        labourEntries: {
          include: {
            employee: {
              select: { id: true, name: true, role: true, hourlyRate: true },
            },
            lotAllocations: {
              include: {
                lot: { select: { id: true, lotNumber: true } },
              },
            },
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketReadAccess(req.user!, docket);

    // Format labour entries
    const labourEntries = docket.labourEntries.map((entry) =>
      mapDocketLabourEntry(entry, { includeAdjustmentReason: true }),
    );

    res.json(buildDocketLabourEntriesResponse(labourEntries));
  }),
);

// POST /api/dockets/:id/labour - Add a labour entry to a docket
docketEntriesRouter.post(
  '/:id/labour',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');

    // Validate request body
    const parseResult = addLabourEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { employeeId, startTime, finishTime, lotAllocations } = parseResult.data;

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

    // Get employee from roster
    const employee = await prisma.employeeRoster.findFirst({
      where: {
        id: employeeId,
        subcontractorCompanyId: docket.subcontractorCompanyId,
      },
    });

    if (!employee) {
      throw AppError.notFound('Employee in roster');
    }
    requireApprovedDocketResource(employee.status, 'Employee');

    // Calculate hours from start/finish time
    let hours = 0;
    if (startTime && finishTime) {
      const [startH, startM] = startTime.split(':').map(Number);
      const [finishH, finishM] = finishTime.split(':').map(Number);
      hours = finishH + finishM / 60 - (startH + startM / 60);
      if (hours < 0) hours += 24; // Handle overnight shifts
    }

    // Calculate cost
    const hourlyRate = Number(employee.hourlyRate) || 0;
    const cost = hours * hourlyRate;

    const { entry, totals } = await prisma.$transaction(async (tx) => {
      await lockDocketForEntryMutation(tx, id);

      const created = await tx.docketLabour.create({
        data: {
          docketId: id,
          employeeId,
          startTime,
          finishTime,
          submittedHours: hours,
          hourlyRate,
          submittedCost: cost,
          lotAllocations: lotAllocations?.length
            ? {
                create: lotAllocations.map((alloc: { lotId: string; hours: number }) => ({
                  lotId: alloc.lotId,
                  hours: alloc.hours,
                })),
              }
            : undefined,
        },
        include: {
          employee: {
            select: { id: true, name: true, role: true, hourlyRate: true },
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
        totals: await refreshLabourSubmittedTotals(tx, id),
      };
    });

    res.status(201).json(buildDocketLabourEntryMutationResponse(entry, totals));
  }),
);

// PUT /api/dockets/:id/labour/:entryId - Update a labour entry
docketEntriesRouter.put(
  '/:id/labour/:entryId',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const entryId = parseDocketRouteParam(req.params.entryId, 'entryId');

    // Validate request body
    const parseResult = updateLabourEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { startTime, finishTime, lotAllocations } = parseResult.data;

    const entry = await prisma.docketLabour.findFirst({
      where: { id: entryId, docketId: id },
      include: {
        employee: { select: { hourlyRate: true, status: true } },
      },
    });

    if (!entry) {
      throw AppError.notFound('Labour entry');
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } });
    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);
    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }
    requireApprovedDocketResource(entry.employee.status, 'Employee');
    await requireLotAllocationsInProject(
      docket.projectId,
      docket.subcontractorCompanyId,
      lotAllocations,
    );

    // Recalculate hours
    let hours = Number(entry.submittedHours) || 0;
    if (startTime && finishTime) {
      const [startH, startM] = startTime.split(':').map(Number);
      const [finishH, finishM] = finishTime.split(':').map(Number);
      hours = finishH + finishM / 60 - (startH + startM / 60);
      if (hours < 0) hours += 24;
    }

    const hourlyRate = Number(entry.hourlyRate) || Number(entry.employee.hourlyRate) || 0;
    const cost = hours * hourlyRate;

    const updated = await prisma.$transaction(async (tx) => {
      await lockDocketForEntryMutation(tx, id);

      await tx.docketLabour.update({
        where: { id: entryId },
        data: {
          startTime,
          finishTime,
          submittedHours: hours,
          submittedCost: cost,
        },
      });

      if (lotAllocations) {
        await tx.docketLabourLot.deleteMany({ where: { docketLabourId: entryId } });
        if (lotAllocations.length > 0) {
          await tx.docketLabourLot.createMany({
            data: lotAllocations.map((alloc: { lotId: string; hours: number }) => ({
              docketLabourId: entryId,
              lotId: alloc.lotId,
              hours: alloc.hours,
            })),
          });
        }
      }

      await refreshLabourSubmittedTotals(tx, id);

      const refreshed = await tx.docketLabour.findUnique({
        where: { id: entryId },
        include: {
          employee: {
            select: { id: true, name: true, role: true, hourlyRate: true },
          },
          lotAllocations: {
            include: {
              lot: { select: { id: true, lotNumber: true } },
            },
          },
        },
      });

      if (!refreshed) {
        throw AppError.notFound('Labour entry');
      }
      return refreshed;
    });

    res.json(buildDocketLabourEntryMutationResponse(updated));
  }),
);

// DELETE /api/dockets/:id/labour/:entryId - Delete a labour entry
docketEntriesRouter.delete(
  '/:id/labour/:entryId',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const entryId = parseDocketRouteParam(req.params.entryId, 'entryId');

    const entry = await prisma.docketLabour.findFirst({
      where: { id: entryId, docketId: id },
    });

    if (!entry) {
      throw AppError.notFound('Labour entry');
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } });
    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);
    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }

    await prisma.$transaction(async (tx) => {
      await lockDocketForEntryMutation(tx, id);

      // Delete entry (cascade deletes lot allocations)
      await tx.docketLabour.delete({ where: { id: entryId } });
      await refreshLabourSubmittedTotals(tx, id);
    });

    res.json(buildDocketEntryDeletedResponse('Labour entry deleted'));
  }),
);

// ============================================================================
// Feature #262 - Plant Entry Management
// ============================================================================

// GET /api/dockets/:id/plant - Get plant entries for a docket
docketEntriesRouter.get(
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
          },
          orderBy: { hoursOperated: 'desc' },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketReadAccess(req.user!, docket);

    // Format plant entries
    const plantEntries = docket.plantEntries.map((entry) =>
      mapDocketPlantEntry(entry, { includeAdjustmentReason: true }),
    );

    res.json(buildDocketPlantEntriesResponse(plantEntries));
  }),
);

// POST /api/dockets/:id/plant - Add a plant entry to a docket
docketEntriesRouter.post(
  '/:id/plant',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');

    // Validate request body
    const parseResult = addPlantEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { plantId, hoursOperated, wetOrDry } = parseResult.data;

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

    // Determine rate based on wet/dry
    const isWet = wetOrDry === 'wet';
    const hourlyRate = isWet
      ? Number(plant.wetRate) || Number(plant.dryRate) || 0
      : Number(plant.dryRate) || 0;
    const cost = Number(hoursOperated) * hourlyRate;

    const { entry, totals } = await prisma.$transaction(async (tx) => {
      await lockDocketForEntryMutation(tx, id);

      const created = await tx.docketPlant.create({
        data: {
          docketId: id,
          plantId,
          hoursOperated,
          wetOrDry: wetOrDry || 'dry',
          hourlyRate,
          submittedCost: cost,
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
docketEntriesRouter.put(
  '/:id/plant/:entryId',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const entryId = parseDocketRouteParam(req.params.entryId, 'entryId');

    // Validate request body
    const parseResult = updatePlantEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { hoursOperated, wetOrDry } = parseResult.data;

    const entry = await prisma.docketPlant.findFirst({
      where: { id: entryId, docketId: id },
      include: {
        plant: { select: { dryRate: true, wetRate: true, status: true } },
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

    // Recalculate cost
    const hours = hoursOperated !== undefined ? Number(hoursOperated) : Number(entry.hoursOperated);
    const isWet = (wetOrDry || entry.wetOrDry) === 'wet';
    const hourlyRate = isWet
      ? Number(entry.plant.wetRate) || Number(entry.plant.dryRate) || 0
      : Number(entry.plant.dryRate) || 0;
    const cost = hours * hourlyRate;

    const updated = await prisma.$transaction(async (tx) => {
      await lockDocketForEntryMutation(tx, id);

      const refreshed = await tx.docketPlant.update({
        where: { id: entryId },
        data: {
          hoursOperated: hours,
          wetOrDry: wetOrDry || entry.wetOrDry,
          hourlyRate,
          submittedCost: cost,
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
        },
      });

      await refreshPlantSubmittedTotals(tx, id);
      return refreshed;
    });

    res.json(buildDocketPlantEntryMutationResponse(updated));
  }),
);

// DELETE /api/dockets/:id/plant/:entryId - Delete a plant entry
docketEntriesRouter.delete(
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

    await prisma.$transaction(async (tx) => {
      await lockDocketForEntryMutation(tx, id);

      // Delete entry
      await tx.docketPlant.delete({ where: { id: entryId } });
      await refreshPlantSubmittedTotals(tx, id);
    });

    res.json(buildDocketEntryDeletedResponse('Plant entry deleted'));
  }),
);
