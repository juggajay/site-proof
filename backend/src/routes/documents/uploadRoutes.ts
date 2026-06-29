import { Router, Request, Response, type RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { checkProjectAccess } from '../../lib/projectAccess.js';
import { isSupabaseConfigured } from '../../lib/supabase.js';
import { assertUploadedFileMatchesDeclaredType } from '../../lib/imageValidation.js';
import { buildDocumentResponse } from '../documentResponses.js';
import {
  attachDocumentToItpCompletion,
  resolveItpEvidenceAttachmentTarget,
  type ItpEvidenceAttachmentTarget,
} from './itpEvidenceAttachment.js';

type AuthUser = NonNullable<Express.Request['user']>;

type PhotoMetadata = {
  gpsLatitude?: number;
  gpsLongitude?: number;
  captureTimestamp?: Date;
  deviceInfo?: string;
};

type CreateDocumentUploadRouterDependencies = {
  prisma: PrismaClient;
  uploadFileMiddleware: RequestHandler;
  maxDocumentIdLength: number;
  maxDocumentTypeLength: number;
  maxCategoryLength: number;
  maxCaptionLength: number;
  maxTagsLength: number;
  cleanupUploadedFile: (file?: Express.Multer.File) => void;
  requireDocumentUploadAccess: (
    user: AuthUser,
    projectId: string,
    lotId?: string | null,
    category?: string | null,
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

const GPS_COORDINATE_PATTERN = /^-?(?:\d+|\d+\.\d+|\.\d+)$/;

const requiredFormStringSchema = (fieldName: string, maxLength: number) =>
  z.string().trim().min(1, `${fieldName} is required`).max(maxLength, `${fieldName} is too long`);

const optionalFormStringSchema = (fieldName: string, maxLength: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z.string().max(maxLength, `${fieldName} is too long`).nullish(),
  );

const optionalGpsCoordinateSchema = (fieldName: string, min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return null;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
          return null;
        }
        return GPS_COORDINATE_PATTERN.test(trimmed) ? Number(trimmed) : Number.NaN;
      }

      return value;
    },
    z
      .number({ invalid_type_error: `${fieldName} must be a valid decimal coordinate` })
      .refine(Number.isFinite, `${fieldName} must be a valid decimal coordinate`)
      .refine(
        (value) => value >= min && value <= max,
        `${fieldName} must be between ${min} and ${max}`,
      )
      .nullish(),
  );

const optionalCaptureTimestampSchema = (fieldName: string) =>
  z
    .preprocess(
      (value) => {
        if (value === undefined || value === null) {
          return undefined;
        }

        if (typeof value === 'string') {
          const trimmed = value.trim();
          return trimmed.length > 0 ? trimmed : undefined;
        }

        return value;
      },
      z
        .string()
        .max(64, `${fieldName} is too long`)
        .datetime({ message: `${fieldName} must be a valid ISO 8601 datetime` })
        .optional(),
    )
    .transform((value) => (value ? new Date(value) : undefined));

function createUploadDocumentBodySchema({
  maxDocumentIdLength,
  maxDocumentTypeLength,
  maxCategoryLength,
  maxCaptionLength,
  maxTagsLength,
}: Pick<
  CreateDocumentUploadRouterDependencies,
  | 'maxDocumentIdLength'
  | 'maxDocumentTypeLength'
  | 'maxCategoryLength'
  | 'maxCaptionLength'
  | 'maxTagsLength'
>) {
  return z.object({
    projectId: requiredFormStringSchema('projectId', maxDocumentIdLength),
    lotId: optionalFormStringSchema('lotId', maxDocumentIdLength),
    documentType: requiredFormStringSchema('documentType', maxDocumentTypeLength),
    category: optionalFormStringSchema('category', maxCategoryLength),
    caption: optionalFormStringSchema('caption', maxCaptionLength),
    tags: optionalFormStringSchema('tags', maxTagsLength),
    gpsLatitude: optionalGpsCoordinateSchema('gpsLatitude', -90, 90),
    gpsLongitude: optionalGpsCoordinateSchema('gpsLongitude', -180, 180),
    capturedAt: optionalCaptureTimestampSchema('capturedAt'),
    // Entity linkage sent by the offline photo sync worker. Only
    // entityType 'itp' (ITP completion evidence) is acted on today; other
    // values are accepted and ignored so queued photos from older clients
    // never fail validation.
    entityType: optionalFormStringSchema('entityType', maxDocumentTypeLength),
    entityId: optionalFormStringSchema('entityId', maxDocumentIdLength),
  });
}

export function createDocumentUploadRouter({
  prisma,
  uploadFileMiddleware,
  maxDocumentIdLength,
  maxDocumentTypeLength,
  maxCategoryLength,
  maxCaptionLength,
  maxTagsLength,
  cleanupUploadedFile,
  requireDocumentUploadAccess,
  getSafeStoredDocumentMimeType,
  extractPhotoMetadata,
  extractPhotoMetadataFromBuffer,
  uploadToSupabase,
  cleanupStoredDocumentUpload,
  sanitizeUploadFilename,
}: CreateDocumentUploadRouterDependencies) {
  const uploadRoutes = Router();
  const uploadDocumentBodySchema = createUploadDocumentBodySchema({
    maxDocumentIdLength,
    maxDocumentTypeLength,
    maxCategoryLength,
    maxCaptionLength,
    maxTagsLength,
  });

  uploadRoutes.use(requireAuth);

  // POST /api/documents/upload - Upload a document
  uploadRoutes.post(
    '/upload',
    uploadFileMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;
      if (!userId) {
        throw AppError.unauthorized();
      }

      if (!req.file) {
        throw AppError.badRequest('No file uploaded');
      }

      const uploadedFile = req.file;

      const bodyParse = uploadDocumentBodySchema.safeParse(req.body);
      if (!bodyParse.success) {
        cleanupUploadedFile(uploadedFile);
        throw AppError.fromZodError(bodyParse.error);
      }

      const {
        projectId,
        lotId,
        documentType,
        category,
        caption,
        tags,
        gpsLatitude,
        gpsLongitude,
        capturedAt,
        entityType,
        entityId,
      } = bodyParse.data;

      const hasAccess = await checkProjectAccess(userId, projectId);
      if (!hasAccess) {
        cleanupUploadedFile(uploadedFile);
        throw AppError.forbidden('Access denied');
      }
      try {
        await requireDocumentUploadAccess(req.user!, projectId, lotId || null, category || null);
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

      // ITP evidence linkage (offline photo pipeline): resolve + authorize the
      // target completion BEFORE the file is stored so a rejected upload never
      // leaves a stored file or document row behind. Unknown completions
      // resolve to null (orphan-safe — the upload proceeds unattached).
      let itpEvidenceTarget: ItpEvidenceAttachmentTarget | null = null;
      try {
        itpEvidenceTarget = await resolveItpEvidenceAttachmentTarget(req.user!, {
          entityType,
          entityId,
          projectId,
          lotId,
        });
      } catch (error) {
        cleanupUploadedFile(uploadedFile);
        throw error;
      }

      let fileUrl: string | null = null;
      let photoMetadata: PhotoMetadata = {};
      let createdDocumentId: string | null = null;
      const effectiveLotId = itpEvidenceTarget?.lotId ?? lotId ?? null;

      try {
        // Upload to Supabase Storage if configured, otherwise use local filesystem
        const storedMimeType = getSafeStoredDocumentMimeType(uploadedFile);
        if (isSupabaseConfigured() && uploadedFile.buffer) {
          // For EXIF extraction from memory buffer, write to temp file
          if (uploadedFile.mimetype.startsWith('image/')) {
            photoMetadata = await extractPhotoMetadataFromBuffer(uploadedFile);
          }

          // Upload to Supabase
          const uploaded = await uploadToSupabase(uploadedFile, projectId);
          fileUrl = uploaded.url;
        } else {
          // Fallback to local filesystem
          photoMetadata = await extractPhotoMetadata(uploadedFile.path, uploadedFile.mimetype);
          fileUrl = `/uploads/documents/${uploadedFile.filename}`;
        }

        // Create document record
        const document = await prisma.document.create({
          data: {
            projectId,
            lotId: effectiveLotId,
            documentType,
            category: category || null,
            filename: sanitizeUploadFilename(uploadedFile.originalname),
            fileUrl,
            fileSize: uploadedFile.size,
            mimeType: storedMimeType,
            uploadedById: userId,
            caption: caption || null,
            tags: tags || null,
            // Feature #479: Store extracted EXIF data
            gpsLatitude: gpsLatitude ?? photoMetadata.gpsLatitude,
            gpsLongitude: gpsLongitude ?? photoMetadata.gpsLongitude,
            captureTimestamp: photoMetadata.captureTimestamp ?? capturedAt,
            // Store device info in aiClassification field as metadata
            aiClassification: photoMetadata.deviceInfo
              ? JSON.stringify({ deviceInfo: photoMetadata.deviceInfo })
              : null,
          },
          include: {
            lot: { select: { id: true, lotNumber: true } },
            uploadedBy: { select: { id: true, fullName: true, email: true } },
          },
        });

        createdDocumentId = document.id;

        // Attach ITP evidence to its completion — the same association row the
        // direct attach endpoint creates, so a queued-and-synced photo ends up
        // identical to a directly uploaded one. Runs after the document exists;
        // a failure here surfaces as a 500 so the offline queue retries (the
        // retry re-resolves the target and stays orphan-safe).
        if (itpEvidenceTarget) {
          await attachDocumentToItpCompletion(itpEvidenceTarget, document.id);
        }

        res.status(201).json(buildDocumentResponse(document));
      } catch (error) {
        if (createdDocumentId) {
          await prisma.iTPCompletionAttachment.deleteMany({
            where: { documentId: createdDocumentId },
          });
          await prisma.document.deleteMany({ where: { id: createdDocumentId } });
        }
        await cleanupStoredDocumentUpload(fileUrl, uploadedFile, projectId);
        throw error;
      }
    }),
  );

  return uploadRoutes;
}
