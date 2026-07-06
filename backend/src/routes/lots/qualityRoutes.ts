import { Router } from 'express';
import type { Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { checkConformancePrerequisites } from '../../lib/conformancePrerequisites.js';
import { buildLotReadinessFromInputs } from '../../lib/evidenceReadiness.js';
import { isReleaseGatedChecklistItem } from '../../lib/holdPointReleaseGating.js';
import { prisma } from '../../lib/prisma.js';
import { getEffectiveProjectRole } from '../../lib/projectAccess.js';
import { PENDING_TEST_RESULT_STATUSES } from '../../lib/testResultStatus.js';
import { getChecklistItemsForInstance } from '../itp/helpers/templateSnapshot.js';
import {
  isValidEmailAddress,
  parseHPDefaultRecipients,
  parseHPProjectSettings,
  parseNotificationEmailList,
} from '../holdpoints/validation.js';
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
import { emitLotWebhookEvent } from './webhookEvents.js';

export const lotQualityRouter = Router();

const LOT_PHOTO_DOCUMENT_FILTER: Prisma.DocumentWhereInput = {
  OR: [
    { documentType: { contains: 'photo', mode: 'insensitive' } },
    { category: { contains: 'photo', mode: 'insensitive' } },
    { mimeType: { startsWith: 'image/' } },
  ],
};

const RELEASE_RECIPIENT_FALLBACK_PROJECT_ROLES = ['superintendent', 'project_manager'];
const TERMINAL_HOLD_POINT_STATUSES = new Set(['released', 'completed']);

type LotForManagementPrep = NonNullable<Awaited<ReturnType<typeof fetchLotReadinessRecord>>>;

function holdPointHasRequestedRecipient(holdPoint: { notificationSentTo: string | null }): boolean {
  return parseNotificationEmailList(holdPoint.notificationSentTo).some(isValidEmailAddress);
}

async function fetchLotReadinessRecord(id: string) {
  return prisma.lot.findUnique({
    where: { id },
    select: {
      id: true,
      lotNumber: true,
      status: true,
      projectId: true,
      budgetAmount: true,
      claimedInId: true,
      project: {
        select: {
          settings: true,
        },
      },
      holdPoints: {
        select: {
          itpChecklistItemId: true,
          notificationSentTo: true,
          status: true,
        },
      },
      itpInstance: {
        select: {
          templateSnapshot: true,
          template: {
            select: {
              checklistItems: {
                orderBy: { sequenceNumber: 'asc' },
                select: {
                  id: true,
                  description: true,
                  sequenceNumber: true,
                  pointType: true,
                  responsibleParty: true,
                  evidenceRequired: true,
                  acceptanceCriteria: true,
                  testType: true,
                },
              },
            },
          },
          completions: {
            select: {
              checklistItemId: true,
              attachments: {
                select: {
                  documentId: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

function buildManagementPrepSnapshot(lot: LotForManagementPrep, fallbackRecipientCount: number) {
  const checklistItems = lot.itpInstance ? getChecklistItemsForInstance(lot.itpInstance) : [];
  const releaseGatedItems = checklistItems.filter(isReleaseGatedChecklistItem);
  const releaseGatedIds = releaseGatedItems.map((item) => item.id);
  const releaseGatedIdSet = new Set(releaseGatedIds);
  const fieldActionableItemIds = checklistItems
    .filter((item) => !releaseGatedIdSet.has(item.id))
    .map((item) => item.id);

  const completionByItemId = new Map(
    (lot.itpInstance?.completions ?? []).map((completion) => [
      completion.checklistItemId,
      completion,
    ]),
  );
  const holdPointByItemId = new Map(
    lot.holdPoints.map((holdPoint) => [holdPoint.itpChecklistItemId, holdPoint]),
  );
  const projectSettings = parseHPProjectSettings(lot.project.settings);
  const hasDefaultRecipients =
    parseHPDefaultRecipients(projectSettings).length > 0 || fallbackRecipientCount > 0;

  const missingRequestEvidenceIds = releaseGatedIds.filter((itemId) => {
    const completion = completionByItemId.get(itemId);
    return (completion?.attachments.length ?? 0) === 0;
  });

  const missingRecipientIds = releaseGatedIds.filter((itemId) => {
    const holdPoint = holdPointByItemId.get(itemId);
    if (holdPoint && TERMINAL_HOLD_POINT_STATUSES.has(holdPoint.status)) {
      return false;
    }

    return !hasDefaultRecipients && (!holdPoint || !holdPointHasRequestedRecipient(holdPoint));
  });

  // The management-prep count is the work still outstanding, so exclude
  // hold points already released/completed — otherwise the UI shows
  // "N hold points need release" beside "N hold points released".
  const outstandingManagementIds = releaseGatedIds.filter((itemId) => {
    const holdPoint = holdPointByItemId.get(itemId);
    return !(holdPoint && TERMINAL_HOLD_POINT_STATUSES.has(holdPoint.status));
  });

  const holdPointsHref = `/projects/${encodeURIComponent(lot.projectId)}/hold-points?lotId=${encodeURIComponent(lot.id)}`;

  return {
    releaseGatedHoldPoints: releaseGatedIds.length,
    missingRequestEvidence: missingRequestEvidenceIds.length,
    missingRecipients: missingRecipientIds.length,
    fieldActionableItems: fieldActionableItemIds.length,
    managementOnlyItems: outstandingManagementIds.length,
    releaseGatedHoldPointIds: releaseGatedIds,
    missingRequestEvidenceIds,
    missingRecipientIds,
    fieldActionableItemIds,
    managementOnlyItemIds: outstandingManagementIds,
    holdPointsHref,
  };
}

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

    const lot = await fetchLotReadinessRecord(id);

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireSubcontractorLotPortalModules(user, lot.projectId, [
      'itps',
      'testResults',
      'ncrs',
    ]);
    await requireLotReadAccess(lot, user, 'You do not have access to this lot', [
      'lots',
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
      fallbackRecipientCount,
    ] = await Promise.all([
      checkConformancePrerequisites(id),
      prisma.holdPoint.count({ where: { lotId: id, status: { not: 'released' } } }),
      prisma.holdPoint.count({ where: { lotId: id, status: 'released' } }),
      prisma.document.count({ where: { lotId: id } }),
      prisma.document.count({ where: { lotId: id, ...LOT_PHOTO_DOCUMENT_FILTER } }),
      prisma.testResult.count({
        where: { lotId: id, status: { in: [...PENDING_TEST_RESULT_STATUSES] } },
      }),
      prisma.projectUser.count({
        where: {
          projectId: lot.projectId,
          status: 'active',
          role: { in: RELEASE_RECIPIENT_FALLBACK_PROJECT_ROLES },
        },
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
      managementPrep: buildManagementPrepSnapshot(lot, fallbackRecipientCount),
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

    await requireSubcontractorLotPortalModules(user, lot.projectId, [
      'itps',
      'testResults',
      'ncrs',
    ]);
    await requireLotReadAccess(lot, user, 'You do not have access to this lot', [
      'lots',
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

    emitLotWebhookEvent(lot.projectId, 'lot.updated', {
      lotId: updatedLot.id,
      projectId: lot.projectId,
      lotNumber: lot.lotNumber,
      status: updatedLot.status,
      actorUserId: user.id,
      action: force ? 'force_conformed' : 'conformed',
      changedFields: ['conformedAt', 'conformedById', 'status'],
      previousStatus: lot.status,
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
    // Overriding a conformed lot back to an operational status (the override
    // target is always operational — never 'conformed') must clear the
    // conformance stamp, otherwise the lot keeps showing "Conformed by X on Y"
    // (stale audit/compliance data) while no longer conformed.
    const clearsConformance = previousStatus === 'conformed';

    // Update the lot status
    const updatedLot = await prisma.lot.update({
      where: { id },
      data: {
        status,
        ...(clearsConformance ? { conformedAt: null, conformedById: null } : {}),
      },
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
        ...(clearsConformance ? { conformanceReset: true } : {}),
      },
      req,
    });

    emitLotWebhookEvent(lot.projectId, 'lot.updated', {
      lotId: updatedLot.id,
      projectId: lot.projectId,
      lotNumber: updatedLot.lotNumber,
      status: updatedLot.status,
      actorUserId: user.id,
      action: 'status_override',
      changedFields: clearsConformance ? ['status', 'conformedAt', 'conformedById'] : ['status'],
      previousStatus,
    });

    res.json(buildLotStatusOverrideResponse(updatedLot, previousStatus, reason));
  }),
);
