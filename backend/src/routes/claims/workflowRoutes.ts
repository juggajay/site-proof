import { Router } from 'express';
import type { Prisma } from '@prisma/client';

import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { logError } from '../../lib/serverLogger.js';
import { sendNotificationIfEnabled } from '../notifications.js';
import {
  buildClaimCertifiedResponse,
  buildClaimCreatedResponse,
  buildClaimDeletedResponse,
  buildClaimDetailResponse,
  buildClaimPaymentRecordedResponse,
  mapClaimCreateItem,
} from './presentation.js';
import {
  CLAIM_AMOUNT_EPSILON,
  CLAIM_LOT_PERCENTAGE_REQUIRED_MESSAGE,
  CLAIM_NUMBER_RETRY_LIMIT,
  MAX_CERTIFICATION_DOCUMENT_ID_LENGTH,
  assertCertifiedAmountWithinClaimTotal,
  assertGenericClaimStatusTransition,
  certifyClaimSchema,
  createClaimSchema,
  getRequestedClaimLots,
  getRequestedClaimPercentage,
  normalizeCertificationDocumentUrl,
  normalizeOptionalCertificationString,
  parseClaimDate,
  parseOptionalClaimDate,
  recordPaymentSchema,
  sanitizeCertificationDocumentFilename,
  updateClaimSchema,
} from './workflowValidation.js';

interface PaymentHistoryEntry {
  amount: number;
  date: string;
  reference: string | null;
  notes: string | null;
  recordedAt: string;
  recordedBy: string;
}

type AuthUser = NonNullable<Express.Request['user']>;
type ClaimCreateResult = {
  claim: Prisma.ProgressClaimGetPayload<{ include: { _count: { select: { claimedLots: true } } } }>;
  totalClaimedAmount: number;
  nextClaimNumber: number;
  lotCount: number;
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

async function getProjectCertificationDocumentId(
  projectId: string,
  documentId: string | undefined,
): Promise<string | undefined> {
  const normalized = normalizeOptionalCertificationString(
    documentId,
    'certificationDocumentId',
    MAX_CERTIFICATION_DOCUMENT_ID_LENGTH,
  );

  if (!normalized) {
    return undefined;
  }

  const document = await prisma.document.findFirst({
    where: { id: normalized, projectId },
    select: { id: true },
  });

  if (!document) {
    throw AppError.badRequest('certificationDocumentId must reference a document in this project');
  }

  return document.id;
}

interface ClaimWorkflowRouterDependencies {
  parseClaimRouteParam: (value: unknown, field: string) => string;
  requireCommercialProjectAccess: (user: AuthUser, projectId: string) => Promise<void>;
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
      await requireCommercialProjectAccess(req.user!, projectId);

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
      const requestedLots = getRequestedClaimLots(validation.data);
      const claimPeriodStart = parseClaimDate(periodStart, 'periodStart');
      const claimPeriodEnd = parseClaimDate(periodEnd, 'periodEnd');

      if (claimPeriodEnd < claimPeriodStart) {
        throw AppError.badRequest('Period end must be on or after period start');
      }

      const uniqueLotIds = Array.from(new Set(requestedLots.map((lot) => lot.lotId)));
      if (uniqueLotIds.length !== requestedLots.length) {
        throw AppError.badRequest('Duplicate lots cannot be added to the same claim');
      }
      const percentageByLotId = new Map(
        requestedLots.map((lot) => [lot.lotId, lot.percentageComplete]),
      );

      let claimResult: ClaimCreateResult | undefined;

      for (let attempt = 1; attempt <= CLAIM_NUMBER_RETRY_LIMIT; attempt += 1) {
        try {
          claimResult = await prisma.$transaction(async (tx) => {
            // Get the next claim number for this project. A retry handles concurrent creates.
            const lastClaim = await tx.progressClaim.findFirst({
              where: { projectId },
              orderBy: { claimNumber: 'desc' },
            });
            const nextClaimNumber = (lastClaim?.claimNumber || 0) + 1;

            // Get the lots to calculate total amount
            const lots = await tx.lot.findMany({
              where: {
                id: { in: uniqueLotIds },
                projectId,
                status: 'conformed',
                claimedInId: null,
              },
            });

            if (lots.length === 0) {
              throw AppError.badRequest('No valid conformed lots found');
            }

            if (lots.length !== uniqueLotIds.length) {
              throw AppError.badRequest(
                'All selected lots must be conformed, unclaimed, and belong to this project',
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

            // Calculate total claimed amount from lot budget amounts and requested progress.
            const totalClaimedAmount = lots.reduce((sum, lot) => {
              const percentageComplete = getRequestedClaimPercentage(percentageByLotId, lot.id);
              const budgetAmount = lot.budgetAmount ? Number(lot.budgetAmount) : 0;
              return sum + (budgetAmount * percentageComplete) / 100;
            }, 0);

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
                totalClaimedAmount,
                claimedLots: {
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
                      amountClaimed: (budgetAmount * percentageComplete) / 100,
                      percentageComplete,
                    };
                  }),
                },
              },
              include: {
                _count: {
                  select: { claimedLots: true },
                },
              },
            });

            // Update only the eligible project lots to link them to this claim and set status to claimed.
            const updateResult = await tx.lot.updateMany({
              where: {
                id: { in: uniqueLotIds },
                projectId,
                status: 'conformed',
                claimedInId: null,
              },
              data: {
                claimedInId: claim.id,
                status: 'claimed',
              },
            });

            if (updateResult.count !== lots.length) {
              throw AppError.badRequest(
                'One or more selected lots are no longer available to claim',
              );
            }

            return { claim, totalClaimedAmount, nextClaimNumber, lotCount: lots.length };
          });
          break;
        } catch (error) {
          if (
            attempt < CLAIM_NUMBER_RETRY_LIMIT &&
            isUniqueConstraintOn(error, ['projectId', 'claimNumber'])
          ) {
            continue;
          }
          throw error;
        }
      }

      if (!claimResult) {
        throw AppError.conflict('Could not allocate a claim number. Please try again.');
      }

      const { claim, totalClaimedAmount, nextClaimNumber, lotCount } = claimResult;

      const transformedClaim = mapClaimCreateItem(claim);

      // Audit log for claim creation
      await createAuditLog({
        projectId,
        userId,
        entityType: 'progress_claim',
        entityId: claim.id,
        action: AuditAction.CLAIM_CREATED,
        changes: { claimNumber: nextClaimNumber, totalClaimedAmount, lotCount },
        req,
      });

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
      await requireCommercialProjectAccess(req.user!, projectId);

      // Validate request body
      const validation = updateClaimSchema.safeParse(req.body);
      if (!validation.success) {
        throw AppError.fromZodError(validation.error);
      }
      const { status, certifiedAmount, paidAmount, paymentReference, disputeNotes } =
        validation.data;

      if (status === 'certified' && certifiedAmount === undefined) {
        throw AppError.badRequest('Certified amount is required when certifying a claim');
      }

      if (status === 'paid' && paidAmount === undefined) {
        throw AppError.badRequest('Paid amount is required when marking a claim as paid');
      }

      const claim = await prisma.progressClaim.findFirst({
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

      if (status === 'certified' && certifiedAmount !== undefined) {
        assertCertifiedAmountWithinClaimTotal(certifiedAmount, claim.totalClaimedAmount);
      }

      if (status === 'paid' && paidAmount !== undefined) {
        const certifiedTotal = claim.certifiedAmount ? Number(claim.certifiedAmount) : 0;
        if (claim.status !== 'certified' || certifiedTotal <= 0) {
          throw AppError.badRequest(
            'Can only mark certified claims with a certified amount as paid',
          );
        }

        if (Math.abs(paidAmount - certifiedTotal) > CLAIM_AMOUNT_EPSILON) {
          throw AppError.badRequest(
            'Paid amount must equal the certified amount when marking a claim as paid',
          );
        }
      }

      if (
        (status === 'certified' && claim.status === 'certified' && claim.certifiedAt) ||
        (status === 'disputed' && claim.status === 'disputed' && claim.disputedAt)
      ) {
        const existingClaim = await prisma.progressClaim.findUniqueOrThrow({
          where: { id: claimId },
          include: {
            _count: {
              select: { claimedLots: true },
            },
          },
        });
        res.json(buildClaimDetailResponse(existingClaim));
        return;
      }

      const updateData: Prisma.ProgressClaimUpdateInput = {};
      const previousStatus = claim.status;

      if (status) {
        updateData.status = status;
        if (status === 'submitted') {
          updateData.submittedAt = new Date();
        }
        if (status === 'certified' && certifiedAmount !== undefined) {
          updateData.certifiedAmount = certifiedAmount;
          updateData.certifiedAt = new Date();
        }
        if (status === 'paid' && paidAmount !== undefined) {
          updateData.paidAmount = paidAmount;
          updateData.paidAt = new Date();
          updateData.paymentReference = paymentReference || null;
        }
        if (status === 'disputed') {
          updateData.disputedAt = new Date();
          updateData.disputeNotes = disputeNotes || null;
        }
      }

      const updatedClaim = await prisma.progressClaim.update({
        where: { id: claimId },
        data: updateData,
        include: {
          _count: {
            select: { claimedLots: true },
          },
        },
      });

      // Feature #931 - Notify project managers when a claim is certified
      if (
        status === 'certified' &&
        previousStatus !== 'certified' &&
        certifiedAmount !== undefined
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
          }).format(certifiedAmount);

          // Create notifications for project managers
          const notificationsToCreate = pmUsers.map((pm) => ({
            userId: pm.id,
            projectId,
            type: 'claim_certified',
            title: 'Claim Certified',
            message: `Claim #${claim.claimNumber} has been certified by ${certifierName}. Certified amount: ${formattedAmount}.`,
            linkUrl: `/projects/${projectId}/claims`,
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
                linkUrl: `/projects/${projectId}/claims`,
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
      if (status === 'paid' && previousStatus !== 'paid' && paidAmount !== undefined) {
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
          }).format(paidAmount);

          // Create notifications for project managers
          const notificationsToCreate = pmUsers.map((pm) => ({
            userId: pm.id,
            projectId,
            type: 'claim_paid',
            title: 'Claim Payment Received',
            message: `Claim #${claim.claimNumber} payment of ${formattedAmount} has been recorded${paymentReference ? ` (Ref: ${paymentReference})` : ''}.`,
            linkUrl: `/projects/${projectId}/claims`,
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
                linkUrl: `/projects/${projectId}/claims`,
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
          changes: { previousStatus, newStatus: status, certifiedAmount, paidAmount },
          req,
        });
      }

      res.json(buildClaimDetailResponse(updatedClaim));
    }),
  );

  return workflowRouter;
}

export function createClaimPostEvidenceWorkflowRouter({
  parseClaimRouteParam,
  requireCommercialProjectAccess,
}: ClaimWorkflowRouterDependencies) {
  const postEvidenceWorkflowRouter = Router();

  // Feature #284: POST /api/projects/:projectId/claims/:claimId/certify - Record certification
  // Dedicated endpoint for recording claim certification with all details
  postEvidenceWorkflowRouter.post(
    '/:projectId/claims/:claimId/certify',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      const claimId = parseClaimRouteParam(req.params.claimId, 'claimId');
      const userId = req.user!.userId;
      await requireCommercialProjectAccess(req.user!, projectId);

      // Validate request body
      const validation = certifyClaimSchema.safeParse(req.body);
      if (!validation.success) {
        throw AppError.fromZodError(validation.error);
      }
      const { certifiedAmount, certificationDate } = validation.data;
      const variationNotes = normalizeOptionalCertificationString(
        validation.data.variationNotes,
        'variationNotes',
        2000,
      );
      const certificationDocumentUrl = normalizeCertificationDocumentUrl(
        validation.data.certificationDocumentUrl,
      );
      const certificationDocumentFilename = validation.data.certificationDocumentFilename;
      const certifiedAt =
        parseOptionalClaimDate(certificationDate, 'certificationDate') ?? new Date();

      // Get the claim
      const claim = await prisma.progressClaim.findFirst({
        where: { id: claimId, projectId },
        include: {
          project: { select: { id: true, name: true } },
        },
      });

      if (!claim) {
        throw AppError.notFound('Claim');
      }

      // Only allow certification of submitted claims
      if (claim.status !== 'submitted' && claim.status !== 'disputed') {
        throw AppError.badRequest(
          `Can only certify submitted or disputed claims. Current status: ${claim.status}`,
        );
      }

      assertCertifiedAmountWithinClaimTotal(certifiedAmount, claim.totalClaimedAmount);

      const previousStatus = claim.status;

      // Create certification document record if URL provided
      let certDocId = await getProjectCertificationDocumentId(
        projectId,
        validation.data.certificationDocumentId,
      );
      if (certificationDocumentUrl && !certDocId) {
        const certDoc = await prisma.document.create({
          data: {
            projectId,
            documentType: 'certificate',
            category: 'certification',
            filename: sanitizeCertificationDocumentFilename(
              certificationDocumentFilename,
              claim.claimNumber,
            ),
            fileUrl: certificationDocumentUrl,
            uploadedById: userId,
            caption: `Certification document for Claim #${claim.claimNumber}`,
          },
        });
        certDocId = certDoc.id;
      }

      const certificationMetadata =
        variationNotes || certDocId
          ? JSON.stringify({
              variationNotes: variationNotes || null,
              certificationDocumentId: certDocId || null,
              certifiedBy: userId,
            })
          : claim.disputeNotes;

      // Update the claim with certification details
      const updatedClaim = await prisma.progressClaim.update({
        where: { id: claimId },
        data: {
          status: 'certified',
          certifiedAmount: certifiedAmount,
          certifiedAt,
          // Store variation notes and document reference in disputeNotes field as JSON.
          disputeNotes: certificationMetadata,
        },
        include: {
          claimedLots: true,
        },
      });

      // Send notifications to project managers
      try {
        const certifier = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, fullName: true },
        });
        const certifierName = certifier?.fullName || certifier?.email || 'Unknown';

        const projectManagers = await prisma.projectUser.findMany({
          where: {
            projectId,
            role: 'project_manager',
            status: 'active',
          },
        });

        const pmUserIds = projectManagers.map((pm) => pm.userId);
        const pmUsers =
          pmUserIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: pmUserIds } },
                select: { id: true, email: true, fullName: true },
              })
            : [];

        const formattedAmount = new Intl.NumberFormat('en-AU', {
          style: 'currency',
          currency: 'AUD',
        }).format(certifiedAmount);

        // Create in-app notifications
        if (pmUsers.length > 0) {
          await prisma.notification.createMany({
            data: pmUsers.map((pm) => ({
              userId: pm.id,
              projectId,
              type: 'claim_certified',
              title: 'Claim Certified',
              message: `Claim #${claim.claimNumber} has been certified by ${certifierName}. Certified amount: ${formattedAmount}.${variationNotes ? ` Variations: ${variationNotes.substring(0, 100)}${variationNotes.length > 100 ? '...' : ''}` : ''}`,
              linkUrl: `/projects/${projectId}/claims`,
            })),
          });
        }

        // Send email notifications
        for (const pm of pmUsers) {
          try {
            await sendNotificationIfEnabled(pm.id, 'enabled', {
              title: 'Claim Certified',
              message: `Claim #${claim.claimNumber} has been certified.\n\nProject: ${claim.project.name}\nCertified Amount: ${formattedAmount}${variationNotes ? `\nVariations: ${variationNotes}` : ''}\n\nPlease review the claim details in the system.`,
              projectName: claim.project.name,
              linkUrl: `/projects/${projectId}/claims`,
            });
          } catch (emailError) {
            logError(`Failed to send certification email to PM ${pm.id}:`, emailError);
          }
        }
      } catch (notifError) {
        logError('Failed to send certification notifications:', notifError);
      }

      const response = buildClaimCertifiedResponse(
        updatedClaim,
        previousStatus,
        variationNotes,
        certDocId || null,
      );

      // Audit log for claim certification
      await createAuditLog({
        projectId,
        userId,
        entityType: 'progress_claim',
        entityId: claimId,
        action: AuditAction.CLAIM_CERTIFIED,
        changes: { previousStatus, certifiedAmount, variationNotes },
        req,
      });

      res.json(response);
    }),
  );

  // Feature #285: POST /api/projects/:projectId/claims/:claimId/payment - Record payment
  // Dedicated endpoint for recording claim payment with support for partial payments
  postEvidenceWorkflowRouter.post(
    '/:projectId/claims/:claimId/payment',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      const claimId = parseClaimRouteParam(req.params.claimId, 'claimId');
      const userId = req.user!.userId;
      await requireCommercialProjectAccess(req.user!, projectId);

      // Validate request body
      const validation = recordPaymentSchema.safeParse(req.body);
      if (!validation.success) {
        throw AppError.fromZodError(validation.error);
      }
      const { paidAmount, paymentDate, paymentReference, paymentNotes } = validation.data;
      const paidAt = parseOptionalClaimDate(paymentDate, 'paymentDate') ?? new Date();
      const paymentDateForHistory = paymentDate || paidAt.toISOString().split('T')[0];
      const recordedAt = new Date().toISOString();

      const paymentResult = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
        SELECT id
        FROM progress_claims
        WHERE id = ${claimId} AND project_id = ${projectId}
        FOR UPDATE
      `;

        const claim = await tx.progressClaim.findFirst({
          where: { id: claimId, projectId },
          include: {
            project: { select: { id: true, name: true } },
          },
        });

        if (!claim) {
          throw AppError.notFound('Claim');
        }

        // Only allow payment of certified or partially paid claims
        if (claim.status !== 'certified' && claim.status !== 'partially_paid') {
          throw AppError.badRequest(
            `Can only record payment for certified or partially paid claims. Current status: ${claim.status}`,
          );
        }

        const previousStatus = claim.status;
        const certifiedAmount = claim.certifiedAmount ? Number(claim.certifiedAmount) : 0;
        const previousPaidAmount = claim.paidAmount ? Number(claim.paidAmount) : 0;
        const outstandingBeforePayment = certifiedAmount - previousPaidAmount;
        if (paidAmount - outstandingBeforePayment > CLAIM_AMOUNT_EPSILON) {
          throw AppError.badRequest(
            'Payment amount cannot exceed the outstanding certified amount',
          );
        }

        const totalPaid = previousPaidAmount + paidAmount;
        const outstanding = certifiedAmount - totalPaid;
        const newStatus = outstanding <= 0 ? 'paid' : 'partially_paid';

        // Build notes with payment history using disputeNotes field
        let existingDisputeNotes: Record<string, unknown> = {};
        const paymentHistory: PaymentHistoryEntry[] = [];
        if (claim.disputeNotes) {
          try {
            const existingNotes = JSON.parse(claim.disputeNotes) as {
              paymentHistory?: PaymentHistoryEntry[];
            } & Record<string, unknown>;
            existingDisputeNotes = existingNotes;
            if (Array.isArray(existingNotes.paymentHistory)) {
              paymentHistory.push(...existingNotes.paymentHistory);
            }
          } catch (_e) {
            // Not JSON, start fresh
          }
        }

        paymentHistory.push({
          amount: paidAmount,
          date: paymentDateForHistory,
          reference: paymentReference || null,
          notes: paymentNotes || null,
          recordedAt,
          recordedBy: userId,
        });

        const updatedClaim = await tx.progressClaim.update({
          where: { id: claimId },
          data: {
            status: newStatus,
            paidAmount: totalPaid,
            paidAt,
            paymentReference: paymentReference || claim.paymentReference,
            disputeNotes: JSON.stringify({
              ...existingDisputeNotes,
              paymentHistory,
              lastPaymentNotes: paymentNotes,
            }),
          },
          include: {
            claimedLots: true,
          },
        });

        return {
          claim,
          updatedClaim,
          previousStatus,
          newStatus,
          totalPaid,
          outstanding,
          paymentHistory,
        };
      });

      const {
        claim,
        updatedClaim,
        previousStatus,
        newStatus,
        totalPaid,
        outstanding,
        paymentHistory,
      } = paymentResult;

      // Send notifications to project managers
      try {
        const payer = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, fullName: true },
        });
        const payerName = payer?.fullName || payer?.email || 'Unknown';

        const projectManagers = await prisma.projectUser.findMany({
          where: {
            projectId,
            role: 'project_manager',
            status: 'active',
          },
        });

        const pmUserIds = projectManagers.map((pm) => pm.userId);
        const pmUsers =
          pmUserIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: pmUserIds } },
                select: { id: true, email: true, fullName: true },
              })
            : [];

        const formattedPaidAmount = new Intl.NumberFormat('en-AU', {
          style: 'currency',
          currency: 'AUD',
        }).format(paidAmount);

        const formattedOutstanding = new Intl.NumberFormat('en-AU', {
          style: 'currency',
          currency: 'AUD',
        }).format(Math.max(0, outstanding));

        const notificationType = newStatus === 'paid' ? 'claim_paid' : 'claim_partial_payment';
        const notificationTitle =
          newStatus === 'paid' ? 'Claim Payment Complete' : 'Partial Payment Received';
        const notificationMessage =
          newStatus === 'paid'
            ? `Claim #${claim.claimNumber} payment of ${formattedPaidAmount} has been recorded${paymentReference ? ` (Ref: ${paymentReference})` : ''}. Claim is now fully paid.`
            : `Partial payment of ${formattedPaidAmount} recorded for Claim #${claim.claimNumber}${paymentReference ? ` (Ref: ${paymentReference})` : ''}. Outstanding: ${formattedOutstanding}.`;

        // Create in-app notifications
        if (pmUsers.length > 0) {
          await prisma.notification.createMany({
            data: pmUsers.map((pm) => ({
              userId: pm.id,
              projectId,
              type: notificationType,
              title: notificationTitle,
              message: notificationMessage,
              linkUrl: `/projects/${projectId}/claims`,
            })),
          });
        }

        // Send email notifications
        for (const pm of pmUsers) {
          try {
            await sendNotificationIfEnabled(pm.id, 'enabled', {
              title: notificationTitle,
              message: `${notificationMessage}\n\nProject: ${claim.project.name}\nRecorded by: ${payerName}\n\nPlease review the payment details in the system.`,
              projectName: claim.project.name,
              linkUrl: `/projects/${projectId}/claims`,
            });
          } catch (emailError) {
            logError(`Failed to send payment email to PM ${pm.id}:`, emailError);
          }
        }
      } catch (notifError) {
        logError('Failed to send payment notifications:', notifError);
      }

      const response = buildClaimPaymentRecordedResponse(
        updatedClaim,
        {
          amount: paidAmount,
          date: paymentDateForHistory,
          reference: paymentReference,
          notes: paymentNotes,
        },
        outstanding,
        previousStatus,
        paymentHistory,
      );

      // Audit log for claim payment
      await createAuditLog({
        projectId,
        userId,
        entityType: 'progress_claim',
        entityId: claimId,
        action: AuditAction.CLAIM_PAYMENT_RECORDED,
        changes: {
          previousStatus,
          newStatus,
          paidAmount,
          paymentReference,
          totalPaid,
          outstanding,
        },
        req,
      });

      res.json(response);
    }),
  );

  // DELETE /api/projects/:projectId/claims/:claimId - Delete a draft claim
  postEvidenceWorkflowRouter.delete(
    '/:projectId/claims/:claimId',
    asyncHandler(async (req, res) => {
      const projectId = parseClaimRouteParam(req.params.projectId, 'projectId');
      const claimId = parseClaimRouteParam(req.params.claimId, 'claimId');
      await requireCommercialProjectAccess(req.user!, projectId);

      const claim = await prisma.progressClaim.findFirst({
        where: { id: claimId, projectId },
      });

      if (!claim) {
        throw AppError.notFound('Claim');
      }

      if (claim.status !== 'draft') {
        throw AppError.badRequest('Can only delete draft claims');
      }

      // Unlink lots from this claim
      await prisma.lot.updateMany({
        where: { claimedInId: claimId, projectId },
        data: { claimedInId: null },
      });

      // Delete the claim (cascades to claimedLots)
      await prisma.progressClaim.delete({
        where: { id: claimId },
      });

      res.json(buildClaimDeletedResponse());
    }),
  );

  return postEvidenceWorkflowRouter;
}
