// NCR evidence: add, list, delete evidence attachments
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { type AuthUser } from '../../lib/auth.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { parseNcrRouteParam, requireActiveProjectUser } from './ncrAccess.js';
import { isStoredDocumentUploadPath } from '../../lib/uploadPaths.js';

const MAX_DOCUMENT_FILE_SIZE_BYTES = 2_147_483_647;
const MAX_EVIDENCE_TYPE_LENGTH = 80;
const MAX_EVIDENCE_FILENAME_LENGTH = 180;
const MAX_EVIDENCE_FILE_URL_LENGTH = 2048;
const MAX_EVIDENCE_MIME_TYPE_LENGTH = 120;
const MAX_EVIDENCE_CAPTION_LENGTH = 2000;
const MAX_EVIDENCE_PROJECT_ID_LENGTH = 120;

function optionalTrimmedEvidenceString(fieldName: string, maxLength: number) {
  return z
    .string({ invalid_type_error: `${fieldName} must be text` })
    .trim()
    .max(maxLength, `${fieldName} must be ${maxLength} characters or less`)
    .optional();
}

function optionalNonEmptyEvidenceString(fieldName: string, maxLength: number) {
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

const addEvidenceSchema = z
  .object({
    documentId: z.string().uuid().optional(),
    evidenceType: optionalNonEmptyEvidenceString('evidenceType', MAX_EVIDENCE_TYPE_LENGTH),
    filename: optionalNonEmptyEvidenceString('filename', MAX_EVIDENCE_FILENAME_LENGTH),
    fileUrl: optionalNonEmptyEvidenceString('fileUrl', MAX_EVIDENCE_FILE_URL_LENGTH),
    fileSize: z
      .number()
      .finite('fileSize must be finite')
      .int('fileSize must be a whole number of bytes')
      .nonnegative('fileSize cannot be negative')
      .max(MAX_DOCUMENT_FILE_SIZE_BYTES, 'fileSize is too large')
      .optional(),
    mimeType: optionalNonEmptyEvidenceString('mimeType', MAX_EVIDENCE_MIME_TYPE_LENGTH),
    caption: optionalTrimmedEvidenceString('caption', MAX_EVIDENCE_CAPTION_LENGTH),
    projectId: optionalNonEmptyEvidenceString('projectId', MAX_EVIDENCE_PROJECT_ID_LENGTH),
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
          'Inline data URLs are not supported for NCR evidence. Upload the file first and attach the stored document.',
        path: ['fileUrl'],
      });
    }
  });

export const ncrEvidenceRouter = Router();

// POST /api/ncrs/:id/evidence - Add evidence to NCR
ncrEvidenceRouter.post(
  '/:id/evidence',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = addEvidenceSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.badRequest('Validation failed', { issues: validation.error.issues });
    }

    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const {
      documentId,
      evidenceType,
      filename,
      fileUrl,
      fileSize,
      mimeType,
      caption,
      projectId: _providedProjectId,
    } = validation.data;

    const ncr = await prisma.nCR.findUnique({
      where: { id },
    });

    if (!ncr) {
      throw AppError.notFound('NCR');
    }

    await requireActiveProjectUser(ncr.projectId, user);

    // If documentId is provided, link existing document
    // Otherwise, create a new document first
    let finalDocumentId = documentId;

    if (documentId) {
      const existingDocument = await prisma.document.findFirst({
        where: {
          id: documentId,
          projectId: ncr.projectId,
        },
        select: { id: true },
      });

      if (!existingDocument) {
        throw AppError.notFound('Document');
      }
    } else {
      // Create a new document for this evidence
      if (!filename || !fileUrl) {
        throw AppError.badRequest('Either documentId or filename and fileUrl are required');
      }

      if (!isStoredDocumentUploadPath(fileUrl)) {
        throw AppError.badRequest('fileUrl must reference an uploaded document file');
      }

      const document = await prisma.document.create({
        data: {
          projectId: ncr.projectId,
          documentType: evidenceType || 'ncr_evidence',
          category: 'ncr_evidence',
          filename,
          fileUrl,
          fileSize,
          mimeType,
          uploadedById: user.userId,
          caption,
        },
      });
      finalDocumentId = document.id;
    }

    const existingEvidence = await prisma.nCREvidence.findFirst({
      where: {
        ncrId: id,
        documentId: finalDocumentId!,
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            mimeType: true,
            uploadedAt: true,
          },
        },
      },
    });

    if (existingEvidence) {
      res.json({
        evidence: existingEvidence,
        message: 'Evidence already linked to NCR',
      });
      return;
    }

    // Create the NCR evidence link
    const evidence = await prisma.nCREvidence.create({
      data: {
        ncrId: id,
        documentId: finalDocumentId!,
        evidenceType: evidenceType || 'photo',
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            mimeType: true,
            uploadedAt: true,
          },
        },
      },
    });

    res.status(201).json({
      evidence,
      message: 'Evidence added to NCR successfully',
    });
  }),
);

// GET /api/ncrs/:id/evidence - List evidence for NCR
ncrEvidenceRouter.get(
  '/:id/evidence',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');

    const ncr = await prisma.nCR.findUnique({
      where: { id },
    });

    if (!ncr) {
      throw AppError.notFound('NCR');
    }

    await requireActiveProjectUser(ncr.projectId, user);

    const evidence = await prisma.nCREvidence.findMany({
      where: { ncrId: id },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            mimeType: true,
            fileSize: true,
            uploadedAt: true,
            uploadedBy: { select: { fullName: true, email: true } },
            caption: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    // Group by evidence type
    const grouped = {
      photos: evidence.filter((e) => e.evidenceType === 'photo'),
      certificates: evidence.filter(
        (e) => e.evidenceType === 'certificate' || e.evidenceType === 'retest_certificate',
      ),
      documents: evidence.filter(
        (e) => !['photo', 'certificate', 'retest_certificate'].includes(e.evidenceType),
      ),
      all: evidence,
    };

    res.json({
      evidence: grouped.all,
      grouped,
      count: evidence.length,
    });
  }),
);

// DELETE /api/ncrs/:id/evidence/:evidenceId - Remove evidence from NCR
ncrEvidenceRouter.delete(
  '/:id/evidence/:evidenceId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const evidenceId = parseNcrRouteParam(req.params.evidenceId, 'evidenceId');

    const ncr = await prisma.nCR.findUnique({
      where: { id },
    });

    if (!ncr) {
      throw AppError.notFound('NCR');
    }

    await requireActiveProjectUser(ncr.projectId, user);

    // Check if NCR is not closed
    if (ncr.status === 'closed' || ncr.status === 'closed_concession') {
      throw AppError.badRequest('Cannot remove evidence from a closed NCR');
    }

    const deleteResult = await prisma.nCREvidence.deleteMany({
      where: { id: evidenceId, ncrId: id },
    });

    if (deleteResult.count === 0) {
      throw AppError.notFound('Evidence');
    }

    res.json({ message: 'Evidence removed successfully' });
  }),
);
