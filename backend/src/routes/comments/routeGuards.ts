import { AppError } from '../../lib/AppError.js';
import { assertUploadedFileMatchesDeclaredType } from '../../lib/imageValidation.js';
import { logWarn } from '../../lib/serverLogger.js';
import { removeStoredCommentAttachment } from './attachmentStorage.js';

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
