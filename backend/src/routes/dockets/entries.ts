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
  parseDocketRouteParam,
  updateLabourEntrySchema,
} from './validation.js';
import { lockEditableDocketForEntryMutation, refreshLabourSubmittedTotals } from './entryTotals.js';
import { buildDocketLabourEntryMutationResponse } from './entryMutationResponses.js';
import {
  buildDocketEntryDeletedResponse,
  buildDocketLabourEntriesResponse,
  mapDocketLabourEntry,
} from './presentation.js';
import {
  assertLotAllocationHoursWithinEntry,
  buildLabourLotAllocationCreate,
  buildLabourLotAllocationRows,
  calculateHoursFromTimeRange,
  calculateLabourEntryCost,
} from './entryCalculations.js';
import { plantDocketEntriesRouter } from './plantEntries.js';

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

    const hours = calculateHoursFromTimeRange(startTime, finishTime);
    assertLotAllocationHoursWithinEntry(hours, lotAllocations);
    const hourlyRate = Number(employee.hourlyRate) || 0;
    const cost = calculateLabourEntryCost(hours, hourlyRate);

    const { entry, totals } = await prisma.$transaction(async (tx) => {
      await lockEditableDocketForEntryMutation(tx, id);

      const created = await tx.docketLabour.create({
        data: {
          docketId: id,
          employeeId,
          startTime,
          finishTime,
          submittedHours: hours,
          hourlyRate,
          submittedCost: cost,
          lotAllocations: buildLabourLotAllocationCreate(lotAllocations),
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

    const hours = calculateHoursFromTimeRange(
      startTime,
      finishTime,
      Number(entry.submittedHours) || 0,
    );
    assertLotAllocationHoursWithinEntry(hours, lotAllocations);

    const hourlyRate = Number(entry.hourlyRate) || Number(entry.employee.hourlyRate) || 0;
    const cost = calculateLabourEntryCost(hours, hourlyRate);

    const updated = await prisma.$transaction(async (tx) => {
      await lockEditableDocketForEntryMutation(tx, id);

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
            data: buildLabourLotAllocationRows(entryId, lotAllocations),
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
      await lockEditableDocketForEntryMutation(tx, id);

      // Delete entry (cascade deletes lot allocations)
      await tx.docketLabour.delete({ where: { id: entryId } });
      await refreshLabourSubmittedTotals(tx, id);
    });

    res.json(buildDocketEntryDeletedResponse('Labour entry deleted'));
  }),
);

docketEntriesRouter.use(plantDocketEntriesRouter);
