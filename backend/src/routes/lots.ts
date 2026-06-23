import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { updateLotSchema } from './lots/validation.js';
import { canViewLotBudget, requireProjectRole } from './lots/access.js';
import {
  requireSubcontractorInProject,
  syncPrimaryLotSubcontractorAssignment,
} from './lots/assignmentHelpers.js';
import { parseLotRouteParam } from './lots/requestParsing.js';
import {
  LOT_EDITORS,
  LOT_BUDGET_EDITORS,
  CONFORMED_LOT_BUDGET_EDIT_FIELDS,
  getProvidedUpdateFields,
} from './lots/updateFields.js';
import { buildLotUpdatedResponse } from './lots/remainingResponses.js';
import { lotReadRouter } from './lots/readRoutes.js';
import { lotCreateRouter } from './lots/createRoutes.js';
import { lotDeleteRouter } from './lots/deleteRoutes.js';
import { lotSubcontractorAssignmentsRouter } from './lots/subcontractorAssignments.js';
import { lotBulkMutationRouter } from './lots/bulkMutationRoutes.js';
import { lotQualityRouter } from './lots/qualityRoutes.js';
import { emitLotWebhookEvent } from './lots/webhookEvents.js';

export const lotsRouter = Router();

// Apply authentication middleware to all lot routes
lotsRouter.use(requireAuth);

// Lot read routes (GET /, /suggest-number, /:id) — mounted before mutation routes. See ./lots/readRoutes.ts
lotsRouter.use(lotReadRouter);

// Lot create routes (POST /, /bulk, /:id/clone) — mounted after read routes, before update/delete/bulk routes. See ./lots/createRoutes.ts
lotsRouter.use(lotCreateRouter);

// PATCH /api/lots/:id - Update a lot
lotsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const validation = updateLotSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        lotNumber: true,
        status: true,
        budgetAmount: true,
        updatedAt: true,
      },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    const userProjectRole = await requireProjectRole(
      lot.projectId,
      user,
      LOT_EDITORS,
      'You do not have permission to edit lots',
      { requireWritable: true },
    );

    // Feature #871: Concurrent edit detection (optimistic locking)
    // If client sends expectedUpdatedAt, check if lot was modified since
    const { expectedUpdatedAt } = req.body;
    if (expectedUpdatedAt) {
      const clientExpectedTime = new Date(expectedUpdatedAt).getTime();
      const serverUpdatedTime = lot.updatedAt.getTime();
      const timeDiff = Math.abs(clientExpectedTime - serverUpdatedTime);

      // Allow 1 second tolerance for timing differences
      if (timeDiff > 1000) {
        throw AppError.conflict(
          'This lot has been modified by another user. Please refresh and try again.',
          {
            serverUpdatedAt: lot.updatedAt.toISOString(),
            clientExpectedAt: expectedUpdatedAt,
          },
        );
      }
    }

    // Extract validated fields
    const {
      lotNumber,
      description,
      activityType,
      chainageStart,
      chainageEnd,
      offset,
      offsetCustom,
      layer,
      areaZone,
      status,
      budgetAmount,
      assignedSubcontractorId,
      lotType: validatedLotType,
      structureId: validatedStructureId,
      structureElement: validatedStructureElement,
    } = validation.data;
    const providedUpdateFields = getProvidedUpdateFields(validation.data);
    const isConformedBudgetOnlyUpdate =
      lot.status === 'conformed' &&
      budgetAmount !== undefined &&
      providedUpdateFields.every((field) => CONFORMED_LOT_BUDGET_EDIT_FIELDS.has(field));

    if (lot.status === 'claimed') {
      throw AppError.badRequest('Cannot edit a claimed lot');
    }

    if (lot.status === 'conformed' && !isConformedBudgetOnlyUpdate) {
      throw AppError.badRequest(
        'Cannot edit a conformed lot. Only the budget amount can be updated before the lot is claimed.',
      );
    }

    if (isConformedBudgetOnlyUpdate && !LOT_BUDGET_EDITORS.includes(userProjectRole)) {
      throw AppError.forbidden(
        'Only project managers, admins, or owners can edit budgets on conformed lots',
      );
    }

    // Feature #853 & #854: Validate area zone and structure ID for respective lot types
    const existingLot = await prisma.lot.findUnique({
      where: { id },
      select: {
        lotType: true,
        areaZone: true,
        structureId: true,
        chainageStart: true,
        chainageEnd: true,
      },
    });
    const newLotType = validatedLotType ?? existingLot?.lotType;
    const newAreaZone = areaZone ?? existingLot?.areaZone;
    const newStructureId = validatedStructureId ?? existingLot?.structureId;
    const newChainageStart =
      chainageStart !== undefined ? chainageStart : existingLot?.chainageStart;
    const newChainageEnd = chainageEnd !== undefined ? chainageEnd : existingLot?.chainageEnd;

    if (newLotType === 'area' && !newAreaZone) {
      throw AppError.badRequest('Area zone is required for area lot type', {
        code: 'AREA_ZONE_REQUIRED',
      });
    }

    // Feature #854: Structure ID required for structure lot type
    if (newLotType === 'structure' && !newStructureId) {
      throw AppError.badRequest('Structure ID is required for structure lot type', {
        code: 'STRUCTURE_ID_REQUIRED',
      });
    }

    if (
      newChainageStart !== null &&
      newChainageStart !== undefined &&
      newChainageEnd !== null &&
      newChainageEnd !== undefined &&
      Number(newChainageStart) > Number(newChainageEnd)
    ) {
      throw AppError.badRequest('chainageStart must be less than or equal to chainageEnd');
    }

    // Build update data - only include fields that were provided
    const updateData: Record<string, unknown> = {};
    if (validatedLotType !== undefined) updateData.lotType = validatedLotType;
    if (lotNumber !== undefined) updateData.lotNumber = lotNumber;
    if (description !== undefined) updateData.description = description;
    if (activityType !== undefined) updateData.activityType = activityType;
    if (chainageStart !== undefined) updateData.chainageStart = chainageStart;
    if (chainageEnd !== undefined) updateData.chainageEnd = chainageEnd;
    if (offset !== undefined) updateData.offset = offset;
    if (offsetCustom !== undefined) updateData.offsetCustom = offsetCustom;
    if (layer !== undefined) updateData.layer = layer;
    if (areaZone !== undefined) updateData.areaZone = areaZone;
    if (validatedStructureId !== undefined) updateData.structureId = validatedStructureId; // Feature #854
    if (validatedStructureElement !== undefined)
      updateData.structureElement = validatedStructureElement; // Feature #854
    if (status !== undefined) updateData.status = status;
    // Only PMs and above can set budget
    if (budgetAmount !== undefined && LOT_BUDGET_EDITORS.includes(userProjectRole)) {
      updateData.budgetAmount = budgetAmount;
    }
    // Only PMs and above can assign subcontractors
    if (assignedSubcontractorId !== undefined && LOT_BUDGET_EDITORS.includes(userProjectRole)) {
      if (assignedSubcontractorId) {
        await requireSubcontractorInProject(assignedSubcontractorId, lot.projectId);
      }
      updateData.assignedSubcontractorId = assignedSubcontractorId || null;
    }

    const updatedLot = await prisma.$transaction(async (tx) => {
      const updated = await tx.lot.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          lotNumber: true,
          description: true,
          status: true,
          activityType: true,
          chainageStart: true,
          chainageEnd: true,
          offset: true,
          offsetCustom: true,
          layer: true,
          areaZone: true,
          budgetAmount: true,
          assignedSubcontractorId: true,
          updatedAt: true,
        },
      });

      if (assignedSubcontractorId !== undefined && LOT_BUDGET_EDITORS.includes(userProjectRole)) {
        await syncPrimaryLotSubcontractorAssignment(tx, {
          lotId: id,
          projectId: lot.projectId,
          subcontractorId: assignedSubcontractorId,
          assignedById: user.id,
        });
      }

      return updated;
    });

    const changedFields = Object.keys(updateData).sort();
    if (changedFields.length > 0) {
      await createAuditLog({
        projectId: lot.projectId,
        userId: user.id,
        entityType: 'lot',
        entityId: id,
        action: AuditAction.LOT_UPDATED,
        changes: {
          lotNumber: updatedLot.lotNumber,
          fields: changedFields,
          ...(updateData.status !== undefined
            ? { status: { from: lot.status, to: updatedLot.status } }
            : {}),
          ...(updateData.budgetAmount !== undefined
            ? {
                budgetAmount: {
                  from: lot.budgetAmount != null ? Number(lot.budgetAmount) : null,
                  to: updatedLot.budgetAmount != null ? Number(updatedLot.budgetAmount) : null,
                },
              }
            : {}),
        },
        req,
      });
      emitLotWebhookEvent(lot.projectId, 'lot.updated', {
        lotId: updatedLot.id,
        projectId: lot.projectId,
        lotNumber: updatedLot.lotNumber,
        status: updatedLot.status,
        actorUserId: user.id,
        action: 'updated',
        changedFields,
        previousStatus: lot.status,
        assignedSubcontractorId: updatedLot.assignedSubcontractorId,
      });
    }

    res.json(buildLotUpdatedResponse(updatedLot, canViewLotBudget(userProjectRole)));
  }),
);

// Lot delete routes (DELETE /:id, POST /bulk-delete) - mounted after update routes,
// before later bulk/status routes. See ./lots/deleteRoutes.ts
lotsRouter.use(lotDeleteRouter);

// Lot bulk mutation routes (POST /bulk-update-status, /bulk-assign-subcontractor, /:id/assign)
// mounted after deletes and before later role/readiness/conformance/status routes.
lotsRouter.use(lotBulkMutationRouter);

// Lot quality/readiness/status routes - mounted after bulk mutation routes,
// before subcontractor assignment routes to preserve Express route order.
lotsRouter.use(lotQualityRouter);

// Lot subcontractor assignment routes (mounted after requireAuth above). See ./lots/subcontractorAssignments.ts
lotsRouter.use(lotSubcontractorAssignmentsRouter);
