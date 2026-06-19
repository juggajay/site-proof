import type { Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { AppError } from '../../lib/AppError.js';
import {
  DOCUMENTS_BUCKET,
  getSupabaseClient,
  getSupabaseStorageReference,
  getSupabaseStoragePath,
  isSupabaseConfigured,
} from '../../lib/supabase.js';
import { logError, logWarn } from '../../lib/serverLogger.js';
import { ensureUploadSubdirectoryAsync, resolveUploadPath } from '../../lib/uploadPaths.js';

const COMMENT_ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024;
export const COMMENT_ATTACHMENT_MAX_FILES = 5;
const COMMENT_ATTACHMENT_FILENAME_MAX_LENGTH = 180;

const allowedAttachmentTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

export interface AttachmentInput {
  filename: string;
  fileUrl: string;
  fileSize?: number | null;
  mimeType?: string | null;
}

function sanitizeFilename(filename: string): string {
  const basename = path.basename(filename.replace(/\\/g, '/'));
  const sanitized = basename
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 || '<>:"/\\|?*'.includes(char) ? '_' : char;
    })
    .join('')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, COMMENT_ATTACHMENT_FILENAME_MAX_LENGTH);

  return sanitized || 'attachment';
}

function getSafeAttachmentMimeType(mimeType: string | null | undefined): string {
  const normalizedMimeType = mimeType?.toLowerCase();
  return normalizedMimeType && allowedAttachmentTypes.includes(normalizedMimeType)
    ? normalizedMimeType
    : 'application/octet-stream';
}

export const commentAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: COMMENT_ATTACHMENT_MAX_SIZE,
    files: COMMENT_ATTACHMENT_MAX_FILES,
  },
  fileFilter: (_req, file, cb) => {
    if (allowedAttachmentTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error('Invalid file type'));
  },
});

async function uploadCommentAttachmentToSupabase(
  file: Express.Multer.File,
  projectId: string,
): Promise<string> {
  const storagePath = `${getCommentAttachmentStoragePrefix(projectId)}${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(file.originalname)}`;

  const { error } = await getSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    logError('Supabase comment attachment upload failed:', error);
    throw AppError.internal('Failed to upload attachment');
  }

  return getSupabaseStorageReference(DOCUMENTS_BUCKET, storagePath);
}

async function uploadCommentAttachmentToDisk(file: Express.Multer.File): Promise<string> {
  const filename = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(file.originalname)}`;
  const uploadDirectory = await ensureUploadSubdirectoryAsync('comments');
  await fs.promises.writeFile(path.join(uploadDirectory, filename), file.buffer, { flag: 'wx' });
  return `/uploads/comments/${filename}`;
}

function getCommentAttachmentStoragePrefix(projectId: string): string {
  return `comments/${projectId}/`;
}

async function deleteLocalCommentAttachmentFile(fileUrl: string): Promise<void> {
  if (!fileUrl.startsWith('/uploads/comments/')) {
    return;
  }

  let filePath: string;
  try {
    filePath = resolveUploadPath(fileUrl, 'comments');
  } catch {
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logError('Failed to delete comment attachment file:', error);
    }
  }
}

function getOwnedCommentAttachmentStoragePath(fileUrl: string, projectId: string): string | null {
  return getSupabaseStoragePath(fileUrl, {
    bucket: DOCUMENTS_BUCKET,
    expectedPrefix: getCommentAttachmentStoragePrefix(projectId),
  });
}

async function deleteCommentAttachmentFromSupabase(
  fileUrl: string,
  projectId: string,
): Promise<void> {
  const storagePath = getOwnedCommentAttachmentStoragePath(fileUrl, projectId);
  if (!storagePath) {
    return;
  }

  const { error } = await getSupabaseClient().storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
  if (error) {
    logError('Supabase comment attachment delete failed:', error);
  }
}

// Routes a comment-attachment fileUrl to the right cleanup mechanism.
// Supabase URLs that resolve inside the configured documents bucket get a
// best-effort `remove` call; everything else falls back to the legacy
// local-disk cleanup. Throws on infrastructure errors (e.g. mocked
// `getSupabaseClient` blowing up); call sites must wrap in try/catch and
// log because storage cleanup is best-effort and the DB row is the source
// of truth.
export async function removeStoredCommentAttachment(
  fileUrl: string,
  projectId: string,
): Promise<void> {
  if (isSupabaseConfigured() && getOwnedCommentAttachmentStoragePath(fileUrl, projectId) !== null) {
    await deleteCommentAttachmentFromSupabase(fileUrl, projectId);
    return;
  }
  await deleteLocalCommentAttachmentFile(fileUrl);
}

function isExternalAttachmentUrl(fileUrl: string): boolean {
  return /^https?:\/\//i.test(fileUrl);
}

function getSafeAttachmentFilename(filename: string): string {
  return sanitizeFilename(filename);
}

export function sendCommentAttachmentFile(
  attachment: { fileUrl: string; filename: string; mimeType: string | null },
  projectId: string,
  res: Pick<Response, 'setHeader' | 'send' | 'sendFile'>,
): Promise<void> | void {
  if (getOwnedCommentAttachmentStoragePath(attachment.fileUrl, projectId)) {
    return sendSupabaseCommentAttachmentFile(attachment, projectId, res);
  }

  if (isExternalAttachmentUrl(attachment.fileUrl)) {
    throw AppError.notFound('Attachment file');
  }

  let filePath: string;
  try {
    filePath = resolveUploadPath(attachment.fileUrl, 'comments');
  } catch {
    throw AppError.notFound('Attachment file');
  }

  if (!fs.existsSync(filePath)) {
    throw AppError.notFound('Attachment file');
  }

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${getSafeAttachmentFilename(attachment.filename)}"`,
  );
  res.setHeader('Content-Type', getSafeAttachmentMimeType(attachment.mimeType));
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(filePath);
}

async function sendSupabaseCommentAttachmentFile(
  attachment: { fileUrl: string; filename: string; mimeType: string | null },
  projectId: string,
  res: Pick<Response, 'setHeader' | 'send'>,
): Promise<void> {
  const storagePath = getOwnedCommentAttachmentStoragePath(attachment.fileUrl, projectId);
  if (!storagePath || !isSupabaseConfigured()) {
    throw AppError.notFound('Attachment file');
  }

  const { data, error } = await getSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .download(storagePath);

  if (error || !data) {
    logWarn('Supabase comment attachment download failed:', error);
    throw AppError.notFound('Attachment file');
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${getSafeAttachmentFilename(attachment.filename)}"`,
  );
  res.setHeader('Content-Type', getSafeAttachmentMimeType(attachment.mimeType));
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(buffer);
}

export async function cleanupStoredCommentAttachments(
  attachments: Pick<AttachmentInput, 'fileUrl'>[],
  projectId: string,
  logMessage: string,
): Promise<void> {
  await Promise.all(
    attachments.map(async (attachment) => {
      try {
        await removeStoredCommentAttachment(attachment.fileUrl, projectId);
      } catch (cleanupError) {
        logWarn(logMessage, cleanupError);
      }
    }),
  );
}

export async function storeCommentAttachmentFiles(
  files: Express.Multer.File[],
  projectId: string,
): Promise<AttachmentInput[]> {
  const attachments: AttachmentInput[] = [];

  try {
    for (const file of files) {
      const fileUrl = isSupabaseConfigured()
        ? await uploadCommentAttachmentToSupabase(file, projectId)
        : await uploadCommentAttachmentToDisk(file);

      attachments.push({
        filename: sanitizeFilename(file.originalname),
        fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
      });
    }
  } catch (error) {
    await cleanupStoredCommentAttachments(
      attachments,
      projectId,
      'Failed to remove comment attachment after upload rollback:',
    );
    throw error;
  }

  return attachments;
}
