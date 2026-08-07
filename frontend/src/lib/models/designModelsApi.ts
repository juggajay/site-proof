/**
 * Wave 5 — design models API client.
 *
 * Backend contract: backend/src/routes/designModels.ts (PR #1802). Uploads are
 * resumable by construction: the server stages fixed-size parts, reports which
 * indexes it holds, and assembles + verifies (sha256 + byte count) on complete.
 * Sending parts always starts from the server's `received` list, so a retry
 * after an interruption (or a Railway redeploy that wiped staged parts) is the
 * same code path as a fresh upload.
 */
import { apiFetch, authFetch, ApiError } from '@/lib/api';

/** Mirrors the backend's MAX_SOURCE_SIZE_BYTES (200 MB) — rejected server-side too. */
export const MAX_SOURCE_SIZE_BYTES = 209_715_200;

export type DesignModelVersionStatus = 'uploading' | 'queued' | 'converting' | 'ready' | 'failed';

export interface DesignModelLatestVersion {
  id: string;
  versionNumber: number;
  status: DesignModelVersionStatus;
  /** BigInt serialised as a string by the backend. */
  fragSizeBytes: string | null;
  createdAt: string;
}

export interface DesignModelListItem {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  latestVersion: DesignModelLatestVersion | null;
}

export interface DesignModelVersion {
  id: string;
  modelId: string;
  versionNumber: number;
  status: DesignModelVersionStatus;
  fileName: string;
  sourceSizeBytes: string;
  sourceSha256: string;
  fragSizeBytes: string | null;
  converterVersion: string | null;
  diagnostics: Record<string, unknown> | null;
  failureCount: number;
  lastFailureReason: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Server-issued upload session — everything needed to (re)send parts. */
export interface UploadHandle {
  versionId: string;
  partSizeBytes: number;
  partCount: number;
  sizeBytes: number;
}

export const VERSION_STATUS_LABELS: Record<DesignModelVersionStatus, string> = {
  uploading: 'Uploading',
  queued: 'Queued for conversion',
  converting: 'Converting',
  ready: 'Ready',
  failed: 'Conversion failed',
};

/** Conversion still in flight — the worker ticks every 5 s; poll the list. */
export function isConversionPending(status: DesignModelVersionStatus): boolean {
  return status === 'uploading' || status === 'queued' || status === 'converting';
}

/**
 * Two failed conversion attempts quarantine the source file server-side — it
 * will not be retried. Display the failure plainly; the fix is a new upload.
 */
export function isQuarantined(version: {
  status: DesignModelVersionStatus;
  failureCount: number;
}): boolean {
  return version.status === 'failed' && version.failureCount >= 2;
}

/** Expected byte size of one part (every part is full-size except the last). */
export function expectedPartSize(
  sizeBytes: number,
  partSizeBytes: number,
  partCount: number,
  index: number,
): number {
  if (index === partCount - 1) {
    return sizeBytes - (partCount - 1) * partSizeBytes;
  }
  return partSizeBytes;
}

/** Part indexes the server does not hold yet, in send order. */
export function missingPartIndexes(partCount: number, received: number[]): number[] {
  const have = new Set(received);
  const missing: number[] = [];
  for (let index = 0; index < partCount; index++) {
    if (!have.has(index)) missing.push(index);
  }
  return missing;
}

/** SHA-256 of a buffer as 64 lowercase hex chars (what the backend verifies). */
export async function sha256HexOf(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function fetchDesignModels(projectId: string): Promise<DesignModelListItem[]> {
  const response = await apiFetch<{ models: DesignModelListItem[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/models`,
  );
  return response.models;
}

export async function createDesignModel(projectId: string, name: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/projects/${encodeURIComponent(projectId)}/models`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function fetchDesignModelVersion(
  projectId: string,
  modelId: string,
  versionId: string,
): Promise<DesignModelVersion> {
  return apiFetch<DesignModelVersion>(
    `/api/projects/${encodeURIComponent(projectId)}/models/${encodeURIComponent(modelId)}/versions/${encodeURIComponent(versionId)}`,
  );
}

export async function deleteDesignModelVersion(
  projectId: string,
  modelId: string,
  versionId: string,
): Promise<void> {
  await apiFetch<void>(
    `/api/projects/${encodeURIComponent(projectId)}/models/${encodeURIComponent(modelId)}/versions/${encodeURIComponent(versionId)}`,
    { method: 'DELETE' },
  );
}

/**
 * Declare a new version: hashes the file (WebCrypto, client-side — the server
 * re-hashes on complete and rejects a mismatch) and opens the upload session.
 */
export async function createDesignModelVersion(
  projectId: string,
  modelId: string,
  file: File,
): Promise<UploadHandle> {
  const sha256 = await sha256HexOf(await file.arrayBuffer());
  const created = await apiFetch<{ versionId: string; partSizeBytes: number; partCount: number }>(
    `/api/projects/${encodeURIComponent(projectId)}/models/${encodeURIComponent(modelId)}/versions`,
    {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, sizeBytes: file.size, sha256 }),
    },
  );
  return { ...created, sizeBytes: file.size };
}

// A 8 MB part on a slow site connection can exceed the shared 30 s budget;
// completion streams + re-hashes the whole assembled file server-side.
const PART_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const COMPLETE_TIMEOUT_MS = 2 * 60 * 1000;

async function throwApiError(response: Response): Promise<never> {
  throw new ApiError(response.status, await response.text());
}

/**
 * Send whatever parts the server is missing, then finalize. Safe to call again
 * with the same handle after any failure — it re-reads `received` first.
 */
export async function sendDesignModelVersionParts(
  projectId: string,
  modelId: string,
  handle: UploadHandle,
  file: File,
  onProgress?: (partsDone: number, partCount: number) => void,
): Promise<DesignModelVersion> {
  const base = `/api/projects/${encodeURIComponent(projectId)}/models/${encodeURIComponent(modelId)}/versions/${encodeURIComponent(handle.versionId)}`;

  const { received } = await apiFetch<{ received: number[] }>(`${base}/parts`);
  const missing = missingPartIndexes(handle.partCount, received);
  let done = handle.partCount - missing.length;
  onProgress?.(done, handle.partCount);

  for (const index of missing) {
    const start = index * handle.partSizeBytes;
    const size = expectedPartSize(handle.sizeBytes, handle.partSizeBytes, handle.partCount, index);
    const form = new FormData();
    form.append('file', file.slice(start, start + size), file.name);
    const response = await authFetch(
      `${base}/parts/${index}`,
      { method: 'PUT', body: form },
      PART_UPLOAD_TIMEOUT_MS,
    );
    if (!response.ok) await throwApiError(response);
    done += 1;
    onProgress?.(done, handle.partCount);
  }

  const completed = await authFetch(`${base}/complete`, { method: 'POST' }, COMPLETE_TIMEOUT_MS);
  if (!completed.ok) await throwApiError(completed);
  return (await completed.json()) as DesignModelVersion;
}

/**
 * Download a ready version's fragments as an ArrayBuffer through the app's
 * authed fetch. `timeoutMs: 0` is the documented long-stream exception — the
 * shared timeout aborts the whole transfer, and a frag can be tens of MB on a
 * slow connection. Callers pass an AbortSignal to cancel on unmount.
 */
export async function fetchDesignModelFragments(
  projectId: string,
  modelId: string,
  versionId: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await authFetch(
    `/api/projects/${encodeURIComponent(projectId)}/models/${encodeURIComponent(modelId)}/versions/${encodeURIComponent(versionId)}/fragments`,
    { signal },
    0,
  );
  if (!response.ok) await throwApiError(response);
  return response.arrayBuffer();
}
