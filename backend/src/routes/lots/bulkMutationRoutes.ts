import { Router } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { requireProjectRole } from './access.js';
import {
  requireSubcontractorInProject,
  syncPrimaryLotSubcontractorAssignment,
} from './assignmentHelpers.js';
import { assertLotsBulkMutable } from './bulkMutationGuards.js';
import {
  buildLotsBulkStatusUpdatedResponse,
  buildLotsBulkSubcontractorAssignedResponse,
} from './bulkMutationResponses.js';
import { buildLegacyLotAssignmentMutationResponse } from './remainingResponses.js';
import {
  parseLotRouteParam,
  getUniqueLotIds,
  assertAllRequestedLotsFound,
} from './requestParsing.js';
import { LOT_CREATORS } from './roles.js';
import {
  bulkUpdateStatusSchema,
  bulkAssignSubcontractorSchema,
  assignSubcontractorSchema,
} from './validation.js';

export const lotBulkMutationRouter = Router();

// POST /api/lots/bulk-update-status - Bulk update lot status (requires creator role)
lotBulkMutationRouter.post(
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
        { requireWritable: true },
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
lotBulkMutationRouter.post(
  '/bulk-assign-subcontractor',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Validate request body
    const validation = bulkAssignSubcontractorSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { lotIds, subcontractorId, canCompleteITP, itpRequiresVerification } = validation.data;
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
        { requireWritable: true },
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
          canCompleteITP,
          itpRequiresVerification,
        });
      }

      return updateResult;
    });

    res.json(buildLotsBulkSubcontractorAssignedResponse(result.count, subcontractorId));
  }),
);

// POST /api/lots/:id/assign - Assign a subcontractor to a lot with notification
lotBulkMutationRouter.post(
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
      { requireWritable: true },
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
