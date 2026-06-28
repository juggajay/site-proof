// NCR evidence: add, list, delete evidence attachments
import type { Prisma } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import {
  NCR_EVIDENCE_MUTATION_ROLES,
  parseNcrRouteParam,
  requireNcrReadAccess,
  requireNcrEvidenceMutationAccess,
  requireNcrResponsibleOrProjectRole,
} from './ncrAccess.js';
import {
  buildNcrEvidenceAddedResponse,
  buildNcrEvidenceAlreadyLinkedResponse,
  buildNcrEvidenceListResponse,
  buildNcrEvidenceRemovedResponse,
} from './ncrEvidenceResponses.js';
import { isUniqueConstraintOn } from './ncrCoreValidation.js';
import { canReadDocument } from '../documents/access.js';

const MAX_DOCUMENT_FILE_SIZE_BYTES = 2_147_483_647;
const MAX_EVIDENCE_TYPE_LENGTH = 80;
const MAX_EVIDENCE_FILENAME_LENGTH = 180;
const MAX_EVIDENCE_FILE_URL_LENGTH = 2048;
const MAX_EVIDENCE_MIME_TYPE_LENGTH = 120;
const MAX_EVIDENCE_CAPTION_LENGTH = 2000;
const MAX_EVIDENCE_PROJECT_ID_LENGTH = 120;

const ncrEvidenceDocumentInclude = {
  document: {
    select: {
      id: true,
      filename: true,
      fileUrl: true,
      mimeType: true,
      uploadedAt: true,
    },
  },
} as const;

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
    if (!data.documentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'documentId is required',
        path: ['documentId'],
      });
    }

    if (data.filename || data.fileUrl || data.fileSize || data.mimeType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Upload evidence first, then attach it by documentId',
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

type AddEvidenceInput = z.infer<typeof addEvidenceSchema>;
type RequestAuthUser = NonNullable<Request['user']>;
type NcrEvidenceWithDocument = Prisma.NCREvidenceGetPayload<{
  include: typeof ncrEvidenceDocumentInclude;
}>;

export const ncrEvidenceRouter = Router();

async function resolveNcrEvidenceDocumentId(
  projectId: string,
  user: RequestAuthUser,
  evidenceInput: AddEvidenceInput,
): Promise<string> {
  const { documentId } = evidenceInput;

  if (documentId) {
    const existingDocument = await prisma.document.findFirst({
      where: {
        id: documentId,
        projectId,
      },
      select: {
        id: true,
        projectId: true,
        lotId: true,
        uploadedById: true,
        documentType: true,
        category: true,
      },
    });

    if (!existingDocument) {
      throw AppError.notFound('Document');
    }

    if (!(await canReadDocument(user, existingDocument))) {
      throw AppError.forbidden('You do not have access to this evidence document');
    }

    return documentId;
  }

  throw AppError.badRequest('documentId is required');
}

async function findNcrEvidenceLink(
  ncrId: string,
  documentId: string,
): Promise<NcrEvidenceWithDocument | null> {
  return prisma.nCREvidence.findUnique({
    where: {
      ncrId_documentId: {
        ncrId,
        documentId,
      },
    },
    include: ncrEvidenceDocumentInclude,
  });
}

async function createNcrEvidenceLink(
  ncrId: string,
  documentId: string,
  evidenceType?: string,
): Promise<{ evidence: NcrEvidenceWithDocument; created: boolean }> {
  const existingEvidence = await findNcrEvidenceLink(ncrId, documentId);
  if (existingEvidence) {
    return { evidence: existingEvidence, created: false };
  }

  try {
    const evidence = await prisma.nCREvidence.create({
      data: {
        ncrId,
        documentId,
        evidenceType: evidenceType || 'photo',
      },
      include: ncrEvidenceDocumentInclude,
    });
    return { evidence, created: true };
  } catch (error) {
    if (!isUniqueConstraintOn(error, ['ncrId', 'documentId'])) {
      throw error;
    }

    const linkedEvidence = await findNcrEvidenceLink(ncrId, documentId);
    if (!linkedEvidence) {
      throw error;
    }

    return { evidence: linkedEvidence, created: false };
  }
}

// POST /api/ncrs/:id/evidence - Add evidence to NCR
ncrEvidenceRouter.post(
  '/:id/evidence',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = addEvidenceSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.badRequest('Validation failed', { issues: validation.error.issues });
    }

    const user = req.user as RequestAuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const { evidenceType, projectId: _providedProjectId } = validation.data;

    const ncr = await prisma.nCR.findUnique({
      where: { id },
    });

    if (!ncr) {
      throw AppError.notFound('NCR');
    }

    await requireNcrResponsibleOrProjectRole(
      ncr,
      user,
      'Only responsible parties or project quality roles can add NCR evidence',
      NCR_EVIDENCE_MUTATION_ROLES,
    );

    const finalDocumentId = await resolveNcrEvidenceDocumentId(
      ncr.projectId,
      user,
      validation.data,
    );

    const { evidence, created } = await createNcrEvidenceLink(id, finalDocumentId, evidenceType);
    if (!created) {
      res.json(buildNcrEvidenceAlreadyLinkedResponse(evidence));
      return;
    }

    await createAuditLog({
      projectId: ncr.projectId,
      userId: user.userId,
      entityType: 'ncr_evidence',
      entityId: evidence.id,
      action: AuditAction.NCR_EVIDENCE_ADDED,
      changes: {
        ncrId: id,
        documentId: finalDocumentId!,
        evidenceType: evidence.evidenceType,
      },
      req,
    });

    res.status(201).json(buildNcrEvidenceAddedResponse(evidence));
  }),
);

// GET /api/ncrs/:id/evidence - List evidence for NCR
ncrEvidenceRouter.get(
  '/:id/evidence',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as RequestAuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        ncrLots: { select: { lotId: true } },
      },
    });

    if (!ncr) {
      throw AppError.notFound('NCR');
    }

    await requireNcrReadAccess(ncr, user);

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

    res.json(buildNcrEvidenceListResponse(evidence));
  }),
);

// DELETE /api/ncrs/:id/evidence/:evidenceId - Remove evidence from NCR
ncrEvidenceRouter.delete(
  '/:id/evidence/:evidenceId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as RequestAuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const evidenceId = parseNcrRouteParam(req.params.evidenceId, 'evidenceId');

    const ncr = await prisma.nCR.findUnique({
      where: { id },
    });

    if (!ncr) {
      throw AppError.notFound('NCR');
    }

    // Check if NCR is not closed
    if (ncr.status === 'closed' || ncr.status === 'closed_concession') {
      throw AppError.badRequest('Cannot remove evidence from a closed NCR');
    }

    const evidence = await prisma.nCREvidence.findUnique({
      where: { id: evidenceId },
      select: {
        ncrId: true,
        documentId: true,
        evidenceType: true,
        document: { select: { uploadedById: true } },
      },
    });

    if (!evidence || evidence.ncrId !== id) {
      throw AppError.notFound('Evidence');
    }

    await requireNcrEvidenceMutationAccess(
      ncr,
      user,
      'Only responsible parties, evidence uploaders, or project quality roles can remove NCR evidence',
      evidence.document.uploadedById,
    );

    await prisma.nCREvidence.delete({
      where: { id: evidenceId },
    });

    await createAuditLog({
      projectId: ncr.projectId,
      userId: user.userId,
      entityType: 'ncr_evidence',
      entityId: evidenceId,
      action: AuditAction.NCR_EVIDENCE_REMOVED,
      changes: {
        ncrId: id,
        documentId: evidence.documentId,
        evidenceType: evidence.evidenceType,
      },
      req,
    });

    res.json(buildNcrEvidenceRemovedResponse());
  }),
);
