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

export type StoredScheduledReportArtifact = ScheduledReportArtifactMetadata & {
  storedPdfBuffer?: Buffer;
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

function isUnsafeFilenameChar(char: string, options: { asciiOnly?: boolean } = {}): boolean {
  const code = char.charCodeAt(0);
  return (
    code < 32 ||
    code === 127 ||
    Boolean(options.asciiOnly && code > 126) ||
    '<>:"/\\|?*'.includes(char)
  );
}

function replaceUnsafeFilenameChars(value: string, options: { asciiOnly?: boolean } = {}): string {
  return value
    .split('')
    .map((char) => (isUnsafeFilenameChar(char, options) ? '_' : char))
    .join('');
}

function getSafeDownloadFilename(filename: string | null | undefined): string {
  const basename = path.basename((filename || '').replace(/\\/g, '/'));
  const sanitized = replaceUnsafeFilenameChars(basename)
    .replace(/^\.+/, '')
    .trim()
    .slice(0, MAX_SAFE_FILENAME_LENGTH);

  return sanitized || 'scheduled-report.pdf';
}

function normalizeArtifactFilename(filename: string): string {
  const safe = getSafeDownloadFilename(filename);
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}

function getAsciiDownloadFilenameFallback(filename: string): string {
  const fallback = replaceUnsafeFilenameChars(filename, { asciiOnly: true })
    .trim()
    .slice(0, MAX_SAFE_FILENAME_LENGTH);

  return fallback || 'scheduled-report.pdf';
}

function encodeContentDispositionFilename(filename: string): string {
  return encodeURIComponent(filename)
    .replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, '%2A');
}

function buildAttachmentContentDisposition(filename: string | null | undefined): string {
  const safeFilename = getSafeDownloadFilename(filename);
  const fallbackFilename = getAsciiDownloadFilenameFallback(safeFilename);

  if (fallbackFilename === safeFilename) {
    return `attachment; filename="${fallbackFilename}"`;
  }

  return `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodeContentDispositionFilename(safeFilename)}`;
}

function setPrivateArtifactDownloadHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
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

async function loadExistingSupabaseArtifact(storagePath: string): Promise<Buffer | null> {
  const { data, error } = await getSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .download(storagePath);
  if (error || !data) {
    return null;
  }

  return Buffer.from(await data.arrayBuffer());
}

async function loadExistingLocalArtifact(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.promises.readFile(filePath);
  } catch {
    return null;
  }
}

export async function storeScheduledReportArtifact(params: {
  projectId: string;
  scheduleId: string;
  runId: string;
  reportName: string;
  pdfBuffer: Buffer;
  now: Date;
}): Promise<StoredScheduledReportArtifact> {
  const storagePath = getScheduledReportArtifactStoragePath(
    params.projectId,
    params.scheduleId,
    params.runId,
  );
  const artifactFilename = normalizeArtifactFilename(`${params.reportName}.pdf`);
  const buildMetadata = (
    pdfBuffer: Buffer,
  ): Omit<ScheduledReportArtifactMetadata, 'artifactFileUrl'> => ({
    artifactReportName: params.reportName,
    artifactFilename,
    artifactMimeType: SCHEDULED_REPORT_ARTIFACT_MIME_TYPE,
    artifactFileSize: pdfBuffer.length,
    artifactSha256: calculateScheduledReportArtifactSha256(pdfBuffer),
    artifactCreatedAt: params.now,
  });

  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseClient()
      .storage.from(DOCUMENTS_BUCKET)
      .upload(storagePath, params.pdfBuffer, {
        contentType: SCHEDULED_REPORT_ARTIFACT_MIME_TYPE,
        upsert: false,
      });

    if (error) {
      const existingBuffer = await loadExistingSupabaseArtifact(storagePath);
      if (existingBuffer) {
        return {
          ...buildMetadata(existingBuffer),
          artifactFileUrl: getSupabaseStorageReference(DOCUMENTS_BUCKET, storagePath),
          storedPdfBuffer: existingBuffer,
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
      ...buildMetadata(params.pdfBuffer),
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
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST') {
      const existingBuffer = await loadExistingLocalArtifact(filePath);
      if (!existingBuffer) {
        throw error;
      }

      return {
        ...buildMetadata(existingBuffer),
        artifactFileUrl: getExpectedLocalArtifactPath(
          params.projectId,
          params.scheduleId,
          params.runId,
        ),
        storedPdfBuffer: existingBuffer,
      };
    }

    throw error;
  }

  return {
    ...buildMetadata(params.pdfBuffer),
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

  setPrivateArtifactDownloadHeaders(res);
  res.setHeader('Content-Disposition', buildAttachmentContentDisposition(run.artifactFilename));
  res.setHeader('Content-Type', run.artifactMimeType || SCHEDULED_REPORT_ARTIFACT_MIME_TYPE);
  res.setHeader('Content-Length', String(buffer.length));
  res.send(buffer);
}
