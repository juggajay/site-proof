import fs from 'fs';

import sharp from 'sharp';

import { AppError, ErrorCodes } from '../../lib/AppError.js';
import { sanitizeUrlValueForLog } from '../../lib/logSanitization.js';
import { logError, logWarn } from '../../lib/serverLogger.js';
import {
  DOCUMENTS_BUCKET,
  getSupabaseClient,
  getSupabaseStorageReference,
  getSupabaseStoragePath,
  isSupabaseConfigured,
} from '../../lib/supabase.js';
import { resolveUploadPath } from '../../lib/uploadPaths.js';

const MAX_CLASSIFICATION_IMAGE_BYTES = 50 * 1024 * 1024;
const LOCAL_DOCUMENT_FILE_SUBDIRECTORIES = ['documents', 'certificates', 'drawings'] as const;

type DocumentImageRecord = {
  fileUrl: string;
  projectId: string;
  documentType?: string | null;
};

type UploadToSupabaseDependencies = {
  buildStoredFilename: (originalName: string) => string;
  getSafeStoredDocumentMimeType: (
    file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>,
  ) => string;
};

export function isExternalFileUrl(fileUrl: string): boolean {
  return /^https?:\/\//i.test(fileUrl);
}

export function resolveLocalDocumentFilePath(fileUrl: string): string {
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

export function cleanupUploadedFile(file?: Express.Multer.File): void {
  if (file?.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

export async function loadSupabaseDocumentImageAsBase64(
  document: DocumentImageRecord,
): Promise<string> {
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

export async function loadDocumentImageAsBase64(
  document: DocumentImageRecord,
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

  if (getOwnedDocumentStoragePath(document.fileUrl, document.projectId, document.documentType)) {
    if (!isSupabaseConfigured()) {
      throw AppError.notFound('Image file');
    }
    return loadSupabaseDocumentImageAsBase64(document);
  }

  if (isExternalFileUrl(document.fileUrl)) {
    throw AppError.notFound('Image file');
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

export async function uploadToSupabase(
  file: Express.Multer.File,
  projectId: string,
  { buildStoredFilename, getSafeStoredDocumentMimeType }: UploadToSupabaseDependencies,
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
    throw new AppError(
      503,
      'File storage is unavailable. Please try again later.',
      ErrorCodes.UPLOAD_FAILED,
    );
  }

  const url = getSupabaseStorageReference(DOCUMENTS_BUCKET, storagePath);
  return { url, storagePath };
}

export function getDocumentStoragePrefixes(
  projectId: string,
  documentType?: string | null,
): string[] {
  const prefixes = [`${projectId}/`];
  if (documentType === 'drawing') {
    prefixes.push(`drawings/${projectId}/`);
  }
  if (documentType === 'test_certificate') {
    prefixes.push(`certificates/${projectId}/`);
  }
  return prefixes;
}

export function getOwnedDocumentStoragePath(
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

export async function deleteFromSupabase(
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

export async function cleanupStoredDocumentUpload(
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

// Grid thumbnails: a small webp derivative stored at a convention-derived key
// right next to the original (original storage key + this suffix). No schema
// change — presence is inferred, absence falls back to the original on read.
export const THUMBNAIL_STORAGE_SUFFIX = '.thumb.webp';
const THUMBNAIL_MAX_EDGE_PX = 320;
const THUMBNAIL_WEBP_QUALITY = 70;

export function isThumbnailableImageMimeType(mimeType: string | null | undefined): boolean {
  return typeof mimeType === 'string' && /^image\/(jpe?g|png|webp|gif)$/i.test(mimeType);
}

async function renderThumbnail(input: Buffer | string): Promise<Buffer> {
  return sharp(input, { failOn: 'none', animated: false })
    .rotate() // honour EXIF orientation before stripping metadata
    .resize(THUMBNAIL_MAX_EDGE_PX, THUMBNAIL_MAX_EDGE_PX, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: THUMBNAIL_WEBP_QUALITY })
    .toBuffer();
}

// Fire-and-forget: generate a grid thumbnail alongside a freshly stored image.
// Mirrors the supabase-vs-local decision the rest of this module makes. NEVER
// throws — a thumbnail is an optimisation, its failure must not fail the upload.
export async function generateDocumentThumbnail(params: {
  fileUrl: string;
  projectId: string;
  mimeType: string | null;
  buffer?: Buffer | null;
  localSourcePath?: string | null;
}): Promise<void> {
  try {
    if (!isThumbnailableImageMimeType(params.mimeType)) {
      return;
    }

    const source = params.buffer ?? params.localSourcePath;
    if (!source) {
      return;
    }

    const thumbnail = await renderThumbnail(source);

    const storagePath = getOwnedDocumentStoragePath(params.fileUrl, params.projectId);
    if (storagePath && isSupabaseConfigured()) {
      const { error } = await getSupabaseClient()
        .storage.from(DOCUMENTS_BUCKET)
        .upload(`${storagePath}${THUMBNAIL_STORAGE_SUFFIX}`, thumbnail, {
          contentType: 'image/webp',
          upsert: true,
        });
      if (error) {
        logWarn('Thumbnail upload to Supabase failed (non-fatal):', error);
      }
      return;
    }

    // Local-disk fallback: write next to where the original is served from.
    if (!isExternalFileUrl(params.fileUrl) && !params.fileUrl.startsWith('data:')) {
      const filePath = resolveLocalDocumentFilePath(params.fileUrl);
      await fs.promises.writeFile(`${filePath}${THUMBNAIL_STORAGE_SUFFIX}`, thumbnail);
    }
  } catch (error) {
    logWarn('Thumbnail generation failed (non-fatal):', error);
  }
}
