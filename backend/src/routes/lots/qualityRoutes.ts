import { Router } from 'express';
import type { Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { checkConformancePrerequisites } from '../../lib/conformancePrerequisites.js';
import { buildLotReadinessFromInputs } from '../../lib/evidenceReadiness.js';
import { prisma } from '../../lib/prisma.js';
import { getEffectiveProjectRole } from '../../lib/projectAccess.js';
import { PENDING_TEST_RESULT_STATUSES } from '../../lib/testResultStatus.js';
import {
  isSubcontractorUser,
  canViewLotBudget,
  requireSubcontractorLotPortalModules,
  requireProjectRole,
  requireLotReadAccess,
} from './access.js';
import { buildLotReadinessResponse, buildLotRoleResponse } from './remainingResponses.js';
import { parseLotRouteParam } from './requestParsing.js';
import { LOT_CONFORMERS, LOT_FORCE_CONFORMERS, STATUS_OVERRIDERS } from './roles.js';
import { buildLotConformedResponse, buildLotStatusOverrideResponse } from './statusResponses.js';
import { conformLotSchema, overrideStatusSchema } from './validation.js';

export const lotQualityRouter = Router();

const LOT_PHOTO_DOCUMENT_FILTER: Prisma.DocumentWhereInput = {
  OR: [
    { documentType: { contains: 'photo', mode: 'insensitive' } },
    { category: { contains: 'photo', mode: 'insensitive' } },
    { mimeType: { startsWith: 'image/' } },
  ],
};

// GET /api/lots/check-role/:projectId - Check user's role on a project
lotQualityRouter.get(
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
lotQualityRouter.get(
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
    const [
      conformStatus,
      unreleasedHoldPoints,
      releasedHoldPoints,
      documents,
      photos,
      pendingTests,
    ] = await Promise.all([
      checkConformancePrerequisites(id),
      prisma.holdPoint.count({ where: { lotId: id, status: { not: 'released' } } }),
      prisma.holdPoint.count({ where: { lotId: id, status: 'released' } }),
      prisma.document.count({ where: { lotId: id } }),
      prisma.document.count({ where: { lotId: id, ...LOT_PHOTO_DOCUMENT_FILTER } }),
      prisma.testResult.count({
        where: { lotId: id, status: { in: [...PENDING_TEST_RESULT_STATUSES] } },
      }),
    ]);

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
        unreleasedHoldPoints,
        releasedHoldPoints,
        approvedDockets: 0,
        diaryEntries: 0,
        documents,
        photos,
        pendingTests,
      },
    });

    res.json(buildLotReadinessResponse(readiness));
  }),
);

// GET /api/lots/:id/conform-status - Get lot conformance prerequisites status
lotQualityRouter.get(
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
lotQualityRouter.post(
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
      { requireWritable: true },
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
lotQualityRouter.post(
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
      { requireWritable: true },
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
