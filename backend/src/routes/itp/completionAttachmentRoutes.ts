import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { type AuthUser } from '../../lib/auth.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  ITP_WRITE_ROLES,
  isItpSubcontractorUser,
  requireItpLotAccess,
  requireItpLotRole,
  requireItpProjectAccess,
  requireItpProjectRole,
  requireItpSubcontractorCompletionPermission,
} from './helpers/access.js';
import {
  isStoredDocumentReference,
  isStoredDocumentUploadPath,
  normalizeStoredDocumentReference,
} from '../../lib/uploadPaths.js';
import { canReadDocument } from '../documents/access.js';
import {
  buildItpCompletionAttachmentDeletedResponse,
  buildItpCompletionAttachmentResponse,
  buildItpCompletionAttachmentsResponse,
} from './completionResponses.js';
import { parseCompletionRouteParam, parseOptionalGpsCoordinate } from './completionValidation.js';
import {
  isSubcontractorVisibleChecklistItem,
  resolveChecklistItemForInstance,
  type ChecklistItem,
} from './helpers/templateSnapshot.js';

const ITP_ATTACHMENT_FILENAME_MAX_LENGTH = 180;
const ITP_ATTACHMENT_URL_MAX_LENGTH = 2048;
const ITP_ATTACHMENT_CAPTION_MAX_LENGTH = 2000;
const ITP_ATTACHMENT_MIME_TYPE_MAX_LENGTH = 120;

function requireVisibleCompletionItemForSubcontractor(
  user: AuthUser,
  completion: {
    checklistItemId: string;
    checklistItem: ChecklistItem;
    itpInstance: {
      templateSnapshot?: string | null;
      template?: Record<string, unknown> | null;
    };
  },
  message: string,
) {
  const checklistItem = resolveChecklistItemForInstance(
    completion.itpInstance,
    completion.checklistItemId,
    completion.checklistItem,
  );

  if (
    isItpSubcontractorUser(user) &&
    (!checklistItem || !isSubcontractorVisibleChecklistItem(checklistItem))
  ) {
    throw AppError.forbidden(message);
  }
}

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

export const completionAttachmentRoutes = Router();

// Add photo attachment to ITP completion
completionAttachmentRoutes.post(
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

    requireVisibleCompletionItemForSubcontractor(
      user,
      completion,
      'ITP attachment write access required',
    );

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

      if (!(await canReadDocument(req.user!, existingDocument))) {
        throw AppError.forbidden('You do not have access to this ITP attachment document');
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

      if (isStoredDocumentUploadPath(fileUrl)) {
        throw AppError.badRequest('Local uploaded document paths must be attached by documentId');
      }

      if (!isStoredDocumentReference(fileUrl, documentProjectId)) {
        throw AppError.badRequest('fileUrl must reference an uploaded document file');
      }
      const storedFileUrl = normalizeStoredDocumentReference(fileUrl, documentProjectId);

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
          fileUrl: storedFileUrl,
          mimeType: determinedMimeType,
          uploadedById: user.userId,
          caption: caption || `ITP Evidence: ${completion.checklistItem.description}`,
          gpsLatitude: parsedGpsLatitude,
          gpsLongitude: parsedGpsLongitude,
        },
      });
    }

    const insertResult = await prisma.iTPCompletionAttachment.createMany({
      data: {
        completionId,
        documentId: document.id,
      },
      skipDuplicates: true,
    });

    const attachment = await prisma.iTPCompletionAttachment.findFirstOrThrow({
      where: {
        completionId,
        documentId: document.id,
      },
      include: {
        document: true,
      },
    });

    res
      .status(insertResult.count === 1 ? 201 : 200)
      .json(buildItpCompletionAttachmentResponse(attachment));
  }),
);

// Get attachments for an ITP completion
completionAttachmentRoutes.get(
  '/completions/:completionId/attachments',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const completionId = parseCompletionRouteParam(req.params.completionId, 'completionId');

    const completion = await prisma.iTPCompletion.findUnique({
      where: { id: completionId },
      select: {
        checklistItemId: true,
        checklistItem: {
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
        itpInstance: {
          select: {
            lotId: true,
            templateSnapshot: true,
            lot: { select: { projectId: true } },
            template: { select: { projectId: true } },
          },
        },
      },
    });

    if (!completion) {
      throw AppError.notFound('Completion');
    }

    const projectId =
      completion.itpInstance?.lot?.projectId || completion.itpInstance?.template.projectId;
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

    requireVisibleCompletionItemForSubcontractor(
      user,
      completion,
      'ITP attachment access required',
    );

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

    res.json(buildItpCompletionAttachmentsResponse(attachments));
  }),
);

// Delete an attachment from ITP completion
completionAttachmentRoutes.delete(
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
            checklistItemId: true,
            checklistItem: {
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
            itpInstance: {
              select: {
                lotId: true,
                templateSnapshot: true,
                lot: { select: { projectId: true } },
                template: { select: { projectId: true } },
              },
            },
          },
        },
      },
    });

    if (!attachment) {
      throw AppError.notFound('Attachment not found');
    }

    const projectId =
      attachment.completion.itpInstance?.lot?.projectId ||
      attachment.completion.itpInstance?.template.projectId;
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

    requireVisibleCompletionItemForSubcontractor(
      user,
      attachment.completion,
      'ITP attachment write access required',
    );

    // Delete the attachment (document remains for record keeping)
    await prisma.iTPCompletionAttachment.delete({
      where: { id: attachmentId },
    });

    res.json(buildItpCompletionAttachmentDeletedResponse());
  }),
);
