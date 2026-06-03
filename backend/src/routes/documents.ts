// Feature #248: Documents API routes
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { isSupabaseConfigured } from '../lib/supabase.js';
import multer from 'multer';
import fs from 'fs';
import exifr from 'exifr';
import { ensureUploadSubdirectory } from '../lib/uploadPaths.js';
import { logWarn } from '../lib/serverLogger.js';
import {
  buildDocumentSignedUrlTokenResponse,
  buildInvalidDocumentSignedUrlTokenResponse,
} from './documentResponses.js';
import { createDocumentPublicRouter } from './documents/publicRoutes.js';
import { createDocumentListRouter } from './documents/listRoutes.js';
import { createDocumentUploadRouter } from './documents/uploadRoutes.js';
import { createDocumentFileAccessRouter } from './documents/fileAccessRoutes.js';
import { createDocumentVersionRouter } from './documents/versionRoutes.js';
import { createDocumentDeleteRouter } from './documents/deleteRoutes.js';
import { createDocumentClassificationRouter } from './documents/classificationRoutes.js';
import {
  buildStoredFilename,
  createTempUploadPath,
  generateSignedUrlToken,
  getNormalizedDocumentMimeType,
  getSafeStoredDocumentMimeType,
  getUnsupportedDocumentFileTypeMessage,
  isAllowedDocumentMimeType,
  parseDocumentContentDisposition,
  parseSignedUrlExpiryMinutes,
  sanitizeUploadFilename,
  sendDocumentFile,
  validateSignedUrlToken,
} from './documents/fileHelpers.js';
import {
  applyDocumentPortalCategoryScope,
  applyDocumentReadScope,
  canReadDocument,
  requireDocumentMutationAccess,
  requireDocumentUploadAccess,
  requireSubcontractorDocumentPortalAccess,
} from './documents/access.js';
import {
  cleanupStoredDocumentUpload,
  cleanupUploadedFile,
  deleteFromSupabase,
  getOwnedDocumentStoragePath,
  isExternalFileUrl,
  loadDocumentImageAsBase64,
  resolveLocalDocumentFilePath,
  uploadToSupabase,
} from './documents/storage.js';

const MAX_DOCUMENT_ID_LENGTH = 120;
const MAX_DOCUMENT_TYPE_LENGTH = 80;
const MAX_CATEGORY_LENGTH = 160;
const MAX_CAPTION_LENGTH = 2000;
const MAX_TAGS_LENGTH = 2000;
const MAX_SEARCH_LENGTH = 200;
const DATE_COMPONENT_QUERY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;

async function extractPhotoMetadataFromBuffer(
  file: Express.Multer.File,
): Promise<Awaited<ReturnType<typeof extractPhotoMetadata>>> {
  const tempPath = createTempUploadPath(file.originalname);
  fs.writeFileSync(tempPath, file.buffer);
  try {
    return await extractPhotoMetadata(tempPath, file.mimetype);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

function getOptionalQueryString(
  query: Record<string, unknown>,
  fieldName: string,
  maxLength: number,
): string | undefined {
  const value = query[fieldName];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

function parseDocumentRouteParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > MAX_DOCUMENT_ID_LENGTH) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

function requireValidDocumentRouteParam(fieldName: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    parseDocumentRouteParam(req.params[fieldName], fieldName);
    next();
  };
}

function getOptionalDateQuery(
  query: Record<string, unknown>,
  fieldName: string,
  endOfDay = false,
): Date | undefined {
  const value = getOptionalQueryString(query, fieldName, 32);
  if (!value) {
    return undefined;
  }

  const dateComponentMatch = DATE_COMPONENT_QUERY_PATTERN.exec(value);
  if (dateComponentMatch) {
    const [, year, month, day] = dateComponentMatch;
    const dateComponent = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      dateComponent.getUTCFullYear() !== Number(year) ||
      dateComponent.getUTCMonth() !== Number(month) - 1 ||
      dateComponent.getUTCDate() !== Number(day)
    ) {
      throw AppError.badRequest(`${fieldName} must be a valid date`);
    }
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw AppError.badRequest(`${fieldName} must be a valid date`);
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

// Feature #479: Extract EXIF metadata from image files
async function extractPhotoMetadata(
  filePath: string,
  mimeType: string,
): Promise<{
  gpsLatitude?: number;
  gpsLongitude?: number;
  captureTimestamp?: Date;
  deviceInfo?: string;
}> {
  // Only process image files
  if (!mimeType || !mimeType.startsWith('image/')) {
    return {};
  }

  try {
    const exifData = await exifr.parse(filePath, {
      gps: true,
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'GPSLatitude',
        'GPSLongitude',
        'Make',
        'Model',
        'Software',
      ],
    });

    if (!exifData) {
      return {};
    }

    const result: {
      gpsLatitude?: number;
      gpsLongitude?: number;
      captureTimestamp?: Date;
      deviceInfo?: string;
    } = {};

    // Extract GPS coordinates
    if (exifData.GPSLatitude !== undefined && exifData.GPSLongitude !== undefined) {
      result.gpsLatitude = exifData.latitude || exifData.GPSLatitude;
      result.gpsLongitude = exifData.longitude || exifData.GPSLongitude;
    }

    // Extract capture timestamp
    if (exifData.DateTimeOriginal) {
      result.captureTimestamp = new Date(exifData.DateTimeOriginal);
    } else if (exifData.CreateDate) {
      result.captureTimestamp = new Date(exifData.CreateDate);
    }

    // Extract device info
    const deviceParts: string[] = [];
    if (exifData.Make) deviceParts.push(exifData.Make);
    if (exifData.Model) deviceParts.push(exifData.Model);
    if (exifData.Software) deviceParts.push(`(${exifData.Software})`);
    if (deviceParts.length > 0) {
      result.deviceInfo = deviceParts.join(' ');
    }

    return result;
  } catch (error) {
    logWarn('Error extracting EXIF metadata:', error);
    return {};
  }
}
const router = Router();

// Feature #741: Public signed URL routes (no auth required)
// This MUST be mounted BEFORE the requireAuth middleware.
router.use(
  createDocumentPublicRouter({
    prisma,
    maxDocumentIdLength: MAX_DOCUMENT_ID_LENGTH,
    parseDocumentRouteParam,
    parseDocumentContentDisposition,
    getOptionalQueryString,
    validateSignedUrlToken,
    sendDocumentFile,
    buildInvalidDocumentSignedUrlTokenResponse,
    buildDocumentSignedUrlTokenResponse,
  }),
);

// Apply auth middleware for all subsequent routes
router.use(requireAuth);

// Configure multer for file uploads
// Use memory storage when Supabase is configured, disk storage as fallback
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadSubdirectory('documents'));
    } catch (error) {
      cb(
        error instanceof Error ? error : new Error('Failed to prepare document upload directory'),
        '',
      );
    }
  },
  filename: (_req, file, cb) => {
    cb(null, buildStoredFilename(file.originalname));
  },
});

// Use memory storage for Supabase uploads
const memoryStorage = multer.memoryStorage();

// Use memory storage when Supabase is configured for cloud uploads
const upload = multer({
  storage: isSupabaseConfigured() ? memoryStorage : diskStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (_req, file, cb) => {
    if (isAllowedDocumentMimeType(getNormalizedDocumentMimeType(file))) {
      cb(null, true);
    } else {
      cb(new Error(getUnsupportedDocumentFileTypeMessage(file)));
    }
  },
});

function uploadDocumentToSupabase(
  file: Express.Multer.File,
  projectId: string,
): Promise<{ url: string; storagePath: string }> {
  return uploadToSupabase(file, projectId, {
    buildStoredFilename,
    getSafeStoredDocumentMimeType,
  });
}

router.use(
  createDocumentListRouter({
    prisma,
    maxCategoryLength: MAX_CATEGORY_LENGTH,
    maxDocumentTypeLength: MAX_DOCUMENT_TYPE_LENGTH,
    maxDocumentIdLength: MAX_DOCUMENT_ID_LENGTH,
    maxSearchLength: MAX_SEARCH_LENGTH,
    parseDocumentRouteParam,
    getOptionalQueryString,
    getOptionalDateQuery,
    requireSubcontractorDocumentPortalAccess,
    applyDocumentReadScope,
    applyDocumentPortalCategoryScope,
  }),
);

router.use(
  createDocumentUploadRouter({
    prisma,
    uploadFileMiddleware: upload.single('file'),
    maxDocumentIdLength: MAX_DOCUMENT_ID_LENGTH,
    maxDocumentTypeLength: MAX_DOCUMENT_TYPE_LENGTH,
    maxCategoryLength: MAX_CATEGORY_LENGTH,
    maxCaptionLength: MAX_CAPTION_LENGTH,
    maxTagsLength: MAX_TAGS_LENGTH,
    cleanupUploadedFile,
    requireDocumentUploadAccess,
    getSafeStoredDocumentMimeType,
    extractPhotoMetadata,
    extractPhotoMetadataFromBuffer,
    uploadToSupabase: uploadDocumentToSupabase,
    cleanupStoredDocumentUpload,
    sanitizeUploadFilename,
  }),
);

router.use(
  createDocumentVersionRouter({
    prisma,
    uploadFileMiddleware: upload.single('file'),
    parseDocumentRouteParam,
    requireValidDocumentRouteParam,
    cleanupUploadedFile,
    canReadDocument,
    requireDocumentMutationAccess,
    getSafeStoredDocumentMimeType,
    extractPhotoMetadata,
    extractPhotoMetadataFromBuffer,
    uploadToSupabase: uploadDocumentToSupabase,
    cleanupStoredDocumentUpload,
    sanitizeUploadFilename,
  }),
);

router.use(
  createDocumentFileAccessRouter({
    prisma,
    parseDocumentRouteParam,
    parseDocumentContentDisposition,
    parseSignedUrlExpiryMinutes,
    generateSignedUrlToken,
    canReadDocument,
    sendDocumentFile,
  }),
);

// DELETE /api/documents/:documentId - Delete a document
router.use(
  createDocumentDeleteRouter({
    prisma,
    parseDocumentRouteParam,
    canReadDocument,
    requireDocumentMutationAccess,
    isSupabaseConfigured,
    getOwnedDocumentStoragePath,
    deleteFromSupabase,
    isExternalFileUrl,
    resolveLocalDocumentFilePath,
  }),
);

router.use(
  createDocumentClassificationRouter({
    prisma,
    parseDocumentRouteParam,
    canReadDocument,
    requireDocumentMutationAccess,
    loadDocumentImageAsBase64,
  }),
);

export default router;
