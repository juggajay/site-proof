import { Router } from 'express';

import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { logError } from '../../lib/serverLogger.js';
import { sendNotificationIfEnabled } from '../notifications.js';
import {
  buildClaimCertifiedResponse,
  buildClaimDeletedResponse,
  buildClaimPaymentRecordedResponse,
} from './presentation.js';
import {
  CLAIM_AMOUNT_EPSILON,
  CLAIM_VARIATION_NOTES_MAX_LENGTH,
  MAX_CERTIFICATION_DOCUMENT_ID_LENGTH,
  assertCertifiedAmountWithinClaimTotal,
  assertReducedCertifiedAmountHasVariationNotes,
  buildClaimCertificationSettlement,
  certifyClaimSchema,
  normalizeOptionalCertificationString,
  parseOptionalClaimDate,
  recordPaymentSchema,
  roundClaimAmountToCents,
  serializeCertificationMetadataForStatusTransition,
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

interface ClaimWorkflowRouterDependencies {
  parseClaimRouteParam: (value: unknown, field: string) => string;
  requireCommercialProjectAccess: (
    user: AuthUser,
    projectId: string,
    options?: { requireWritable?: boolean },
  ) => Promise<void>;
}

async function getProjectCertificationDocumentId(
  client: Pick<typeof prisma, 'document'>,
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

  const document = await client.document.findFirst({
    where: { id: normalized, projectId },
    select: { id: true },
  });

  if (!document) {
    throw AppError.badRequest('certificationDocumentId must reference a document in this project');
  }

  return document.id;
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
      await requireCommercialProjectAccess(req.user!, projectId, { requireWritable: true });

      // Validate request body
      const validation = certifyClaimSchema.safeParse(req.body);
      if (!validation.success) {
        throw AppError.fromZodError(validation.error);
      }
      const { certifiedAmount, certificationDate } = validation.data;
      const roundedCertifiedAmount = roundClaimAmountToCents(certifiedAmount);
      const variationNotes = normalizeOptionalCertificationString(
        validation.data.variationNotes,
        'variationNotes',
        CLAIM_VARIATION_NOTES_MAX_LENGTH,
      );
      const certifiedAt =
        parseOptionalClaimDate(certificationDate, 'certificationDate') ?? new Date();

      const certificationResult = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
        SELECT id
        FROM progress_claims
        WHERE id = ${claimId} AND project_id = ${projectId}
        FOR UPDATE
      `;

        // Get the claim while holding the row lock so concurrent certify
        // requests see the committed status transition.
        const claim = await tx.progressClaim.findFirst({
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

        assertCertifiedAmountWithinClaimTotal(roundedCertifiedAmount, claim.totalClaimedAmount);
        assertReducedCertifiedAmountHasVariationNotes(
          roundedCertifiedAmount,
          claim.totalClaimedAmount,
          variationNotes,
        );

        const previousStatus = claim.status;

        const certDocId = await getProjectCertificationDocumentId(
          tx,
          projectId,
          validation.data.certificationDocumentId,
        );

        const certificationMetadata = serializeCertificationMetadataForStatusTransition({
          existingDisputeNotes: claim.disputeNotes,
          variationNotes,
          certificationDocumentId: certDocId || null,
          certifiedBy: userId,
        });
        const certificationSettlement = buildClaimCertificationSettlement(
          roundedCertifiedAmount,
          certifiedAt,
        );

        // Update the claim with certification details
        const updatedClaim = await tx.progressClaim.update({
          where: { id: claimId },
          data: {
            status: certificationSettlement.status,
            certifiedAmount: roundedCertifiedAmount,
            certifiedAt,
            paidAmount: certificationSettlement.paidAmount,
            paidAt: certificationSettlement.paidAt,
            disputedAt: null,
            // Store variation notes and document reference in disputeNotes field as JSON.
            disputeNotes: certificationMetadata,
          },
          include: {
            claimedLots: true,
          },
        });

        return {
          claim,
          updatedClaim,
          previousStatus,
          certDocId,
        };
      });

      const { claim, updatedClaim, previousStatus, certDocId } = certificationResult;

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
        }).format(roundedCertifiedAmount);

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
        changes: { previousStatus, certifiedAmount: roundedCertifiedAmount, variationNotes },
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
      await requireCommercialProjectAccess(req.user!, projectId, { requireWritable: true });

      // Validate request body
      const validation = recordPaymentSchema.safeParse(req.body);
      if (!validation.success) {
        throw AppError.fromZodError(validation.error);
      }
      const { paidAmount, paymentDate, paymentReference, paymentNotes } = validation.data;
      const roundedPaidAmount = roundClaimAmountToCents(paidAmount);
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
        const certifiedAmount = roundClaimAmountToCents(
          claim.certifiedAmount ? Number(claim.certifiedAmount) : 0,
        );
        const previousPaidAmount = roundClaimAmountToCents(
          claim.paidAmount ? Number(claim.paidAmount) : 0,
        );
        const outstandingBeforePayment = roundClaimAmountToCents(
          certifiedAmount - previousPaidAmount,
        );
        if (roundedPaidAmount - outstandingBeforePayment > CLAIM_AMOUNT_EPSILON) {
          throw AppError.badRequest(
            'Payment amount cannot exceed the outstanding certified amount',
          );
        }

        const totalPaid = roundClaimAmountToCents(previousPaidAmount + roundedPaidAmount);
        const outstanding = roundClaimAmountToCents(certifiedAmount - totalPaid);
        const newStatus = outstanding <= CLAIM_AMOUNT_EPSILON ? 'paid' : 'partially_paid';

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
          amount: roundedPaidAmount,
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
        }).format(roundedPaidAmount);

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
          amount: roundedPaidAmount,
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
          paidAmount: roundedPaidAmount,
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
      const userId = req.user!.userId;
      await requireCommercialProjectAccess(req.user!, projectId, { requireWritable: true });

      const deleteResult = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM progress_claims
          WHERE id = ${claimId} AND project_id = ${projectId}
          FOR UPDATE
        `;

        const claim = await tx.progressClaim.findFirst({
          where: { id: claimId, projectId },
          include: {
            _count: { select: { claimedLots: true } },
          },
        });

        if (!claim) {
          throw AppError.notFound('Claim');
        }

        if (claim.status !== 'draft') {
          throw AppError.badRequest('Can only delete draft claims');
        }

        // Release this claim's increments. Deleting the claim cascades its
        // ClaimedLot rows, so cumulative claimed percentages recover on their
        // own. Lots this claim had taken to 100% (status `claimed`, linked via
        // claimedInId) must be returned to `conformed` so they can be claimed
        // again.
        const releasedClaimedLots = await tx.lot.updateMany({
          where: { claimedInId: claimId, projectId, status: 'claimed' },
          data: { claimedInId: null, status: 'conformed' },
        });
        const clearedStaleLotLinks = await tx.lot.updateMany({
          where: { claimedInId: claimId, projectId },
          data: { claimedInId: null },
        });
        await tx.progressClaim.delete({
          where: { id: claimId },
        });

        return { claim, releasedClaimedLots, clearedStaleLotLinks };
      });

      const { claim, releasedClaimedLots, clearedStaleLotLinks } = deleteResult;

      await createAuditLog({
        projectId,
        userId,
        entityType: 'progress_claim',
        entityId: claimId,
        action: AuditAction.CLAIM_DELETED,
        changes: {
          claimNumber: claim.claimNumber,
          previousStatus: claim.status,
          totalClaimedAmount: Number(claim.totalClaimedAmount),
          lotCount: claim._count.claimedLots,
          releasedClaimedLots: releasedClaimedLots.count,
          clearedStaleLotLinks: clearedStaleLotLinks.count,
        },
        req,
      });

      res.json(buildClaimDeletedResponse());
    }),
  );

  return postEvidenceWorkflowRouter;
}
