import { Router } from 'express';
import { Prisma } from '@prisma/client';

import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { logError } from '../../lib/serverLogger.js';
import { sendNotificationIfEnabled } from '../notifications.js';
import { buildProjectEntityLink } from '../notifications/links.js';
import {
  checkConformancePrerequisitesBatch,
  getClaimBlockingReasonsForConformedLot,
} from '../../lib/conformancePrerequisites.js';
import {
  buildClaimCertificationView,
  buildClaimCreatedResponse,
  buildClaimDetailResponse,
  getClaimReadDisputeNotes,
  mapClaimCreateItem,
} from './presentation.js';
import { getCumulativeClaimedPercentByLot } from './cumulativeClaims.js';
import {
  CLAIM_AMOUNT_EPSILON,
  CLAIM_LOT_PERCENTAGE_REQUIRED_MESSAGE,
  CLAIM_NUMBER_RETRY_LIMIT,
  assertCertifiedAmountCoversPaid,
  assertCertifiedAmountWithinClaimTotal,
  assertClaimIncrementWithinRemaining,
  assertGenericClaimStatusTransition,
  assertReducedCertifiedAmountHasVariationNotes,
  buildClaimCertificationSettlement,
  createClaimSchema,
  getRequestedClaimLots,
  getRequestedClaimVariationIds,
  getRequestedClaimPercentage,
  isLotFullyClaimed,
  parseClaimDate,
  roundClaimAmountToCents,
  serializeCertificationMetadataForStatusTransition,
  serializeDisputeNotesForStatusTransition,
  updateClaimSchema,
} from './workflowValidation.js';

type AuthUser = NonNullable<Express.Request['user']>;
type ClaimCreateResult = {
  claim: Prisma.ProgressClaimGetPayload<{
    include: { _count: { select: { claimedLots: true; variations: true } } };
  }>;
  totalClaimedAmount: number;
  nextClaimNumber: number;
  lotCount: number;
  variationCount: number;
  replayed?: boolean;
};

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

function isPrismaTransactionWriteConflict(error: unknown) {
  return (error as { code?: unknown })?.code === 'P2034';
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

function assertVariationClaimable(variation: {
  variationNumber: string;
  status: string;
  claimedInId: string | null;
  approvedAmount: unknown;
}): void {
  const approvedAmount = Number(variation.approvedAmount ?? 0);
  if (
    variation.status !== 'approved' ||
    variation.claimedInId !== null ||
    !Number.isFinite(approvedAmount) ||
    approvedAmount <= 0
  ) {
    throw AppError.badRequest(`Variation ${variation.variationNumber} is not claimable`, {
      code: 'VARIATION_NOT_CLAIMABLE',
      variationNumber: variation.variationNumber,
      status: variation.status,
      claimedInId: variation.claimedInId,
      approvedAmount,
    });
  }
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

      let claimResult: ClaimCreateResult | undefined;

      for (let attempt = 1; attempt <= CLAIM_NUMBER_RETRY_LIMIT; attempt += 1) {
        try {
          claimResult = await prisma.$transaction(async (tx) => {
            if (requestKey) {
              const existing = await tx.progressClaim.findFirst({
                where: { projectId, requestKey },
                include: { _count: { select: { claimedLots: true, variations: true } } },
              });
              if (existing) {
                return {
                  claim: existing,
                  totalClaimedAmount: Number(existing.totalClaimedAmount ?? 0),
                  nextClaimNumber: existing.claimNumber,
                  lotCount: existing._count.claimedLots,
                  variationCount: existing._count.variations,
                  replayed: true,
                };
              }
            }

            await lockClaimLotsForUpdate(tx, projectId, uniqueLotIds);
            await lockClaimVariationsForUpdate(tx, projectId, uniqueVariationIds);

            // Get the next claim number for this project. A retry handles concurrent creates.
            const lastClaim = await tx.progressClaim.findFirst({
              where: { projectId },
              orderBy: { claimNumber: 'desc' },
            });
            const nextClaimNumber = (lastClaim?.claimNumber || 0) + 1;

            // Get the lots to calculate total amount. Progress claims are
            // cumulative, so a partially-claimed lot stays `conformed`
            // (claimedInId null) and remains selectable until its cumulative
            // claimed percentage reaches 100%. Only fully-claimed lots are
            // flipped to `claimed`.
            const lots =
              uniqueLotIds.length > 0
                ? await tx.lot.findMany({
                    where: {
                      id: { in: uniqueLotIds },
                      projectId,
                      status: 'conformed',
                      claimedInId: null,
                    },
                  })
                : [];

            if (uniqueLotIds.length > 0 && lots.length === 0) {
              throw AppError.badRequest('No valid conformed lots found');
            }

            if (lots.length !== uniqueLotIds.length) {
              throw AppError.badRequest(
                'All selected lots must be conformed, unclaimed, and belong to this project',
              );
            }

            const conformanceByLotId = await checkConformancePrerequisitesBatch(uniqueLotIds, tx);
            const staleConformanceLots = lots
              .map((lot) => ({
                lot,
                conformance: conformanceByLotId.get(lot.id),
              }))
              .map(({ lot, conformance }) => ({
                lot,
                blockingReasons: getClaimBlockingReasonsForConformedLot(conformance, {
                  conformanceOverridden: lot.conformanceOverriddenAt != null,
                }),
              }))
              .filter(({ blockingReasons }) => blockingReasons.length > 0);

            if (staleConformanceLots.length > 0) {
              throw AppError.badRequest(
                'One or more selected lots no longer satisfy conformance prerequisites',
                {
                  code: 'CONFORMANCE_STALE',
                  lots: staleConformanceLots.map(({ lot, blockingReasons }) => ({
                    id: lot.id,
                    lotNumber: lot.lotNumber,
                    blockingReasons,
                  })),
                },
              );
            }

            // Feature #894: Verify all lots have a rate (budgetAmount) set
            const lotsWithoutRate = lots.filter(
              (lot) => !lot.budgetAmount || Number(lot.budgetAmount) <= 0,
            );
            if (lotsWithoutRate.length > 0) {
              throw AppError.badRequest(
                `The following lots do not have a rate set: ${lotsWithoutRate.map((l) => l.lotNumber).join(', ')}. Please set a budget amount for each lot before adding to a claim.`,
                {
                  code: 'RATE_REQUIRED',
                  lotsWithoutRate: lotsWithoutRate.map((l) => ({
                    id: l.id,
                    lotNumber: l.lotNumber,
                  })),
                },
              );
            }

            // Cumulative claiming: reject any increment that would push a lot
            // past 100% of its budget across all of its claims so far.
            const priorCumulativeByLotId =
              uniqueLotIds.length > 0
                ? await getCumulativeClaimedPercentByLot(uniqueLotIds, tx)
                : new Map<string, number>();
            for (const lot of lots) {
              const increment = getRequestedClaimPercentage(percentageByLotId, lot.id);
              const priorCumulative = priorCumulativeByLotId.get(lot.id) ?? 0;
              assertClaimIncrementWithinRemaining(priorCumulative, increment, lot.lotNumber);
            }

            const variations =
              uniqueVariationIds.length > 0
                ? await tx.variation.findMany({
                    where: {
                      id: { in: uniqueVariationIds },
                      projectId,
                    },
                    select: {
                      id: true,
                      variationNumber: true,
                      status: true,
                      claimedInId: true,
                      approvedAmount: true,
                    },
                  })
                : [];

            if (variations.length !== uniqueVariationIds.length) {
              throw AppError.badRequest('All selected variations must belong to this project', {
                code: 'VARIATION_NOT_CLAIMABLE',
              });
            }

            for (const variation of variations) {
              assertVariationClaimable(variation);
            }

            // The line amount for each lot is THIS claim's increment percentage
            // of its budget, so claim totals always reconcile to the budget.
            const lotClaimedAmount = roundClaimAmountToCents(
              lots.reduce((sum, lot) => {
                const percentageComplete = getRequestedClaimPercentage(percentageByLotId, lot.id);
                const budgetAmount = lot.budgetAmount ? Number(lot.budgetAmount) : 0;
                return sum + roundClaimAmountToCents((budgetAmount * percentageComplete) / 100);
              }, 0),
            );
            const variationClaimedAmount = roundClaimAmountToCents(
              variations.reduce(
                (sum, variation) =>
                  sum + roundClaimAmountToCents(Number(variation.approvedAmount ?? 0)),
                0,
              ),
            );
            const totalClaimedAmount = roundClaimAmountToCents(
              lotClaimedAmount + variationClaimedAmount,
            );

            // Create the claim with claimed lots
            const claim = await tx.progressClaim.create({
              data: {
                projectId,
                claimNumber: nextClaimNumber,
                claimPeriodStart,
                claimPeriodEnd,
                status: 'draft',
                preparedById: userId,
                preparedAt: new Date(),
                requestKey: requestKey ?? null,
                totalClaimedAmount,
                claimedLots:
                  lots.length > 0
                    ? {
                        create: lots.map((lot) => {
                          const percentageComplete = getRequestedClaimPercentage(
                            percentageByLotId,
                            lot.id,
                          );
                          const budgetAmount = lot.budgetAmount ? Number(lot.budgetAmount) : 0;

                          return {
                            lotId: lot.id,
                            quantity: 1,
                            unit: 'ea',
                            rate: lot.budgetAmount,
                            amountClaimed: roundClaimAmountToCents(
                              (budgetAmount * percentageComplete) / 100,
                            ),
                            percentageComplete,
                          };
                        }),
                      }
                    : undefined,
              },
              include: {
                _count: {
                  select: { claimedLots: true, variations: true },
                },
              },
            });

            if (uniqueVariationIds.length > 0) {
              const variationUpdateResult = await tx.variation.updateMany({
                where: {
                  id: { in: uniqueVariationIds },
                  projectId,
                  status: 'approved',
                  claimedInId: null,
                },
                data: {
                  status: 'claimed',
                  claimedInId: claim.id,
                },
              });

              if (variationUpdateResult.count !== uniqueVariationIds.length) {
                throw AppError.badRequest(
                  'One or more selected variations are no longer available to claim',
                  {
                    code: 'VARIATION_NOT_CLAIMABLE',
                  },
                );
              }
            }

            // Flip only the lots that this claim takes to 100% cumulative into
            // the terminal `claimed` state, linking them to this completing
            // claim. Lots below 100% stay `conformed` so they can be claimed
            // again on a future claim.
            const fullyClaimedLotIds = lots
              .filter((lot) => {
                const increment = getRequestedClaimPercentage(percentageByLotId, lot.id);
                const priorCumulative = priorCumulativeByLotId.get(lot.id) ?? 0;
                return isLotFullyClaimed(priorCumulative + increment);
              })
              .map((lot) => lot.id);

            if (fullyClaimedLotIds.length > 0) {
              const updateResult = await tx.lot.updateMany({
                where: {
                  id: { in: fullyClaimedLotIds },
                  projectId,
                  status: 'conformed',
                  claimedInId: null,
                },
                data: {
                  claimedInId: claim.id,
                  status: 'claimed',
                },
              });

              if (updateResult.count !== fullyClaimedLotIds.length) {
                throw AppError.badRequest(
                  'One or more selected lots are no longer available to claim',
                );
              }
            }

            const claimWithCounts = await tx.progressClaim.findUniqueOrThrow({
              where: { id: claim.id },
              include: {
                _count: {
                  select: { claimedLots: true, variations: true },
                },
              },
            });

            return {
              claim: claimWithCounts,
              totalClaimedAmount,
              nextClaimNumber,
              lotCount: lots.length,
              variationCount: variations.length,
            };
          });
          break;
        } catch (error) {
          if (requestKey && isUniqueConstraintOn(error, ['projectId', 'requestKey'])) {
            const existing = await prisma.progressClaim.findFirst({
              where: { projectId, requestKey },
              include: { _count: { select: { claimedLots: true, variations: true } } },
            });
            if (existing) {
              claimResult = {
                claim: existing,
                totalClaimedAmount: Number(existing.totalClaimedAmount ?? 0),
                nextClaimNumber: existing.claimNumber,
                lotCount: existing._count.claimedLots,
                variationCount: existing._count.variations,
                replayed: true,
              };
              break;
            }
          }

          if (
            attempt < CLAIM_NUMBER_RETRY_LIMIT &&
            (isUniqueConstraintOn(error, ['projectId', 'claimNumber']) ||
              isPrismaTransactionWriteConflict(error))
          ) {
            continue;
          }
          throw error;
        }
      }

      if (!claimResult) {
        throw AppError.conflict('Could not allocate a claim number. Please try again.');
      }

      const { claim, totalClaimedAmount, nextClaimNumber, lotCount, variationCount } = claimResult;

      const transformedClaim = mapClaimCreateItem(claim);

      // Audit log for claim creation
      if (!claimResult.replayed) {
        await createAuditLog({
          projectId,
          userId,
          entityType: 'progress_claim',
          entityId: claim.id,
          action: AuditAction.CLAIM_CREATED,
          changes: { claimNumber: nextClaimNumber, totalClaimedAmount, lotCount, variationCount },
          req,
        });
      }

      res.status(201).json(buildClaimCreatedResponse(transformedClaim));
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
