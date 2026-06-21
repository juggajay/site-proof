import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { assertLotDeletable, assertLotsBulkDeletable } from '../../lib/lotDeletion.js';
import { bulkDeleteSchema } from './validation.js';
import { requireProjectRole } from './access.js';
import {
  parseLotRouteParam,
  getUniqueLotIds,
  assertAllRequestedLotsFound,
} from './requestParsing.js';
import { LOT_DELETERS } from './roles.js';
import { buildLotDeletedResponse } from './coreResponses.js';
import { buildLotsBulkDeletedResponse } from './bulkMutationResponses.js';

export const lotDeleteRouter = Router();

// DELETE /api/lots/:id - Delete a lot (requires deleter role)
// Feature #585: Added docket allocation integrity check
lotDeleteRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    const lot = await prisma.lot.findUnique({
      where: { id },
      include: {
        // Fetch all hold point records: unreleased records block active work,
        // released records block deletion because release evidence is retained.
        holdPoints: {
          select: {
            id: true,
            status: true,
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
      { requireWritable: true },
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
lotDeleteRouter.post(
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
          select: { id: true, status: true },
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
        { requireWritable: true },
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
