import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { AppError } from '../../lib/AppError.js';
import { logError, logWarn } from '../../lib/serverLogger.js';
import {
  DOCUMENTS_BUCKET,
  getSupabaseClient,
  getSupabaseStorageReference,
  getSupabaseStoragePath,
  isSupabaseConfigured,
} from '../../lib/supabase.js';
import { ensureUploadSubdirectory, resolveUploadPath } from '../../lib/uploadPaths.js';
import { buildStoredFilename } from './filenames.js';

const DRAWINGS_STORAGE_PREFIX = 'drawings';

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadSubdirectory('drawings'));
    } catch (error) {
      cb(
        error instanceof Error ? error : new Error('Failed to prepare drawing upload directory'),
        '',
      );
    }
  },
  filename: (_req, file, cb) => {
    cb(null, buildStoredFilename(file.originalname));
  },
});

const memoryStorage = multer.memoryStorage();

export const upload = multer({
  storage: isSupabaseConfigured() ? memoryStorage : diskStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for drawings
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'application/dxf',
      'application/dwg',
      'application/vnd.dwg',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      allowedTypes.includes(file.mimetype) ||
      ['.pdf', '.dwg', '.dxf', '.jpg', '.jpeg', '.png', '.tiff', '.tif'].includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

export function cleanupUploadedFile(file?: Express.Multer.File): void {
  if (file?.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

async function uploadDrawingToSupabase(
  file: Express.Multer.File,
  projectId: string,
): Promise<{ url: string; storagePath: string }> {
  const storagePath = `${DRAWINGS_STORAGE_PREFIX}/${projectId}/${buildStoredFilename(file.originalname)}`;

  const { error } = await getSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    logError('Supabase drawing upload failed:', error);
    throw AppError.internal('Failed to upload drawing');
  }

  return {
    url: getSupabaseStorageReference(DOCUMENTS_BUCKET, storagePath),
    storagePath,
  };
}

function getDrawingStoragePrefix(projectId: string): string {
  return `${DRAWINGS_STORAGE_PREFIX}/${projectId}/`;
}

function getOwnedDrawingStoragePath(fileUrl: string, projectId: string): string | null {
  return getSupabaseStoragePath(fileUrl, {
    bucket: DOCUMENTS_BUCKET,
    expectedPrefix: getDrawingStoragePrefix(projectId),
  });
}

async function deleteDrawingFromSupabase(fileUrl: string, projectId: string): Promise<void> {
  const storagePath = getOwnedDrawingStoragePath(fileUrl, projectId);
  if (!storagePath) {
    return;
  }

  const { error } = await getSupabaseClient().storage.from(DOCUMENTS_BUCKET).remove([storagePath]);

  if (error) {
    logError('Supabase drawing delete failed:', error);
  }
}

export async function storeDrawingUpload(
  file: Express.Multer.File,
  projectId: string,
): Promise<string> {
  if (isSupabaseConfigured() && file.buffer) {
    const uploaded = await uploadDrawingToSupabase(file, projectId);
    return uploaded.url;
  }

  return `/uploads/drawings/${file.filename}`;
}

// Best-effort cleanup after a failed drawing upload. Removes either the
// Supabase object (if we already uploaded) or the local temp file.
export async function cleanupStoredDrawingUpload(
  fileUrl: string | null,
  file: Express.Multer.File,
  projectId: string,
): Promise<void> {
  if (fileUrl && isSupabaseConfigured() && getOwnedDrawingStoragePath(fileUrl, projectId)) {
    await deleteDrawingFromSupabase(fileUrl, projectId);
    return;
  }
  cleanupUploadedFile(file);
}

export function prepareStoredDrawingFileCleanup(
  existingFileUrl: string,
  projectId: string,
): () => Promise<void> {
  const isSupabaseStored =
    isSupabaseConfigured() && getOwnedDrawingStoragePath(existingFileUrl, projectId) !== null;

  let filePath: string | null = null;
  if (!isSupabaseStored) {
    try {
      filePath = resolveUploadPath(existingFileUrl, 'drawings');
    } catch (error) {
      logWarn('Skipping drawing file cleanup for invalid file path:', error);
    }
  }

  return async () => {
    if (isSupabaseStored) {
      try {
        await deleteDrawingFromSupabase(existingFileUrl, projectId);
      } catch (error) {
        logWarn('Failed to delete drawing file from Supabase after database delete:', error);
      }
    } else if (filePath) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        logWarn('Failed to delete drawing file after database delete:', error);
      }
    }
  };
}
