import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { AppError } from '../../lib/AppError.js';
import { logError } from '../../lib/serverLogger.js';
import { ensureUploadSubdirectory } from '../../lib/uploadPaths.js';
import {
  DOCUMENTS_BUCKET,
  getSupabaseClient,
  getSupabasePublicUrl,
  getSupabaseStoragePath,
  isSupabaseConfigured,
} from '../../lib/supabase.js';

const CERTIFICATES_STORAGE_PREFIX = 'certificates';
const MAX_CERTIFICATE_FILENAME_LENGTH = 180;

function getSafeCertificateExtension(originalName: string): string {
  const ext = path.extname(sanitizeUploadFilename(originalName)).toLowerCase();
  return ['.pdf', '.jpg', '.jpeg', '.png'].includes(ext) ? ext : '';
}

// When Supabase Storage is configured we keep certificate uploads in memory
// and stream them to the `documents` bucket under a `certificates/<projectId>/...`
// prefix. Otherwise we fall back to the local filesystem (dev only —
// Railway's filesystem is ephemeral, so production must always have Supabase).
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadSubdirectory('certificates'));
    } catch (error) {
      cb(
        error instanceof Error
          ? error
          : new Error('Failed to prepare certificate upload directory'),
        '',
      );
    }
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
    cb(null, `cert-${uniqueSuffix}${getSafeCertificateExtension(file.originalname)}`);
  },
});

const memoryStorage = multer.memoryStorage();

// Storage mode is intentionally selected once at module initialization. Tests
// load this module with Supabase mocked both on and off to cover both branches.
export const certificateUpload = multer({
  storage: isSupabaseConfigured() ? memoryStorage : diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  },
});

function buildStoredCertificateFilename(originalName: string): string {
  const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
  return `cert-${uniqueSuffix}${getSafeCertificateExtension(originalName)}`;
}

export function shouldUploadCertificateToSupabase(file: Express.Multer.File): boolean {
  return isSupabaseConfigured() && !!file.buffer;
}

export async function uploadCertificateToSupabase(
  file: Express.Multer.File,
  projectId: string,
): Promise<{ url: string; storagePath: string }> {
  const storagePath = `${CERTIFICATES_STORAGE_PREFIX}/${projectId}/${buildStoredCertificateFilename(file.originalname)}`;

  const { error } = await getSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    logError('Supabase certificate upload failed:', error);
    throw AppError.internal('Failed to upload certificate');
  }

  return {
    url: getSupabasePublicUrl(DOCUMENTS_BUCKET, storagePath),
    storagePath,
  };
}

function getCertificateStoragePrefix(projectId: string): string {
  return `${CERTIFICATES_STORAGE_PREFIX}/${projectId}/`;
}

export function getOwnedCertificateStoragePath(fileUrl: string, projectId: string): string | null {
  return getSupabaseStoragePath(fileUrl, {
    bucket: DOCUMENTS_BUCKET,
    expectedPrefix: getCertificateStoragePrefix(projectId),
  });
}

export function isOwnedSupabaseCertificateUrl(fileUrl: string, projectId: string): boolean {
  return isSupabaseConfigured() && getOwnedCertificateStoragePath(fileUrl, projectId) !== null;
}

export async function deleteCertificateFromSupabase(
  fileUrl: string,
  projectId: string,
): Promise<void> {
  const storagePath = getOwnedCertificateStoragePath(fileUrl, projectId);
  if (!storagePath) {
    return;
  }

  const { error } = await getSupabaseClient().storage.from(DOCUMENTS_BUCKET).remove([storagePath]);

  if (error) {
    logError('Supabase certificate delete failed:', error);
  }
}

// Best-effort cleanup after a failed certificate upload. Removes either the
// Supabase object (if we already uploaded) or the local temp file.
export async function cleanupStoredCertificateUpload(
  fileUrl: string | null,
  file: Express.Multer.File,
  projectId: string,
): Promise<void> {
  if (fileUrl && isOwnedSupabaseCertificateUrl(fileUrl, projectId)) {
    await deleteCertificateFromSupabase(fileUrl, projectId);
    return;
  }
  cleanupUploadedCertificateFile(file);
}

export function cleanupUploadedCertificateFile(file?: Express.Multer.File): void {
  if (file?.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

export function sanitizeUploadFilename(filename: string): string {
  const basename = path.basename(filename.replace(/\\/g, '/'));
  const sanitized = basename
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char))
    .join('')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, MAX_CERTIFICATE_FILENAME_LENGTH);

  return sanitized || 'certificate';
}
