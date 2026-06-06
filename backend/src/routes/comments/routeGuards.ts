import { AppError } from '../../lib/AppError.js';
import { assertUploadedFileMatchesDeclaredType } from '../../lib/imageValidation.js';
import { logWarn } from '../../lib/serverLogger.js';
import {
  COMMENT_ATTACHMENT_MAX_FILES,
  removeStoredCommentAttachment,
} from './attachmentStorage.js';

export function requireCommentUserId(userId: string | null | undefined): string {
  if (!userId) {
    throw AppError.unauthorized();
  }
  return userId;
}

export function requireCommentAuthor(
  authorId: string | null,
  userId: string,
  message: string,
): void {
  if (authorId !== userId) {
    throw AppError.forbidden(message);
  }
}

export function assertCommentAttachmentLimit(attachments: unknown): void {
  if (Array.isArray(attachments) && attachments.length > COMMENT_ATTACHMENT_MAX_FILES) {
    throw AppError.badRequest(
      `attachments cannot include more than ${COMMENT_ATTACHMENT_MAX_FILES} files`,
    );
  }
}

export function requireCommentAttachmentArray(attachments: unknown): unknown[] {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    throw AppError.badRequest('attachments array is required');
  }

  assertCommentAttachmentLimit(attachments);
  return attachments;
}

export function validateUploadedCommentFiles(
  files: Express.Multer.File[] | undefined,
): Express.Multer.File[] | undefined {
  for (const file of files || []) {
    assertUploadedFileMatchesDeclaredType(file);
  }

  return files;
}

export async function cleanupDeletedCommentAttachmentFiles(
  attachments: Array<{ fileUrl: string | null }>,
  projectId: string,
): Promise<void> {
  await Promise.all(
    attachments.map(async (attachment) => {
      try {
        if (attachment.fileUrl) {
          await removeStoredCommentAttachment(attachment.fileUrl, projectId);
        }
      } catch (cleanupError) {
        logWarn('Failed to remove comment attachment file after comment delete:', cleanupError);
      }
    }),
  );
}

export async function cleanupDeletedCommentAttachmentFile(
  fileUrl: string | null,
  projectId: string,
): Promise<void> {
  try {
    if (fileUrl) {
      await removeStoredCommentAttachment(fileUrl, projectId);
    }
  } catch (cleanupError) {
    logWarn('Failed to remove comment attachment file after attachment delete:', cleanupError);
  }
}
