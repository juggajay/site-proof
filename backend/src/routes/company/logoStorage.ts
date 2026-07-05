import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { AppError } from '../../lib/AppError.js';
import { getSafeImageExtensionForMimeType } from '../../lib/imageValidation.js';
import { buildApiUrl, buildBackendUrl } from '../../lib/runtimeConfig.js';
import { logError } from '../../lib/serverLogger.js';
import {
  buildSignedStorageFileUrl,
  createSignedStorageAccessToken,
  validateSignedStorageAccessToken,
} from '../../lib/signedStorageUrls.js';
import {
  DOCUMENTS_BUCKET,
  getSupabaseClient,
  getSupabaseStorageReference,
  getSupabaseStoragePath,
  isSupabaseConfigured,
} from '../../lib/supabase.js';
import { ensureUploadSubdirectory, getUploadSubdirectoryPath } from '../../lib/uploadPaths.js';
import { COMPANY_LOGO_PATH_PREFIX } from './validation.js';

const COMPANY_LOGO_STORAGE_PREFIX = 'company-logos';
const COMPANY_LOGO_ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const companyLogoUploadDir = getUploadSubdirectoryPath('company-logos');
const COMPANY_LOGO_MIME_BY_EXTENSION = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
]);

// Company logo uploads use Supabase Storage (memory-buffered) in production and
// fall back to the local filesystem when Supabase is not configured. Path
// inside the `documents` bucket: `company-logos/<companyId>/<unique>.<ext>`.
const companyLogoDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadSubdirectory('company-logos'));
    } catch (error) {
      cb(
        error instanceof Error
          ? error
          : new Error('Failed to prepare company logo upload directory'),
        '',
      );
    }
  },
  filename: (req, file, cb) => {
    const companyId = req.user?.companyId || 'unknown';
    const ext = getSafeImageExtensionForMimeType(file.mimetype);
    if (!ext) {
      cb(new Error('Invalid file type'), '');
      return;
    }
    cb(null, `company-logo-${companyId}-${crypto.randomUUID()}${ext}`);
  },
});

const companyLogoMemoryStorage = multer.memoryStorage();

export const companyLogoUpload = multer({
  storage: isSupabaseConfigured() ? companyLogoMemoryStorage : companyLogoDiskStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!getSafeImageExtensionForMimeType(file.mimetype)) {
      cb(new Error('Invalid file type'));
      return;
    }
    cb(null, true);
  },
});

export function cleanupUploadedLogo(file?: Express.Multer.File): void {
  if (file?.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

export function buildCompanyLogoStorageFilename(
  companyId: string,
  mimetype: string,
): string | null {
  const ext = getSafeImageExtensionForMimeType(mimetype);
  if (!ext) return null;
  return `company-logo-${companyId}-${crypto.randomUUID()}${ext}`;
}

export function getCompanyLogoStoragePrefix(companyId: string): string {
  return `${COMPANY_LOGO_STORAGE_PREFIX}/${companyId}/`;
}

export async function uploadCompanyLogoToSupabase(
  file: Express.Multer.File,
  companyId: string,
): Promise<{ storageReference: string; storagePath: string }> {
  const filename = buildCompanyLogoStorageFilename(companyId, file.mimetype);
  if (!filename) {
    throw AppError.badRequest('Invalid file type');
  }
  const storagePath = `${getCompanyLogoStoragePrefix(companyId)}${filename}`;

  const { error } = await getSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    logError('Supabase company logo upload failed:', error);
    throw AppError.internal('Failed to upload company logo');
  }

  return {
    storageReference: getSupabaseStorageReference(DOCUMENTS_BUCKET, storagePath),
    storagePath,
  };
}

export function getOwnedCompanyLogoStoragePath(
  fileUrl: string | null | undefined,
  companyId: string,
): string | null {
  if (!fileUrl) return null;

  return getSupabaseStoragePath(fileUrl, {
    bucket: DOCUMENTS_BUCKET,
    expectedPrefix: getCompanyLogoStoragePrefix(companyId),
  });
}

export function createCompanyLogoAccessToken(
  companyId: string,
  storagePath: string,
  nowMs = Date.now(),
): string {
  return createSignedStorageAccessToken(
    companyId,
    storagePath,
    COMPANY_LOGO_ACCESS_TOKEN_TTL_MS,
    nowMs,
  );
}

export function validateCompanyLogoAccessToken(
  token: string | undefined,
  companyId: string,
  storagePath: string,
  nowMs = Date.now(),
): boolean {
  return validateSignedStorageAccessToken(token, companyId, storagePath, nowMs);
}

export function buildCompanyLogoDisplayUrl(
  companyId: string,
  logoUrl: string | null | undefined,
): string | null {
  if (!logoUrl) return null;

  const storagePath = getOwnedCompanyLogoStoragePath(logoUrl, companyId);
  if (!storagePath || !isSupabaseConfigured()) {
    return logoUrl;
  }

  return buildSignedStorageFileUrl(
    '/api/company/logo/file',
    companyId,
    storagePath,
    COMPANY_LOGO_ACCESS_TOKEN_TTL_MS,
  );
}

export function getCompanyLogoDisplayUrlCompanyId(logoUrl: string): string | null {
  let parsedLogoUrl: URL;
  let parsedBackendUrl: URL;
  try {
    parsedLogoUrl = new URL(logoUrl);
    parsedBackendUrl = new URL(buildBackendUrl('/'));
  } catch {
    return null;
  }

  const pathPrefix = '/api/company/logo/file/';
  if (
    parsedLogoUrl.origin !== parsedBackendUrl.origin ||
    !parsedLogoUrl.pathname.startsWith(pathPrefix)
  ) {
    return null;
  }

  const encodedCompanyId = parsedLogoUrl.pathname.slice(pathPrefix.length);
  if (!encodedCompanyId || encodedCompanyId.includes('/')) {
    return null;
  }

  try {
    return decodeURIComponent(encodedCompanyId);
  } catch {
    return null;
  }
}

export function getCompanyLogoContentType(storagePath: string): string {
  return COMPANY_LOGO_MIME_BY_EXTENSION.get(path.extname(storagePath).toLowerCase()) || 'image/png';
}

// Logos are small; larger than this we skip embedding and fall back to the URL.
const MAX_EMBEDDED_LOGO_BYTES = 200 * 1024;

// Fetch a company logo as a base64 data URL for embedding directly into a
// generated PDF. Removes the client-side cross-origin fetch (important on the
// public release page, an external viewer on a flaky connection). Best-effort:
// any failure (missing object, oversized, Supabase unset) returns null so the
// caller falls back to the signed display URL. ponytail: Supabase-only — a dev
// disk fallback would render the logo locally too, add it if dev ever needs it.
export async function getCompanyLogoDataUrl(
  companyId: string,
  logoUrl: string | null | undefined,
): Promise<string | null> {
  if (!logoUrl || !isSupabaseConfigured()) return null;

  const storagePath = getOwnedCompanyLogoStoragePath(logoUrl, companyId);
  if (!storagePath) return null;

  try {
    const { data, error } = await getSupabaseClient()
      .storage.from(DOCUMENTS_BUCKET)
      .download(storagePath);
    if (error || !data) return null;

    const buffer = Buffer.from(await data.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_EMBEDDED_LOGO_BYTES) return null;

    return `data:${getCompanyLogoContentType(storagePath)};base64,${buffer.toString('base64')}`;
  } catch (error) {
    logError('Company logo embed failed:', error);
    return null;
  }
}

export function assertCompanyLogoUrlOwnedByCompany(
  logoUrl: string | null | undefined,
  companyId: string,
): void {
  if (!logoUrl || !isSupabaseConfigured()) return;

  const anyDocumentsStoragePath = getSupabaseStoragePath(logoUrl, DOCUMENTS_BUCKET);
  if (anyDocumentsStoragePath !== null && !getOwnedCompanyLogoStoragePath(logoUrl, companyId)) {
    throw AppError.badRequest('Company logo URL must reference an uploaded company logo');
  }
}

export function toCompanyLogoStorageValue(
  logoUrl: string | null,
  companyId: string,
): string | null {
  if (!logoUrl || !isSupabaseConfigured()) return logoUrl;

  const storagePath = getOwnedCompanyLogoStoragePath(logoUrl, companyId);
  if (!storagePath) return logoUrl;

  return getSupabaseStorageReference(DOCUMENTS_BUCKET, storagePath);
}

async function deleteCompanyLogoFromSupabase(fileUrl: string, companyId: string): Promise<void> {
  const storagePath = getOwnedCompanyLogoStoragePath(fileUrl, companyId);
  if (!storagePath) return;

  const { error } = await getSupabaseClient().storage.from(DOCUMENTS_BUCKET).remove([storagePath]);

  if (error) {
    logError('Supabase company logo delete failed:', error);
  }
}

export async function cleanupStoredCompanyLogoUpload(
  fileUrl: string | null,
  file: Express.Multer.File,
  companyId: string,
): Promise<void> {
  if (fileUrl && isSupabaseConfigured() && getOwnedCompanyLogoStoragePath(fileUrl, companyId)) {
    await deleteCompanyLogoFromSupabase(fileUrl, companyId);
    return;
  }
  cleanupUploadedLogo(file);
}

export async function removeStoredCompanyLogo(
  logoUrl: string | null | undefined,
  companyId: string,
): Promise<void> {
  if (!logoUrl) return;
  if (isSupabaseConfigured() && getOwnedCompanyLogoStoragePath(logoUrl, companyId) !== null) {
    await deleteCompanyLogoFromSupabase(logoUrl, companyId);
    return;
  }
  deleteLocalCompanyLogo(logoUrl, companyId);
}

// Decide whether a PATCH that changed `logoUrl` should trigger best-effort
// cleanup of the previously-stored object. Raw string comparison alone is
// unsafe because two URLs can point at the same Supabase object while
// differing only in a query string (cache-buster, signed-URL variant, etc.)
// — deleting on string-difference would yank the still-active file.
//
// When both URLs resolve inside the configured Supabase documents bucket we
// compare their storage paths. Otherwise we fall back to raw URL comparison,
// which is the right call for local `/uploads/...` paths and external URLs.
export function shouldRemovePreviousLogoOnPatch(
  previousLogoUrl: string | null,
  newLogoUrl: string | null,
): boolean {
  if (!previousLogoUrl) return false;

  const previousStoragePath = getSupabaseStoragePath(previousLogoUrl, DOCUMENTS_BUCKET);
  const newStoragePath = newLogoUrl ? getSupabaseStoragePath(newLogoUrl, DOCUMENTS_BUCKET) : null;

  if (previousStoragePath !== null && newStoragePath !== null) {
    return previousStoragePath !== newStoragePath;
  }

  return previousLogoUrl !== newLogoUrl;
}

function deleteLocalCompanyLogo(logoUrl: string | null | undefined, companyId: string): void {
  if (!logoUrl) return;

  let pathname: string;
  try {
    const baseUrl = buildApiUrl('/');
    const parsedUrl = new URL(logoUrl, baseUrl);
    const isRelativeUploadUrl = logoUrl.startsWith(COMPANY_LOGO_PATH_PREFIX);
    if (!isRelativeUploadUrl && parsedUrl.origin !== new URL(baseUrl).origin) {
      return;
    }

    pathname = parsedUrl.pathname;
  } catch {
    return;
  }

  if (!pathname.startsWith(COMPANY_LOGO_PATH_PREFIX)) {
    return;
  }

  const encodedFilename = pathname.split('/').pop();
  if (!encodedFilename) return;

  let filename: string;
  try {
    filename = decodeURIComponent(encodedFilename);
  } catch {
    return;
  }

  if (filename !== path.basename(filename) || filename.includes('/') || filename.includes('\\')) {
    return;
  }

  if (!filename.startsWith(`company-logo-${companyId}-`)) {
    return;
  }

  const uploadDir = path.resolve(companyLogoUploadDir);
  const logoPath = path.resolve(uploadDir, filename);
  if (logoPath.startsWith(`${uploadDir}${path.sep}`) && fs.existsSync(logoPath)) {
    fs.unlinkSync(logoPath);
  }
}
