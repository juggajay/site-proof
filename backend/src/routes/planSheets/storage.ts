import fs from 'node:fs';
import path from 'node:path';

import type { Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';

import { AppError, ErrorCodes } from '../../lib/AppError.js';
import { logError, logWarn } from '../../lib/serverLogger.js';
import {
  DOCUMENTS_BUCKET,
  getSupabaseClient,
  getSupabaseStoragePath,
  getSupabaseStorageReference,
  isSupabaseConfigured,
} from '../../lib/supabase.js';
import { ensureUploadSubdirectoryAsync, resolveUploadPath } from '../../lib/uploadPaths.js';

const PLAN_SHEETS_SUBDIR = 'plan-sheets';
// CivilPro-scale drawings are large; 6000px on the long edge keeps registration
// precise while staying mobile-renderable. Bigger inputs are downscaled.
const MAX_EDGE_PX = 6000;

// PNG/JPEG only, kept in memory (we re-encode with sharp, never touch disk until
// the local fallback write). Magic-byte sniffing happens in the route via
// assertUploadedImageFile — this is the cheap declared-type gate.
export const planSheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Prefix matches errorHandler's INVALID_FILE_TYPE branch → 400.
      cb(new Error('Invalid file type: only PNG and JPEG images are allowed'));
    }
  },
});

export interface ProcessedPlanSheetImage {
  png: Buffer;
  width: number;
  height: number;
}

// Downscale to MAX_EDGE_PX (never enlarge), normalise EXIF orientation, and
// re-encode as PNG so the stored pixels match what the viewer registers against.
export async function processPlanSheetImage(input: Buffer): Promise<ProcessedPlanSheetImage> {
  const png = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize(MAX_EDGE_PX, MAX_EDGE_PX, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();

  const meta = await sharp(png).metadata();
  if (!meta.width || !meta.height) {
    throw AppError.badRequest('Could not read image dimensions');
  }
  return { png, width: meta.width, height: meta.height };
}

function supabaseStoragePath(projectId: string, sheetId: string): string {
  return `projects/${projectId}/${PLAN_SHEETS_SUBDIR}/${sheetId}/page.png`;
}

// Ownership check: only a supabase ref under this project's plan-sheets prefix
// resolves. Anything else (or a mismatched project) returns null.
function ownedSupabasePath(imageRef: string, projectId: string): string | null {
  return getSupabaseStoragePath(imageRef, {
    bucket: DOCUMENTS_BUCKET,
    expectedPrefix: `projects/${projectId}/${PLAN_SHEETS_SUBDIR}/`,
  });
}

// Persist the rendered PNG and return the ref to store in PlanSheet.imageRef.
// Supabase when configured (durable); otherwise local disk — production refuses
// to boot with local storage (runtimeConfig ALLOW_LOCAL_FILE_STORAGE gate).
export async function storePlanSheetImage(
  projectId: string,
  sheetId: string,
  png: Buffer,
): Promise<string> {
  if (isSupabaseConfigured()) {
    const storagePath = supabaseStoragePath(projectId, sheetId);
    const { error } = await getSupabaseClient()
      .storage.from(DOCUMENTS_BUCKET)
      .upload(storagePath, png, { contentType: 'image/png', upsert: false });
    if (error) {
      logError('Supabase plan-sheet upload failed:', error);
      throw new AppError(
        503,
        'File storage is unavailable. Please try again later.',
        ErrorCodes.UPLOAD_FAILED,
      );
    }
    return getSupabaseStorageReference(DOCUMENTS_BUCKET, storagePath);
  }

  // sheetId/projectId are server-generated uuids — no user input in the path.
  const dir = await ensureUploadSubdirectoryAsync(`${PLAN_SHEETS_SUBDIR}/${projectId}/${sheetId}`);
  await fs.promises.writeFile(path.join(dir, 'page.png'), png);
  return `uploads/${PLAN_SHEETS_SUBDIR}/${projectId}/${sheetId}/page.png`;
}

// Stream the stored PNG with private, no-store headers (mirrors sendDocumentFile).
export async function sendPlanSheetImage(
  imageRef: string,
  projectId: string,
  res: Response,
): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  const storagePath = ownedSupabasePath(imageRef, projectId);
  if (storagePath) {
    if (!isSupabaseConfigured()) {
      throw AppError.notFound('Plan sheet image');
    }
    const { data, error } = await getSupabaseClient()
      .storage.from(DOCUMENTS_BUCKET)
      .download(storagePath);
    if (error || !data) {
      logWarn('Supabase plan-sheet download failed:', error);
      throw AppError.notFound('Plan sheet image');
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
    return;
  }

  const filePath = resolveUploadPath(imageRef, PLAN_SHEETS_SUBDIR);
  if (!fs.existsSync(filePath)) {
    throw AppError.notFound('Plan sheet image');
  }
  res.setHeader('Content-Type', 'image/png');
  res.sendFile(filePath);
}

// Best-effort storage cleanup on delete. Logs and swallows all errors — a stray
// object must never fail the row delete.
export async function deletePlanSheetImage(imageRef: string, projectId: string): Promise<void> {
  try {
    const storagePath = ownedSupabasePath(imageRef, projectId);
    if (storagePath) {
      if (!isSupabaseConfigured()) {
        return;
      }
      const { error } = await getSupabaseClient()
        .storage.from(DOCUMENTS_BUCKET)
        .remove([storagePath]);
      if (error) {
        logError('Supabase plan-sheet delete failed:', error);
      }
      return;
    }
    const filePath = resolveUploadPath(imageRef, PLAN_SHEETS_SUBDIR);
    await fs.promises.rm(filePath, { force: true });
  } catch (err) {
    logWarn('Plan-sheet image cleanup failed (non-fatal):', err);
  }
}
