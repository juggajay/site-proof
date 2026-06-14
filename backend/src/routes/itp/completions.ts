// ITP completion recording, hold point completions, witness point completions
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { type AuthUser } from '../../lib/auth.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { checkAndNotifyWitnessPoint } from './helpers/witnessPoints.js';
import { updateLotStatusFromITP } from './helpers/lotProgression.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  ITP_WRITE_ROLES,
  isItpSubcontractorUser,
  requireItpLotRole,
  requireItpProjectRole,
  requireItpSubcontractorCompletionPermission,
} from './helpers/access.js';
import { logError } from '../../lib/serverLogger.js';
import { createNcrWithAllocatedNumber } from '../ncrs/ncrNumberAllocation.js';
import { buildChecklistItemNcrMarker } from './instances/ncrLinks.js';
import { buildItpCompletionResultResponse } from './completionResponses.js';
import {
  buildItpCompletionTransform,
  buildItpCompletionWitnessData,
  buildItpSubbieCompletionNotifications,
  deriveItpCompletionStatus,
  isItpCompletionFinished,
  parseProjectRequiresSubcontractorVerification,
  resolveSubcontractorVerificationStatus,
  shouldCreateFailedItpNcr,
} from './completionWorkflow.js';
import { completionAttachmentRoutes } from './completionAttachmentRoutes.js';
import { completionUpdateRoutes } from './completionUpdateRoutes.js';
import { completionVerificationRoutes } from './completionVerificationRoutes.js';
import { isReleaseGatedChecklistItem } from '../../lib/holdPointReleaseGating.js';
import {
  isSubcontractorVisibleChecklistItem,
  resolveChecklistItemForInstance,
} from './helpers/templateSnapshot.js';

// ============== Zod Schemas ==============
const ITP_COMPLETION_NOTES_MAX_LENGTH = 5000;
const ITP_COMPLETION_FAILURE_DESCRIPTION_MAX_LENGTH = 5000;
const ITP_COMPLETION_SHORT_TEXT_MAX_LENGTH = 160;
const ITP_SIGNATURE_DATA_URL_MAX_LENGTH = 512_000;

// POST /completions - Complete/update checklist item
const createCompletionSchema = z.object({
  itpInstanceId: z.string().uuid(),
  checklistItemId: z.string().uuid(),
  isCompleted: z.boolean().optional(),
  notes: z
    .string()
    .max(
      ITP_COMPLETION_NOTES_MAX_LENGTH,
      `Notes must be ${ITP_COMPLETION_NOTES_MAX_LENGTH} characters or less`,
    )
    .optional()
    .nullable(),
  status: z.enum(['pending', 'completed', 'not_applicable', 'failed']).optional(),
  // NCR details for failed status
  ncrDescription: z
    .string()
    .max(
      ITP_COMPLETION_FAILURE_DESCRIPTION_MAX_LENGTH,
      `NCR description must be ${ITP_COMPLETION_FAILURE_DESCRIPTION_MAX_LENGTH} characters or less`,
    )
    .optional(),
  ncrCategory: z
    .string()
    .max(
      ITP_COMPLETION_SHORT_TEXT_MAX_LENGTH,
      `NCR category must be ${ITP_COMPLETION_SHORT_TEXT_MAX_LENGTH} characters or less`,
    )
    .optional(),
  ncrSeverity: z.enum(['minor', 'major', 'critical']).optional(),
  // Witness point details
  witnessPresent: z.boolean().optional(),
  witnessName: z
    .string()
    .max(
      ITP_COMPLETION_SHORT_TEXT_MAX_LENGTH,
      `Witness name must be ${ITP_COMPLETION_SHORT_TEXT_MAX_LENGTH} characters or less`,
    )
    .optional()
    .nullable(),
  witnessCompany: z
    .string()
    .max(
      ITP_COMPLETION_SHORT_TEXT_MAX_LENGTH,
      `Witness company must be ${ITP_COMPLETION_SHORT_TEXT_MAX_LENGTH} characters or less`,
    )
    .optional()
    .nullable(),
  // Feature #463: Signature capture
  signatureDataUrl: z
    .string()
    .max(
      ITP_SIGNATURE_DATA_URL_MAX_LENGTH,
      `Signature data must be ${ITP_SIGNATURE_DATA_URL_MAX_LENGTH} characters or less`,
    )
    .optional()
    .nullable(),
});

export const completionsRouter = Router();

// Complete/update a checklist item (supports N/A and Failed status with reason)
completionsRouter.post(
  '/completions',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const parseResult = createCompletionSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }
    const {
      itpInstanceId,
      checklistItemId,
      isCompleted,
      notes,
      status: directStatus,
      // NCR details for failed status
      ncrDescription,
      ncrCategory,
      ncrSeverity,
      // Witness point details
      witnessPresent,
      witnessName,
      witnessCompany,
      // Feature #463: Signature capture
      signatureDataUrl,
    } = parseResult.data;

    // Validate required reasons and derive the completion status (direct status
    // takes precedence over the isCompleted flag). See completionWorkflow.ts.
    const newStatus = deriveItpCompletionStatus({
      directStatus,
      isCompleted,
      notes,
      ncrDescription,
    });

    const itpInstanceForAccess = await prisma.iTPInstance.findUnique({
      where: { id: itpInstanceId },
      select: {
        lotId: true,
        templateId: true,
        templateSnapshot: true,
        lot: { select: { projectId: true } },
        template: { select: { projectId: true } },
      },
    });

    if (!itpInstanceForAccess) {
      throw AppError.notFound('ITP instance');
    }

    const completionProjectId =
      itpInstanceForAccess.lot?.projectId || itpInstanceForAccess.template.projectId;
    if (!completionProjectId) {
      throw AppError.badRequest('Unable to determine project for ITP completion');
    }

    let subcontractorCompletionAssignment: { itpRequiresVerification: boolean } | null = null;
    if (itpInstanceForAccess.lotId) {
      await requireItpLotRole(
        user,
        completionProjectId,
        itpInstanceForAccess.lotId,
        ITP_WRITE_ROLES,
        'ITP completion write access required',
      );
      subcontractorCompletionAssignment = await requireItpSubcontractorCompletionPermission(
        user,
        completionProjectId,
        itpInstanceForAccess.lotId,
      );
    } else {
      await requireItpProjectRole(
        user,
        completionProjectId,
        ITP_WRITE_ROLES,
        'ITP completion write access required',
      );
      if (isItpSubcontractorUser(user)) {
        throw AppError.forbidden('ITP completion write access required');
      }
    }

    const checklistItem = await prisma.iTPChecklistItem.findFirst({
      where: {
        id: checklistItemId,
        templateId: itpInstanceForAccess.templateId,
      },
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
    });

    if (!checklistItem) {
      throw AppError.badRequest('Checklist item does not belong to this ITP instance');
    }

    const checklistItemForInstance = resolveChecklistItemForInstance(
      itpInstanceForAccess,
      checklistItemId,
      checklistItem,
    );

    if (!checklistItemForInstance) {
      throw AppError.badRequest('Checklist item does not belong to this ITP instance');
    }

    if (
      isItpSubcontractorUser(user) &&
      !isSubcontractorVisibleChecklistItem(checklistItemForInstance)
    ) {
      throw AppError.forbidden('ITP completion write access required');
    }

    // I1-core GUARD: a hold-point (or superintendent sign-off) item must be
    // satisfied through the hold-point release flow, which records who released
    // it, when, and how. Block the bare "tick it complete" path for these items
    // UNLESS the corresponding HoldPoint has already been released (in which case
    // the attribution is on the HoldPoint and the completion just mirrors it).
    //
    // Witness items are intentionally NOT blocked (witness points are not hard
    // blockers), and N/A / Failed flows stay open so a contractor can still mark
    // a hold point N/A or raise an NCR. The guard fires only when FINISHING the
    // item as 'completed'.
    const isHoldPointSignoffItem = isReleaseGatedChecklistItem(checklistItemForInstance);

    if (newStatus === 'completed' && isHoldPointSignoffItem) {
      let holdPointReleased = false;
      if (itpInstanceForAccess.lotId) {
        const releasedHoldPoint = await prisma.holdPoint.findFirst({
          where: {
            itpChecklistItemId: checklistItemId,
            lotId: itpInstanceForAccess.lotId,
            status: 'released',
          },
          select: { id: true },
        });
        holdPointReleased = !!releasedHoldPoint;
      }

      if (!holdPointReleased) {
        throw AppError.badRequest(
          'This is a hold point. It must be released through the hold-point release flow ' +
            '(which records who released it, when, and how) before the ITP item can be completed.',
        );
      }
    }

    // Feature #271: Check if user is a subcontractor
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.userId },
      include: { subcontractorCompany: { select: { id: true, companyName: true } } },
    });
    const isSubcontractor = !!subcontractorUser;

    // Determine completedAt and completedById based on status
    const isFinished = isItpCompletionFinished(newStatus);

    // Feature #271: Subcontractor completions - check lot assignment for ITP permissions
    let verificationStatus: string | undefined;
    if (isSubcontractor && isFinished && newStatus === 'completed') {
      // Get the ITP instance to find the lot and project
      const itpInstanceForPermCheck = await prisma.iTPInstance.findUnique({
        where: { id: itpInstanceId },
        select: {
          lotId: true,
          lot: {
            select: {
              project: {
                select: { id: true, settings: true },
              },
            },
          },
        },
      });

      if (itpInstanceForPermCheck?.lotId && subcontractorUser) {
        if (!subcontractorCompletionAssignment) {
          throw AppError.forbidden('Not authorized to complete ITP items on this lot');
        }

        // Check project-level setting for subcontractor verification, then let the
        // lot assignment override it when the project requires verification.
        const projectRequiresVerification = parseProjectRequiresSubcontractorVerification(
          itpInstanceForPermCheck.lot?.project?.settings,
        );

        verificationStatus = resolveSubcontractorVerificationStatus({
          projectRequiresVerification,
          itpRequiresVerification: subcontractorCompletionAssignment.itpRequiresVerification,
        });
      } else {
        // Fallback to auto-verify if no assignment found (project default is no verification)
        verificationStatus = 'verified';
      }
    }

    // Build witness data object (only include if values provided)
    const witnessData = buildItpCompletionWitnessData({
      witnessPresent,
      witnessName,
      witnessCompany,
    });

    const completionInclude = {
      completedBy: {
        select: { id: true, fullName: true, email: true },
      },
      verifiedBy: {
        select: { id: true, fullName: true, email: true },
      },
      attachments: true,
      checklistItem: true,
    } as const;

    const { completion, shouldCreateFailedNcr } = await prisma.$transaction(async (tx) => {
      // Serialize find-or-create completion writes for an ITP instance without requiring a schema migration.
      const lockedInstances = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM itp_instances
        WHERE id = ${itpInstanceId}
        FOR UPDATE
      `;
      if (lockedInstances.length !== 1) {
        throw AppError.notFound('ITP instance');
      }

      const existingCompletion = await tx.iTPCompletion.findFirst({
        where: {
          itpInstanceId,
          checklistItemId,
        },
      });
      if (existingCompletion?.verificationStatus === 'verified') {
        throw AppError.conflict(
          'Verified ITP completions cannot be changed through the standard completion path',
          { verificationStatus: existingCompletion.verificationStatus },
        );
      }

      const shouldCreateFailedNcr = shouldCreateFailedItpNcr(newStatus, existingCompletion?.status);

      if (existingCompletion) {
        // Update existing completion
        const completion = await tx.iTPCompletion.update({
          where: { id: existingCompletion.id },
          data: {
            status: newStatus,
            notes: notes ?? existingCompletion.notes,
            completedAt: isFinished ? new Date() : null,
            completedById: isFinished ? user.userId : null,
            // Feature #463: Signature capture
            ...(signatureDataUrl !== undefined ? { signatureUrl: signatureDataUrl } : {}),
            // Feature #271: Set pending_verification for subcontractor completions
            ...(verificationStatus ? { verificationStatus } : {}),
            ...witnessData,
          },
          include: completionInclude,
        });

        return { completion, shouldCreateFailedNcr };
      }

      // Create new completion
      const completion = await tx.iTPCompletion.create({
        data: {
          itpInstanceId,
          checklistItemId,
          status: newStatus,
          notes: notes || null,
          completedAt: isFinished ? new Date() : null,
          completedById: isFinished ? user.userId : null,
          // Feature #463: Signature capture
          signatureUrl: signatureDataUrl || null,
          // Feature #271: Set pending_verification for subcontractor completions
          ...(verificationStatus ? { verificationStatus } : {}),
          ...witnessData,
        },
        include: completionInclude,
      });

      return { completion, shouldCreateFailedNcr };
    });

    // If status is 'failed', create an NCR linked to the lot
    let createdNcr = null;
    if (shouldCreateFailedNcr) {
      // Get the ITP instance to find the lot and project
      const itpInstance = await prisma.iTPInstance.findUnique({
        where: { id: itpInstanceId },
        include: {
          lot: true,
          template: true,
        },
      });

      if (itpInstance && itpInstance.lot) {
        const lot = itpInstance.lot;

        // Get checklist item description for NCR context
        const checklistItemDescription =
          completion.checklistItem?.description || 'ITP checklist item';

        // Determine if major NCR requires QM approval
        const isMajor = ncrSeverity === 'major';

        // Allocate the NCR number and create the NCR using the canonical race-safe
        // path (max sequence + 1 inside a transaction with retry on the
        // [projectId, ncrNumber] unique constraint). Computing the number with a
        // plain count outside a transaction lets two concurrent "Mark as Failed"
        // submissions derive the same number, so the second one 500s on P2002.
        createdNcr = await createNcrWithAllocatedNumber(lot.projectId, async (tx, ncrNumber) => {
          const ncr = await tx.nCR.create({
            data: {
              projectId: lot.projectId,
              ncrNumber,
              description: ncrDescription || `ITP item failed: ${checklistItemDescription}`,
              specificationReference: itpInstance.template?.specificationReference || null,
              category: ncrCategory || 'workmanship',
              severity: ncrSeverity || 'minor',
              qmApprovalRequired: isMajor,
              clientNotificationRequired: isMajor,
              raisedById: user.userId,
              // Store ITP item reference in rectification notes for traceability. The
              // human-readable sentence keeps context for reviewers; the trailing
              // machine-parseable marker lets the GET ITP instance endpoint re-attach
              // this NCR as the failed item's linkedNcr after a page reload.
              rectificationNotes: `Raised from ITP checklist item: ${checklistItemDescription} (Item ID: ${checklistItemId}) ${buildChecklistItemNcrMarker(checklistItemId)}`,
              ncrLots: {
                create: [
                  {
                    lotId: lot.id,
                  },
                ],
              },
            },
            include: {
              project: { select: { name: true } },
              raisedBy: { select: { fullName: true, email: true } },
              ncrLots: {
                include: {
                  lot: { select: { lotNumber: true } },
                },
              },
            },
          });

          // Update lot status to ncr_raised in the same transaction as the NCR.
          await tx.lot.update({
            where: { id: lot.id },
            data: { status: 'ncr_raised' },
          });

          return ncr;
        });
      }
    }

    // Auto-progress lot status based on ITP completion state (but not for failed items)
    if (isFinished && newStatus !== 'failed') {
      await updateLotStatusFromITP(itpInstanceId);
    }

    // Check for approaching witness points and send notifications (Feature #175)
    let witnessPointNotification = null;
    if (isFinished && newStatus === 'completed') {
      witnessPointNotification = await checkAndNotifyWitnessPoint(
        itpInstanceId,
        checklistItemId,
        user.userId,
      );
    }

    // Feature #271: Notify head contractor when subcontractor completes an item (only if verification required)
    let subbieCompletionNotification = null;
    if (
      isSubcontractor &&
      isFinished &&
      newStatus === 'completed' &&
      verificationStatus === 'pending_verification'
    ) {
      try {
        // Get the ITP instance with lot and project info
        const itpInstance = await prisma.iTPInstance.findUnique({
          where: { id: itpInstanceId },
          include: {
            lot: {
              include: {
                project: { select: { id: true, name: true } },
              },
            },
          },
        });

        if (itpInstance && itpInstance.lot && itpInstance.lot.project) {
          const lot = itpInstance.lot;
          const project = lot.project;
          const itemDescription = completion.checklistItem?.description || 'ITP item';
          const subbieName =
            subcontractorUser?.subcontractorCompany?.companyName || 'Subcontractor';

          // Find project managers and superintendents to notify
          const projectManagers = await prisma.projectUser.findMany({
            where: {
              projectId: project.id,
              role: { in: ['project_manager', 'admin', 'superintendent'] },
              status: 'active',
            },
            select: { userId: true },
          });

          // Create notifications for head contractor team
          const subbieNotifications = buildItpSubbieCompletionNotifications(projectManagers, {
            projectId: project.id,
            lotId: lot.id,
            lotNumber: lot.lotNumber,
            checklistItemId,
            itemDescription,
            subbieName,
          });
          if (subbieNotifications) {
            await prisma.notification.createMany({
              data: subbieNotifications.rows,
            });

            subbieCompletionNotification = subbieNotifications.summary;
          }
        }
      } catch (notifError) {
        logError('Failed to send subcontractor completion notification:', notifError);
      }
    }

    // Audit log for ITP completion
    const itpInstanceForAudit = await prisma.iTPInstance.findUnique({
      where: { id: itpInstanceId },
      select: { lot: { select: { projectId: true } } },
    });
    await createAuditLog({
      projectId: itpInstanceForAudit?.lot?.projectId,
      userId: user.userId,
      entityType: 'itp_completion',
      entityId: completion.id,
      action: AuditAction.ITP_ITEM_COMPLETED,
      changes: { status: newStatus, checklistItemId, notes, verificationStatus },
      req,
    });

    // Transform to frontend-friendly format
    const transformedCompletion = buildItpCompletionTransform(completion, createdNcr);

    res.json(
      buildItpCompletionResultResponse(
        transformedCompletion,
        createdNcr,
        witnessPointNotification,
        subbieCompletionNotification,
      ),
    );
  }),
);

completionsRouter.use(completionUpdateRoutes);
completionsRouter.use(completionVerificationRoutes);
completionsRouter.use(completionAttachmentRoutes);
