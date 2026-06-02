import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { checkConformancePrerequisites } from '../lib/conformancePrerequisites.js';
import { buildLotReadinessFromInputs } from '../lib/evidenceReadiness.js';
import { getEffectiveProjectRole } from '../lib/projectAccess.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { assertLotDeletable, assertLotsBulkDeletable } from '../lib/lotDeletion.js';
import {
  updateLotSchema,
  bulkDeleteSchema,
  bulkUpdateStatusSchema,
  bulkAssignSubcontractorSchema,
  assignSubcontractorSchema,
  conformLotSchema,
  overrideStatusSchema,
} from './lots/validation.js';
import {
  isSubcontractorUser,
  canViewLotBudget,
  requireSubcontractorLotPortalModules,
  requireProjectRole,
  requireLotReadAccess,
} from './lots/access.js';
import {
  parseLotRouteParam,
  getUniqueLotIds,
  assertAllRequestedLotsFound,
} from './lots/requestParsing.js';
import {
  requireSubcontractorInProject,
  syncPrimaryLotSubcontractorAssignment,
} from './lots/assignmentHelpers.js';
import {
  LOT_EDITORS,
  LOT_BUDGET_EDITORS,
  CONFORMED_LOT_BUDGET_EDIT_FIELDS,
  getProvidedUpdateFields,
} from './lots/updateFields.js';
import {
  LOT_CREATORS,
  LOT_DELETERS,
  LOT_CONFORMERS,
  LOT_FORCE_CONFORMERS,
  STATUS_OVERRIDERS,
} from './lots/roles.js';
import { assertLotsBulkMutable } from './lots/bulkMutationGuards.js';
import {
  buildLotsBulkDeletedResponse,
  buildLotsBulkStatusUpdatedResponse,
  buildLotsBulkSubcontractorAssignedResponse,
} from './lots/bulkMutationResponses.js';
import {
  buildLotConformedResponse,
  buildLotStatusOverrideResponse,
} from './lots/statusResponses.js';
import { buildLotDeletedResponse } from './lots/coreResponses.js';
import {
  buildLegacyLotAssignmentMutationResponse,
  buildLotReadinessResponse,
  buildLotRoleResponse,
  buildLotUpdatedResponse,
} from './lots/remainingResponses.js';
import { lotReadRouter } from './lots/readRoutes.js';
import { lotCreateRouter } from './lots/createRoutes.js';
import { lotSubcontractorAssignmentsRouter } from './lots/subcontractorAssignments.js';

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
        status: true,
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

    res.json(buildLotUpdatedResponse(updatedLot, canViewLotBudget(userProjectRole)));
  }),
);

// DELETE /api/lots/:id - Delete a lot (requires deleter role)
// Feature #585: Added docket allocation integrity check
lotsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    const lot = await prisma.lot.findUnique({
      where: { id },
      include: {
        // Check for actual hold point records that aren't released
        holdPoints: {
          where: {
            status: { not: 'released' },
          },
        },
        // Also check for ITP instances with hold point items (virtual hold points)
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  where: { pointType: 'hold_point' },
                },
              },
            },
            completions: {
              where: {
                checklistItem: { pointType: 'hold_point' },
              },
            },
          },
        },
        // Check for docket allocations
        docketLabourLots: {
          select: { id: true },
        },
        docketPlantLots: {
          select: { id: true },
        },
      },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireProjectRole(
      lot.projectId,
      user,
      LOT_DELETERS,
      'You do not have permission to delete lots',
    );

    // Block deletion when the lot is conformed/claimed, has unreleased hold
    // points, or carries docket allocations.
    assertLotDeletable(lot);

    await prisma.lot.delete({
      where: { id },
    });

    res.json(buildLotDeletedResponse());
  }),
);

// POST /api/lots/bulk-delete - Bulk delete lots (requires deleter role)
lotsRouter.post(
  '/bulk-delete',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Validate request body
    const validation = bulkDeleteSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { lotIds } = validation.data;
    const uniqueLotIds = getUniqueLotIds(lotIds);

    // Check that lots exist and can be deleted (not conformed or claimed)
    const lotsToDelete = await prisma.lot.findMany({
      where: {
        id: { in: uniqueLotIds },
      },
      select: {
        id: true,
        projectId: true,
        lotNumber: true,
        status: true,
        holdPoints: {
          where: {
            status: { not: 'released' },
          },
          select: { id: true },
        },
        itpInstance: {
          select: {
            template: {
              select: {
                checklistItems: {
                  where: { pointType: 'hold_point' },
                  select: { id: true },
                },
              },
            },
            completions: {
              where: {
                checklistItem: { pointType: 'hold_point' },
              },
              select: {
                checklistItemId: true,
                verificationStatus: true,
              },
            },
          },
        },
        docketLabourLots: {
          select: { id: true },
        },
        docketPlantLots: {
          select: { id: true },
        },
      },
    });
    assertAllRequestedLotsFound(uniqueLotIds, lotsToDelete);

    const projectIds = [...new Set(lotsToDelete.map((lot) => lot.projectId))];
    for (const projectId of projectIds) {
      await requireProjectRole(
        projectId,
        user,
        LOT_DELETERS,
        'You do not have permission to delete lots',
      );
    }

    // Block the bulk delete when any requested lot is conformed/claimed, has
    // unreleased hold points, or carries docket allocations.
    assertLotsBulkDeletable(lotsToDelete);

    // Delete all lots in a transaction
    const result = await prisma.lot.deleteMany({
      where: {
        id: { in: uniqueLotIds },
        status: { notIn: ['conformed', 'claimed'] },
      },
    });

    res.json(buildLotsBulkDeletedResponse(result.count));
  }),
);

// POST /api/lots/bulk-update-status - Bulk update lot status (requires creator role)
lotsRouter.post(
  '/bulk-update-status',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Validate request body
    const validation = bulkUpdateStatusSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { lotIds, status } = validation.data;
    const uniqueLotIds = getUniqueLotIds(lotIds);

    // Check that lots exist and can be updated (not conformed or claimed)
    const lotsToUpdate = await prisma.lot.findMany({
      where: {
        id: { in: uniqueLotIds },
      },
      select: {
        id: true,
        projectId: true,
        lotNumber: true,
        status: true,
      },
    });
    assertAllRequestedLotsFound(uniqueLotIds, lotsToUpdate);

    const projectIds = [...new Set(lotsToUpdate.map((lot) => lot.projectId))];
    for (const projectId of projectIds) {
      await requireProjectRole(
        projectId,
        user,
        LOT_CREATORS,
        'You do not have permission to update lots',
      );
    }

    // Block lots that cannot be bulk-mutated (conformed or claimed)
    assertLotsBulkMutable(lotsToUpdate);

    // Update all lots
    const result = await prisma.lot.updateMany({
      where: {
        id: { in: uniqueLotIds },
        status: { notIn: ['conformed', 'claimed'] },
      },
      data: {
        status: status,
        updatedAt: new Date(),
      },
    });

    res.json(buildLotsBulkStatusUpdatedResponse(result.count, status));
  }),
);

// POST /api/lots/bulk-assign-subcontractor - Bulk assign lots to subcontractor (requires creator role)
lotsRouter.post(
  '/bulk-assign-subcontractor',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Validate request body
    const validation = bulkAssignSubcontractorSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { lotIds, subcontractorId } = validation.data;
    const uniqueLotIds = getUniqueLotIds(lotIds);

    // Check that lots exist and can be updated (not conformed or claimed)
    const lotsToUpdate = await prisma.lot.findMany({
      where: {
        id: { in: uniqueLotIds },
      },
      select: {
        id: true,
        projectId: true,
        lotNumber: true,
        status: true,
      },
    });
    assertAllRequestedLotsFound(uniqueLotIds, lotsToUpdate);

    const projectIds = [...new Set(lotsToUpdate.map((lot) => lot.projectId))];
    for (const projectId of projectIds) {
      await requireProjectRole(
        projectId,
        user,
        ['owner', 'admin', 'project_manager', 'site_manager'],
        'You do not have permission to assign lots',
      );
    }

    if (subcontractorId) {
      if (projectIds.length !== 1) {
        throw AppError.badRequest(
          'Bulk subcontractor assignment must target lots in a single project',
        );
      }
      await requireSubcontractorInProject(subcontractorId, projectIds[0]);
    }

    // Block lots that cannot be bulk-mutated (conformed or claimed)
    assertLotsBulkMutable(lotsToUpdate);

    // Update all lots and keep assignment records in sync with the legacy field.
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.lot.updateMany({
        where: {
          id: { in: uniqueLotIds },
          status: { notIn: ['conformed', 'claimed'] },
        },
        data: {
          assignedSubcontractorId: subcontractorId || null,
          updatedAt: new Date(),
        },
      });

      for (const lot of lotsToUpdate) {
        await syncPrimaryLotSubcontractorAssignment(tx, {
          lotId: lot.id,
          projectId: lot.projectId,
          subcontractorId,
          assignedById: user.id,
        });
      }

      return updateResult;
    });

    res.json(buildLotsBulkSubcontractorAssignedResponse(result.count, subcontractorId));
  }),
);

// POST /api/lots/:id/assign - Assign a subcontractor to a lot with notification
lotsRouter.post(
  '/:id/assign',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const validation = assignSubcontractorSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { subcontractorId } = validation.data;

    // Get the lot with project info
    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        lotNumber: true,
        description: true,
        status: true,
        projectId: true,
        assignedSubcontractorId: true,
      },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    // Don't allow assigning terminal lots
    if (lot.status === 'conformed' || lot.status === 'claimed') {
      throw AppError.badRequest(`Cannot assign a ${lot.status} lot`);
    }

    await requireProjectRole(
      lot.projectId,
      user,
      ['owner', 'admin', 'project_manager', 'site_manager'],
      'You do not have permission to assign lots',
    );

    if (subcontractorId) {
      await requireSubcontractorInProject(subcontractorId, lot.projectId);
    }

    // Update the lot and keep the new assignment table aligned with the legacy field.
    const updatedLot = await prisma.$transaction(async (tx) => {
      await syncPrimaryLotSubcontractorAssignment(tx, {
        lotId: id,
        projectId: lot.projectId,
        subcontractorId,
        assignedById: user.id,
      });

      return tx.lot.update({
        where: { id },
        data: {
          assignedSubcontractorId: subcontractorId || null,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          lotNumber: true,
          description: true,
          status: true,
          assignedSubcontractorId: true,
          assignedSubcontractor: {
            select: {
              id: true,
              companyName: true,
            },
          },
        },
      });
    });

    // If assigning (not unassigning), send notifications to subcontractor users
    if (subcontractorId) {
      // Find all users linked to this subcontractor company
      const subcontractorUsers = await prisma.subcontractorUser.findMany({
        where: {
          subcontractorCompanyId: subcontractorId,
        },
        select: {
          userId: true,
        },
      });

      if (subcontractorUsers.length > 0) {
        // Get assigner info
        const assignerName = user.fullName || user.email || 'A project manager';

        // Create notifications for all subcontractor users
        await prisma.notification.createMany({
          data: subcontractorUsers.map((su) => ({
            userId: su.userId,
            projectId: lot.projectId,
            type: 'lot_assigned',
            title: 'Lot Assigned to Your Company',
            message: `${assignerName} assigned lot ${lot.lotNumber}${lot.description ? ` (${lot.description})` : ''} to your company.`,
            linkUrl: `/projects/${lot.projectId}/lots/${lot.id}`,
          })),
        });
      }

      // Record in audit log
      await prisma.auditLog.create({
        data: {
          projectId: lot.projectId,
          userId: user.id,
          entityType: 'Lot',
          entityId: id,
          action: 'subcontractor_assigned',
          changes: JSON.stringify({
            lotNumber: lot.lotNumber,
            subcontractorId,
            subcontractorName: updatedLot.assignedSubcontractor?.companyName,
            previousSubcontractorId: lot.assignedSubcontractorId,
            assignedBy: user.email,
          }),
        },
      });
    }

    res.json(buildLegacyLotAssignmentMutationResponse(subcontractorId, updatedLot));
  }),
);

// GET /api/lots/check-role/:projectId - Check user's role on a project
lotsRouter.get(
  '/check-role/:projectId',
  asyncHandler(async (req, res) => {
    const projectId = parseLotRouteParam(req.params.projectId, 'projectId');
    const user = req.user!;

    const role = await getEffectiveProjectRole(user, projectId, {
      excludeSubcontractorProjectMemberships: true,
      throwIfProjectMissing: true,
    });
    if (!role) {
      throw AppError.forbidden('You do not have access to this project');
    }

    // Check quality management permissions
    const isQualityManager = role === 'quality_manager';
    const canConformLots = LOT_CONFORMERS.includes(role);
    const canVerifyTestResults = LOT_CONFORMERS.includes(role);
    const canCloseNCRs = LOT_CONFORMERS.includes(role);
    const canManageITPTemplates = LOT_CONFORMERS.includes(role);

    res.json(
      buildLotRoleResponse(
        role,
        isQualityManager,
        canConformLots,
        canVerifyTestResults,
        canCloseNCRs,
        canManageITPTemplates,
      ),
    );
  }),
);

// GET /api/lots/:id/readiness - Get deterministic evidence readiness for a lot
lotsRouter.get(
  '/:id/readiness',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        projectId: true,
        budgetAmount: true,
        claimedInId: true,
        holdPoints: {
          select: { status: true },
        },
        documents: {
          select: {
            documentType: true,
            category: true,
            mimeType: true,
          },
        },
        testResults: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireLotReadAccess(lot, user);
    await requireSubcontractorLotPortalModules(user, lot.projectId, [
      'itps',
      'testResults',
      'ncrs',
    ]);

    const effectiveProjectRole = isSubcontractorUser(user)
      ? null
      : await getEffectiveProjectRole(user, lot.projectId, {
          excludeSubcontractorProjectMemberships: true,
          throwIfProjectMissing: true,
        });
    const canViewCommercial = !isSubcontractorUser(user) && canViewLotBudget(effectiveProjectRole);
    const conformStatus = await checkConformancePrerequisites(id);

    if (!conformStatus.prerequisites) {
      throw AppError.notFound('Lot');
    }

    const readiness = buildLotReadinessFromInputs({
      lot: {
        id: lot.id,
        lotNumber: lot.lotNumber,
        status: lot.status,
        budgetAmount: lot.budgetAmount === null ? null : Number(lot.budgetAmount),
        claimedInId: lot.claimedInId,
      },
      canViewCommercial,
      conformStatus: {
        canConform: Boolean(conformStatus.canConform),
        blockingReasons: conformStatus.blockingReasons ?? [],
        prerequisites: conformStatus.prerequisites,
      },
      evidenceCounts: {
        unreleasedHoldPoints: lot.holdPoints.filter((holdPoint) => holdPoint.status !== 'released')
          .length,
        releasedHoldPoints: lot.holdPoints.filter((holdPoint) => holdPoint.status === 'released')
          .length,
        approvedDockets: 0,
        diaryEntries: 0,
        documents: lot.documents.length,
        photos: lot.documents.filter((document) => {
          const type = `${document.documentType ?? ''} ${document.category ?? ''} ${
            document.mimeType ?? ''
          }`.toLowerCase();
          return type.includes('photo') || type.includes('image/');
        }).length,
        pendingTests: lot.testResults.filter((test) =>
          ['pending', 'requested', 'submitted'].includes(test.status),
        ).length,
      },
    });

    res.json(buildLotReadinessResponse(readiness));
  }),
);

// GET /api/lots/:id/conform-status - Get lot conformance prerequisites status
lotsRouter.get(
  '/:id/conform-status',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    const lot = await prisma.lot.findUnique({
      where: { id },
      select: { id: true, projectId: true },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireLotReadAccess(lot, user);
    await requireSubcontractorLotPortalModules(user, lot.projectId, [
      'itps',
      'testResults',
      'ncrs',
    ]);

    const result = await checkConformancePrerequisites(id);

    res.json(result);
  }),
);

// POST /api/lots/:id/conform - Conform a lot (quality management)
lotsRouter.post(
  '/:id/conform',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const validation = conformLotSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { force, reason } = validation.data; // Optional force parameter to skip prerequisite check
    const forceReason = reason?.trim();

    if (force && (!forceReason || forceReason.length < 5)) {
      throw AppError.badRequest(
        'Force conform reason is required and must be at least 5 characters',
      );
    }

    // Check conformance prerequisites first
    const conformStatus = await checkConformancePrerequisites(id);

    if (conformStatus.error) {
      throw AppError.notFound('Lot');
    }

    const lot = conformStatus.lot!;

    const role = await requireProjectRole(
      lot.projectId,
      user,
      LOT_CONFORMERS,
      'You do not have permission to conform lots. Required roles: Quality Manager, Project Manager, Admin, or Owner.',
    );

    if (force && !LOT_FORCE_CONFORMERS.includes(role)) {
      throw AppError.forbidden('Only project admins or owners can force lot conformance');
    }

    // Check if lot is already conformed or claimed
    if (lot.status === 'conformed' || lot.status === 'claimed') {
      throw AppError.badRequest(`Lot is already ${lot.status}`);
    }

    // Check prerequisites unless force flag is provided (only for admins)
    if (!conformStatus.canConform && !force) {
      throw AppError.badRequest('Cannot conform lot - prerequisites not met', {
        blockingReasons: conformStatus.blockingReasons as unknown as Record<string, unknown>,
        prerequisites: conformStatus.prerequisites as unknown as Record<string, unknown>,
      });
    }

    // Update lot status to conformed
    const updatedLot = await prisma.lot.update({
      where: { id },
      data: {
        status: 'conformed',
        conformedAt: new Date(),
        conformedBy: {
          connect: { id: user.id },
        },
      },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        conformedAt: true,
      },
    });

    await createAuditLog({
      projectId: lot.projectId,
      userId: user.id,
      entityType: 'lot',
      entityId: updatedLot.id,
      action: force ? AuditAction.LOT_FORCE_CONFORMED : AuditAction.LOT_STATUS_CHANGED,
      changes: {
        lotNumber: lot.lotNumber,
        status: { from: lot.status, to: updatedLot.status },
        force,
        ...(forceReason ? { reason: forceReason } : {}),
      },
      req,
    });

    res.json(buildLotConformedResponse(updatedLot));
  }),
);

// POST /api/lots/:id/override-status - Manual status override with reason (Feature #159)
lotsRouter.post(
  '/:id/override-status',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const validation = overrideStatusSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { status, reason } = validation.data;

    // Get the lot
    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        projectId: true,
      },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    // Don't allow overriding claimed lots
    if (lot.status === 'claimed') {
      throw AppError.badRequest('Cannot override status of a claimed lot');
    }

    await requireProjectRole(
      lot.projectId,
      user,
      STATUS_OVERRIDERS,
      'You do not have permission to override lot status. Required roles: Quality Manager, Project Manager, Admin, or Owner.',
    );

    const previousStatus = lot.status;

    // Update the lot status
    const updatedLot = await prisma.lot.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        updatedAt: true,
      },
    });

    await createAuditLog({
      projectId: lot.projectId,
      userId: user.id,
      entityType: 'lot',
      entityId: id,
      action: AuditAction.LOT_STATUS_CHANGED,
      changes: {
        lotNumber: lot.lotNumber,
        status: {
          from: previousStatus,
          to: status,
        },
        reason: reason.trim(),
        override: true,
      },
      req,
    });

    res.json(buildLotStatusOverrideResponse(updatedLot, previousStatus, reason));
  }),
);

// Lot subcontractor assignment routes (mounted after requireAuth above). See ./lots/subcontractorAssignments.ts
lotsRouter.use(lotSubcontractorAssignmentsRouter);
