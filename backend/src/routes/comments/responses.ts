import { getPaginationMeta } from '../../lib/pagination.js';
import { serializeUserAvatar } from '../../lib/avatarUrls.js';

type JsonRecord = Record<string, unknown>;

function buildCommentAttachmentDownloadUrl(attachmentId: string): string {
  return `/api/comments/attachments/${encodeURIComponent(attachmentId)}/download`;
}

function stripCommentAttachmentFileUrl(attachment: unknown): unknown {
  if (!attachment || typeof attachment !== 'object') {
    return attachment;
  }

  const { fileUrl: _fileUrl, ...safeAttachment } = attachment as JsonRecord;
  const attachmentId = typeof safeAttachment.id === 'string' ? safeAttachment.id : null;

  if (attachmentId) {
    return {
      ...safeAttachment,
      downloadUrl: buildCommentAttachmentDownloadUrl(attachmentId),
    };
  }

  return safeAttachment;
}

function stripCommentAttachmentFileUrls(comment: unknown): unknown {
  if (!comment || typeof comment !== 'object') {
    return comment;
  }

  const shapedComment: JsonRecord = { ...(comment as JsonRecord) };
  if (
    shapedComment.author &&
    typeof shapedComment.author === 'object' &&
    typeof (shapedComment.author as JsonRecord).id === 'string'
  ) {
    shapedComment.author = serializeUserAvatar(
      shapedComment.author as { id: string; avatarUrl?: string | null },
    );
  }

  if (Array.isArray(shapedComment.attachments)) {
    shapedComment.attachments = shapedComment.attachments.map(stripCommentAttachmentFileUrl);
  }

  if (Array.isArray(shapedComment.replies)) {
    shapedComment.replies = shapedComment.replies.map(stripCommentAttachmentFileUrls);
  }

  return shapedComment;
}

export function buildCommentListResponse(
  comments: unknown[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    comments: comments.map(stripCommentAttachmentFileUrls),
    pagination: getPaginationMeta(total, page, limit),
  };
}

export function buildCommentMutationResponse(comment: unknown) {
  return { comment: stripCommentAttachmentFileUrls(comment) };
}

export function buildCommentSuccessResponse() {
  return { success: true };
}

export function buildCommentAttachmentsCreatedResponse(count: number, attachments: unknown[]) {
  return { count, attachments: attachments.map(stripCommentAttachmentFileUrl) };
}
