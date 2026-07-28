import type { Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { logWarn } from '../../lib/serverLogger.js';
import { DOCUMENTS_BUCKET, getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase.js';
import { ensureUploadSubdirectory } from '../../lib/uploadPaths.js';
import {
  getOwnedDocumentStoragePath,
  isExternalFileUrl,
  resolveLocalDocumentFilePath,
  THUMBNAIL_STORAGE_SUFFIX,
} from './storage.js';

// Grid tiles request the thumbnail derivative; anything else serves the original.
export type DocumentFileVariant = 'thumb';
const THUMBNAIL_CONTENT_TYPE = 'image/webp';

export function parseDocumentFileVariant(value: unknown): DocumentFileVariant | undefined {
  return value === 'thumb' ? 'thumb' : undefined;
}

type SignedUrlValidation = {
  valid: boolean;
  expired?: boolean;
  userId?: string;
  expiresAt?: Date;
  createdAt?: Date;
};

const MAX_FILENAME_LENGTH = 180;
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

/** The general document upload ceiling, extracted from `documents.ts`. 50 MB. */
export const DOCUMENT_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Wave D `D1d` — the CCTV video allow-set, spec §4.8 item 1, **AT-149**.
 *
 * A SEPARATE set, deliberately NOT a widening of `ALLOWED_DOCUMENT_MIME_TYPES`:
 * that set governs every document upload in the product, and video belongs only
 * on the surface that expects it (`POST /api/documents/upload/cctv`). The
 * separation is the design — `isAllowedDocumentMimeType('video/mp4')` stays
 * `false` and a test pins it.
 *
 * Derived from Logan PSP5 §5.6.5(1)(e) read with §5.7.1(1)(a)'s named
 * containers — *"WINCAM (version 7 or later) or CCTV footage or DVD-ROM … or
 * MPEG 4"*. In practice a WINCAN/PACP export is MPEG-4; the other three are the
 * legacy containers the clause's own wording still admits (a DVD-ROM rip is
 * MPEG-1/2 program stream, and WinCan v7-era exports are AVI or QuickTime).
 * Four entries, each traceable to the clause. Adding a fifth is a pack-class
 * change, not a convenience.
 */
const ALLOWED_CCTV_VIDEO_MIME_TYPES = new Set([
  'video/mp4', // MPEG 4 — the clause's named format and the WINCAN export default
  'video/mpeg', // "DVD-ROM" / .mpg MPEG-1/2 program stream
  'video/quicktime', // .mov, legacy WinCan/PACP export
  'video/x-msvideo', // .avi, "WINCAM (version 7 or later)"-era export
]);
const SUPPORTED_CCTV_FILE_TYPE_DESCRIPTION = 'MP4, MPEG, QuickTime (.mov) and AVI video';

/**
 * The CCTV surface's own size ceiling — **256 MiB**, spec §4.8 item 2.
 *
 * Enforced independently of {@link DOCUMENT_UPLOAD_MAX_BYTES} (50 MB), and
 * derived in the D1d PR body from four inputs, the binding one being (d): the
 * shipped upload path is `multer.memoryStorage()` (`documents.ts:273-278`),
 * which buffers the whole file in RAM and `Buffer.concat`s it on finish, so
 * peak RSS is ~2x the file per in-flight upload; the Supabase leg then posts
 * that same buffer in one shot. 256 MiB is what that path can honestly carry.
 *
 * ponytail: a number, not a streaming path. Raising it requires a resumable /
 * multipart upload path (TUS or S3 multipart) — that is D1c-adjacent
 * infrastructure and is deliberately NOT built here. It also requires the
 * Supabase `documents` bucket's own `file_size_limit` to be raised to match,
 * which is an ops action, not a code change.
 */
export const CCTV_UPLOAD_MAX_BYTES = 256 * 1024 * 1024;

export function isAllowedDocumentMimeType(mimeType: string): boolean {
  return ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType);
}

export function isAllowedCctvVideoMimeType(mimeType: string): boolean {
  return ALLOWED_CCTV_VIDEO_MIME_TYPES.has(mimeType.toLowerCase());
}

export function getUnsupportedCctvFileTypeMessage(
  file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>,
): string {
  const filename = sanitizeUploadFilename(file.originalname);
  return (
    `Invalid file type for ${filename}. The CCTV upload accepts video only: ` +
    `${SUPPORTED_CCTV_FILE_TYPE_DESCRIPTION}. Upload other evidence through the ` +
    'standard document upload.'
  );
}

export function getCctvFileTooLargeMessage(maxBytes = CCTV_UPLOAD_MAX_BYTES): string {
  return (
    `CCTV video exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB upload ceiling. ` +
    'Logan PSP5 §5.6.5(1)(e) is a per-run deliverable — submit one file per pipe run ' +
    '(maintenance hole upstream to maintenance hole downstream) rather than a combined reel.'
  );
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
export async function generateSignedUrlToken(
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
export async function validateSignedUrlToken(
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

export function parseSignedUrlExpiryMinutes(value: unknown): number {
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

export function sanitizeUploadFilename(filename: string): string {
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

export function getNormalizedDocumentMimeType(
  file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>,
): string {
  const extensionMimeType = EXTENSION_DOCUMENT_MIME_TYPES.get(
    path.extname(file.originalname).toLowerCase(),
  );
  return extensionMimeType ?? file.mimetype.toLowerCase();
}

export function getSafeStoredDocumentMimeType(
  file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>,
): string {
  const normalizedMimeType = getNormalizedDocumentMimeType(file);
  // D1d: a CCTV video admitted by the separate allow-set must keep its real
  // type. Coercing it to octet-stream would file the deliverable as an unknown
  // blob and make `Document.mimeType` useless to the folio.
  return ALLOWED_DOCUMENT_MIME_TYPES.has(normalizedMimeType) ||
    isAllowedCctvVideoMimeType(normalizedMimeType)
    ? normalizedMimeType
    : 'application/octet-stream';
}

export function getUnsupportedDocumentFileTypeMessage(
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

export function parseDocumentContentDisposition(value: unknown): 'inline' | 'attachment' {
  if (value === undefined) {
    return 'attachment';
  }

  if (value !== 'inline' && value !== 'attachment') {
    throw AppError.badRequest('disposition must be inline or attachment');
  }

  return value;
}

export function buildStoredFilename(originalName: string): string {
  return `${Date.now()}-${crypto.randomUUID()}-${sanitizeUploadFilename(originalName)}`;
}

export function createTempUploadPath(originalName: string): string {
  return path.join(
    ensureUploadSubdirectory('documents'),
    `temp-${crypto.randomUUID()}-${sanitizeUploadFilename(originalName)}`,
  );
}

function sendDownloadedBuffer(
  res: Response,
  buffer: Buffer,
  filename: string,
  contentType: string,
  contentDisposition: 'inline' | 'attachment',
): void {
  res.setHeader(
    'Content-Disposition',
    `${contentDisposition}; filename="${getSafeDownloadFilename(filename)}"`,
  );
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', String(buffer.length));
  res.send(buffer);
}

async function sendSupabaseDocumentFile(
  document: {
    fileUrl: string;
    filename: string;
    mimeType: string | null;
    projectId: string;
    documentType?: string | null;
  },
  res: Response,
  contentType: string,
  contentDisposition: 'inline' | 'attachment',
  variant?: DocumentFileVariant,
): Promise<void> {
  const storagePath = getOwnedDocumentStoragePath(
    document.fileUrl,
    document.projectId,
    document.documentType,
  );
  if (!storagePath || !isSupabaseConfigured()) {
    throw AppError.notFound('File');
  }

  const storage = getSupabaseClient().storage.from(DOCUMENTS_BUCKET);

  // Thumbnail variant: serve the derivative when it exists, otherwise fall
  // through to the original (legacy files never had one generated).
  if (variant === 'thumb') {
    const { data: thumbData } = await storage.download(`${storagePath}${THUMBNAIL_STORAGE_SUFFIX}`);
    if (thumbData) {
      sendDownloadedBuffer(
        res,
        Buffer.from(await thumbData.arrayBuffer()),
        document.filename,
        THUMBNAIL_CONTENT_TYPE,
        contentDisposition,
      );
      return;
    }
  }

  const { data, error } = await storage.download(storagePath);

  if (error || !data) {
    logWarn('Supabase document download failed:', error);
    throw AppError.notFound('File');
  }

  sendDownloadedBuffer(
    res,
    Buffer.from(await data.arrayBuffer()),
    document.filename,
    contentType,
    contentDisposition,
  );
}

export async function sendDocumentFile(
  document: {
    fileUrl: string;
    filename: string;
    mimeType: string | null;
    projectId: string;
    documentType?: string | null;
  },
  res: Response,
  disposition: 'inline' | 'attachment' = 'inline',
  variant?: DocumentFileVariant,
): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  const contentType = getSafeServedDocumentMimeType(document);
  const contentDisposition = getDocumentContentDisposition(disposition, contentType);

  if (getOwnedDocumentStoragePath(document.fileUrl, document.projectId, document.documentType)) {
    await sendSupabaseDocumentFile(document, res, contentType, contentDisposition, variant);
    return;
  }

  if (isExternalFileUrl(document.fileUrl)) {
    throw AppError.notFound('File');
  }

  const filePath = resolveLocalDocumentFilePath(document.fileUrl);

  // Thumbnail variant: serve the local derivative when present, else the original.
  if (variant === 'thumb') {
    const thumbPath = `${filePath}${THUMBNAIL_STORAGE_SUFFIX}`;
    if (fs.existsSync(thumbPath)) {
      res.setHeader(
        'Content-Disposition',
        `${contentDisposition}; filename="${getSafeDownloadFilename(document.filename)}"`,
      );
      res.setHeader('Content-Type', THUMBNAIL_CONTENT_TYPE);
      res.sendFile(thumbPath);
      return;
    }
  }

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
