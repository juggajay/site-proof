import { getPaginationMeta } from '../../lib/pagination.js';

export function buildCommentListResponse(
  comments: unknown[],
  total: number,
  page: number,
  limit: number,
) {
  return { comments, pagination: getPaginationMeta(total, page, limit) };
}

export function buildUploadedCommentAttachmentsResponse(attachments: unknown[]) {
  return { attachments };
}

export function buildCommentMutationResponse(comment: unknown) {
  return { comment };
}

export function buildCommentSuccessResponse() {
  return { success: true };
}

export function buildCommentAttachmentsCreatedResponse(count: number, attachments: unknown[]) {
  return { count, attachments };
}
