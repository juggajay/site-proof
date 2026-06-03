import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { type AuthUser } from '../../lib/auth.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ITP_VERIFY_ROLES, requireItpProjectRole } from './helpers/access.js';
import { logError } from '../../lib/serverLogger.js';
import {
  buildItpCompletionResponse,
  buildItpCompletionStatusResponse,
  buildPendingItpVerificationsResponse,
} from './completionResponses.js';
import {
  parseCompletionRouteParam,
  parseRequiredCompletionQueryString,
} from './completionValidation.js';

const ITP_COMPLETION_REJECTION_REASON_MAX_LENGTH = 3000;

// POST /completions/:id/reject - Reject completion
const rejectCompletionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Rejection reason is required')
    .max(
      ITP_COMPLETION_REJECTION_REASON_MAX_LENGTH,
      `Rejection reason must be ${ITP_COMPLETION_REJECTION_REASON_MAX_LENGTH} characters or less`,
    ),
});

const completionVerificationResponseInclude = {
  completedBy: {
    select: { id: true, fullName: true, email: true },
  },
  verifiedBy: {
    select: { id: true, fullName: true, email: true },
  },
  itpInstance: {
    include: {
      lot: {
        select: { id: true, lotNumber: true, projectId: true },
      },
    },
  },
  checklistItem: {
    select: { description: true },
  },
} as const;

export const completionVerificationRoutes = Router();

// Verify a completed checklist item (for hold points)
completionVerificationRoutes.post(
  '/completions/:id/verify',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const id = parseCompletionRouteParam(req.params.id, 'id');

    const completionForAccess = await prisma.iTPCompletion.findUnique({
      where: { id },
      select: {
        verificationStatus: true,
        itpInstance: {
          select: {
            lotId: true,
            lot: { select: { projectId: true } },
          },
        },
      },
    });

    if (!completionForAccess) {
      throw AppError.notFound('Completion');
    }

    const projectId = completionForAccess.itpInstance?.lot?.projectId;
    if (!projectId) {
      throw AppError.badRequest('Unable to determine project for ITP completion');
    }

    await requireItpProjectRole(
      user,
      projectId,
      ITP_VERIFY_ROLES,
      'ITP verification access required',
    );

    if (completionForAccess.verificationStatus === 'verified') {
      const completion = await prisma.iTPCompletion.findUniqueOrThrow({
        where: { id },
        include: completionVerificationResponseInclude,
      });

      res.json(
        buildItpCompletionStatusResponse(
          {
            ...completion,
            isVerified: true,
          },
          completion.status === 'completed',
        ),
      );
      return;
    }

    if (completionForAccess.verificationStatus === 'rejected') {
      throw AppError.conflict('Rejected ITP completions must be resubmitted before verification', {
        verificationStatus: completionForAccess.verificationStatus,
      });
    }

    const completion = await prisma.iTPCompletion.update({
      where: { id },
      data: {
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        verifiedById: user.userId,
      },
      include: completionVerificationResponseInclude,
    });

    // Create notification for the user who completed the item (Feature #633)
    if (completion.completedById && completion.completedById !== user.userId) {
      try {
        await prisma.notification.create({
          data: {
            userId: completion.completedById,
            projectId: completion.itpInstance?.lot?.projectId,
            type: 'itp_verification',
            title: 'ITP Item Verified',
            message: `Your ITP item "${completion.checklistItem?.description}" for Lot ${completion.itpInstance?.lot?.lotNumber} has been verified`,
            linkUrl: `/projects/${completion.itpInstance?.lot?.projectId}/lots/${completion.itpInstance?.lotId}?tab=itp`,
          },
        });
      } catch (notifError) {
        logError('Failed to create verification notification:', notifError);
      }
    }

    // Audit log for ITP verification
    await createAuditLog({
      projectId: completion.itpInstance?.lot?.projectId,
      userId: user.userId,
      entityType: 'itp_completion',
      entityId: id,
      action: AuditAction.ITP_ITEM_VERIFIED,
      changes: {
        lotId: completion.itpInstance?.lotId,
        checklistItemId: completion.checklistItemId,
        verificationStatus: {
          from: completionForAccess.verificationStatus,
          to: 'verified',
        },
      },
      req,
    });

    // Transform to frontend-friendly format
    const transformedCompletion = {
      ...completion,
      isCompleted: completion.status === 'completed',
      isVerified: completion.verificationStatus === 'verified',
    };

    res.json(buildItpCompletionResponse(transformedCompletion));
  }),
);

// Reject a completed checklist item (Feature #634)
completionVerificationRoutes.post(
  '/completions/:id/reject',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const id = parseCompletionRouteParam(req.params.id, 'id');
    const parseResult = rejectCompletionSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }
    const { reason } = parseResult.data;

    const completionForAccess = await prisma.iTPCompletion.findUnique({
      where: { id },
      select: {
        verificationStatus: true,
        itpInstance: {
          select: {
            lotId: true,
            lot: { select: { projectId: true } },
          },
        },
      },
    });

    if (!completionForAccess) {
      throw AppError.notFound('Completion');
    }

    const projectId = completionForAccess.itpInstance?.lot?.projectId;
    if (!projectId) {
      throw AppError.badRequest('Unable to determine project for ITP completion');
    }

    await requireItpProjectRole(
      user,
      projectId,
      ITP_VERIFY_ROLES,
      'ITP verification access required',
    );

    if (completionForAccess.verificationStatus !== 'pending_verification') {
      throw AppError.conflict('Only ITP completions pending verification can be rejected', {
        verificationStatus: completionForAccess.verificationStatus,
      });
    }

    const completion = await prisma.iTPCompletion.update({
      where: { id },
      data: {
        verificationStatus: 'rejected',
        verifiedAt: new Date(),
        verifiedById: user.userId,
        verificationNotes: reason.trim(),
      },
      include: completionVerificationResponseInclude,
    });

    // Create notification for the user who completed the item
    if (completion.completedById && completion.completedById !== user.userId) {
      try {
        await prisma.notification.create({
          data: {
            userId: completion.completedById,
            projectId: completion.itpInstance?.lot?.projectId,
            type: 'itp_rejection',
            title: 'ITP Item Rejected',
            message: `Your ITP item "${completion.checklistItem?.description}" for Lot ${completion.itpInstance?.lot?.lotNumber} was rejected. Reason: ${reason.trim()}`,
            linkUrl: `/projects/${completion.itpInstance?.lot?.projectId}/lots/${completion.itpInstance?.lotId}?tab=itp`,
          },
        });
      } catch (notifError) {
        logError('Failed to create rejection notification:', notifError);
      }
    }

    // Audit log for ITP rejection
    await createAuditLog({
      projectId: completion.itpInstance?.lot?.projectId,
      userId: user.userId,
      entityType: 'itp_completion',
      entityId: id,
      action: AuditAction.ITP_ITEM_REJECTED,
      changes: {
        lotId: completion.itpInstance?.lotId,
        checklistItemId: completion.checklistItemId,
        verificationStatus: {
          from: completionForAccess.verificationStatus,
          to: 'rejected',
        },
        reason: reason.trim(),
      },
      req,
    });

    // Transform to frontend-friendly format
    const transformedCompletion = {
      ...completion,
      isCompleted: completion.status === 'completed',
      isVerified: false,
      isRejected: true,
      rejectionReason: reason.trim(),
    };

    res.json(buildItpCompletionResponse(transformedCompletion));
  }),
);

// Feature #272: Get pending verifications for a project
// Head contractor can view all ITP items completed by subcontractors that need verification
completionVerificationRoutes.get(
  '/pending-verifications',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const projectId = parseRequiredCompletionQueryString(req.query.projectId, 'projectId');

    await requireItpProjectRole(
      user,
      projectId,
      ITP_VERIFY_ROLES,
      'ITP verification access required',
    );

    // Find all completions with pending_verification status for this project
    const pendingCompletions = await prisma.iTPCompletion.findMany({
      where: {
        verificationStatus: 'pending_verification',
        itpInstance: {
          lot: {
            projectId,
          },
        },
      },
      include: {
        completedBy: {
          select: { id: true, fullName: true, email: true },
        },
        checklistItem: {
          select: { id: true, description: true, responsibleParty: true },
        },
        itpInstance: {
          include: {
            lot: {
              select: {
                id: true,
                lotNumber: true,
                description: true,
                assignedSubcontractorId: true,
                assignedSubcontractor: {
                  select: { id: true, companyName: true },
                },
              },
            },
            template: {
              select: { id: true, name: true },
            },
          },
        },
        attachments: {
          include: {
            document: {
              select: { id: true, filename: true, fileUrl: true, caption: true },
            },
          },
        },
      },
      orderBy: { completedAt: 'asc' },
    });

    // Transform for frontend
    const transformed = pendingCompletions.map((c) => ({
      id: c.id,
      status: c.status,
      verificationStatus: c.verificationStatus,
      completedAt: c.completedAt,
      notes: c.notes,
      completedBy: c.completedBy,
      checklistItem: c.checklistItem,
      lot: c.itpInstance.lot,
      template: c.itpInstance.template,
      subcontractor: c.itpInstance.lot?.assignedSubcontractor || null,
      attachments: c.attachments.map((a) => ({
        id: a.id,
        document: a.document,
      })),
    }));

    res.json(buildPendingItpVerificationsResponse(transformed));
  }),
);
