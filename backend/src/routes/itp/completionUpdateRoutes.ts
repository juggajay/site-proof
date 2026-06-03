import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { type AuthUser } from '../../lib/auth.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  ITP_VERIFY_ROLES,
  ITP_WRITE_ROLES,
  isItpSubcontractorUser,
  requireItpLotRole,
  requireItpProjectRole,
  requireItpSubcontractorCompletionPermission,
} from './helpers/access.js';
import { buildItpCompletionStatusResponse } from './completionResponses.js';
import { parseCompletionRouteParam } from './completionValidation.js';

const ITP_COMPLETION_REVISION_REASON_MAX_LENGTH = 1000;

const updateCompletionSchema = z.object({
  notes: z.string().max(5000, 'Notes must be 5000 characters or less').nullable(),
  revisionReason: z
    .string({ invalid_type_error: 'Revision reason must be text' })
    .trim()
    .min(1, 'Revision reason is required')
    .max(
      ITP_COMPLETION_REVISION_REASON_MAX_LENGTH,
      `Revision reason must be ${ITP_COMPLETION_REVISION_REASON_MAX_LENGTH} characters or less`,
    )
    .optional(),
});

export const completionUpdateRoutes = Router();

// PATCH /completions/:id - Update completion metadata without changing status
completionUpdateRoutes.patch(
  '/completions/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const id = parseCompletionRouteParam(req.params.id, 'id');
    const parseResult = updateCompletionSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const completionForAccess = await prisma.iTPCompletion.findUnique({
      where: { id },
      select: {
        checklistItemId: true,
        notes: true,
        verificationStatus: true,
        itpInstance: {
          select: {
            lotId: true,
            lot: { select: { projectId: true } },
            template: { select: { projectId: true } },
          },
        },
      },
    });

    if (!completionForAccess) {
      throw AppError.notFound('ITP completion');
    }

    const projectId =
      completionForAccess.itpInstance.lot?.projectId ||
      completionForAccess.itpInstance.template.projectId;
    if (!projectId) {
      throw AppError.badRequest('Unable to determine project for ITP completion');
    }

    let effectiveRole: string;
    if (completionForAccess.itpInstance.lotId) {
      effectiveRole = await requireItpLotRole(
        user,
        projectId,
        completionForAccess.itpInstance.lotId,
        ITP_WRITE_ROLES,
        'ITP completion write access required',
      );
      await requireItpSubcontractorCompletionPermission(
        user,
        projectId,
        completionForAccess.itpInstance.lotId,
      );
    } else {
      effectiveRole = await requireItpProjectRole(
        user,
        projectId,
        ITP_WRITE_ROLES,
        'ITP completion write access required',
      );
      if (isItpSubcontractorUser(user)) {
        throw AppError.forbidden('ITP completion write access required');
      }
    }

    const revisionReason = parseResult.data.revisionReason;
    const isVerifiedRevision = completionForAccess.verificationStatus === 'verified';
    if (isVerifiedRevision) {
      if (!ITP_VERIFY_ROLES.includes(effectiveRole)) {
        throw AppError.forbidden('ITP verifier access required to revise verified completions');
      }

      if (!revisionReason) {
        throw AppError.conflict(
          'Verified ITP completions require a verifier revision reason before notes can be changed',
          { verificationStatus: completionForAccess.verificationStatus },
        );
      }
    }

    const completion = await prisma.iTPCompletion.update({
      where: { id },
      data: {
        notes: parseResult.data.notes,
      },
      include: {
        completedBy: {
          select: { id: true, fullName: true, email: true },
        },
        attachments: {
          include: {
            document: true,
          },
        },
      },
    });

    await createAuditLog({
      projectId,
      userId: user.userId,
      entityType: 'itp_completion',
      entityId: completion.id,
      action: AuditAction.ITP_ITEM_UPDATED,
      changes: {
        checklistItemId: completionForAccess.checklistItemId,
        notes: parseResult.data.notes,
        previousNotes: completionForAccess.notes,
        ...(isVerifiedRevision
          ? {
              verifiedRevision: true,
              revisionReason,
            }
          : {}),
      },
      req,
    });

    res.json(
      buildItpCompletionStatusResponse(
        {
          ...completion,
          isNotApplicable: completion.status === 'not_applicable',
          isFailed: completion.status === 'failed',
          isVerified: completion.verificationStatus === 'verified',
          isPendingVerification: completion.verificationStatus === 'pending_verification',
          attachments: completion.attachments || [],
        },
        completion.status === 'completed' || completion.status === 'not_applicable',
      ),
    );
  }),
);
