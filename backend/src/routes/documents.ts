// Feature #248: Documents API routes
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError, ErrorCodes } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { parsePagination, getPrismaSkipTake, getPaginationMeta } from '../lib/pagination.js';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  getSupabasePublicUrl,
  getSupabaseStoragePath,
  DOCUMENTS_BUCKET,
} from '../lib/supabase.js';
import {
  activeSubcontractorCompanyWhere,
  checkProjectAccess,
  hasSubcontractorPortalModuleAccess,
  requireSubcontractorPortalModuleAccess,
} from '../lib/projectAccess.js';
import type { SubcontractorPortalAccessKey } from '../lib/projectAccess.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import exifr from 'exifr';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { buildBackendUrl } from '../lib/runtimeConfig.js';
import { ensureUploadSubdirectory, resolveUploadPath } from '../lib/uploadPaths.js';
import { assertUploadedFileMatchesDeclaredType } from '../lib/imageValidation.js';
import { sanitizeUrlValueForLog } from '../lib/logSanitization.js';
import { logError, logWarn } from '../lib/serverLogger.js';
import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';

type SignedUrlValidation = {
  valid: boolean;
  expired?: boolean;
  userId?: string;
  expiresAt?: Date;
  createdAt?: Date;
};

const PHOTO_CLASSIFICATION_CATEGORIES = [
  'Survey',
  'Compaction',
  'Material Delivery',
  'Excavation',
  'Formwork',
  'Concrete Pour',
  'Pipe Laying',
  'General Progress',
  'Inspection',
  'Testing',
  'Safety',
  'Plant/Equipment',
] as const;

type PhotoClassificationCategory = (typeof PHOTO_CLASSIFICATION_CATEGORIES)[number];
type PhotoClassificationSuggestion = { label: PhotoClassificationCategory; confidence: number };

const MAX_DOCUMENT_ID_LENGTH = 120;
const MAX_DOCUMENT_TYPE_LENGTH = 80;
const MAX_CATEGORY_LENGTH = 160;
const MAX_CAPTION_LENGTH = 2000;
const MAX_TAGS_LENGTH = 2000;
const MAX_FILENAME_LENGTH = 180;
const MAX_SEARCH_LENGTH = 200;
const DATE_COMPONENT_QUERY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;
const LOCAL_DOCUMENT_FILE_SUBDIRECTORIES = ['documents', 'certificates', 'drawings'] as const;
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-outlook',
  'message/rfc822',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);
const EXTENSION_DOCUMENT_MIME_TYPES = new Map([
  ['.eml', 'message/rfc822'],
  ['.msg', 'application/vnd.ms-outlook'],
]);
const INLINE_RENDERABLE_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const requiredFormStringSchema = (fieldName: string, maxLength = MAX_DOCUMENT_ID_LENGTH) =>
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

const uploadDocumentBodySchema = z.object({
  projectId: requiredFormStringSchema('projectId'),
  lotId: optionalFormStringSchema('lotId', MAX_DOCUMENT_ID_LENGTH),
  documentType: requiredFormStringSchema('documentType', MAX_DOCUMENT_TYPE_LENGTH),
  category: optionalFormStringSchema('category', MAX_CATEGORY_LENGTH),
  caption: optionalFormStringSchema('caption', MAX_CAPTION_LENGTH),
  tags: optionalFormStringSchema('tags', MAX_TAGS_LENGTH),
});

const updateDocumentBodySchema = z.object({
  lotId: optionalFormStringSchema('lotId', MAX_DOCUMENT_ID_LENGTH),
  category: optionalFormStringSchema('category', MAX_CATEGORY_LENGTH),
  caption: optionalFormStringSchema('caption', MAX_CAPTION_LENGTH),
  tags: optionalFormStringSchema('tags', MAX_TAGS_LENGTH),
  isFavourite: z.boolean().optional(),
});

const saveClassificationBodySchema = z
  .object({
    classification: optionalFormStringSchema('classification', MAX_CATEGORY_LENGTH),
    classifications: z
      .array(
        z.object({
          label: requiredFormStringSchema('label', MAX_CATEGORY_LENGTH),
        }),
      )
      .max(3, 'classifications must contain at most 3 labels')
      .optional(),
  })
  .refine(
    (data) =>
      Boolean(data.classification || (data.classifications && data.classifications.length > 0)),
    { message: 'Classification is required' },
  );

function isAnthropicConfigured(): boolean {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return Boolean(
    apiKey &&
    apiKey !== 'sk-placeholder' &&
    !apiKey.toLowerCase().includes('placeholder') &&
    !apiKey.toLowerCase().includes('your-'),
  );
}

function photoClassificationUnavailable(
  message = 'AI photo classification is not configured',
): AppError {
  return new AppError(503, message, ErrorCodes.EXTERNAL_SERVICE_ERROR);
}

function loadDocumentImageAsBase64(document: { fileUrl: string }, mimeType: string): string {
  if (document.fileUrl.startsWith('data:')) {
    const base64Match = document.fileUrl.match(
      new RegExp(`^data:${mimeType.replace('/', '\\/')};base64,(.+)$`),
    );
    if (!base64Match) {
      throw AppError.badRequest('Invalid base64 data URL format');
    }
    return base64Match[1];
  }

  const filePath = resolveLocalDocumentFilePath(document.fileUrl);
  if (!fs.existsSync(filePath)) {
    throw AppError.notFound('Image file');
  }

  return fs.readFileSync(filePath).toString('base64');
}

function normalizeClassificationConfidence(value: string | undefined): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(100, Math.max(0, parsed));
}

function parseClassificationResponse(text: string): PhotoClassificationSuggestion[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const suggestions: PhotoClassificationSuggestion[] = [];

  for (const line of lines) {
    const [category, confidenceStr] = line.split('|');
    const matchedCategory = PHOTO_CLASSIFICATION_CATEGORIES.find(
      (c) => c.toLowerCase() === category?.toLowerCase().trim(),
    );

    if (!matchedCategory) {
      continue;
    }

    const confidence = normalizeClassificationConfidence(confidenceStr);
    if (confidence <= 0) {
      continue;
    }

    suggestions.push({ label: matchedCategory, confidence });
  }

  return suggestions;
}

function hashSignedUrlToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function cleanupExpiredSignedUrlTokens(now: Date = new Date()): Promise<void> {
  await prisma.documentSignedUrlToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });
}

// Generate a signed URL token
async function generateSignedUrlToken(
  documentId: string,
  userId: string,
  expiresInMinutes: number = 15,
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  await cleanupExpiredSignedUrlTokens();
  await prisma.documentSignedUrlToken.create({
    data: {
      tokenHash: hashSignedUrlToken(token),
      documentId,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

// Validate a signed URL token
async function validateSignedUrlToken(
  token: string,
  documentId: string,
): Promise<SignedUrlValidation> {
  const tokenHash = hashSignedUrlToken(token);
  const data = await prisma.documentSignedUrlToken.findUnique({
    where: { tokenHash },
  });

  if (!data) {
    return { valid: false };
  }

  if (data.documentId !== documentId) {
    return { valid: false };
  }

  if (data.expiresAt < new Date()) {
    await prisma.documentSignedUrlToken.deleteMany({ where: { tokenHash } });
    return { valid: false, expired: true };
  }

  return {
    valid: true,
    userId: data.userId,
    expiresAt: data.expiresAt,
    createdAt: data.createdAt,
  };
}

function getSignedUrlTokenResponse(validation: SignedUrlValidation, documentId: string) {
  return {
    valid: true,
    expired: false,
    documentId,
    expiresAt: validation.expiresAt?.toISOString(),
    createdAt: validation.createdAt?.toISOString(),
    message: 'Token is valid',
  };
}

function parseSignedUrlExpiryMinutes(value: unknown): number {
  if (value === undefined) return 15;

  let parsed: number;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string') {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      throw AppError.badRequest('expiresInMinutes must be an integer between 1 and 1440');
    }
    parsed = Number(normalized);
  } else {
    throw AppError.badRequest('expiresInMinutes must be an integer between 1 and 1440');
  }

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1440) {
    throw AppError.badRequest('expiresInMinutes must be an integer between 1 and 1440');
  }

  return parsed;
}

function isExternalFileUrl(fileUrl: string): boolean {
  return /^https?:\/\//i.test(fileUrl);
}

function isSafeExternalDocumentUrl(fileUrl: string): boolean {
  return getSupabaseStoragePath(fileUrl, DOCUMENTS_BUCKET) !== null;
}

function resolveLocalDocumentFilePath(fileUrl: string): string {
  for (const subdirectory of LOCAL_DOCUMENT_FILE_SUBDIRECTORIES) {
    try {
      return resolveUploadPath(fileUrl, subdirectory);
    } catch (error) {
      if (!(error instanceof AppError)) {
        throw error;
      }
    }
  }

  throw AppError.badRequest('Invalid upload path');
}

function getSafeDownloadFilename(filename: string): string {
  const basename = path.basename(filename.replace(/\\/g, '/'));
  const sanitized = basename
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 || '<>:"/\\|?*'.includes(char) ? '_' : char;
    })
    .join('')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, MAX_FILENAME_LENGTH);

  return sanitized || 'document';
}

function sanitizeUploadFilename(filename: string): string {
  const basename = path.basename(filename.replace(/\\/g, '/'));
  const sanitized = basename
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char))
    .join('')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, MAX_FILENAME_LENGTH);

  return sanitized || 'upload';
}

function getNormalizedDocumentMimeType(
  file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>,
): string {
  const extensionMimeType = EXTENSION_DOCUMENT_MIME_TYPES.get(
    path.extname(file.originalname).toLowerCase(),
  );
  return extensionMimeType ?? file.mimetype.toLowerCase();
}

function getSafeStoredDocumentMimeType(
  file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>,
): string {
  const normalizedMimeType = getNormalizedDocumentMimeType(file);
  return ALLOWED_DOCUMENT_MIME_TYPES.has(normalizedMimeType)
    ? normalizedMimeType
    : 'application/octet-stream';
}

function getSafeServedDocumentMimeType(document: {
  filename: string;
  mimeType: string | null;
}): string {
  const extensionMimeType = EXTENSION_DOCUMENT_MIME_TYPES.get(
    path.extname(document.filename).toLowerCase(),
  );
  if (extensionMimeType) {
    return extensionMimeType;
  }

  const storedMimeType = document.mimeType?.toLowerCase();
  return storedMimeType && ALLOWED_DOCUMENT_MIME_TYPES.has(storedMimeType)
    ? storedMimeType
    : 'application/octet-stream';
}

function getDocumentContentDisposition(
  requestedDisposition: 'inline' | 'attachment',
  contentType: string,
): 'inline' | 'attachment' {
  if (
    requestedDisposition === 'inline' &&
    !INLINE_RENDERABLE_DOCUMENT_MIME_TYPES.has(contentType)
  ) {
    return 'attachment';
  }

  return requestedDisposition;
}

function buildStoredFilename(originalName: string): string {
  return `${Date.now()}-${crypto.randomUUID()}-${sanitizeUploadFilename(originalName)}`;
}

function createTempUploadPath(originalName: string): string {
  return path.join(
    ensureUploadSubdirectory('documents'),
    `temp-${crypto.randomUUID()}-${sanitizeUploadFilename(originalName)}`,
  );
}

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

function sendDocumentFile(
  document: { fileUrl: string; filename: string; mimeType: string | null },
  res: Response,
  disposition: 'inline' | 'attachment' = 'inline',
): void {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (isExternalFileUrl(document.fileUrl)) {
    if (!isSafeExternalDocumentUrl(document.fileUrl)) {
      throw AppError.notFound('File');
    }

    res.redirect(document.fileUrl);
    return;
  }

  const filePath = resolveLocalDocumentFilePath(document.fileUrl);
  if (!fs.existsSync(filePath)) {
    throw AppError.notFound('File');
  }

  const contentType = getSafeServedDocumentMimeType(document);
  const contentDisposition = getDocumentContentDisposition(disposition, contentType);

  res.setHeader(
    'Content-Disposition',
    `${contentDisposition}; filename="${getSafeDownloadFilename(document.filename)}"`,
  );
  res.setHeader('Content-Type', contentType);
  res.sendFile(filePath);
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
const DOCUMENT_WRITE_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
  'site_engineer',
  'foreman',
  'subcontractor_admin',
  'subcontractor',
];

type AuthUser = NonNullable<Express.Request['user']>;
type DocumentAccessRecord = {
  projectId: string;
  lotId: string | null;
  uploadedById: string | null;
  documentType?: string | null;
  category?: string | null;
};

function cleanupUploadedFile(file?: Express.Multer.File): void {
  if (file?.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

function isDocumentSubcontractorUser(user: AuthUser): boolean {
  return user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin';
}

function getDocumentPortalModule(category?: string | null): SubcontractorPortalAccessKey {
  return category === 'itp_evidence' ? 'itps' : 'documents';
}

async function hasSubcontractorDocumentPortalAccess(
  user: AuthUser,
  projectId: string,
  category?: string | null,
): Promise<boolean> {
  if (!isDocumentSubcontractorUser(user)) {
    return true;
  }

  return hasSubcontractorPortalModuleAccess({
    userId: user.id,
    role: user.roleInCompany,
    projectId,
    module: getDocumentPortalModule(category),
  });
}

async function requireSubcontractorDocumentPortalAccess(
  user: AuthUser,
  projectId: string,
  category?: string | null,
): Promise<void> {
  if (!isDocumentSubcontractorUser(user)) {
    return;
  }

  await requireSubcontractorPortalModuleAccess({
    userId: user.id,
    role: user.roleInCompany,
    projectId,
    module: getDocumentPortalModule(category),
  });
}

async function getProjectSubcontractorCompanyId(
  userId: string,
  projectId: string,
): Promise<string | null> {
  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: { subcontractorCompanyId: true },
  });

  return subcontractorUser?.subcontractorCompanyId ?? null;
}

async function getAssignedDocumentLotIds(
  projectId: string,
  subcontractorCompanyId: string,
): Promise<string[]> {
  const [assignments, legacyLots] = await Promise.all([
    prisma.lotSubcontractorAssignment.findMany({
      where: {
        projectId,
        subcontractorCompanyId,
        status: 'active',
      },
      select: { lotId: true },
    }),
    prisma.lot.findMany({
      where: {
        projectId,
        assignedSubcontractorId: subcontractorCompanyId,
      },
      select: { id: true },
    }),
  ]);

  return [
    ...new Set([
      ...assignments.map((assignment) => assignment.lotId),
      ...legacyLots.map((lot) => lot.id),
    ]),
  ];
}

async function applyDocumentReadScope(
  user: AuthUser,
  projectId: string,
  where: Prisma.DocumentWhereInput,
): Promise<void> {
  if (!isDocumentSubcontractorUser(user)) {
    return;
  }

  const subcontractorCompanyId = await getProjectSubcontractorCompanyId(user.id, projectId);
  if (!subcontractorCompanyId) {
    where.id = '__no_subcontractor_document_access__';
    return;
  }

  const assignedLotIds = await getAssignedDocumentLotIds(projectId, subcontractorCompanyId);
  const scopedAccess: Prisma.DocumentWhereInput = {
    OR: [
      { lotId: null },
      { uploadedById: user.id },
      ...(assignedLotIds.length > 0 ? [{ lotId: { in: assignedLotIds } }] : []),
    ],
  };

  where.AND = [
    ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
    scopedAccess,
  ];
}

async function canReadDocument(user: AuthUser, document: DocumentAccessRecord): Promise<boolean> {
  if (!(await checkProjectAccess(user.id, document.projectId))) {
    return false;
  }

  if (!isDocumentSubcontractorUser(user)) {
    return true;
  }

  if (!(await hasSubcontractorDocumentPortalAccess(user, document.projectId, document.category))) {
    return false;
  }

  if (!document.lotId || document.uploadedById === user.id) {
    return true;
  }

  const subcontractorCompanyId = await getProjectSubcontractorCompanyId(
    user.id,
    document.projectId,
  );
  if (!subcontractorCompanyId) {
    return false;
  }

  const assignedLotIds = await getAssignedDocumentLotIds(
    document.projectId,
    subcontractorCompanyId,
  );
  return assignedLotIds.includes(document.lotId);
}

async function getEffectiveProjectRole(user: AuthUser, projectId: string): Promise<string | null> {
  const isSubcontractor = isDocumentSubcontractorUser(user);
  const [project, projectUser] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    }),
    isSubcontractor
      ? null
      : prisma.projectUser.findFirst({
          where: {
            projectId,
            userId: user.id,
            status: 'active',
          },
          select: { role: true },
        }),
  ]);

  if (!project) {
    throw AppError.notFound('Project');
  }

  if (
    !isSubcontractor &&
    (user.roleInCompany === 'owner' || user.roleInCompany === 'admin') &&
    project.companyId === user.companyId
  ) {
    return user.roleInCompany;
  }

  if (projectUser) {
    return projectUser.role;
  }

  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId: user.id,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: { role: true },
  });

  return subcontractorUser ? user.roleInCompany : null;
}

async function requireProjectWriteAccess(user: AuthUser, projectId: string): Promise<void> {
  if (!(await checkProjectAccess(user.id, projectId))) {
    throw AppError.forbidden('Access denied');
  }

  const effectiveRole = await getEffectiveProjectRole(user, projectId);
  if (!effectiveRole || !DOCUMENT_WRITE_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Document write access required');
  }
}

async function requireLotInProject(projectId: string, lotId?: string | null): Promise<void> {
  if (!lotId) return;

  const lot = await prisma.lot.findFirst({
    where: { id: lotId, projectId },
    select: { id: true },
  });

  if (!lot) {
    throw AppError.badRequest('lotId must belong to the document project');
  }
}

async function requireSubcontractorAssignedLotWriteScope(
  user: AuthUser,
  projectId: string,
  lotId?: string | null,
  message = 'Subcontractor document writes must be linked to an assigned lot',
): Promise<void> {
  if (!isDocumentSubcontractorUser(user)) {
    return;
  }

  if (!lotId) {
    throw AppError.forbidden(message);
  }

  const subcontractorCompanyId = await getProjectSubcontractorCompanyId(user.id, projectId);
  if (!subcontractorCompanyId) {
    throw AppError.forbidden('Access denied');
  }

  const assignedLotIds = await getAssignedDocumentLotIds(projectId, subcontractorCompanyId);
  if (!assignedLotIds.includes(lotId)) {
    throw AppError.forbidden('Subcontractor document writes are limited to assigned lots');
  }
}

async function requireDocumentUploadAccess(
  user: AuthUser,
  projectId: string,
  lotId?: string | null,
  category?: string | null,
): Promise<void> {
  await requireProjectWriteAccess(user, projectId);
  await requireSubcontractorDocumentPortalAccess(user, projectId, category);
  await requireLotInProject(projectId, lotId);
  await requireSubcontractorAssignedLotWriteScope(user, projectId, lotId);
}

async function requireDocumentMutationAccess(
  user: AuthUser,
  document: DocumentAccessRecord,
  targetLotId?: string | null,
  targetCategory?: string | null,
): Promise<void> {
  await requireProjectWriteAccess(user, document.projectId);

  if (targetLotId !== undefined) {
    await requireLotInProject(document.projectId, targetLotId);
  }

  if (!isDocumentSubcontractorUser(user)) {
    return;
  }

  if (document.uploadedById !== user.id) {
    throw AppError.forbidden('Only the uploading subcontractor can modify this document');
  }

  const effectiveCategory = targetCategory !== undefined ? targetCategory : document.category;
  await requireSubcontractorDocumentPortalAccess(user, document.projectId, effectiveCategory);

  const effectiveLotId = targetLotId !== undefined ? targetLotId : document.lotId;
  await requireSubcontractorAssignedLotWriteScope(
    user,
    document.projectId,
    effectiveLotId,
    'Subcontractor documents must stay linked to an assigned lot',
  );
}

// Feature #741: Public route for signed URL download (no auth required)
// This MUST be defined BEFORE the requireAuth middleware
router.get(
  '/download/:documentId',
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = parseDocumentRouteParam(req.params.documentId, 'documentId');
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      throw AppError.badRequest('Token is required', {
        message: 'Please provide a valid signed URL token',
      });
    }

    // Validate the signed token
    const validation = await validateSignedUrlToken(token, documentId);

    if (!validation.valid) {
      if (validation.expired) {
        throw new AppError(
          410,
          'This signed URL has expired. Please request a new one.',
          'URL_EXPIRED',
        );
      }
      throw AppError.forbidden('The signed URL token is invalid or does not match this document.');
    }

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw AppError.notFound('Document');
    }

    sendDocumentFile(document, res, 'attachment');
  }),
);

// Feature #741: Public route for token validation (no auth required)
router.get(
  '/signed-url/validate',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.query;
    const documentId = getOptionalQueryString(req.query, 'documentId', MAX_DOCUMENT_ID_LENGTH);

    if (!token || typeof token !== 'string') {
      throw AppError.badRequest('Token is required');
    }

    if (!documentId) {
      throw AppError.badRequest('Document ID is required');
    }

    const validation = await validateSignedUrlToken(token, documentId);

    if (!validation.valid) {
      return res.json({
        valid: false,
        expired: validation.expired || false,
        message: validation.expired ? 'Token has expired' : 'Token is invalid',
      });
    }

    res.json(getSignedUrlTokenResponse(validation, documentId));
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
    if (ALLOWED_DOCUMENT_MIME_TYPES.has(getNormalizedDocumentMimeType(file))) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Helper to upload file to Supabase Storage
async function uploadToSupabase(
  file: Express.Multer.File,
  projectId: string,
): Promise<{ url: string; storagePath: string }> {
  const storagePath = `${projectId}/${buildStoredFilename(file.originalname)}`;

  const { error } = await getSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: getSafeStoredDocumentMimeType(file),
      upsert: false,
    });

  if (error) {
    logError('Supabase document upload failed:', error);
    throw AppError.internal('Failed to upload document');
  }

  const url = getSupabasePublicUrl(DOCUMENTS_BUCKET, storagePath);
  return { url, storagePath };
}

// Helper to delete file from Supabase Storage
async function deleteFromSupabase(fileUrl: string): Promise<void> {
  const storagePath = getSupabaseStoragePath(fileUrl, DOCUMENTS_BUCKET);
  if (!storagePath) {
    logWarn('Could not extract storage path from URL:', sanitizeUrlValueForLog(fileUrl));
    return;
  }

  const { error } = await getSupabaseClient().storage.from(DOCUMENTS_BUCKET).remove([storagePath]);

  if (error) {
    logError('Supabase document delete failed:', error);
  }
}

async function cleanupStoredDocumentUpload(
  fileUrl: string | null,
  file: Express.Multer.File,
): Promise<void> {
  if (fileUrl && isSupabaseConfigured() && getSupabaseStoragePath(fileUrl, DOCUMENTS_BUCKET)) {
    await deleteFromSupabase(fileUrl);
    return;
  }

  if (!fileUrl || (!isExternalFileUrl(fileUrl) && !fileUrl.startsWith('data:'))) {
    cleanupUploadedFile(file);
  }
}

// GET /api/documents/:projectId - List documents for a project
router.get(
  '/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseDocumentRouteParam(req.params.projectId, 'projectId');
    const user = req.user!;
    const userId = user.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    const hasAccess = await checkProjectAccess(userId, projectId);
    if (!hasAccess) {
      throw AppError.forbidden('Access denied');
    }

    await requireSubcontractorPortalModuleAccess({
      userId,
      role: user.roleInCompany,
      projectId,
      module: 'documents',
    });

    const category = getOptionalQueryString(req.query, 'category', MAX_CATEGORY_LENGTH);
    const documentType = getOptionalQueryString(
      req.query,
      'documentType',
      MAX_DOCUMENT_TYPE_LENGTH,
    );
    const lotId = getOptionalQueryString(req.query, 'lotId', MAX_DOCUMENT_ID_LENGTH);
    const search = getOptionalQueryString(req.query, 'search', MAX_SEARCH_LENGTH);
    const dateFrom = getOptionalDateQuery(req.query, 'dateFrom');
    const dateTo = getOptionalDateQuery(req.query, 'dateTo', true);

    const where: Prisma.DocumentWhereInput = { projectId };
    if (category) where.category = category;
    if (documentType) where.documentType = documentType;
    if (lotId) where.lotId = lotId;

    // Feature #249: Date range filtering
    if (dateFrom || dateTo) {
      where.uploadedAt = {};
      if (dateFrom) {
        where.uploadedAt.gte = dateFrom;
      }
      if (dateTo) {
        where.uploadedAt.lte = dateTo;
      }
    }

    // Push search filtering to database
    if (search) {
      where.OR = [
        { filename: { contains: search, mode: 'insensitive' } },
        { caption: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { documentType: { contains: search, mode: 'insensitive' } },
      ];
    }

    await applyDocumentReadScope(user, projectId, where);

    const pagination = parsePagination(req.query);
    const { skip, take } = getPrismaSkipTake(pagination.page, pagination.limit);

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          lot: { select: { id: true, lotNumber: true, description: true } },
          uploadedBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { uploadedAt: 'desc' },
        skip,
        take,
      }),
      prisma.document.count({ where }),
    ]);

    // Group by category for convenience
    const categories: Record<string, number> = {};
    for (const doc of documents) {
      const cat = doc.category || 'Uncategorized';
      categories[cat] = (categories[cat] || 0) + 1;
    }

    res.json({
      documents,
      total,
      categories,
      pagination: getPaginationMeta(total, pagination.page, pagination.limit),
    });
  }),
);

// POST /api/documents/upload - Upload a document
router.post(
  '/upload',
  upload.single('file'),
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

    const { projectId, lotId, documentType, category, caption, tags } = bodyParse.data;

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

    let fileUrl: string | null = null;
    let photoMetadata: Awaited<ReturnType<typeof extractPhotoMetadata>> = {};
    let documentCreated = false;

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
          lotId: lotId || null,
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
          gpsLatitude: photoMetadata.gpsLatitude,
          gpsLongitude: photoMetadata.gpsLongitude,
          captureTimestamp: photoMetadata.captureTimestamp,
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

      documentCreated = true;
      res.status(201).json(document);
    } catch (error) {
      if (!documentCreated) {
        await cleanupStoredDocumentUpload(fileUrl, uploadedFile);
      }
      throw error;
    }
  }),
);

// Feature #481: POST /api/documents/:documentId/version - Upload a new version of a document
router.post(
  '/:documentId/version',
  requireValidDocumentRouteParam('documentId'),
  upload.single('file'),
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
    let photoMetadata: Awaited<ReturnType<typeof extractPhotoMetadata>> = {};
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
      res.status(201).json(newDocument);
    } catch (error) {
      if (!documentCreated) {
        await cleanupStoredDocumentUpload(fileUrl, uploadedFile);
      }
      throw error;
    }
  }),
);

// Feature #481: GET /api/documents/:documentId/versions - Get all versions of a document
router.get(
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

    res.json({
      documentId: rootDocumentId,
      totalVersions: versions.length,
      versions,
    });
  }),
);

// GET /api/documents/file/:documentId - Get document file (requires auth)
router.get(
  '/file/:documentId',
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

    sendDocumentFile(document, res);
  }),
);

// Feature #741: POST /api/documents/:documentId/signed-url - Generate a signed URL for file download
// This creates a time-limited, secure URL that can be shared without requiring auth
router.post(
  '/:documentId/signed-url',
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = parseDocumentRouteParam(req.params.documentId, 'documentId');
    const { expiresInMinutes } = req.body;
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

    // Validate expiry time (1 minute to 24 hours)
    const validExpiry = parseSignedUrlExpiryMinutes(expiresInMinutes);

    // Generate signed token
    const { token, expiresAt } = await generateSignedUrlToken(documentId, userId, validExpiry);

    const signedUrl = buildBackendUrl(`/api/documents/download/${documentId}?token=${token}`);

    res.json({
      signedUrl,
      token,
      documentId,
      filename: document.filename,
      mimeType: document.mimeType,
      expiresAt: expiresAt.toISOString(),
      expiresInMinutes: validExpiry,
      message: `Signed URL valid for ${validExpiry} minutes`,
    });
  }),
);

// DELETE /api/documents/:documentId - Delete a document
router.delete(
  '/:documentId',
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
    await requireDocumentMutationAccess(req.user!, document);

    // Audit log for document deletion
    await createAuditLog({
      projectId: document.projectId,
      userId,
      entityType: 'document',
      entityId: documentId,
      action: AuditAction.DOCUMENT_DELETED,
      changes: { filename: document.filename, fileUrl: document.fileUrl },
      req,
    });

    // Delete database record
    await prisma.document.delete({ where: { id: documentId } });

    try {
      if (isSupabaseConfigured() && getSupabaseStoragePath(document.fileUrl, DOCUMENTS_BUCKET)) {
        await deleteFromSupabase(document.fileUrl);
      } else if (isExternalFileUrl(document.fileUrl)) {
        logWarn(
          'Skipping delete for external document URL:',
          sanitizeUrlValueForLog(document.fileUrl),
        );
      } else if (document.fileUrl.startsWith('data:')) {
        // Legacy inline documents have no storage object to delete.
      } else {
        const filePath = resolveLocalDocumentFilePath(document.fileUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      logWarn('Failed to delete document storage object after database delete:', error);
    }

    res.status(204).send();
  }),
);

// Feature #247: AI Photo Classification
// POST /api/documents/:documentId/classify - Classify a photo using AI
router.post(
  '/:documentId/classify',
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

    // Only classify images
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    // Determine mimeType from document or extract from base64 data URL
    let mimeType = document.mimeType;
    if (!mimeType && document.fileUrl?.startsWith('data:')) {
      const dataUrlMatch = document.fileUrl.match(/^data:([^;]+);base64,/);
      if (dataUrlMatch) {
        mimeType = dataUrlMatch[1];
      }
    }

    if (!mimeType || !imageTypes.includes(mimeType)) {
      throw AppError.badRequest('Only image files can be classified');
    }

    // Feature #729: Multi-label classification support
    if (!isAnthropicConfigured()) {
      throw photoClassificationUnavailable();
    }

    const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    const base64Image = loadDocumentImageAsBase64(document, mimeType);

    let suggestedClassifications: PhotoClassificationSuggestion[] = [];

    try {
      // Call Anthropic API for multi-label image classification
      const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:
            process.env.ANTHROPIC_DOCUMENT_CLASS_MODEL ||
            process.env.ANTHROPIC_MODEL ||
            'claude-3-5-haiku-20241022',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64Image,
                  },
                },
                {
                  type: 'text',
                  text: `Classify this civil construction photo. A photo may show multiple things happening.

Available categories: ${PHOTO_CLASSIFICATION_CATEGORIES.join(', ')}

List ALL applicable categories with confidence percentages (0-100), up to 3 categories.
Format each on a new line: CategoryName|Confidence

Example response for a photo showing excavation with safety equipment:
Excavation|90
Safety|75
Plant/Equipment|60

Respond with ONLY the category lines, nothing else.`,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API request failed with status ${response.status}`);
      }

      const result = (await response.json()) as { content: { type: string; text: string }[] };
      const aiResponse = result.content[0]?.text?.trim() || '';
      suggestedClassifications = parseClassificationResponse(aiResponse);
    } catch (error) {
      logWarn('AI photo classification unavailable:', error);
      throw photoClassificationUnavailable('AI photo classification is temporarily unavailable');
    }

    if (suggestedClassifications.length === 0) {
      throw photoClassificationUnavailable(
        'AI photo classification did not return supported categories',
      );
    }

    // Sort by confidence and limit to top 3
    suggestedClassifications.sort((a, b) => b.confidence - a.confidence);
    suggestedClassifications = suggestedClassifications.slice(0, 3);

    // Primary classification is the highest confidence one (for backward compatibility)
    const primaryClassification = suggestedClassifications[0]!;

    res.json({
      documentId,
      // Backward compatible single classification
      suggestedClassification: primaryClassification.label,
      confidence: primaryClassification.confidence,
      // Feature #729: Multi-label classifications
      suggestedClassifications,
      isMultiLabel: suggestedClassifications.length > 1,
      categories: PHOTO_CLASSIFICATION_CATEGORIES,
    });
  }),
);

// POST /api/documents/:documentId/save-classification - Save the classification
// Feature #729: Supports both single classification and multi-label classifications
router.post(
  '/:documentId/save-classification',
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = parseDocumentRouteParam(req.params.documentId, 'documentId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    const bodyParse = saveClassificationBodySchema.safeParse(req.body);
    if (!bodyParse.success) {
      throw AppError.fromZodError(bodyParse.error);
    }
    const { classification, classifications } = bodyParse.data;

    // Support both single classification (backward compat) and multi-label
    const finalClassification =
      classification ||
      (classifications && classifications.length > 0
        ? classifications.map((c: { label: string }) => c.label).join(', ')
        : null);

    if (!finalClassification) {
      throw AppError.badRequest('Classification is required');
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
    await requireDocumentMutationAccess(req.user!, document);

    // Update the document with the classification
    // If multiple classifications provided, store as comma-separated for display
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        aiClassification: finalClassification,
      },
      include: {
        lot: { select: { id: true, lotNumber: true } },
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    res.json({
      ...updatedDocument,
      // Feature #729: Return parsed classifications array for convenience
      classificationLabels: finalClassification.split(', ').filter(Boolean),
    });
  }),
);

// PATCH /api/documents/:documentId - Update document metadata
router.patch(
  '/:documentId',
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = parseDocumentRouteParam(req.params.documentId, 'documentId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    const bodyParse = updateDocumentBodySchema.safeParse(req.body);
    if (!bodyParse.success) {
      throw AppError.fromZodError(bodyParse.error);
    }
    const { lotId, category, caption, tags, isFavourite } = bodyParse.data;

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
    await requireDocumentMutationAccess(req.user!, document, lotId, category);

    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        lotId: lotId !== undefined ? lotId || null : undefined,
        category: category !== undefined ? category : undefined,
        caption: caption !== undefined ? caption : undefined,
        tags: tags !== undefined ? tags : undefined,
        isFavourite: isFavourite !== undefined ? isFavourite : undefined,
      },
      include: {
        lot: { select: { id: true, lotNumber: true } },
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    res.json(updatedDocument);
  }),
);

export default router;
