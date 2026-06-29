import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Response } from 'express';

import { AppError, ErrorCodes } from '../AppError.js';
import { logError, logWarn } from '../serverLogger.js';
import {
  DOCUMENTS_BUCKET,
  getSupabaseClient,
  getSupabaseStoragePath,
  getSupabaseStorageReference,
  isSupabaseConfigured,
} from '../supabase.js';
import { ensureUploadSubdirectoryAsync, resolveUploadPath } from '../uploadPaths.js';

const SCHEDULED_REPORT_ARTIFACT_ROOT = 'scheduled-reports';
const SCHEDULED_REPORT_ARTIFACT_MIME_TYPE = 'application/pdf';
const MAX_SAFE_FILENAME_LENGTH = 180;

export type ScheduledReportArtifactMetadata = {
  artifactFileUrl: string;
  artifactReportName: string;
  artifactFilename: string;
  artifactMimeType: string;
  artifactFileSize: number;
  artifactSha256: string;
  artifactCreatedAt: Date;
};

export type ScheduledReportArtifactRecord = {
  id: string;
  scheduleId: string;
  projectId: string;
  artifactFileUrl: string | null;
  artifactReportName: string | null;
  artifactFilename: string | null;
  artifactMimeType: string | null;
  artifactFileSize: number | null;
  artifactSha256: string | null;
};

export function buildScheduledReportArtifactFrontendPath(runId: string): string {
  return `/reports/scheduled-runs/${encodeURIComponent(runId)}/artifact`;
}

function assertSafeStorageId(value: string, fieldName: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw AppError.badRequest(`${fieldName} is invalid`);
  }
}

function getSafeDownloadFilename(filename: string | null | undefined): string {
  const basename = path.basename((filename || '').replace(/\\/g, '/'));
  const sanitized = basename
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 || '<>:"/\\|?*'.includes(char) ? '_' : char;
    })
    .join('')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, MAX_SAFE_FILENAME_LENGTH);

  return sanitized || 'scheduled-report.pdf';
}

function normalizeArtifactFilename(filename: string): string {
  const safe = getSafeDownloadFilename(filename);
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}

export function getScheduledReportArtifactStoragePath(
  projectId: string,
  scheduleId: string,
  runId: string,
): string {
  assertSafeStorageId(projectId, 'projectId');
  assertSafeStorageId(scheduleId, 'scheduleId');
  assertSafeStorageId(runId, 'runId');
  return `${SCHEDULED_REPORT_ARTIFACT_ROOT}/${projectId}/${scheduleId}/${runId}.pdf`;
}

export function getOwnedScheduledReportArtifactStoragePath(
  fileUrl: string,
  projectId: string,
  scheduleId: string,
  runId: string,
): string | null {
  const expectedPath = getScheduledReportArtifactStoragePath(projectId, scheduleId, runId);
  const storagePath = getSupabaseStoragePath(fileUrl, {
    bucket: DOCUMENTS_BUCKET,
    expectedPrefix: `${SCHEDULED_REPORT_ARTIFACT_ROOT}/${projectId}/${scheduleId}/`,
  });

  return storagePath === expectedPath ? storagePath : null;
}

function getExpectedLocalArtifactPath(
  projectId: string,
  scheduleId: string,
  runId: string,
): string {
  return `uploads/${getScheduledReportArtifactStoragePath(projectId, scheduleId, runId)}`;
}

function resolveOwnedLocalArtifactPath(
  fileUrl: string,
  projectId: string,
  scheduleId: string,
  runId: string,
): string {
  const expectedFileUrl = getExpectedLocalArtifactPath(projectId, scheduleId, runId);
  const resolvedPath = resolveUploadPath(fileUrl, SCHEDULED_REPORT_ARTIFACT_ROOT);
  const expectedPath = resolveUploadPath(expectedFileUrl, SCHEDULED_REPORT_ARTIFACT_ROOT);

  if (resolvedPath !== expectedPath) {
    throw AppError.notFound('Scheduled report artifact');
  }

  return resolvedPath;
}

export function calculateScheduledReportArtifactSha256(pdfBuffer: Buffer): string {
  return crypto.createHash('sha256').update(pdfBuffer).digest('hex');
}

async function tryAdoptExistingSupabaseArtifact(
  storagePath: string,
  expectedSha256: string,
): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .download(storagePath);
  if (error || !data) {
    return false;
  }

  const existingBuffer = Buffer.from(await data.arrayBuffer());
  return calculateScheduledReportArtifactSha256(existingBuffer) === expectedSha256;
}

async function tryAdoptExistingLocalArtifact(
  filePath: string,
  expectedSha256: string,
): Promise<boolean> {
  try {
    const existingBuffer = await fs.promises.readFile(filePath);
    return calculateScheduledReportArtifactSha256(existingBuffer) === expectedSha256;
  } catch {
    return false;
  }
}

export async function storeScheduledReportArtifact(params: {
  projectId: string;
  scheduleId: string;
  runId: string;
  reportName: string;
  pdfBuffer: Buffer;
  now: Date;
}): Promise<ScheduledReportArtifactMetadata> {
  const storagePath = getScheduledReportArtifactStoragePath(
    params.projectId,
    params.scheduleId,
    params.runId,
  );
  const artifactFilename = normalizeArtifactFilename(`${params.reportName}.pdf`);
  const artifactSha256 = calculateScheduledReportArtifactSha256(params.pdfBuffer);
  const metadata = {
    artifactReportName: params.reportName,
    artifactFilename,
    artifactMimeType: SCHEDULED_REPORT_ARTIFACT_MIME_TYPE,
    artifactFileSize: params.pdfBuffer.length,
    artifactSha256,
    artifactCreatedAt: params.now,
  };

  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseClient()
      .storage.from(DOCUMENTS_BUCKET)
      .upload(storagePath, params.pdfBuffer, {
        contentType: SCHEDULED_REPORT_ARTIFACT_MIME_TYPE,
        upsert: false,
      });

    if (error) {
      if (await tryAdoptExistingSupabaseArtifact(storagePath, artifactSha256)) {
        return {
          ...metadata,
          artifactFileUrl: getSupabaseStorageReference(DOCUMENTS_BUCKET, storagePath),
        };
      }

      logError('[Scheduled Reports] Artifact upload failed:', error);
      throw new AppError(
        503,
        'Scheduled report artifact storage is unavailable. Please try again later.',
        ErrorCodes.UPLOAD_FAILED,
      );
    }

    return {
      ...metadata,
      artifactFileUrl: getSupabaseStorageReference(DOCUMENTS_BUCKET, storagePath),
    };
  }

  const artifactDirectory = await ensureUploadSubdirectoryAsync(
    `${SCHEDULED_REPORT_ARTIFACT_ROOT}/${params.projectId}/${params.scheduleId}`,
  );
  const filePath = path.join(artifactDirectory, `${params.runId}.pdf`);
  try {
    await fs.promises.writeFile(filePath, params.pdfBuffer, { flag: 'wx' });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'EEXIST' &&
      (await tryAdoptExistingLocalArtifact(filePath, artifactSha256))
    ) {
      return {
        ...metadata,
        artifactFileUrl: getExpectedLocalArtifactPath(
          params.projectId,
          params.scheduleId,
          params.runId,
        ),
      };
    }

    throw error;
  }

  return {
    ...metadata,
    artifactFileUrl: getExpectedLocalArtifactPath(
      params.projectId,
      params.scheduleId,
      params.runId,
    ),
  };
}

export async function loadScheduledReportArtifactBuffer(
  run: ScheduledReportArtifactRecord,
): Promise<Buffer> {
  if (!run.artifactFileUrl) {
    throw AppError.notFound('Scheduled report artifact');
  }

  const storagePath = getOwnedScheduledReportArtifactStoragePath(
    run.artifactFileUrl,
    run.projectId,
    run.scheduleId,
    run.id,
  );
  if (storagePath) {
    if (!isSupabaseConfigured()) {
      throw AppError.notFound('Scheduled report artifact');
    }

    const { data, error } = await getSupabaseClient()
      .storage.from(DOCUMENTS_BUCKET)
      .download(storagePath);

    if (error || !data) {
      logWarn('[Scheduled Reports] Supabase artifact download failed:', error);
      throw AppError.notFound('Scheduled report artifact');
    }

    return Buffer.from(await data.arrayBuffer());
  }

  const filePath = resolveOwnedLocalArtifactPath(
    run.artifactFileUrl,
    run.projectId,
    run.scheduleId,
    run.id,
  );
  if (!fs.existsSync(filePath)) {
    throw AppError.notFound('Scheduled report artifact');
  }

  return fs.promises.readFile(filePath);
}

export async function sendScheduledReportArtifactFile(
  run: ScheduledReportArtifactRecord,
  res: Response,
): Promise<void> {
  const buffer = await loadScheduledReportArtifactBuffer(run);
  const expectedSha256 = run.artifactSha256?.trim();
  if (expectedSha256 && calculateScheduledReportArtifactSha256(buffer) !== expectedSha256) {
    throw AppError.internal('Scheduled report artifact integrity check failed');
  }

  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${getSafeDownloadFilename(run.artifactFilename)}"`,
  );
  res.setHeader('Content-Type', run.artifactMimeType || SCHEDULED_REPORT_ARTIFACT_MIME_TYPE);
  res.setHeader('Content-Length', String(buffer.length));
  res.send(buffer);
}
