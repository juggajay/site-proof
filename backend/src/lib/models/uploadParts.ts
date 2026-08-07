import fs from 'node:fs';
import path from 'node:path';

import { ensureUploadSubdirectoryAsync, getUploadSubdirectoryPath } from '../uploadPaths.js';
import { assertSafeStorageId } from '../scheduledReports/artifacts.js';

export const DESIGN_MODEL_UPLOAD_SCRATCH = 'design-model-uploads';
export const ORTHO_UPLOAD_SCRATCH = 'ortho-uploads';
export const UPLOAD_PART_SIZE_BYTES = 8 * 1024 * 1024;
export const MAX_SOURCE_SIZE_BYTES = 200 * 1024 * 1024;
export const STALE_UPLOAD_MAX_AGE_MS = 24 * 60 * 60_000;

export function uploadPartCount(sourceSizeBytes: number, maxSourceSizeBytes: number): number {
  if (
    !Number.isSafeInteger(sourceSizeBytes) ||
    sourceSizeBytes < 1 ||
    sourceSizeBytes > maxSourceSizeBytes
  ) {
    throw new RangeError(`Source size must be between 1 and ${maxSourceSizeBytes} bytes`);
  }
  return Math.ceil(sourceSizeBytes / UPLOAD_PART_SIZE_BYTES);
}

export function expectedUploadPartSize(
  sourceSizeBytes: number,
  index: number,
  maxSourceSizeBytes: number,
): number {
  const partCount = uploadPartCount(sourceSizeBytes, maxSourceSizeBytes);
  if (!Number.isSafeInteger(index) || index < 0 || index >= partCount) {
    throw new RangeError('Part index is outside the declared upload');
  }
  return index === partCount - 1
    ? sourceSizeBytes - (partCount - 1) * UPLOAD_PART_SIZE_BYTES
    : UPLOAD_PART_SIZE_BYTES;
}

export function partFileName(index: number): string {
  return index.toString().padStart(6, '0');
}

export function uploadPartsDirectory(
  uploadId: string,
  scratchRoot = DESIGN_MODEL_UPLOAD_SCRATCH,
): string {
  assertSafeStorageId(uploadId, 'uploadId');
  assertSafeStorageId(scratchRoot, 'scratchRoot');
  return getUploadSubdirectoryPath(`${scratchRoot}/${uploadId}`);
}

export async function ensureUploadPartsDirectory(
  uploadId: string,
  scratchRoot = DESIGN_MODEL_UPLOAD_SCRATCH,
): Promise<string> {
  assertSafeStorageId(uploadId, 'uploadId');
  assertSafeStorageId(scratchRoot, 'scratchRoot');
  return ensureUploadSubdirectoryAsync(`${scratchRoot}/${uploadId}`);
}

export async function listReceivedParts(
  uploadId: string,
  scratchRoot = DESIGN_MODEL_UPLOAD_SCRATCH,
): Promise<number[]> {
  const directory = uploadPartsDirectory(uploadId, scratchRoot);
  let entries: string[];
  try {
    entries = await fs.promises.readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => /^\d{6}$/.test(entry))
    .map(Number)
    .sort((left, right) => left - right);
}

export function uploadPartPath(
  uploadId: string,
  index: number,
  scratchRoot = DESIGN_MODEL_UPLOAD_SCRATCH,
): string {
  return path.join(uploadPartsDirectory(uploadId, scratchRoot), partFileName(index));
}

export async function removeUploadParts(
  uploadId: string,
  scratchRoot = DESIGN_MODEL_UPLOAD_SCRATCH,
): Promise<void> {
  await fs.promises.rm(uploadPartsDirectory(uploadId, scratchRoot), {
    recursive: true,
    force: true,
  });
}

export async function sweepStaleUploadParts(
  at = new Date(),
  scratchRoot = DESIGN_MODEL_UPLOAD_SCRATCH,
): Promise<number> {
  assertSafeStorageId(scratchRoot, 'scratchRoot');
  const root = getUploadSubdirectoryPath(scratchRoot);
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }

  let removed = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(root, entry.name);
    const stats = await fs.promises.stat(directory);
    if (at.getTime() - stats.mtimeMs <= STALE_UPLOAD_MAX_AGE_MS) continue;
    await fs.promises.rm(directory, { recursive: true, force: true });
    removed += 1;
  }
  return removed;
}
