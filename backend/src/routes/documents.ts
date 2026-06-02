// Feature #248: Documents API routes
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
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
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import exifr from 'exifr';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { ensureUploadSubdirectory, resolveUploadPath } from '../lib/uploadPaths.js';
import { sanitizeUrlValueForLog } from '../lib/logSanitization.js';
import { logError, logWarn } from '../lib/serverLogger.js';
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

type SignedUrlValidation = {
  valid: boolean;
  expired?: boolean;
  userId?: string;
  expiresAt?: Date;
  createdAt?: Date;
};

const MAX_DOCUMENT_ID_LENGTH = 120;
const MAX_DOCUMENT_TYPE_LENGTH = 80;
const MAX_CATEGORY_LENGTH = 160;
const MAX_CAPTION_LENGTH = 2000;
const MAX_TAGS_LENGTH = 2000;
const MAX_FILENAME_LENGTH = 180;
const MAX_SEARCH_LENGTH = 200;
const MAX_CLASSIFICATION_IMAGE_BYTES = 50 * 1024 * 1024;
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
const SUPPORTED_DOCUMENT_FILE_TYPE_DESCRIPTION =
  'PDF, Word, Excel, Outlook email, and image files (JPEG, PNG, GIF, WebP)';
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

async function loadSupabaseDocumentImageAsBase64(document: {
  fileUrl: string;
  projectId: string;
  documentType?: string | null;
}): Promise<string> {
  const storagePath = getOwnedDocumentStoragePath(
    document.fileUrl,
    document.projectId,
    document.documentType,
  );
  if (!storagePath) {
    throw AppError.badRequest('Invalid Supabase document URL');
  }

  const { data, error } = await getSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .download(storagePath);

  if (error || !data) {
    logWarn('Supabase image download failed for classification:', error);
    throw AppError.notFound('Image file');
  }

  if (data.size > MAX_CLASSIFICATION_IMAGE_BYTES) {
    throw AppError.badRequest('Image file is too large to classify');
  }

  return Buffer.from(await data.arrayBuffer()).toString('base64');
}

async function loadDocumentImageAsBase64(
  document: { fileUrl: string; projectId: string; documentType?: string | null },
  mimeType: string,
): Promise<string> {
  if (document.fileUrl.startsWith('data:')) {
    const base64Match = document.fileUrl.match(
      new RegExp(`^data:${mimeType.replace('/', '\\/')};base64,(.+)$`),
    );
    if (!base64Match) {
      throw AppError.badRequest('Invalid base64 data URL format');
    }
    return base64Match[1];
  }

  if (isExternalFileUrl(document.fileUrl)) {
    if (!isSupabaseConfigured()) {
      throw AppError.notFound('Image file');
    }
    return loadSupabaseDocumentImageAsBase64(document);
  }

  const filePath = resolveLocalDocumentFilePath(document.fileUrl);
  if (!fs.existsSync(filePath)) {
    throw AppError.notFound('Image file');
  }

  const stats = fs.statSync(filePath);
  if (stats.size > MAX_CLASSIFICATION_IMAGE_BYTES) {
    throw AppError.badRequest('Image file is too large to classify');
  }

  return fs.readFileSync(filePath).toString('base64');
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

function getUnsupportedDocumentFileTypeMessage(
  file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>,
): string {
  const filename = sanitizeUploadFilename(file.originalname);
  const extension = path.extname(file.originalname).toLowerCase();
  const normalizedMimeType = getNormalizedDocumentMimeType(file);
  const textFileHint =
    extension === '.txt' || normalizedMimeType === 'text/plain'
      ? ' Text files (.txt) are not supported for project documents.'
      : '';

  return `Invalid file type for ${filename}.${textFileHint} Supported project document uploads: ${SUPPORTED_DOCUMENT_FILE_TYPE_DESCRIPTION}.`;
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

function parseDocumentContentDisposition(value: unknown): 'inline' | 'attachment' {
  if (value === undefined) {
    return 'attachment';
  }

  if (value !== 'inline' && value !== 'attachment') {
    throw AppError.badRequest('disposition must be inline or attachment');
  }

  return value;
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

async function sendSupabaseDocumentFile(
  document: { fileUrl: string; filename: string; mimeType: string | null },
  res: Response,
  contentType: string,
  contentDisposition: 'inline' | 'attachment',
): Promise<void> {
  const storagePath = getSupabaseStoragePath(document.fileUrl, DOCUMENTS_BUCKET);
  if (!storagePath || !isSupabaseConfigured()) {
    res.redirect(document.fileUrl);
    return;
  }

  const { data, error } = await getSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .download(storagePath);

  if (error || !data) {
    logWarn('Supabase document download failed:', error);
    throw AppError.notFound('File');
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  res.setHeader(
    'Content-Disposition',
    `${contentDisposition}; filename="${getSafeDownloadFilename(document.filename)}"`,
  );
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', String(buffer.length));
  res.send(buffer);
}

async function sendDocumentFile(
  document: { fileUrl: string; filename: string; mimeType: string | null },
  res: Response,
  disposition: 'inline' | 'attachment' = 'inline',
): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  const contentType = getSafeServedDocumentMimeType(document);
  const contentDisposition = getDocumentContentDisposition(disposition, contentType);

  if (isExternalFileUrl(document.fileUrl)) {
    if (!isSafeExternalDocumentUrl(document.fileUrl)) {
      throw AppError.notFound('File');
    }

    if (contentDisposition === 'inline') {
      await sendSupabaseDocumentFile(document, res, contentType, contentDisposition);
      return;
    }

    res.redirect(document.fileUrl);
    return;
  }

  const filePath = resolveLocalDocumentFilePath(document.fileUrl);
  if (!fs.existsSync(filePath)) {
    throw AppError.notFound('File');
  }

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
const DOCUMENT_SPECIAL_PORTAL_CATEGORIES = ['itp_evidence', 'test_results'] as const;
const DOCUMENT_CATEGORY_PORTAL_MODULES: Record<
  (typeof DOCUMENT_SPECIAL_PORTAL_CATEGORIES)[number],
  SubcontractorPortalAccessKey
> = {
  itp_evidence: 'itps',
  test_results: 'testResults',
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
  if (category && Object.hasOwn(DOCUMENT_CATEGORY_PORTAL_MODULES, category)) {
    return DOCUMENT_CATEGORY_PORTAL_MODULES[
      category as (typeof DOCUMENT_SPECIAL_PORTAL_CATEGORIES)[number]
    ];
  }

  return 'documents';
}

function appendDocumentWhereClause(
  where: Prisma.DocumentWhereInput,
  clause: Prisma.DocumentWhereInput,
): void {
  where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), clause];
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

  appendDocumentWhereClause(where, scopedAccess);
}

async function applyDocumentPortalCategoryScope(
  user: AuthUser,
  projectId: string,
  where: Prisma.DocumentWhereInput,
): Promise<void> {
  if (!isDocumentSubcontractorUser(user)) {
    return;
  }

  const [canReadGeneralDocuments, canReadItpEvidence, canReadTestResults] = await Promise.all([
    hasSubcontractorDocumentPortalAccess(user, projectId, null),
    hasSubcontractorDocumentPortalAccess(user, projectId, 'itp_evidence'),
    hasSubcontractorDocumentPortalAccess(user, projectId, 'test_results'),
  ]);

  const categoryAccess: Prisma.DocumentWhereInput[] = [];
  if (canReadGeneralDocuments) {
    categoryAccess.push(
      { category: null },
      { category: { notIn: [...DOCUMENT_SPECIAL_PORTAL_CATEGORIES] } },
    );
  }
  if (canReadItpEvidence) {
    categoryAccess.push({ category: 'itp_evidence' });
  }
  if (canReadTestResults) {
    categoryAccess.push({ category: 'test_results' });
  }

  if (categoryAccess.length === 0) {
    where.id = '__no_subcontractor_document_portal_access__';
    return;
  }

  appendDocumentWhereClause(where, { OR: categoryAccess });
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
    if (ALLOWED_DOCUMENT_MIME_TYPES.has(getNormalizedDocumentMimeType(file))) {
      cb(null, true);
    } else {
      cb(new Error(getUnsupportedDocumentFileTypeMessage(file)));
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

function getDocumentStoragePrefixes(projectId: string, documentType?: string | null): string[] {
  const prefixes = [`${projectId}/`];
  if (documentType === 'drawing') {
    prefixes.push(`drawings/${projectId}/`);
  }
  if (documentType === 'test_certificate') {
    prefixes.push(`certificates/${projectId}/`);
  }
  return prefixes;
}

function getOwnedDocumentStoragePath(
  fileUrl: string,
  projectId: string,
  documentType?: string | null,
): string | null {
  for (const expectedPrefix of getDocumentStoragePrefixes(projectId, documentType)) {
    const storagePath = getSupabaseStoragePath(fileUrl, {
      bucket: DOCUMENTS_BUCKET,
      expectedPrefix,
    });
    if (storagePath) return storagePath;
  }
  return null;
}

// Helper to delete file from Supabase Storage
async function deleteFromSupabase(
  fileUrl: string,
  projectId: string,
  documentType?: string | null,
): Promise<void> {
  const storagePath = getOwnedDocumentStoragePath(fileUrl, projectId, documentType);
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
  projectId: string,
): Promise<void> {
  if (fileUrl && isSupabaseConfigured() && getOwnedDocumentStoragePath(fileUrl, projectId)) {
    await deleteFromSupabase(fileUrl, projectId);
    return;
  }

  if (!fileUrl || (!isExternalFileUrl(fileUrl) && !fileUrl.startsWith('data:'))) {
    cleanupUploadedFile(file);
  }
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
    uploadToSupabase,
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
    uploadToSupabase,
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
