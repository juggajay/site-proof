import { Router, Request, Response, type RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { isSupabaseConfigured } from '../../lib/supabase.js';
import { assertUploadedFileMatchesDeclaredType } from '../../lib/imageValidation.js';
import { buildDocumentResponse, buildDocumentVersionsResponse } from '../documentResponses.js';

type AuthUser = NonNullable<Express.Request['user']>;

type DocumentAccessRecord = {
  projectId: string;
  lotId: string | null;
  uploadedById: string | null;
  documentType?: string | null;
  category?: string | null;
};

type PhotoMetadata = {
  gpsLatitude?: number;
  gpsLongitude?: number;
  captureTimestamp?: Date;
  deviceInfo?: string;
};

type CreateDocumentVersionRouterDependencies = {
  prisma: PrismaClient;
  uploadFileMiddleware: RequestHandler;
  parseDocumentRouteParam: (value: unknown, fieldName: string) => string;
  requireValidDocumentRouteParam: (fieldName: string) => RequestHandler;
  cleanupUploadedFile: (file?: Express.Multer.File) => void;
  canReadDocument: (user: AuthUser, document: DocumentAccessRecord) => Promise<boolean>;
  requireDocumentMutationAccess: (
    user: AuthUser,
    document: DocumentAccessRecord,
    targetLotId?: string | null,
    targetCategory?: string | null,
  ) => Promise<void>;
  getSafeStoredDocumentMimeType: (
    file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>,
  ) => string;
  extractPhotoMetadata: (filePath: string, mimeType: string) => Promise<PhotoMetadata>;
  extractPhotoMetadataFromBuffer: (file: Express.Multer.File) => Promise<PhotoMetadata>;
  uploadToSupabase: (
    file: Express.Multer.File,
    projectId: string,
  ) => Promise<{ url: string; storagePath: string }>;
  cleanupStoredDocumentUpload: (
    fileUrl: string | null,
    file: Express.Multer.File,
    projectId: string,
  ) => Promise<void>;
  sanitizeUploadFilename: (filename: string) => string;
};

async function assertDocumentCanUseGenericVersioning(
  prisma: PrismaClient,
  documentId: string,
): Promise<void> {
  const [itpAttachment, ncrEvidence] = await Promise.all([
    prisma.iTPCompletionAttachment.findFirst({
      where: { documentId },
      select: { id: true },
    }),
    prisma.nCREvidence.findFirst({
      where: { documentId },
      select: { id: true },
    }),
  ]);

  if (!itpAttachment && !ncrEvidence) {
    return;
  }

  throw AppError.conflict(
    'Workflow evidence documents must be replaced from the ITP or NCR workflow.',
    {
      code: 'WORKFLOW_EVIDENCE_VERSION_BLOCKED',
      evidenceType: itpAttachment ? 'itp' : 'ncr',
    },
  );
}

export function createDocumentVersionRouter({
  prisma,
  uploadFileMiddleware,
  parseDocumentRouteParam,
  requireValidDocumentRouteParam,
  cleanupUploadedFile,
  canReadDocument,
  requireDocumentMutationAccess,
  getSafeStoredDocumentMimeType,
  extractPhotoMetadata,
  extractPhotoMetadataFromBuffer,
  uploadToSupabase,
  cleanupStoredDocumentUpload,
  sanitizeUploadFilename,
}: CreateDocumentVersionRouterDependencies) {
  const versionRoutes = Router();

  // Feature #481: POST /api/documents/:documentId/version - Upload a new version of a document
  versionRoutes.post(
    '/:documentId/version',
    requireValidDocumentRouteParam('documentId'),
    uploadFileMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = parseDocumentRouteParam(req.params.documentId, 'documentId');
      const userId = req.user!.id;
      if (!userId) {
        throw AppError.unauthorized();
      }

      if (!req.file) {
        throw AppError.badRequest('No file uploaded');
      }
      const uploadedFile = req.file;

      // Find the original document
      const originalDocument = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!originalDocument) {
        cleanupUploadedFile(uploadedFile);
        throw AppError.notFound('Original document');
      }

      const hasAccess = await canReadDocument(req.user!, originalDocument);
      if (!hasAccess) {
        cleanupUploadedFile(uploadedFile);
        throw AppError.forbidden('Access denied');
      }
      try {
        await requireDocumentMutationAccess(req.user!, originalDocument);
      } catch (error) {
        cleanupUploadedFile(uploadedFile);
        throw error;
      }
      try {
        await assertDocumentCanUseGenericVersioning(prisma, originalDocument.id);
      } catch (error) {
        cleanupUploadedFile(uploadedFile);
        throw error;
      }
      try {
        assertUploadedFileMatchesDeclaredType(uploadedFile);
      } catch (error) {
        cleanupUploadedFile(uploadedFile);
        throw error;
      }

      // Find the root document (first version)
      let rootDocumentId = originalDocument.id;
      // Note: currentVersion is tracked via allVersions query below
      if (originalDocument.parentDocumentId) {
        // This is already a version, find the root
        const rootDocument = await prisma.document.findUnique({
          where: { id: originalDocument.parentDocumentId },
        });
        if (rootDocument) {
          rootDocumentId = rootDocument.id;
        }
      }

      let fileUrl: string | null = null;
      let photoMetadata: PhotoMetadata = {};
      let documentCreated = false;

      try {
        // Upload to Supabase Storage if configured, otherwise use local filesystem
        const storedMimeType = getSafeStoredDocumentMimeType(uploadedFile);
        if (isSupabaseConfigured() && uploadedFile.buffer) {
          // For EXIF extraction from memory buffer, write to temp file
          if (uploadedFile.mimetype.startsWith('image/')) {
            photoMetadata = await extractPhotoMetadataFromBuffer(uploadedFile);
          }

          const uploaded = await uploadToSupabase(uploadedFile, originalDocument.projectId);
          fileUrl = uploaded.url;
        } else {
          photoMetadata = await extractPhotoMetadata(uploadedFile.path, uploadedFile.mimetype);
          fileUrl = `/uploads/documents/${uploadedFile.filename}`;
        }
        const storedFileUrl = fileUrl;

        const newDocument = await prisma.$transaction(async (tx) => {
          const versionScope = {
            OR: [{ id: rootDocumentId }, { parentDocumentId: rootDocumentId }],
          };

          await tx.$queryRaw`SELECT id FROM documents WHERE id = ${rootDocumentId} FOR UPDATE`;

          const targetDocument = await tx.document.findUnique({
            where: { id: originalDocument.id },
            select: { isLatestVersion: true },
          });
          if (!targetDocument) {
            throw AppError.notFound('Original document');
          }
          if (!targetDocument.isLatestVersion) {
            throw AppError.conflict(
              'New versions must be uploaded from the current latest document',
            );
          }

          const allVersions = await tx.document.findMany({
            where: versionScope,
            select: { version: true },
          });
          const highestVersion = Math.max(...allVersions.map((v) => v.version));
          const newVersion = highestVersion + 1;

          await tx.document.updateMany({
            where: versionScope,
            data: { isLatestVersion: false },
          });

          return tx.document.create({
            data: {
              projectId: originalDocument.projectId,
              lotId: originalDocument.lotId,
              documentType: originalDocument.documentType,
              category: originalDocument.category,
              filename: sanitizeUploadFilename(uploadedFile.originalname),
              fileUrl: storedFileUrl,
              fileSize: uploadedFile.size,
              mimeType: storedMimeType,
              uploadedById: userId,
              caption: originalDocument.caption,
              tags: originalDocument.tags,
              version: newVersion,
              parentDocumentId: rootDocumentId,
              isLatestVersion: true,
              gpsLatitude: photoMetadata.gpsLatitude,
              gpsLongitude: photoMetadata.gpsLongitude,
              captureTimestamp: photoMetadata.captureTimestamp,
              aiClassification: photoMetadata.deviceInfo
                ? JSON.stringify({ deviceInfo: photoMetadata.deviceInfo })
                : null,
            },
            include: {
              lot: { select: { id: true, lotNumber: true } },
              uploadedBy: { select: { id: true, fullName: true, email: true } },
            },
          });
        });

        documentCreated = true;
        res.status(201).json(buildDocumentResponse(newDocument));
      } catch (error) {
        if (!documentCreated) {
          await cleanupStoredDocumentUpload(fileUrl, uploadedFile, originalDocument.projectId);
        }
        throw error;
      }
    }),
  );

  // Feature #481: GET /api/documents/:documentId/versions - Get all versions of a document
  versionRoutes.get(
    '/:documentId/versions',
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = parseDocumentRouteParam(req.params.documentId, 'documentId');
      const userId = req.user!.id;

      if (!userId) {
        throw AppError.unauthorized();
      }

      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw AppError.notFound('Document');
      }

      const hasAccess = await canReadDocument(req.user!, document);
      if (!hasAccess) {
        throw AppError.forbidden('Access denied');
      }

      // Find the root document ID
      const rootDocumentId = document.parentDocumentId || document.id;

      // Get all versions
      const versions = await prisma.document.findMany({
        where: {
          OR: [{ id: rootDocumentId }, { parentDocumentId: rootDocumentId }],
        },
        include: {
          uploadedBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { version: 'desc' },
      });

      res.json(buildDocumentVersionsResponse(rootDocumentId, versions));
    }),
  );

  return versionRoutes;
}
