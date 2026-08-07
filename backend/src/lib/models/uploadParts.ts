import fs from 'node:fs';
import path from 'node:path';

import { ensureUploadSubdirectoryAsync, getUploadSubdirectoryPath } from '../uploadPaths.js';
import { assertSafeStorageId } from '../scheduledReports/artifacts.js';

export const DESIGN_MODEL_UPLOAD_SCRATCH = 'design-model-uploads';
export const UPLOAD_PART_SIZE_BYTES = 8 * 1024 * 1024;
export const MAX_SOURCE_SIZE_BYTES = 200 * 1024 * 1024;
export const STALE_UPLOAD_MAX_AGE_MS = 24 * 60 * 60_000;

export function partFileName(index: number): string {
  return index.toString().padStart(6, '0');
}

export function uploadPartsDirectory(versionId: string): string {
  assertSafeStorageId(versionId, 'versionId');
  return getUploadSubdirectoryPath(`${DESIGN_MODEL_UPLOAD_SCRATCH}/${versionId}`);
}

export async function ensureUploadPartsDirectory(versionId: string): Promise<string> {
  assertSafeStorageId(versionId, 'versionId');
  return ensureUploadSubdirectoryAsync(`${DESIGN_MODEL_UPLOAD_SCRATCH}/${versionId}`);
}

export async function listReceivedParts(versionId: string): Promise<number[]> {
  const directory = uploadPartsDirectory(versionId);
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

export function uploadPartPath(versionId: string, index: number): string {
  return path.join(uploadPartsDirectory(versionId), partFileName(index));
}

export async function removeUploadParts(versionId: string): Promise<void> {
  await fs.promises.rm(uploadPartsDirectory(versionId), { recursive: true, force: true });
}

export async function sweepStaleUploadParts(at = new Date()): Promise<number> {
  const root = getUploadSubdirectoryPath(DESIGN_MODEL_UPLOAD_SCRATCH);
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
