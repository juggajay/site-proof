import { Router } from 'express';
import type { Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AuditAction } from '../../lib/auditLog.js';
import { checkConformancePrerequisites } from '../../lib/conformancePrerequisites.js';
import { buildLotReadinessFromInputs } from '../../lib/evidenceReadiness.js';
import { buildConformanceBlockerItems } from '../../lib/evidenceReadiness/conformanceItems.js';
import { isReleaseGatedChecklistItem } from '../../lib/holdPointReleaseGating.js';
import { holdPointTerminal } from '../../lib/readiness/predicates.js';
import { prismaRegimeStreamFetcher } from '../../lib/readiness/sufficiency/prismaStream.js';
import { recordDecision, type DecisionSnapshotInput } from '../../lib/readiness/recordDecision.js';
import {
  LOT_CONFORMANCE_REQUIREMENT_SET,
  LOT_CONFORMANCE_RESULT_SCHEMA_VERSION,
  buildLotConformanceResultV1,
} from '../../lib/readiness/requirements/lotConformance.v1.js';
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

type ConformanceEvaluation = Awaited<ReturnType<typeof checkConformancePrerequisites>>;

/**
 * The single `lot_conformance.v1` row every lot conformance decision records
 * (execution spec §11 F0.4b PR 1). `evaluate` produced this readiness INSIDE
 * the decision's serializable transaction, so it is what readiness genuinely
 * looked like at the instant the status changed — not a re-read taken after.
 */
function lotConformanceSnapshot(
  lotId: string,
  evaluation: ConformanceEvaluation,
  options: { overridden: boolean; reason?: string },
): DecisionSnapshotInput[] {
  return [
    {
      entityType: 'lot',
      entityId: lotId,
      requirementSet: LOT_CONFORMANCE_REQUIREMENT_SET,
      resultSchemaVersion: LOT_CONFORMANCE_RESULT_SCHEMA_VERSION,
      result: buildLotConformanceResultV1({
        canConform: Boolean(evaluation.canConform),
        items: evaluation.prerequisites
          ? buildConformanceBlockerItems(evaluation.prerequisites, evaluation.sufficiency)
          : [],
        overridden: options.overridden,
        reason: options.reason,
      }),
    },
  ];
}

/**
 * The optimistic guard missed: `update` matched no row, so the lot moved
 * between the pre-transaction read and the decision's write.
 *
 * NEW in F0.4b PR 1 — before it these routes issued a bare `prisma.lot.update`
 * by id, so two concurrent conforms could both report success. Distinct from
 * `recordDecision`'s own 409 `DECISION_CONFLICT` (serialization retries
 * exhausted); both tell the client the same thing: refresh and re-decide.
 */
function conflictIfGuardMissed(error: unknown): never {
  if ((error as { code?: unknown } | null)?.code === 'P2025') {
    throw AppError.conflict(
      'This lot changed while the decision was being recorded. Refresh and try again.',
    );
  }
  throw error;
}

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
      conformanceOverriddenAt: true,
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
    if (holdPoint && holdPointTerminal(holdPoint)) {
      return false;
    }

    return !hasDefaultRecipients && (!holdPoint || !holdPointHasRequestedRecipient(holdPoint));
  });

  // The management-prep count is the work still outstanding, so exclude
  // hold points already released/completed — otherwise the UI shows
  // "N hold points need release" beside "N hold points released".
  const outstandingManagementIds = releaseGatedIds.filter((itemId) => {
    const holdPoint = holdPointByItemId.get(itemId);
    return !(holdPoint && holdPointTerminal(holdPoint));
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
      // Wave C1 (§3.4.3 [C1R-B7]). The readiness read runs outside any
      // transaction, so this is where the frequency-stream history read is
      // allowed — and the only C1.1 path that supplies a fetcher.
      checkConformancePrerequisites(id, prisma, { regimeFetcher: prismaRegimeStreamFetcher() }),
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
        conformanceOverriddenAt: lot.conformanceOverriddenAt
          ? lot.conformanceOverriddenAt.toISOString()
          : null,
      },
      canViewCommercial,
      conformStatus: {
        canConform: Boolean(conformStatus.canConform),
        blockingReasons: conformStatus.blockingReasons ?? [],
        prerequisites: conformStatus.prerequisites,
      },
      sufficiency: conformStatus.sufficiency ?? null,
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

    // Authorization reads stay OUTSIDE the decision transaction: the
    // no-stale-readiness guarantee covers EVIDENCE, not permissions
    // (execution spec §11 F0.4b `[R3.1-R6]`).
    const lot = await prisma.lot.findUnique({
      where: { id },
      select: { id: true, lotNumber: true, status: true, projectId: true },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

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

    // A friendly, cheap rejection for the already-decided lot. It is no longer
    // the only thing between two concurrent conforms — the optimistic guard in
    // `mutate` below is, and it answers 409 rather than double-conforming.
    if (lot.status === 'conformed' || lot.status === 'claimed') {
      throw AppError.badRequest(`Lot is already ${lot.status}`);
    }

    const now = new Date();
    const decision = await recordDecision({
      projectId: lot.projectId,
      entityType: 'lot',
      entityId: id,
      // Force-conform is an `override`; `waiver` is reserved for future
      // explicit requirement waivers (spec §11 F0.4b PR 1 `[R3.1-B4]`).
      decisionKind: force ? 'override' : 'approval',
      auditAction: force ? AuditAction.LOT_FORCE_CONFORMED : AuditAction.LOT_STATUS_CHANGED,
      actor: { kind: 'user', userId: user.id },
      auditChanges: {
        lotNumber: lot.lotNumber,
        status: { from: lot.status, to: 'conformed' },
        force,
        ...(forceReason ? { reason: forceReason } : {}),
      },
      req,
      // The prerequisite gate now reads inside the decision transaction, so
      // evidence can no longer change between the check and the status write.
      evaluate: async (tx) => {
        const conformStatus = await checkConformancePrerequisites(id, tx);

        if (conformStatus.error) {
          throw AppError.notFound('Lot');
        }

        // Check prerequisites unless force flag is provided (only for admins)
        if (!conformStatus.canConform && !force) {
          throw AppError.badRequest('Cannot conform lot - prerequisites not met', {
            blockingReasons: conformStatus.blockingReasons as unknown as Record<string, unknown>,
            prerequisites: conformStatus.prerequisites as unknown as Record<string, unknown>,
          });
        }

        return conformStatus;
      },
      // Update lot status to conformed. A forced conform also persists the
      // override marker (reason validated >= 5 chars above) so the claim gate
      // can later distinguish a deliberate override from a regression. The
      // normal path never sets these columns (a not-yet-conformed lot has them
      // null).
      mutate: (tx) =>
        tx.lot
          .update({
            where: { id, status: { notIn: ['conformed', 'claimed'] } },
            data: {
              status: 'conformed',
              conformedAt: now,
              conformedBy: {
                connect: { id: user.id },
              },
              ...(force
                ? {
                    conformanceOverriddenAt: now,
                    conformanceOverriddenBy: { connect: { id: user.id } },
                    conformanceOverrideReason: forceReason,
                  }
                : {}),
            },
            select: {
              id: true,
              lotNumber: true,
              status: true,
              conformedAt: true,
            },
          })
          .catch(conflictIfGuardMissed),
      snapshots: (evaluation) =>
        lotConformanceSnapshot(id, evaluation, {
          overridden: Boolean(force),
          reason: forceReason,
        }),
    });

    // No requestKey on this route, so a replay is impossible and `mutation` is
    // always present (spec §11 F0.4b PR 1 — replay is inert flag-off `[R3.1-B2]`).
    const updatedLot = decision.mutation!;

    // Post-commit, fire-and-forget: never dispatched from inside the decision,
    // so a rolled-back or retried attempt cannot emit a user-visible signal.
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

    const decision = await recordDecision({
      projectId: lot.projectId,
      entityType: 'lot',
      entityId: id,
      // De-conform is an `override` too, never a `waiver` (`[R3.1-B4]`).
      decisionKind: 'override',
      auditAction: AuditAction.LOT_STATUS_CHANGED,
      actor: { kind: 'user', userId: user.id },
      auditChanges: {
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
      // Records what readiness looked like at the moment conformance was
      // withdrawn — the evidence side of "why was this de-conformed?".
      evaluate: async (tx) => {
        const conformStatus = await checkConformancePrerequisites(id, tx);

        if (conformStatus.error) {
          throw AppError.notFound('Lot');
        }

        return conformStatus;
      },
      // Update the lot status. Moving a conformed lot back to an operational
      // status also clears any force-conformance override marker, so a later
      // re-conform starts clean instead of silently inheriting the old
      // override. Pinned to the status this decision was made against, so a
      // concurrent transition (a claim, a re-conform) loses instead of being
      // silently overwritten.
      mutate: (tx) =>
        tx.lot
          .update({
            where: { id, status: previousStatus },
            data: {
              status,
              ...(clearsConformance
                ? {
                    conformedAt: null,
                    conformedById: null,
                    conformanceOverriddenAt: null,
                    conformanceOverriddenById: null,
                    conformanceOverrideReason: null,
                  }
                : {}),
            },
            select: {
              id: true,
              lotNumber: true,
              status: true,
              updatedAt: true,
            },
          })
          .catch(conflictIfGuardMissed),
      snapshots: (evaluation) =>
        lotConformanceSnapshot(id, evaluation, { overridden: true, reason: reason.trim() }),
    });

    // No requestKey on this route, so `mutation` is always present.
    const updatedLot = decision.mutation!;

    // Post-commit, fire-and-forget — never dispatched from inside the decision.
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
