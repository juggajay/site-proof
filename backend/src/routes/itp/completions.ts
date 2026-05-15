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
  ITP_VERIFY_ROLES,
  ITP_WRITE_ROLES,
  isItpSubcontractorUser,
  requireItpLotAccess,
  requireItpLotRole,
  requireItpProjectAccess,
  requireItpProjectRole,
  requireItpSubcontractorCompletionPermission,
} from './helpers/access.js';
import { isStoredDocumentUploadPath } from '../../lib/uploadPaths.js';
import { logError } from '../../lib/serverLogger.js';

// ============== Zod Schemas ==============
const GPS_COORDINATE_PATTERN = /^-?(?:\d+|\d+\.\d+|\.\d+)$/;
const ITP_ATTACHMENT_FILENAME_MAX_LENGTH = 180;
const ITP_ATTACHMENT_URL_MAX_LENGTH = 2048;
const ITP_ATTACHMENT_CAPTION_MAX_LENGTH = 2000;
const ITP_ATTACHMENT_MIME_TYPE_MAX_LENGTH = 120;
const ITP_COMPLETION_NOTES_MAX_LENGTH = 5000;
const ITP_COMPLETION_FAILURE_DESCRIPTION_MAX_LENGTH = 5000;
const ITP_COMPLETION_SHORT_TEXT_MAX_LENGTH = 160;
const ITP_COMPLETION_REJECTION_REASON_MAX_LENGTH = 3000;
const ITP_SIGNATURE_DATA_URL_MAX_LENGTH = 512_000;
const ITP_COMPLETION_ROUTE_PARAM_MAX_LENGTH = 128;

function optionalTrimmedAttachmentString(fieldName: string, maxLength: number) {
  return z
    .string({ invalid_type_error: `${fieldName} must be text` })
    .trim()
    .max(maxLength, `${fieldName} must be ${maxLength} characters or less`)
    .optional();
}

function optionalNonEmptyAttachmentString(fieldName: string, maxLength: number) {
  return z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z
      .string({ invalid_type_error: `${fieldName} must be text` })
      .max(maxLength, `${fieldName} must be ${maxLength} characters or less`)
      .optional(),
  );
}

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

const updateCompletionSchema = z.object({
  notes: z
    .string()
    .max(
      ITP_COMPLETION_NOTES_MAX_LENGTH,
      `Notes must be ${ITP_COMPLETION_NOTES_MAX_LENGTH} characters or less`,
    )
    .nullable(),
});

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

// POST /completions/:completionId/attachments - Add attachment
const addAttachmentSchema = z
  .object({
    documentId: z.string().uuid().optional(),
    filename: optionalNonEmptyAttachmentString('filename', ITP_ATTACHMENT_FILENAME_MAX_LENGTH),
    fileUrl: optionalNonEmptyAttachmentString('fileUrl', ITP_ATTACHMENT_URL_MAX_LENGTH),
    caption: optionalTrimmedAttachmentString('caption', ITP_ATTACHMENT_CAPTION_MAX_LENGTH),
    gpsLatitude: z.union([z.string(), z.number()]).optional().nullable(),
    gpsLongitude: z.union([z.string(), z.number()]).optional().nullable(),
    mimeType: optionalNonEmptyAttachmentString('mimeType', ITP_ATTACHMENT_MIME_TYPE_MAX_LENGTH),
  })
  .superRefine((data, ctx) => {
    if (!data.documentId && (!data.filename || !data.fileUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either documentId or filename and fileUrl are required',
        path: ['documentId'],
      });
    }

    if (data.fileUrl?.startsWith('data:')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Inline data URLs are not supported for ITP attachments. Upload the file first and attach the stored document.',
        path: ['fileUrl'],
      });
    }
  });

export const completionsRouter = Router();

function parseCompletionRouteParam(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a single value`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest(`${field} is required`);
  }

  if (normalized.length > ITP_COMPLETION_ROUTE_PARAM_MAX_LENGTH) {
    throw AppError.badRequest(`${field} is too long`);
  }

  return normalized;
}

function parseRequiredCompletionQueryString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} is required`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest(`${field} is required`);
  }

  return normalized;
}

function parseOptionalGpsCoordinate(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? (() => {
            const normalized = value.trim();
            if (!normalized) return null;
            if (!GPS_COORDINATE_PATTERN.test(normalized)) {
              throw AppError.badRequest(`${field} must be a valid decimal coordinate`);
            }
            return Number(normalized);
          })()
        : Number.NaN;

  if (parsed === null) {
    return null;
  }

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw AppError.badRequest(`${field} must be between ${min} and ${max}`);
  }

  return parsed;
}

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

    // Validate N/A status requires a reason
    if (directStatus === 'not_applicable' && !notes?.trim()) {
      throw AppError.badRequest('A reason is required when marking an item as N/A');
    }

    // Validate failed status requires NCR description
    if (directStatus === 'failed' && !ncrDescription?.trim()) {
      throw AppError.badRequest('NCR description is required when marking an item as Failed');
    }

    // Determine status - direct status takes precedence, then isCompleted flag
    let newStatus: string;
    if (directStatus) {
      newStatus = directStatus;
    } else {
      newStatus = isCompleted ? 'completed' : 'pending';
    }

    const itpInstanceForAccess = await prisma.iTPInstance.findUnique({
      where: { id: itpInstanceId },
      select: {
        lotId: true,
        templateId: true,
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
      select: { id: true },
    });

    if (!checklistItem) {
      throw AppError.badRequest('Checklist item does not belong to this ITP instance');
    }

    // Feature #271: Check if user is a subcontractor
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.userId },
      include: { subcontractorCompany: { select: { id: true, companyName: true } } },
    });
    const isSubcontractor = !!subcontractorUser;

    // Check if completion already exists
    const existingCompletion = await prisma.iTPCompletion.findFirst({
      where: {
        itpInstanceId,
        checklistItemId,
      },
    });

    // Determine completedAt and completedById based on status
    const isFinished =
      newStatus === 'completed' || newStatus === 'not_applicable' || newStatus === 'failed';

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

        // Check project-level setting for subcontractor verification
        let projectRequiresVerification = false; // Default: no verification needed
        const projectSettings = itpInstanceForPermCheck.lot?.project?.settings;
        if (projectSettings) {
          try {
            const settings =
              typeof projectSettings === 'string' ? JSON.parse(projectSettings) : projectSettings;
            projectRequiresVerification = settings.requireSubcontractorVerification === true;
          } catch (_e) {
            // Invalid JSON, use default (no verification)
          }
        }

        // Set verification status: project setting controls default, lot assignment can override
        // If project doesn't require verification, auto-verify
        // If project requires verification, use lot assignment setting
        if (!projectRequiresVerification) {
          verificationStatus = 'verified';
        } else {
          verificationStatus = subcontractorCompletionAssignment.itpRequiresVerification
            ? 'pending_verification'
            : 'verified';
        }
      } else {
        // Fallback to auto-verify if no assignment found (project default is no verification)
        verificationStatus = 'verified';
      }
    }

    // Build witness data object (only include if values provided)
    const witnessData: Record<string, unknown> = {};
    if (witnessPresent !== undefined) {
      witnessData.witnessPresent = witnessPresent;
    }
    if (witnessName !== undefined) {
      witnessData.witnessName = witnessName || null;
    }
    if (witnessCompany !== undefined) {
      witnessData.witnessCompany = witnessCompany || null;
    }

    let completion;
    if (existingCompletion) {
      // Update existing completion
      completion = await prisma.iTPCompletion.update({
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
        include: {
          completedBy: {
            select: { id: true, fullName: true, email: true },
          },
          verifiedBy: {
            select: { id: true, fullName: true, email: true },
          },
          attachments: true,
          checklistItem: true,
        },
      });
    } else {
      // Create new completion
      completion = await prisma.iTPCompletion.create({
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
        include: {
          completedBy: {
            select: { id: true, fullName: true, email: true },
          },
          verifiedBy: {
            select: { id: true, fullName: true, email: true },
          },
          attachments: true,
          checklistItem: true,
        },
      });
    }

    // If status is 'failed', create an NCR linked to the lot
    let createdNcr = null;
    if (newStatus === 'failed') {
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

        // Generate NCR number
        const existingNcrCount = await prisma.nCR.count({
          where: { projectId: lot.projectId },
        });
        const ncrNumber = `NCR-${String(existingNcrCount + 1).padStart(4, '0')}`;

        // Determine if major NCR requires QM approval
        const isMajor = ncrSeverity === 'major';

        // Create the NCR
        createdNcr = await prisma.nCR.create({
          data: {
            projectId: lot.projectId,
            ncrNumber,
            description: ncrDescription || `ITP item failed: ${checklistItemDescription}`,
            specificationReference: itpInstance.template?.specificationReference || null,
            category: ncrCategory || 'workmanship',
            severity: ncrSeverity || 'minor',
            qmApprovalRequired: isMajor,
            raisedById: user.userId,
            // Store ITP item reference in rectification notes for traceability
            rectificationNotes: `Raised from ITP checklist item: ${checklistItemDescription} (Item ID: ${checklistItemId})`,
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

        // Update lot status to ncr_raised
        await prisma.lot.update({
          where: { id: lot.id },
          data: { status: 'ncr_raised' },
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
          if (projectManagers.length > 0) {
            await prisma.notification.createMany({
              data: projectManagers.map((pm) => ({
                userId: pm.userId,
                projectId: project.id,
                type: 'itp_subbie_completion',
                title: 'Subcontractor ITP Item Completed',
                message: `${subbieName} has completed ITP item "${itemDescription}" on lot ${lot.lotNumber}. Verification required.`,
                linkUrl: `/projects/${project.id}/lots/${lot.id}?tab=itp&highlight=${checklistItemId}`,
              })),
            });

            subbieCompletionNotification = {
              notificationsSent: projectManagers.length,
              subcontractorCompany: subbieName,
              lotNumber: lot.lotNumber,
              itemDescription,
            };
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
    const transformedCompletion = {
      ...completion,
      isCompleted: completion.status === 'completed' || completion.status === 'not_applicable',
      isNotApplicable: completion.status === 'not_applicable',
      isFailed: completion.status === 'failed',
      isVerified: completion.verificationStatus === 'verified',
      isPendingVerification: completion.verificationStatus === 'pending_verification',
      attachments: completion.attachments || [],
      linkedNcr: createdNcr,
    };

    res.json({
      completion: transformedCompletion,
      ncr: createdNcr,
      witnessPointNotification,
      subbieCompletionNotification,
    });
  }),
);

// PATCH /completions/:id - Update completion metadata without changing status
completionsRouter.patch(
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

    if (completionForAccess.itpInstance.lotId) {
      await requireItpLotRole(
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
      await requireItpProjectRole(
        user,
        projectId,
        ITP_WRITE_ROLES,
        'ITP completion write access required',
      );
      if (isItpSubcontractorUser(user)) {
        throw AppError.forbidden('ITP completion write access required');
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
      },
      req,
    });

    res.json({
      completion: {
        ...completion,
        isCompleted: completion.status === 'completed' || completion.status === 'not_applicable',
        isNotApplicable: completion.status === 'not_applicable',
        isFailed: completion.status === 'failed',
        isVerified: completion.verificationStatus === 'verified',
        isPendingVerification: completion.verificationStatus === 'pending_verification',
        attachments: completion.attachments || [],
      },
    });
  }),
);

// Verify a completed checklist item (for hold points)
completionsRouter.post(
  '/completions/:id/verify',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const id = parseCompletionRouteParam(req.params.id, 'id');

    const completionForAccess = await prisma.iTPCompletion.findUnique({
      where: { id },
      select: {
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

    const completion = await prisma.iTPCompletion.update({
      where: { id },
      data: {
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        verifiedById: user.userId,
      },
      include: {
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
      },
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
      changes: { verificationStatus: 'verified' },
      req,
    });

    // Transform to frontend-friendly format
    const transformedCompletion = {
      ...completion,
      isCompleted: completion.status === 'completed',
      isVerified: completion.verificationStatus === 'verified',
    };

    res.json({ completion: transformedCompletion });
  }),
);

// Reject a completed checklist item (Feature #634)
completionsRouter.post(
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

    const completion = await prisma.iTPCompletion.update({
      where: { id },
      data: {
        verificationStatus: 'rejected',
        verifiedAt: new Date(),
        verifiedById: user.userId,
        verificationNotes: reason.trim(),
      },
      include: {
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
      },
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
      changes: { verificationStatus: 'rejected', reason: reason.trim() },
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

    res.json({ completion: transformedCompletion });
  }),
);

// Feature #272: Get pending verifications for a project
// Head contractor can view all ITP items completed by subcontractors that need verification
completionsRouter.get(
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

    res.json({
      pendingVerifications: transformed,
      count: transformed.length,
    });
  }),
);

// Add photo attachment to ITP completion
completionsRouter.post(
  '/completions/:completionId/attachments',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const completionId = parseCompletionRouteParam(req.params.completionId, 'completionId');
    const parseResult = addAttachmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }
    const { documentId, filename, fileUrl, caption, gpsLatitude, gpsLongitude, mimeType } =
      parseResult.data;

    // Get the completion to find projectId
    const completion = await prisma.iTPCompletion.findUnique({
      where: { id: completionId },
      include: {
        itpInstance: {
          include: {
            template: {
              include: {
                project: true,
              },
            },
          },
        },
        checklistItem: true,
      },
    });

    if (!completion) {
      throw AppError.notFound('Completion not found');
    }

    // Get the lot from the ITP instance
    const itpInstance = await prisma.iTPInstance.findUnique({
      where: { id: completion.itpInstanceId },
      include: { lot: true },
    });

    // Use the lot's projectId (important for cross-project template imports)
    // Fall back to template's projectId if lot is not found
    const documentProjectId =
      itpInstance?.lot?.projectId || completion.itpInstance.template.projectId;

    if (!documentProjectId) {
      throw AppError.badRequest('Unable to determine project for attachment');
    }

    if (itpInstance?.lotId) {
      await requireItpLotRole(
        user,
        documentProjectId,
        itpInstance.lotId,
        ITP_WRITE_ROLES,
        'ITP attachment write access required',
      );
      await requireItpSubcontractorCompletionPermission(user, documentProjectId, itpInstance.lotId);
    } else {
      await requireItpProjectRole(
        user,
        documentProjectId,
        ITP_WRITE_ROLES,
        'ITP attachment write access required',
      );
      if (isItpSubcontractorUser(user)) {
        throw AppError.forbidden('ITP attachment write access required');
      }
    }

    const parsedGpsLatitude = parseOptionalGpsCoordinate(gpsLatitude, 'gpsLatitude', -90, 90);
    const parsedGpsLongitude = parseOptionalGpsCoordinate(gpsLongitude, 'gpsLongitude', -180, 180);

    let document;

    if (documentId) {
      const existingDocument = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!existingDocument) {
        throw AppError.notFound('Document');
      }

      if (existingDocument.projectId !== documentProjectId) {
        throw AppError.badRequest('Document must belong to the same project as the ITP completion');
      }

      if (
        itpInstance?.lotId &&
        existingDocument.lotId &&
        existingDocument.lotId !== itpInstance.lotId
      ) {
        throw AppError.badRequest('Document must belong to the same lot as the ITP completion');
      }

      const updateData: {
        caption?: string;
        gpsLatitude?: number;
        gpsLongitude?: number;
      } = {};

      if (caption !== undefined) {
        updateData.caption = caption;
      }
      if (parsedGpsLatitude !== null) {
        updateData.gpsLatitude = parsedGpsLatitude;
      }
      if (parsedGpsLongitude !== null) {
        updateData.gpsLongitude = parsedGpsLongitude;
      }

      document =
        Object.keys(updateData).length > 0
          ? await prisma.document.update({
              where: { id: existingDocument.id },
              data: updateData,
            })
          : existingDocument;
    } else {
      if (!filename || !fileUrl) {
        throw AppError.badRequest('filename and fileUrl are required');
      }

      if (!isStoredDocumentUploadPath(fileUrl)) {
        throw AppError.badRequest('fileUrl must reference an uploaded document file');
      }

      // Determine mimeType from the stored file URL or filename
      let determinedMimeType: string | null = mimeType || null;
      if (!determinedMimeType) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          gif: 'image/gif',
          webp: 'image/webp',
        };
        determinedMimeType = mimeMap[ext || ''] || null;
      }

      // Create a document record for clients that already uploaded the file elsewhere.
      document = await prisma.document.create({
        data: {
          projectId: documentProjectId,
          lotId: itpInstance?.lotId ?? undefined,
          documentType: 'photo',
          category: 'itp_evidence',
          filename,
          fileUrl,
          mimeType: determinedMimeType,
          uploadedById: user.userId,
          caption: caption || `ITP Evidence: ${completion.checklistItem.description}`,
          gpsLatitude: parsedGpsLatitude,
          gpsLongitude: parsedGpsLongitude,
        },
      });
    }

    const existingAttachment = await prisma.iTPCompletionAttachment.findFirst({
      where: {
        completionId,
        documentId: document.id,
      },
      include: {
        document: true,
      },
    });

    if (existingAttachment) {
      res.json({
        attachment: {
          id: existingAttachment.id,
          documentId: existingAttachment.documentId,
          document: existingAttachment.document,
        },
      });
      return;
    }

    // Create the attachment link
    const attachment = await prisma.iTPCompletionAttachment.create({
      data: {
        completionId,
        documentId: document.id,
      },
      include: {
        document: true,
      },
    });

    res.status(201).json({
      attachment: {
        id: attachment.id,
        documentId: attachment.documentId,
        document: attachment.document,
      },
    });
  }),
);

// Get attachments for an ITP completion
completionsRouter.get(
  '/completions/:completionId/attachments',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const completionId = parseCompletionRouteParam(req.params.completionId, 'completionId');

    const completion = await prisma.iTPCompletion.findUnique({
      where: { id: completionId },
      select: {
        itpInstance: {
          select: {
            lotId: true,
            lot: { select: { projectId: true } },
          },
        },
      },
    });

    if (!completion) {
      throw AppError.notFound('Completion');
    }

    const projectId = completion.itpInstance?.lot?.projectId;
    if (!projectId) {
      throw AppError.badRequest('Unable to determine project for ITP completion');
    }

    if (!completion.itpInstance?.lotId) {
      await requireItpProjectAccess(user, projectId);
      if (isItpSubcontractorUser(user)) {
        throw AppError.forbidden('Access denied');
      }
    } else {
      await requireItpLotAccess(user, projectId, completion.itpInstance.lotId);
    }

    const attachments = await prisma.iTPCompletionAttachment.findMany({
      where: { completionId },
      include: {
        document: {
          include: {
            uploadedBy: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    });

    res.json({
      attachments: attachments.map((a) => ({
        id: a.id,
        documentId: a.documentId,
        document: a.document,
      })),
    });
  }),
);

// Delete an attachment from ITP completion
completionsRouter.delete(
  '/completions/:completionId/attachments/:attachmentId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const completionId = parseCompletionRouteParam(req.params.completionId, 'completionId');
    const attachmentId = parseCompletionRouteParam(req.params.attachmentId, 'attachmentId');

    // Verify the attachment belongs to this completion
    const attachment = await prisma.iTPCompletionAttachment.findFirst({
      where: {
        id: attachmentId,
        completionId,
      },
      include: {
        completion: {
          select: {
            itpInstance: {
              select: {
                lotId: true,
                lot: { select: { projectId: true } },
              },
            },
          },
        },
      },
    });

    if (!attachment) {
      throw AppError.notFound('Attachment not found');
    }

    const projectId = attachment.completion.itpInstance?.lot?.projectId;
    if (!projectId) {
      throw AppError.badRequest('Unable to determine project for ITP completion');
    }

    if (attachment.completion.itpInstance?.lotId) {
      await requireItpLotRole(
        user,
        projectId,
        attachment.completion.itpInstance.lotId,
        ITP_WRITE_ROLES,
        'ITP attachment write access required',
      );
      await requireItpSubcontractorCompletionPermission(
        user,
        projectId,
        attachment.completion.itpInstance.lotId,
      );
    } else {
      await requireItpProjectRole(
        user,
        projectId,
        ITP_WRITE_ROLES,
        'ITP attachment write access required',
      );
      if (isItpSubcontractorUser(user)) {
        throw AppError.forbidden('ITP attachment write access required');
      }
    }

    // Delete the attachment (document remains for record keeping)
    await prisma.iTPCompletionAttachment.delete({
      where: { id: attachmentId },
    });

    res.json({ success: true });
  }),
);
