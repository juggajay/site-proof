// NCR closure workflow transitions: QM approval, closure, client notification, reopen
import type { Prisma } from '@prisma/client';
import { Router, type Request, type Response } from 'express';

import { type AuthUser } from '../../lib/auth.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { sendEmail } from '../../lib/email.js';
import { assertProjectAllowsWrite } from '../../lib/projectAccess.js';
import { prisma } from '../../lib/prisma.js';
import { ncrSerious } from '../../lib/readiness/predicates.js';
import { recordDecision, type DecisionSnapshotInput } from '../../lib/readiness/recordDecision.js';
import {
  NCR_CLOSURE_REQUIREMENT_SET,
  NCR_CLOSURE_RESULT_SCHEMA_VERSION,
  buildNcrClosureResultV1,
} from '../../lib/readiness/requirements/ncrClosure.v1.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import {
  NCR_QM_APPROVAL_ROLES,
  NCR_QUALITY_MANAGEMENT_ROLES,
  parseNcrRouteParam,
  requireActiveProjectUser,
  requireNcrResponsibleOrProjectRole,
} from './ncrAccess.js';
import {
  buildNcrClientNotificationResponse,
  buildNcrClosedResponse,
  buildNcrSubmittedForVerificationResponse,
  buildNcrWorkflowMessageResponse,
  buildNcrWorkflowResponse,
} from './ncrWorkflowResponses.js';
import { emitNcrWebhookEvent } from './webhookEvents.js';
import {
  closeNcrSchema,
  notifyClientSchema,
  reopenNcrSchema,
  requireMajorConcessionClientApproval,
  submitForVerificationSchema,
} from './ncrWorkflowValidation.js';
import { claimNcrVerificationSubmission } from './ncrVerificationSubmission.js';
import { getLotStatusAfterNcrClosure } from './ncrLotStatus.js';
import { assertAfterEvidencePresent } from './ncrEvidencePhase.js';

export const ncrClosureWorkflowRouter = Router();

async function claimClientNotification(ncrId: string, notificationTime: Date) {
  const notificationClaim = await prisma.nCR.updateMany({
    where: { id: ncrId, clientNotificationRequired: true, clientNotifiedAt: null },
    data: { clientNotifiedAt: notificationTime },
  });

  if (notificationClaim.count === 1) {
    return;
  }

  const currentNcr = await prisma.nCR.findUnique({
    where: { id: ncrId },
    select: { clientNotifiedAt: true },
  });

  if (currentNcr?.clientNotifiedAt) {
    throw AppError.badRequest(
      `Client was already notified on ${currentNcr.clientNotifiedAt.toLocaleDateString('en-AU')}`,
    );
  }

  throw AppError.badRequest('Client notification state changed. Please retry.');
}

async function releaseClientNotificationClaim(ncrId: string, notificationTime: Date) {
  await prisma.nCR.updateMany({
    where: { id: ncrId, clientNotifiedAt: notificationTime },
    data: { clientNotifiedAt: null },
  });
}

async function ensureQmApprovalClaimed(
  ncrId: string,
  updateCount: number,
  client: Pick<typeof prisma, 'nCR'> = prisma,
) {
  if (updateCount === 1) {
    return;
  }

  const currentNcr = await client.nCR.findUnique({
    where: { id: ncrId },
    select: { qmApprovedAt: true },
  });

  if (currentNcr?.qmApprovedAt) {
    throw AppError.badRequest('This NCR has already been approved by QM');
  }

  throw AppError.badRequest('QM approval state changed. Please retry.');
}

async function ensureCloseClaimed(
  ncrId: string,
  updateCount: number,
  client: Pick<typeof prisma, 'nCR'> = prisma,
) {
  if (updateCount === 1) {
    return;
  }

  const currentNcr = await client.nCR.findUnique({
    where: { id: ncrId },
    select: { status: true, _count: { select: { ncrEvidence: true } } },
  });

  // The close guard also requires evidence to exist; distinguish that cause so
  // the caller isn't told the status is wrong when it is actually evidence that
  // is missing (e.g. the last evidence was pulled during verification).
  if (currentNcr?.status === 'verification' && currentNcr._count.ncrEvidence === 0) {
    throw AppError.badRequest(
      'This NCR has no rectification evidence attached and cannot be closed.',
      { evidenceCount: 0 },
    );
  }

  throw AppError.badRequest('NCR must be in verification status to close', {
    currentStatus: currentNcr?.status,
  });
}

async function ensureReopenClaimed(updateCount: number) {
  if (updateCount === 1) {
    return;
  }

  throw AppError.badRequest('NCR is not closed');
}

interface NcrQmApprovalState {
  status: string;
  qmApprovalRequired: boolean;
  qmApprovedAt: Date | null;
}

interface NcrCloseState extends NcrQmApprovalState {
  severity: string;
  qmApprovedById: string | null;
  clientNotificationRequired: boolean;
  clientNotifiedAt: Date | null;
  ncrEvidence: ReadonlyArray<{ evidenceType: string }>;
}

/**
 * The QM-approval gates that read NCR STATE. Called twice (F0.4b PR 2): once on
 * the pre-transaction read for a cheap rejection, once inside `evaluate(tx)` so
 * the decision is made against the row it actually writes.
 */
function assertNcrQmApprovable(ncr: NcrQmApprovalState): void {
  if (!ncr.qmApprovalRequired) {
    throw AppError.badRequest('This NCR does not require QM approval');
  }

  if (ncr.qmApprovedAt) {
    throw AppError.badRequest('This NCR has already been approved by QM');
  }

  if (ncr.status !== 'verification') {
    throw AppError.badRequest('NCR must be in verification status before QM approval', {
      currentStatus: ncr.status,
    });
  }
}

/**
 * The closure gates that read NCR STATE rather than permissions: verification
 * status, the major-NCR QM approval and its segregation of duties, M27 client
 * notification, H9 concession client approval.
 *
 * Called twice for the same reason as {@link assertNcrQmApprovable}. Role and
 * membership reads stay OUTSIDE the decision transaction — the
 * no-stale-readiness guarantee covers evidence, not permissions (execution spec
 * §11 F0.4b `[R3.1-R6]`). The segregation-of-duties comparison lives here rather
 * than with those role reads because it is a comparison against NCR columns this
 * function already holds, not a permissions lookup.
 *
 * Returns whether the M27 client-notification requirement was overridden, which
 * the caller records in the audit row.
 */
interface NcrCloseGateOptions {
  userId: string;
  withConcession?: boolean;
  overrideClientNotification?: boolean;
  clientApprovalReference?: string;
}

function assertNcrClosable(
  ncr: NcrCloseState,
  options: NcrCloseGateOptions,
): { clientNotificationOverridden: boolean } {
  // Closing is the final verification decision; rectification must be submitted first.
  if (ncr.status !== 'verification') {
    throw AppError.badRequest('NCR must be in verification status to close', {
      currentStatus: ncr.status,
    });
  }

  // The rectification must be evidenced by something that isn't a "before" photo.
  // Concession closes are exempt — see assertAfterEvidencePresent.
  assertAfterEvidencePresent(ncr.ncrEvidence, { withConcession: options.withConcession });

  // CRITICAL: For major NCRs, require independent QM approval before closing.
  if (ncr.severity === 'major' && ncr.qmApprovalRequired) {
    if (!ncr.qmApprovedAt || !ncr.qmApprovedById) {
      throw AppError.forbidden(
        'Major NCRs require Quality Manager approval before closure. Please request QM approval first.',
      );
    }

    if (ncr.qmApprovedById === options.userId) {
      throw AppError.forbidden(
        'Major NCR closure must be completed by a different user than the QM approver.',
      );
    }
  }

  // M27: don't let a "client notification required" NCR be closed before the
  // client was actually notified, unless the closer supplies an explicit,
  // reasoned override (audited by the caller).
  const clientNotificationOutstanding = ncr.clientNotificationRequired && !ncr.clientNotifiedAt;
  if (clientNotificationOutstanding && !options.overrideClientNotification) {
    throw AppError.badRequest(
      'This NCR requires client notification before it can be closed. Record the client notification, or close with an explicit override and reason.',
      { clientNotificationRequired: true, clientNotifiedAt: null },
    );
  }

  // H9: a major NCR accepted by concession must carry the client's approval
  // reference, so an accepted major defect has a durable record of sign-off.
  requireMajorConcessionClientApproval({
    severity: ncr.severity,
    withConcession: options.withConcession,
    clientApprovalReference: options.clientApprovalReference,
  });

  return { clientNotificationOverridden: clientNotificationOutstanding };
}

/**
 * Every input a closure decision depends on, read INSIDE the decision's
 * serializable transaction: the gate columns AND the affected lots' statuses.
 *
 * Before F0.4b PR 2 the lot side came from the route's pre-transaction read, so
 * a lot that moved in between was cascaded on stale data. Reading it here means
 * a lot (or another NCR on it) moving mid-decision conflicts and retries against
 * fresh data instead.
 */
async function evaluateNcrClosure(
  tx: Prisma.TransactionClient,
  ncrId: string,
  gate: NcrCloseGateOptions,
) {
  const current = await tx.nCR.findUnique({
    where: { id: ncrId },
    select: {
      severity: true,
      status: true,
      qmApprovalRequired: true,
      qmApprovedAt: true,
      qmApprovedById: true,
      clientNotificationRequired: true,
      clientNotifiedAt: true,
      ncrEvidence: { select: { evidenceType: true } },
      ncrLots: { select: { lotId: true, lot: { select: { status: true } } } },
    },
  });

  if (!current) {
    throw AppError.notFound('NCR not found');
  }

  assertNcrClosable(current, gate);

  // Which affected lots this closure may clear, and to what. A lot another NCR
  // still holds open is left alone and counted as a blocker.
  const cascade: Array<{ lotId: string; nextStatus: string }> = [];
  let lotsWithOtherOpenNcrs = 0;

  for (const ncrLot of current.ncrLots) {
    const otherOpenNcrs = await tx.nCRLot.count({
      where: {
        lotId: ncrLot.lotId,
        ncr: { id: { not: ncrId }, status: { notIn: ['closed', 'closed_concession'] } },
      },
    });

    if (otherOpenNcrs > 0) {
      lotsWithOtherOpenNcrs += 1;
      continue;
    }

    // No other open NCRs, so clear the NCR-raised state without reopening
    // terminal lots.
    const nextStatus = getLotStatusAfterNcrClosure(ncrLot.lot.status);
    if (nextStatus) {
      cascade.push({ lotId: ncrLot.lotId, nextStatus });
    }
  }

  return {
    serious: ncrSerious(current),
    affectedLotCount: current.ncrLots.length,
    lotsWithOtherOpenNcrs,
    cascade,
  };
}

/**
 * The single `ncr_closure.v1` row every NCR closure/concession/QM-approval
 * decision records (execution spec §11 F0.4b PR 2). The grain is `ncr` ONLY —
 * the lots this closure cascades over get no snapshot row of their own, they are
 * carried as `affectedLotCount`.
 *
 * `evaluate` produced these numbers INSIDE the decision's serializable
 * transaction, so they are what readiness genuinely looked like at the instant
 * the status changed.
 */
function ncrClosureSnapshot(
  ncrId: string,
  evaluation: {
    closed: boolean;
    byConcession?: boolean;
    serious: boolean;
    affectedLotCount: number;
    /** Affected lots another open NCR still blocks; > 0 emits `open_ncrs`. */
    lotsWithOtherOpenNcrs?: number;
  },
  reason?: string,
): DecisionSnapshotInput[] {
  return [
    {
      entityType: 'ncr',
      entityId: ncrId,
      requirementSet: NCR_CLOSURE_REQUIREMENT_SET,
      resultSchemaVersion: NCR_CLOSURE_RESULT_SCHEMA_VERSION,
      result: buildNcrClosureResultV1({
        closed: evaluation.closed,
        byConcession: evaluation.byConcession,
        serious: evaluation.serious,
        // The one blocker a closure decision can leave behind: affected lots it
        // could not clear because a DIFFERENT NCR is still open on them.
        items: (evaluation.lotsWithOtherOpenNcrs ?? 0) > 0 ? [{ code: 'open_ncrs' }] : [],
        affectedLotCount: evaluation.affectedLotCount,
        reason,
      }),
    },
  ];
}

// POST /api/ncrs/:id/qm-approve - QM approval for major NCRs (Quality Manager only)
ncrClosureWorkflowRouter.post(
  '/:id/qm-approve',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!ncr) {
      throw AppError.notFound('NCR not found');
    }

    await requireActiveProjectUser(
      ncr.projectId,
      user,
      'Only a Quality Manager or company owner can approve major NCR closures',
      NCR_QM_APPROVAL_ROLES,
    );
    await assertProjectAllowsWrite(ncr.projectId);

    // A cheap rejection before a serializable transaction is opened; `evaluate`
    // re-runs the same gates on transaction data below.
    assertNcrQmApprovable(ncr);

    const qmApprovedAt = new Date();
    // F0.4b PR 2: this route's FIRST transaction — the approval columns and its
    // audit row now commit together (execution spec §9 `[R3.1-R1]`).
    const decision = await recordDecision({
      projectId: ncr.projectId,
      entityType: 'ncr',
      entityId: id,
      decisionKind: 'approval',
      auditAction: AuditAction.NCR_QM_APPROVED,
      actor: { kind: 'user', userId: user.userId },
      auditChanges: {
        ncrNumber: ncr.ncrNumber,
        severity: ncr.severity,
        status: ncr.status,
        qmApprovalRequired: ncr.qmApprovalRequired,
        qmApproved: true,
      },
      req,
      evaluate: async (tx) => {
        const current = await tx.nCR.findUnique({
          where: { id },
          select: {
            severity: true,
            status: true,
            qmApprovalRequired: true,
            qmApprovedAt: true,
            _count: { select: { ncrLots: true } },
          },
        });

        if (!current) {
          throw AppError.notFound('NCR not found');
        }

        assertNcrQmApprovable(current);

        return { serious: ncrSerious(current), affectedLotCount: current._count.ncrLots };
      },
      // The existing optimistic guard stays as the cheap second line inside the
      // transaction.
      mutate: async (tx) => {
        const approvalUpdate = await tx.nCR.updateMany({
          where: { id, qmApprovalRequired: true, qmApprovedAt: null, status: 'verification' },
          data: {
            qmApprovedById: user.userId,
            qmApprovedAt,
          },
        });
        await ensureQmApprovalClaimed(id, approvalUpdate.count, tx);

        return tx.nCR.findUniqueOrThrow({
          where: { id },
          include: {
            qmApprovedBy: { select: { id: true, fullName: true, email: true } },
          },
        });
      },
      // QM approval is a step TOWARD closure, never the closure itself.
      snapshots: (evaluation) =>
        ncrClosureSnapshot(id, {
          closed: false,
          serious: evaluation.serious,
          affectedLotCount: evaluation.affectedLotCount,
        }),
    });

    // No requestKey on this route, so a replay is impossible and `mutation` is
    // always present (spec §11 F0.4b — replay is inert flag-off `[R3.1-B2]`).
    res.json(
      buildNcrWorkflowMessageResponse(
        decision.mutation!,
        'QM approval granted. NCR can now be closed.',
      ),
    );
  }),
);

// POST /api/ncrs/:id/close - Close NCR (requires QM approval for major NCRs)
ncrClosureWorkflowRouter.post(
  '/:id/close',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = closeNcrSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const {
      verificationNotes,
      lessonsLearned,
      withConcession,
      concessionJustification,
      concessionRiskAssessment,
      overrideClientNotification,
      clientNotificationOverrideReason,
      clientApprovalReference,
    } = validation.data;

    // Deliberately does NOT read the affected lots' statuses: before F0.4b PR 2
    // the in-transaction lot cascade decided each lot's next status from THIS
    // pre-transaction snapshot, so a lot that moved in between was cascaded on
    // stale data. `evaluate(tx)` re-reads them inside the decision now.
    const ncr = await prisma.nCR.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        ncrNumber: true,
        status: true,
        severity: true,
        qmApprovalRequired: true,
        qmApprovedAt: true,
        qmApprovedById: true,
        clientNotificationRequired: true,
        clientNotifiedAt: true,
        ncrEvidence: { select: { evidenceType: true } },
        _count: { select: { ncrLots: true } },
      },
    });

    if (!ncr) {
      throw AppError.notFound('NCR not found');
    }

    await requireActiveProjectUser(
      ncr.projectId,
      user,
      'Only Quality Managers, Project Managers, or Admins can close NCRs',
      NCR_QUALITY_MANAGEMENT_ROLES,
    );
    await assertProjectAllowsWrite(ncr.projectId);

    const gate: NcrCloseGateOptions = {
      userId: user.userId,
      withConcession,
      overrideClientNotification,
      clientApprovalReference,
    };
    // A cheap rejection before a serializable transaction is opened;
    // `evaluateNcrClosure` re-runs the same gates on transaction data below.
    const { clientNotificationOverridden } = assertNcrClosable(ncr, gate);

    const closeStatus = withConcession ? 'closed_concession' : 'closed';
    const closedAt = new Date();

    const decision = await recordDecision({
      projectId: ncr.projectId,
      entityType: 'ncr',
      entityId: id,
      decisionKind: withConcession ? 'concession' : 'closure',
      auditAction: AuditAction.NCR_STATUS_CHANGED,
      actor: { kind: 'user', userId: user.userId },
      auditChanges: {
        ncrNumber: ncr.ncrNumber,
        status: { from: ncr.status, to: closeStatus },
        withConcession: Boolean(withConcession),
        verificationNotesPresent: Boolean(verificationNotes),
        lessonsLearnedPresent: Boolean(lessonsLearned),
        affectedLotCount: ncr._count.ncrLots,
        ...(withConcession ? { clientApprovalReference: clientApprovalReference ?? null } : {}),
        ...(clientNotificationOverridden
          ? {
              clientNotificationOverridden: true,
              clientNotificationOverrideReason: clientNotificationOverrideReason ?? null,
            }
          : {}),
      },
      req,
      evaluate: (tx) => evaluateNcrClosure(tx, id, gate),
      // The existing optimistic guard (status + evidence-present) stays as the
      // cheap second line inside the transaction.
      mutate: async (tx, evaluation) => {
        const closeUpdate = await tx.nCR.updateMany({
          where: { id, status: 'verification', ncrEvidence: { some: {} } },
          data: {
            status: closeStatus,
            verifiedById: user.userId,
            verifiedAt: closedAt,
            verificationNotes,
            closedById: user.userId,
            closedAt,
            lessonsLearned,
            concessionJustification: withConcession ? concessionJustification : null,
            concessionRiskAssessment: withConcession ? concessionRiskAssessment : null,
            clientApprovalReference: withConcession ? (clientApprovalReference ?? null) : null,
          },
        });
        await ensureCloseClaimed(id, closeUpdate.count, tx);

        for (const { lotId, nextStatus } of evaluation.cascade) {
          await tx.lot.update({ where: { id: lotId }, data: { status: nextStatus } });
        }

        return tx.nCR.findUniqueOrThrow({
          where: { id },
          include: {
            closedBy: { select: { fullName: true, email: true } },
            qmApprovedBy: { select: { id: true, fullName: true, email: true } },
          },
        });
      },
      snapshots: (evaluation) =>
        ncrClosureSnapshot(
          id,
          {
            closed: true,
            byConcession: Boolean(withConcession),
            serious: evaluation.serious,
            affectedLotCount: evaluation.affectedLotCount,
            lotsWithOtherOpenNcrs: evaluation.lotsWithOtherOpenNcrs,
          },
          // Closure provenance: the concession's justification when the defect
          // was accepted, otherwise the verification the closer recorded.
          withConcession ? concessionJustification : verificationNotes,
        ),
    });

    // No requestKey on this route, so `mutation` is always present.
    const updatedNcr = decision.mutation!;

    // Post-commit, fire-and-forget: never dispatched from inside the decision,
    // so a rolled-back or retried attempt cannot emit a user-visible signal.
    emitNcrWebhookEvent(ncr.projectId, 'ncr.closed', {
      ncrId: ncr.id,
      projectId: ncr.projectId,
      ncrNumber: ncr.ncrNumber,
      status: updatedNcr.status,
      severity: ncr.severity,
      actorUserId: user.userId,
      action: withConcession ? 'closed_concession' : 'closed',
    });

    res.json(buildNcrClosedResponse(updatedNcr, ncr.severity));
  }),
);

// Feature #213: POST /api/ncrs/:id/notify-client - Notify client about major NCR
ncrClosureWorkflowRouter.post(
  '/:id/notify-client',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = notifyClientSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const { recipientEmail, additionalMessage } = validation.data;

    if (!recipientEmail) {
      throw AppError.badRequest('Recipient email is required to notify the client');
    }

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        project: { select: { name: true, projectNumber: true } },
        raisedBy: { select: { fullName: true, email: true } },
        ncrLots: {
          include: {
            lot: { select: { lotNumber: true, description: true } },
          },
        },
      },
    });

    if (!ncr) {
      throw AppError.notFound('NCR not found');
    }

    // Check if client notification is required (major NCR)
    if (!ncr.clientNotificationRequired) {
      throw AppError.badRequest('Client notification not required for this NCR');
    }

    // Check if already notified
    if (ncr.clientNotifiedAt) {
      throw AppError.badRequest(
        `Client was already notified on ${new Date(ncr.clientNotifiedAt).toLocaleDateString('en-AU')}`,
      );
    }

    await requireActiveProjectUser(
      ncr.projectId,
      user,
      'Only Project Managers, Quality Managers, or Admins can notify client',
      ['quality_manager', 'admin', 'project_manager', 'owner'],
    );
    await assertProjectAllowsWrite(ncr.projectId);

    // Get user details for notification
    const notifiedByUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { fullName: true, email: true },
    });

    const notificationTime = new Date();
    await claimClientNotification(id, notificationTime);

    // Generate notification package content
    const lotNumbers = ncr.ncrLots.map((nl) => nl.lot.lotNumber).join(', ') || 'N/A';
    const notificationPackage = {
      ncrNumber: ncr.ncrNumber,
      project: `${ncr.project.name} (${ncr.project.projectNumber})`,
      severity: ncr.severity,
      category: ncr.category,
      affectedLots: lotNumbers,
      description: ncr.description,
      specificationReference: ncr.specificationReference || 'N/A',
      raisedBy: ncr.raisedBy?.fullName || ncr.raisedBy?.email || 'Unknown',
      raisedAt: ncr.raisedAt,
      notifiedBy: notifiedByUser?.fullName || notifiedByUser?.email || 'Unknown',
      notifiedAt: notificationTime.toISOString(),
      additionalMessage: additionalMessage || null,
    };

    const emailResult = await sendEmail({
      to: recipientEmail,
      subject: `Major NCR notification: ${ncr.ncrNumber} - ${ncr.project.name}`,
      text: [
        `Major NCR notification: ${ncr.ncrNumber}`,
        '',
        `Project: ${notificationPackage.project}`,
        `Severity: ${notificationPackage.severity}`,
        `Category: ${notificationPackage.category}`,
        `Affected lots: ${notificationPackage.affectedLots}`,
        `Specification reference: ${notificationPackage.specificationReference}`,
        `Raised by: ${notificationPackage.raisedBy}`,
        `Raised at: ${new Date(ncr.raisedAt).toLocaleString('en-AU')}`,
        `Notified by: ${notificationPackage.notifiedBy}`,
        '',
        'Description:',
        ncr.description,
        ...(additionalMessage ? ['', 'Additional message:', additionalMessage] : []),
      ].join('\n'),
    }).catch(async (error: unknown) => {
      await releaseClientNotificationClaim(id, notificationTime);
      throw error;
    });

    if (!emailResult.success) {
      await releaseClientNotificationClaim(id, notificationTime);
      throw AppError.internal('Client notification email could not be sent');
    }

    const updatedNcr = await prisma.nCR.findUniqueOrThrow({
      where: { id },
      include: {
        project: { select: { name: true } },
        raisedBy: { select: { fullName: true, email: true } },
        ncrLots: {
          include: {
            lot: { select: { lotNumber: true, description: true } },
          },
        },
      },
    });

    await createAuditLog({
      projectId: ncr.projectId,
      userId: user.userId,
      entityType: 'ncr',
      entityId: ncr.id,
      action: AuditAction.NCR_CLIENT_NOTIFIED,
      changes: {
        ncrNumber: ncr.ncrNumber,
        severity: ncr.severity,
        affectedLotCount: ncr.ncrLots.length,
        recipientEmailPresent: Boolean(recipientEmail),
        additionalMessagePresent: Boolean(additionalMessage),
      },
      req,
    });

    res.json(buildNcrClientNotificationResponse(updatedNcr, notificationPackage, ncr.ncrNumber));
  }),
);

// POST /api/ncrs/:id/reopen - Reopen a closed NCR
ncrClosureWorkflowRouter.post(
  '/:id/reopen',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = reopenNcrSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const { reason } = validation.data;

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        ncrLots: { select: { lotId: true } },
      },
    });

    if (!ncr) {
      throw AppError.notFound('NCR not found');
    }

    if (ncr.status !== 'closed' && ncr.status !== 'closed_concession') {
      throw AppError.badRequest('NCR is not closed');
    }

    await requireActiveProjectUser(ncr.projectId, user, 'Only Quality Managers can reopen NCRs', [
      'quality_manager',
      'admin',
      'project_manager',
    ]);
    await assertProjectAllowsWrite(ncr.projectId);

    const updatedNcr = await prisma.$transaction(async (tx) => {
      const reopenUpdate = await tx.nCR.updateMany({
        where: { id, status: { in: ['closed', 'closed_concession'] } },
        data: {
          status: 'rectification',
          verifiedById: null,
          verifiedAt: null,
          verificationNotes: null,
          closedById: null,
          closedAt: null,
          qmApprovedById: null,
          qmApprovedAt: null,
          lessonsLearned: reason
            ? `[Reopened: ${reason}] ${ncr.lessonsLearned || ''}`
            : ncr.lessonsLearned,
        },
      });
      await ensureReopenClaimed(reopenUpdate.count);

      const reopenedNcr = await tx.nCR.findUniqueOrThrow({
        where: { id },
      });

      if (ncr.ncrLots.length > 0) {
        await tx.lot.updateMany({
          where: {
            id: { in: ncr.ncrLots.map((ncrLot) => ncrLot.lotId) },
            projectId: ncr.projectId,
            status: { notIn: ['conformed', 'claimed'] },
          },
          data: { status: 'ncr_raised' },
        });
      }

      return reopenedNcr;
    });

    await createAuditLog({
      projectId: ncr.projectId,
      userId: user.userId,
      entityType: 'ncr',
      entityId: ncr.id,
      action: AuditAction.NCR_STATUS_CHANGED,
      changes: {
        ncrNumber: ncr.ncrNumber,
        status: { from: ncr.status, to: updatedNcr.status },
        reasonPresent: Boolean(reason),
      },
      req,
    });

    res.json(buildNcrWorkflowResponse(updatedNcr));
  }),
);

// POST /api/ncrs/:id/submit-for-verification - Submit rectification for verification
ncrClosureWorkflowRouter.post(
  '/:id/submit-for-verification',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = submitForVerificationSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const { rectificationNotes } = validation.data;

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        ncrEvidence: true,
      },
    });

    if (!ncr) {
      throw AppError.notFound('NCR not found');
    }

    await requireNcrResponsibleOrProjectRole(
      ncr,
      user,
      'Only the responsible party or project quality roles can submit NCR rectification',
    );

    // Check if NCR is in rectification status
    if (ncr.status !== 'rectification') {
      throw AppError.badRequest('NCR must be in rectification status to submit for verification', {
        currentStatus: ncr.status,
      });
    }

    // Check if evidence has been uploaded
    if (ncr.ncrEvidence.length === 0) {
      throw AppError.badRequest(
        'Please upload at least one piece of evidence before submitting for verification',
        { evidenceCount: 0 },
      );
    }

    await claimNcrVerificationSubmission({
      ncrId: id,
      rectificationNotes,
      submittedAt: new Date(),
    });

    const updatedNcr = await prisma.nCR.findUniqueOrThrow({
      where: { id },
      include: {
        ncrEvidence: {
          include: {
            document: { select: { id: true, filename: true, fileUrl: true } },
          },
        },
      },
    });

    await createAuditLog({
      projectId: ncr.projectId,
      userId: user.userId,
      entityType: 'ncr',
      entityId: ncr.id,
      action: AuditAction.NCR_STATUS_CHANGED,
      changes: {
        ncrNumber: ncr.ncrNumber,
        status: { from: ncr.status, to: updatedNcr.status },
        rectificationNotesPresent: Boolean(rectificationNotes),
        evidenceCount: ncr.ncrEvidence.length,
        submissionPath: 'submit-for-verification',
      },
      req,
    });

    res.json(buildNcrSubmittedForVerificationResponse(updatedNcr));
  }),
);
