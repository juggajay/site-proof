import { randomUUID } from 'crypto';

import { Router } from 'express';
import { Prisma } from '@prisma/client';

import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { AppError, ErrorCodes } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { transitionLotStatusesWhere } from '../../lib/lotStatusTransition.js';
import { prisma } from '../../lib/prisma.js';
import { recordDecision } from '../../lib/readiness/recordDecision.js';
import { logError } from '../../lib/serverLogger.js';
import { sendNotificationIfEnabled } from '../notifications.js';
import { buildProjectEntityLink } from '../notifications/links.js';
import {
  buildClaimCertificationView,
  buildClaimCreatedResponse,
  buildClaimDetailResponse,
  getClaimReadDisputeNotes,
  mapClaimCreateItem,
} from './presentation.js';
import { claimInclusionSnapshots, evaluateClaimInclusion } from './inclusionDecision.js';
import {
  CLAIM_AMOUNT_EPSILON,
  CLAIM_LOT_PERCENTAGE_REQUIRED_MESSAGE,
  assertCertifiedAmountCoversPaid,
  assertCertifiedAmountWithinClaimTotal,
  assertGenericClaimStatusTransition,
  assertReducedCertifiedAmountHasVariationNotes,
  buildClaimCertificationSettlement,
  createClaimSchema,
  getRequestedClaimLots,
  getRequestedClaimVariationIds,
  parseClaimDate,
  roundClaimAmountToCents,
  serializeCertificationMetadataForStatusTransition,
  serializeDisputeNotesForStatusTransition,
  updateClaimSchema,
} from './workflowValidation.js';

type AuthUser = NonNullable<Express.Request['user']>;
type ClaimWithMemberCounts = Prisma.ProgressClaimGetPayload<{
  include: { _count: { select: { claimedLots: true; variations: true } } };
}>;

function normalizeUniqueTargetField(value: string) {
  return value.replace(/_/g, '').toLowerCase();
}

function isUniqueConstraintOn(error: unknown, fields: string[]) {
  const candidate = error as { code?: unknown; meta?: { target?: unknown } };
  if (candidate?.code !== 'P2002') {
    return false;
  }

  const target = candidate.meta?.target;
  if (!Array.isArray(target)) {
    return false;
  }

  const normalizedTarget = target
    .filter((field): field is string => typeof field === 'string')
    .map(normalizeUniqueTargetField);
  return fields.every((field) => normalizedTarget.includes(normalizeUniqueTargetField(field)));
}

/**
 * ONE retry classifier (F0.4b PR 5, adoption review R2).
 *
 * Claim numbers are allocated by reading the project's current max inside the
 * decision transaction, so two concurrent creates can collide on the
 * `(projectId, claimNumber)` unique index. That collision IS a write conflict,
 * so it is re-thrown with Prisma's write-conflict code and handled by
 * `recordDecision`'s serializable retry — the next attempt re-runs `evaluate`,
 * which reads a fresh max. The deleted `CLAIM_NUMBER_RETRY_LIMIT` loop is NOT
 * replaced by a second loop around the decision: two stacked classifiers would
 * multiply out to 15 transactions and make the exhausted-retry status depend on
 * which loop gave up first.
 */
function asDecisionWriteConflict(error: unknown): Error {
  return Object.assign(new Error('Claim number collided with a concurrent claim'), {
    code: 'P2034',
    cause: error,
  });
}

/**
 * `[R3.1-B2]` — the loser of a same-`requestKey` race.
 *
 * Both branches mean "another request with this key won the write", never "the
 * client sent something invalid": the unique-index violation is the winner
 * committing between our pre-check and our insert, and `DECISION_CONFLICT` is
 * the same race losing `recordDecision`'s serializable retries instead. Either
 * way F-03 requires the winner's claim, not an error.
 */
function lostTheRequestKeyRace(error: unknown): boolean {
  return (
    isUniqueConstraintOn(error, ['projectId', 'requestKey']) ||
    (error instanceof AppError && error.code === ErrorCodes.DECISION_CONFLICT)
  );
}

/**
 * Claim create's idempotency mechanism, unchanged by F0.4b: the
 * `(projectId, requestKey)` unique index. `recordDecision`'s own
 * snapshot-backed replay is deliberately NOT used — the unique index is the
 * proven mechanism, and migrating onto replay (even now that
 * `READINESS_SNAPSHOTS_ENABLED` is ON in prod, since 2026-07-26) would need
 * its own reviewed slice to avoid reopening the F-03 double-billing hole
 * (`[R3.1-B2]`, spec §9 step 2).
 */
async function findClaimByRequestKey(
  projectId: string,
  requestKey: string,
): Promise<ClaimWithMemberCounts | null> {
  return prisma.progressClaim.findFirst({
    where: { projectId, requestKey },
    include: { _count: { select: { claimedLots: true, variations: true } } },
  });
}

async function lockClaimLotsForUpdate(
  tx: Prisma.TransactionClient,
  projectId: string,
  lotIds: string[],
): Promise<void> {
  if (lotIds.length === 0) return;

  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM lots
    WHERE project_id = ${projectId}
      AND id IN (${Prisma.join([...lotIds].sort())})
    ORDER BY id
    FOR UPDATE
  `;
}

async function lockClaimVariationsForUpdate(
  tx: Prisma.TransactionClient,
  projectId: string,
  variationIds: string[],
): Promise<void> {
  if (variationIds.length === 0) return;

  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM variations
    WHERE project_id = ${projectId}
      AND id IN (${Prisma.join([...variationIds].sort())})
    ORDER BY id
    FOR UPDATE
  `;
}

interface ClaimWorkflowRouterDependencies {
  parseClaimRouteParam: (value: unknown, field: string) => string;
  requireCommercialProjectAccess: (
    user: AuthUser,
    projectId: string,
    options?: { requireWritable?: boolean },
  ) => Promise<void>;
}

export function createClaimWorkflowRouter({
  parseClaimRouteParam,
  requireCommercialProjectAccess,
}: ClaimWorkflowRouterDependencies) {
  const workflowRouter = Router();

  // POST /api/projects/:projectId/claims - Create a new claim
  workflowRouter.post(
    '/:projectId/claims',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      const userId = req.user!.userId;
      await requireCommercialProjectAccess(req.user!, projectId, { requireWritable: true });

      // Validate request body
      const validation = createClaimSchema.safeParse(req.body);
      if (!validation.success) {
        const hasMissingPercentageIssue = validation.error.issues.some((issue) =>
          issue.message.includes('percentageComplete'),
        );
        if (hasMissingPercentageIssue) {
          throw AppError.badRequest(CLAIM_LOT_PERCENTAGE_REQUIRED_MESSAGE, {
            issues: validation.error.issues,
          });
        }
        throw AppError.fromZodError(validation.error);
      }
      const { periodStart, periodEnd } = validation.data;
      const requestKey = validation.data.requestKey;
      const requestedLots = getRequestedClaimLots(validation.data);
      const requestedVariationIds = getRequestedClaimVariationIds(validation.data);
      const claimPeriodStart = parseClaimDate(periodStart, 'periodStart');
      const claimPeriodEnd = parseClaimDate(periodEnd, 'periodEnd');

      if (claimPeriodEnd < claimPeriodStart) {
        throw AppError.badRequest('Period end must be on or after period start');
      }

      const uniqueLotIds = Array.from(new Set(requestedLots.map((lot) => lot.lotId)));
      if (uniqueLotIds.length !== requestedLots.length) {
        throw AppError.badRequest('Duplicate lots cannot be added to the same claim');
      }
      const uniqueVariationIds = Array.from(new Set(requestedVariationIds));
      const percentageByLotId = new Map(
        requestedLots.map((lot) => [lot.lotId, lot.percentageComplete]),
      );

      // The claim id is minted HERE, not by the database: `recordDecision` needs
      // the decided entity's id before the transaction opens, and
      // `entityCreatedByMutate` is the option PR 0 added for exactly this case —
      // `mutate` creates the row, and the project-scope check re-runs on `tx`
      // AFTER `mutate`, so a claim minted into the wrong project still fails,
      // inside the transaction that rolls it back (`[R3.1-B1]`).
      const claimId = randomUUID();
      // Same for the ClaimedLot join rows: `claim_lot` snapshots key on
      // ClaimedLot.id, and `snapshots(evaluation)` has to be able to name those
      // ids. Pre-minting them is cheaper and clearer than re-reading the join
      // rows — and a snapshot may never be built from a post-commit re-query.
      const claimedLotIdByLotId = new Map(
        uniqueLotIds.map((lotId) => [lotId, randomUUID()] as const),
      );

      // `recordDecision` takes `auditChanges` as a value, but a claim's audit
      // facts (its number, its member counts, which lots it completed) only exist
      // once `evaluate` has run. `mutate` fills this object in; `recordDecision`
      // writes the audit row strictly AFTER `mutate` within the same
      // transaction, and a retried attempt overwrites every key, so the row can
      // never carry a previous attempt's facts.
      //
      // ponytail: one mutable object beats widening `recordDecision`'s signature
      // for its only evaluation-derived caller. If a second one appears, change
      // `auditChanges` to accept `(evaluation) => changes`.
      const auditChanges: Record<string, unknown> = {};

      // `[R3.1-B2]` REPLAY STAYS ON THE EXISTING MACHINERY. The
      // `(projectId, requestKey)` pre-check runs BEFORE the decision opens, and
      // the unique index behind it is what makes concurrent same-key creates
      // converge (see `lostTheRequestKeyRace`). `requestKey` is deliberately NOT
      // passed to `recordDecision`: the unique index is the proven idempotency
      // mechanism, and moving onto snapshot replay would need its own reviewed
      // slice to avoid reopening the F-03 double-billing hole.
      let claim = requestKey ? await findClaimByRequestKey(projectId, requestKey) : null;

      if (!claim) {
        try {
          // ONE decision (`decisionKind: 'inclusion'`): the ProgressClaim row,
          // its N ClaimedLot rows, the variation and lot status flips, the
          // aggregate + member snapshots and the single audit row all commit
          // together or not at all. The audit write moving inside the
          // transaction is a deliberate integrity change — "claimed but
          // unaudited" stops being reachable (spec §9 `[R3.1-R1]`).
          const decision = await recordDecision({
            projectId,
            entityType: 'claim',
            entityId: claimId,
            entityCreatedByMutate: true,
            decisionKind: 'inclusion',
            auditAction: AuditAction.CLAIM_CREATED,
            // Audit vocabulary untouched: `claim_created` rows have always been
            // written against `progress_claim`, and consumers still match on it.
            auditEntityType: 'progress_claim',
            actor: { kind: 'user', userId },
            auditChanges,
            req,
            evaluate: async (tx) => {
              // `SELECT … FOR UPDATE` inside Serializable is anticipated by
              // `recordDecision` (it classifies a raw 40001 from a locking query
              // as a retryable conflict, recordDecision.ts:184-195). Keep the
              // lock: it is the cheap second line that makes the common
              // two-clients-one-lot race block and serialise rather than both
              // running to commit and one aborting.
              await lockClaimLotsForUpdate(tx, projectId, uniqueLotIds);
              await lockClaimVariationsForUpdate(tx, projectId, uniqueVariationIds);

              return evaluateClaimInclusion(tx, {
                projectId,
                uniqueLotIds,
                uniqueVariationIds,
                percentageByLotId,
                claimedLotIdByLotId,
              });
            },
            mutate: async (tx, evaluation) => {
              const { lotMembers, variationMembers, fullyClaimedLotIds } = evaluation;

              try {
                await tx.progressClaim.create({
                  data: {
                    id: claimId,
                    projectId,
                    claimNumber: evaluation.nextClaimNumber,
                    claimPeriodStart,
                    claimPeriodEnd,
                    status: 'draft',
                    preparedById: userId,
                    preparedAt: new Date(),
                    requestKey: requestKey ?? null,
                    totalClaimedAmount: evaluation.totalClaimedAmount,
                    claimedLots:
                      lotMembers.length > 0
                        ? {
                            create: lotMembers.map((member) => ({
                              id: member.claimedLotId,
                              lotId: member.lot.id,
                              quantity: 1,
                              unit: 'ea',
                              rate: member.lot.budgetAmount,
                              amountClaimed: member.amountClaimed,
                              percentageComplete: member.percentageComplete,
                            })),
                          }
                        : undefined,
                  },
                });
              } catch (error) {
                // Only the claim-number collision is retryable. A
                // `(projectId, requestKey)` violation is the replay race and must
                // reach the route's catch untouched.
                if (isUniqueConstraintOn(error, ['projectId', 'claimNumber'])) {
                  throw asDecisionWriteConflict(error);
                }
                throw error;
              }

              if (variationMembers.length > 0) {
                const variationIds = variationMembers.map((member) => member.variation.id);
                const variationUpdateResult = await tx.variation.updateMany({
                  where: {
                    id: { in: variationIds },
                    projectId,
                    status: 'approved',
                    claimedInId: null,
                  },
                  data: { status: 'claimed', claimedInId: claimId },
                });

                if (variationUpdateResult.count !== variationIds.length) {
                  throw AppError.badRequest(
                    'One or more selected variations are no longer available to claim',
                    { code: 'VARIATION_NOT_CLAIMABLE' },
                  );
                }
              }

              // Flip only the lots this claim takes to 100% cumulative into the
              // terminal `claimed` state. Lots below 100% stay `conformed` so
              // they can be claimed again on a future claim.
              if (fullyClaimedLotIds.length > 0) {
                const updateResult = await transitionLotStatusesWhere(tx, {
                  where: {
                    id: { in: fullyClaimedLotIds },
                    projectId,
                    status: 'conformed',
                    claimedInId: null,
                  },
                  to: 'claimed',
                  extraData: { claimedInId: claimId },
                  event: {
                    actorId: userId,
                    source: 'user',
                    sourceEntityType: 'claim',
                    sourceEntityId: claimId,
                  },
                  onCountMismatch: () => {
                    throw AppError.badRequest(
                      'One or more selected lots are no longer available to claim',
                    );
                  },
                });

                if (updateResult.lots.length !== fullyClaimedLotIds.length) {
                  throw AppError.badRequest(
                    'One or more selected lots are no longer available to claim',
                  );
                }
              }

              Object.assign(auditChanges, {
                claimNumber: evaluation.nextClaimNumber,
                totalClaimedAmount: evaluation.totalClaimedAmount,
                lotCount: lotMembers.length,
                variationCount: variationMembers.length,
                // What the deleted per-lot `lot_status_changed` loop carried,
                // preserved on the one decision row and now CORRELATED with the
                // claim that caused the flip (`[R3.1-R4]` precedent). The map
                // time scrubber reads it back through
                // `lots/statusTimeline.ts`.
                fullyClaimedLotIds,
              });

              // Read the counts after the variation link, so `_count.variations`
              // is this claim's real membership (the nested create above only
              // covers `claimedLots`).
              return tx.progressClaim.findUniqueOrThrow({
                where: { id: claimId },
                include: { _count: { select: { claimedLots: true, variations: true } } },
              });
            },
            snapshots: (evaluation) => claimInclusionSnapshots(claimId, evaluation),
          });

          claim = decision.mutation!;
        } catch (error) {
          // The same-key race path, unchanged in meaning: the winner's claim is
          // the correct answer, so re-read it rather than surfacing the write
          // failure (F-03).
          const raced =
            requestKey && lostTheRequestKeyRace(error)
              ? await findClaimByRequestKey(projectId, requestKey)
              : null;
          if (!raced) {
            throw error;
          }
          claim = raced;
        }
      }

      res.status(201).json(buildClaimCreatedResponse(mapClaimCreateItem(claim)));
    }),
  );

  // PUT /api/projects/:projectId/claims/:claimId - Update a claim
  workflowRouter.put(
    '/:projectId/claims/:claimId',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      const claimId = parseClaimRouteParam(req.params.claimId, 'claimId');
      const userId = req.user!.userId;
      await requireCommercialProjectAccess(req.user!, projectId, { requireWritable: true });

      // Validate request body
      const validation = updateClaimSchema.safeParse(req.body);
      if (!validation.success) {
        throw AppError.fromZodError(validation.error);
      }
      const {
        status,
        certifiedAmount,
        paidAmount,
        paymentReference,
        disputeNotes,
        submittedTo,
        submissionMethod,
      } = validation.data;
      const roundedCertifiedAmount =
        certifiedAmount === undefined ? undefined : roundClaimAmountToCents(certifiedAmount);
      const roundedPaidAmount =
        paidAmount === undefined ? undefined : roundClaimAmountToCents(paidAmount);

      if (status === 'certified' && roundedCertifiedAmount === undefined) {
        throw AppError.badRequest('Certified amount is required when certifying a claim');
      }

      if (status === 'paid' && roundedPaidAmount === undefined) {
        throw AppError.badRequest('Paid amount is required when marking a claim as paid');
      }

      const updateResult = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM progress_claims
          WHERE id = ${claimId} AND project_id = ${projectId}
          FOR UPDATE
        `;

        const claim = await tx.progressClaim.findFirst({
          where: { id: claimId, projectId },
          include: {
            project: {
              select: { id: true, name: true },
            },
          },
        });

        if (!claim) {
          throw AppError.notFound('Claim');
        }

        // Don't allow updates to paid claims
        if (claim.status === 'paid') {
          throw AppError.badRequest('Cannot update a paid claim');
        }

        assertGenericClaimStatusTransition(claim.status, status);

        if (status === 'certified' && roundedCertifiedAmount !== undefined) {
          assertCertifiedAmountWithinClaimTotal(roundedCertifiedAmount, claim.totalClaimedAmount);
          assertCertifiedAmountCoversPaid(roundedCertifiedAmount, claim.paidAmount);
          assertReducedCertifiedAmountHasVariationNotes(
            roundedCertifiedAmount,
            claim.totalClaimedAmount,
            disputeNotes,
          );
        }

        if (status === 'paid' && roundedPaidAmount !== undefined) {
          const certifiedTotal = roundClaimAmountToCents(
            claim.certifiedAmount ? Number(claim.certifiedAmount) : 0,
          );
          if (claim.status !== 'certified' || certifiedTotal <= 0) {
            throw AppError.badRequest(
              'Can only mark certified claims with a certified amount as paid',
            );
          }

          if (Math.abs(roundedPaidAmount - certifiedTotal) > CLAIM_AMOUNT_EPSILON) {
            throw AppError.badRequest(
              'Paid amount must equal the certified amount when marking a claim as paid',
            );
          }
        }

        if (
          (status === 'submitted' && claim.status === 'submitted' && claim.submittedAt) ||
          (status === 'certified' && claim.status === 'certified' && claim.certifiedAt) ||
          (status === 'disputed' && claim.status === 'disputed' && claim.disputedAt)
        ) {
          const existingClaim = await tx.progressClaim.findUniqueOrThrow({
            where: { id: claimId },
            include: {
              _count: {
                select: { claimedLots: true },
              },
            },
          });
          return {
            claim,
            updatedClaim: existingClaim,
            previousStatus: claim.status,
            idempotentRetry: true,
          };
        }

        const updateData: Prisma.ProgressClaimUpdateInput = {};
        const previousStatus = claim.status;

        if (status) {
          updateData.status = status;
          if (status === 'submitted') {
            updateData.submittedAt = new Date();
            // M82: record who/where the claim was submitted to for the audit trail.
            if (submittedTo !== undefined) {
              updateData.submittedTo = submittedTo || null;
            }
          }
          if (status === 'certified' && roundedCertifiedAmount !== undefined) {
            const certifiedAt = new Date();
            const certificationSettlement = buildClaimCertificationSettlement(
              roundedCertifiedAmount,
              certifiedAt,
            );
            updateData.certifiedAmount = roundedCertifiedAmount;
            updateData.certifiedAt = certifiedAt;
            updateData.status = certificationSettlement.status;
            updateData.paidAmount = certificationSettlement.paidAmount;
            updateData.paidAt = certificationSettlement.paidAt;
            updateData.disputedAt = null;
            updateData.disputeNotes = serializeCertificationMetadataForStatusTransition({
              existingDisputeNotes: claim.disputeNotes,
              variationNotes: disputeNotes,
              certificationDocumentId: null,
              certifiedBy: userId,
            });
          }
          if (status === 'paid' && roundedPaidAmount !== undefined) {
            updateData.paidAmount = roundedPaidAmount;
            updateData.paidAt = new Date();
            updateData.paymentReference = paymentReference || null;
          }
          if (status === 'disputed') {
            updateData.disputedAt = new Date();
            updateData.disputeNotes = serializeDisputeNotesForStatusTransition(
              claim.disputeNotes,
              disputeNotes,
            );
          }
        }

        const updatedClaim = await tx.progressClaim.update({
          where: { id: claimId },
          data: updateData,
          include: {
            _count: {
              select: { claimedLots: true },
            },
          },
        });

        return {
          claim,
          updatedClaim,
          previousStatus,
          idempotentRetry: false,
        };
      });

      const { claim, updatedClaim, previousStatus } = updateResult;

      if (updateResult.idempotentRetry) {
        res.json(
          buildClaimDetailResponse({
            ...updatedClaim,
            disputeNotes: getClaimReadDisputeNotes(updatedClaim.disputeNotes),
            certification: buildClaimCertificationView(updatedClaim.disputeNotes),
          }),
        );
        return;
      }

      // Feature #931 - Notify project managers when a claim is certified
      if (
        status === 'certified' &&
        previousStatus !== 'certified' &&
        roundedCertifiedAmount !== undefined
      ) {
        try {
          // Get the user who certified the claim
          const certifier = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, fullName: true },
          });
          const certifierName = certifier?.fullName || certifier?.email || 'Unknown';

          // Get all project managers on this project
          const projectManagers = await prisma.projectUser.findMany({
            where: {
              projectId,
              role: 'project_manager',
              status: 'active',
            },
          });

          // Get user details for project managers
          const pmUserIds = projectManagers.map((pm) => pm.userId);
          const pmUsers =
            pmUserIds.length > 0
              ? await prisma.user.findMany({
                  where: { id: { in: pmUserIds } },
                  select: { id: true, email: true, fullName: true },
                })
              : [];

          // Format certified amount for display
          const formattedAmount = new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
          }).format(roundedCertifiedAmount);

          // Create notifications for project managers
          const notificationsToCreate = pmUsers.map((pm) => ({
            userId: pm.id,
            projectId,
            type: 'claim_certified',
            title: 'Claim Certified',
            message: `Claim #${claim.claimNumber} has been certified by ${certifierName}. Certified amount: ${formattedAmount}.`,
            linkUrl: buildProjectEntityLink('claim', claim.id, projectId),
          }));

          if (notificationsToCreate.length > 0) {
            await prisma.notification.createMany({
              data: notificationsToCreate,
            });
          }

          // Send email notifications to project managers
          for (const pm of pmUsers) {
            try {
              await sendNotificationIfEnabled(pm.id, 'enabled', {
                title: 'Claim Certified',
                message: `Claim #${claim.claimNumber} has been certified by ${certifierName}.\n\nProject: ${claim.project.name}\nCertified Amount: ${formattedAmount}\n\nPlease review the claim details in the system.`,
                projectName: claim.project.name,
                linkUrl: buildProjectEntityLink('claim', claim.id, projectId),
              });
            } catch (emailError) {
              logError(`[Claim Certification] Failed to send email to PM ${pm.id}:`, emailError);
            }
          }
        } catch (notifError) {
          logError('[Claim Certification] Failed to send notifications:', notifError);
          // Don't fail the main request if notifications fail
        }
      }

      // Feature #932 - Notify relevant users when a claim is paid
      if (status === 'paid' && previousStatus !== 'paid' && roundedPaidAmount !== undefined) {
        try {
          // Get all project managers on this project
          const projectManagers = await prisma.projectUser.findMany({
            where: {
              projectId,
              role: 'project_manager',
              status: 'active',
            },
          });

          // Get user details for project managers
          const pmUserIds = projectManagers.map((pm) => pm.userId);
          const pmUsers =
            pmUserIds.length > 0
              ? await prisma.user.findMany({
                  where: { id: { in: pmUserIds } },
                  select: { id: true, email: true, fullName: true },
                })
              : [];

          // Format paid amount for display
          const formattedAmount = new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
          }).format(roundedPaidAmount);

          // Create notifications for project managers
          const notificationsToCreate = pmUsers.map((pm) => ({
            userId: pm.id,
            projectId,
            type: 'claim_paid',
            title: 'Claim Payment Received',
            message: `Claim #${claim.claimNumber} payment of ${formattedAmount} has been recorded${paymentReference ? ` (Ref: ${paymentReference})` : ''}.`,
            linkUrl: buildProjectEntityLink('claim', claim.id, projectId),
          }));

          if (notificationsToCreate.length > 0) {
            await prisma.notification.createMany({
              data: notificationsToCreate,
            });
          }

          // Send email notifications to project managers
          for (const pm of pmUsers) {
            try {
              await sendNotificationIfEnabled(pm.id, 'enabled', {
                title: 'Claim Payment Received',
                message: `Claim #${claim.claimNumber} payment has been recorded.\n\nProject: ${claim.project.name}\nPaid Amount: ${formattedAmount}${paymentReference ? `\nPayment Reference: ${paymentReference}` : ''}\n\nPlease review the payment details in the system.`,
                projectName: claim.project.name,
                linkUrl: buildProjectEntityLink('claim', claim.id, projectId),
              });
            } catch (emailError) {
              logError(`[Claim Payment] Failed to send email to PM ${pm.id}:`, emailError);
            }
          }
        } catch (notifError) {
          logError('[Claim Payment] Failed to send notifications:', notifError);
          // Don't fail the main request if notifications fail
        }
      }

      // Audit log for claim status change
      if (status) {
        await createAuditLog({
          projectId,
          userId,
          entityType: 'progress_claim',
          entityId: claimId,
          action: AuditAction.CLAIM_STATUS_CHANGED,
          changes: {
            previousStatus,
            newStatus: status,
            certifiedAmount: roundedCertifiedAmount,
            paidAmount: roundedPaidAmount,
            ...(status === 'submitted'
              ? {
                  submittedTo: submittedTo || null,
                  submissionMethod: submissionMethod ?? null,
                }
              : {}),
          },
          req,
        });
      }

      res.json(
        buildClaimDetailResponse({
          ...updatedClaim,
          disputeNotes: getClaimReadDisputeNotes(updatedClaim.disputeNotes),
          certification: buildClaimCertificationView(updatedClaim.disputeNotes),
        }),
      );
    }),
  );

  return workflowRouter;
}
