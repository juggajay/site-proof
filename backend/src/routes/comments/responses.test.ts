import { describe, expect, it } from 'vitest';

import {
  buildCommentAttachmentsCreatedResponse,
  buildCommentListResponse,
  buildCommentMutationResponse,
  buildCommentSuccessResponse,
  buildUploadedCommentAttachmentsResponse,
} from './responses.js';

describe('comment response helpers', () => {
  it('preserves comment list pagination envelope', () => {
    const comments = [{ id: 'comment-1', content: 'Looks good' }];

    expect(buildCommentListResponse(comments, 26, 2, 25)).toEqual({
      comments,
      pagination: {
        page: 2,
        limit: 25,
        total: 26,
        totalPages: 2,
        hasNextPage: false,
        hasPrevPage: true,
      },
    });
  });

  it('preserves uploaded attachment response envelope', () => {
    const attachments = [{ filename: 'photo.jpg', fileUrl: '/uploads/photo.jpg' }];

    expect(buildUploadedCommentAttachmentsResponse(attachments)).toEqual({ attachments });
  });

  it('preserves create and update comment envelopes', () => {
    const comment = { id: 'comment-1', content: 'Updated' };

    expect(buildCommentMutationResponse(comment)).toEqual({ comment });
  });

  it('preserves delete success response', () => {
    expect(buildCommentSuccessResponse()).toEqual({ success: true });
  });

  it('preserves attachment append response envelope', () => {
    const attachments = [{ id: 'attachment-1', filename: 'photo.jpg' }];

    expect(buildCommentAttachmentsCreatedResponse(2, attachments)).toEqual({
      count: 2,
      attachments,
    });
  });
});
