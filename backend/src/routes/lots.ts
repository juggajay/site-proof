import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { activitySlugForWrite } from '../lib/activityTaxonomy.js';
import { transitionLotStatus } from '../lib/lotStatusTransition.js';
import { assertLotSufficiencyAttributes } from '../lib/readiness/sufficiency/lotAttributeValidation.js';
import { updateLotSchema } from './lots/validation.js';
import { canViewLotBudget, requireProjectRole } from './lots/access.js';
import { parseLotRouteParam } from './lots/requestParsing.js';
import {
  LOT_EDITORS,
  LOT_BUDGET_EDITORS,
  CONFORMED_LOT_BUDGET_EDIT_FIELDS,
  getProvidedUpdateFields,
} from './lots/updateFields.js';
import { buildLotUpdatedResponse } from './lots/remainingResponses.js';
import { lotReadRouter } from './lots/readRoutes.js';
import { lotGeometryRouter } from './lots/geometryRoutes.js';
import { lotCreateRouter } from './lots/createRoutes.js';
import { lotDeleteRouter } from './lots/deleteRoutes.js';
import { lotSubcontractorAssignmentsRouter } from './lots/subcontractorAssignments.js';
import { lotBulkMutationRouter } from './lots/bulkMutationRoutes.js';
import { lotQualityRouter } from './lots/qualityRoutes.js';
import { lotFolioRouter } from './lots/folioRoutes.js';
import { ifcExportRouter } from './lots/ifcExportRoutes.js';
import { emitLotWebhookEvent } from './lots/webhookEvents.js';

export const lotsRouter = Router();

// Apply authentication middleware to all lot routes
lotsRouter.use(requireAuth);

// Lot read routes (GET /, /suggest-number, /:id) — mounted before mutation routes. See ./lots/readRoutes.ts
lotsRouter.use(lotReadRouter);

// Lot geometry routes (GET/POST /:lotId/geometries, DELETE /:lotId/geometries/:geometryId).
// Two-segment paths, so they never collide with the read router's dynamic `/:id`.
lotsRouter.use(lotGeometryRouter);

// Wave D `D1b` folio routes (POST /:id/folio/sessions, GET /:id/folios).
// Three- and two-segment paths, so like the geometry router they never collide
// with the read router's dynamic `/:id`. See ./lots/folioRoutes.ts
lotsRouter.use(lotFolioRouter);

// P1a DRAFT IFC export (GET /:id/exports/ifc-draft), parent-authenticated above.
lotsRouter.use(ifcExportRouter);

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
        // C1 (F7): prior values of the compliance-driving testing inputs, so the
        // audit trail records the direction of a requirement change, not just
        // that a field was touched.
        activityType: true,
        activitySlug: true,
        testScale: true,
        materialType: true,
        quantityValue: true,
        quantityUnit: true,
        // D14 §9.2 — joins an existing select, so the whitelist costs no query.
        project: { select: { state: true, specificationSet: true } },
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
      testScale,
      materialType,
      quantityValue,
      quantityUnit,
    } = validation.data;

    // D14 §9.2 — placement 2 of 4, and the one the external review's F2 named:
    // a quality_manager may edit and conform but may NOT force-conform, so an
    // unvalidated scale here converted an insufficient block-mode verdict into a
    // non-blocking `unknown` with no override record of any kind.
    assertLotSufficiencyAttributes(lot.project, { testScale, materialType });
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

    // Claim line amounts snapshot the budget at time of claiming, and the
    // over-claim guard caps on cumulative percentage — changing the budget
    // after a partial claim would make the billed dollars reconcile to no
    // coherent budget (under- or over-billing the remainder).
    if (isConformedBudgetOnlyUpdate) {
      const claimLineCount = await prisma.claimedLot.count({ where: { lotId: id } });
      if (claimLineCount > 0) {
        throw AppError.badRequest(
          'Cannot edit the budget of a lot that has already been included in a progress claim',
        );
      }
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
    if (activityType !== undefined) {
      updateData.activityType = activityType;
      // Wave C1 (§6): the folded slug never drifts from the free text — it is
      // written in the same statement, by the same helper every other write path
      // uses.
      updateData.activitySlug = activitySlugForWrite(activityType);
    }
    if (testScale !== undefined) updateData.testScale = testScale;
    if (materialType !== undefined) updateData.materialType = materialType;
    if (quantityValue !== undefined) updateData.quantityValue = quantityValue;
    if (quantityUnit !== undefined) updateData.quantityUnit = quantityUnit;
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
    // Legacy single-FK subcontractor assignment is retired: the modern per-lot
    // assignments UI is the only way to SET a subcontractor. Editors may still
    // CLEAR a stale legacy assignment (migration-friendly) — a non-null value is
    // ignored so a re-sent unchanged field never re-establishes a legacy write.
    // Clearing does NOT touch modern LotSubcontractorAssignment rows (those are
    // the source of truth). See docs/research/agentic-setup-synthesis-2026-07-15.md §1.
    if (assignedSubcontractorId === null && LOT_BUDGET_EDITORS.includes(userProjectRole)) {
      updateData.assignedSubcontractorId = null;
    }

    const auditUpdateData = { ...updateData };
    delete updateData.status;
    const updatedLot = await prisma.$transaction(async (tx) => {
      if (status !== undefined) {
        await transitionLotStatus(tx, {
          lotId: id,
          to: status,
          event: { actorId: user.id, source: 'user' },
        });
      }

      const select = {
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
      } as const;
      if (Object.keys(updateData).length > 0) {
        return tx.lot.update({ where: { id }, data: updateData, select });
      }
      return tx.lot.findUniqueOrThrow({ where: { id }, select });
    });

    const changedFields = Object.keys(auditUpdateData).sort();
    // C1 (F7): scale, quantity and activity classification all move the required
    // test count, so the audit record carries from/to — same shape as the
    // existing status/budget pairs. Quantity is logged as a value+unit pair
    // because either half alone is meaningless.
    const quantityChanged = quantityValue !== undefined || quantityUnit !== undefined;
    const quantityAudit = {
      from: {
        value: lot.quantityValue != null ? Number(lot.quantityValue) : null,
        unit: lot.quantityUnit ?? null,
      },
      to: {
        value:
          quantityValue !== undefined
            ? quantityValue
            : lot.quantityValue != null
              ? Number(lot.quantityValue)
              : null,
        unit: quantityUnit !== undefined ? quantityUnit : (lot.quantityUnit ?? null),
      },
    };
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
          ...(auditUpdateData.status !== undefined
            ? { status: { from: lot.status, to: updatedLot.status } }
            : {}),
          ...(auditUpdateData.budgetAmount !== undefined
            ? {
                budgetAmount: {
                  from: lot.budgetAmount != null ? Number(lot.budgetAmount) : null,
                  to: updatedLot.budgetAmount != null ? Number(updatedLot.budgetAmount) : null,
                },
              }
            : {}),
          ...(updateData.testScale !== undefined
            ? { testScale: { from: lot.testScale ?? null, to: testScale ?? null } }
            : {}),
          ...(updateData.materialType !== undefined
            ? { materialType: { from: lot.materialType ?? null, to: materialType ?? null } }
            : {}),
          ...(quantityChanged ? { quantity: quantityAudit } : {}),
          ...(updateData.activityType !== undefined
            ? {
                activity: {
                  from: { type: lot.activityType, slug: lot.activitySlug ?? null },
                  to: {
                    type: activityType,
                    slug: (updateData.activitySlug as string | null | undefined) ?? null,
                  },
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
