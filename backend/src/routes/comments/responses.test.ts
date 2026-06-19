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
    const comments = [
      {
        id: 'comment-1',
        content: 'Looks good',
        attachments: [
          {
            id: 'attachment-1',
            filename: 'photo.jpg',
            fileUrl: 'supabase://documents/comments/project/photo.jpg',
          },
        ],
        replies: [
          {
            id: 'reply-1',
            content: 'Reply',
            attachments: [
              {
                id: 'attachment-2',
                filename: 'reply-photo.jpg',
                fileUrl:
                  'https://storage.example/object/public/documents/comments/project/reply-photo.jpg',
              },
            ],
          },
        ],
      },
    ];

    expect(buildCommentListResponse(comments, 26, 2, 25)).toEqual({
      comments: [
        {
          id: 'comment-1',
          content: 'Looks good',
          attachments: [
            {
              id: 'attachment-1',
              filename: 'photo.jpg',
              downloadUrl: '/api/comments/attachments/attachment-1/download',
            },
          ],
          replies: [
            {
              id: 'reply-1',
              content: 'Reply',
              attachments: [
                {
                  id: 'attachment-2',
                  filename: 'reply-photo.jpg',
                  downloadUrl: '/api/comments/attachments/attachment-2/download',
                },
              ],
            },
          ],
        },
      ],
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
    const comment = {
      id: 'comment-1',
      content: 'Updated',
      attachments: [
        {
          id: 'attachment-1',
          filename: 'photo.jpg',
          fileUrl: 'https://storage.example/object/public/documents/comments/project/photo.jpg',
        },
      ],
    };

    expect(buildCommentMutationResponse(comment)).toEqual({
      comment: {
        id: 'comment-1',
        content: 'Updated',
        attachments: [
          {
            id: 'attachment-1',
            filename: 'photo.jpg',
            downloadUrl: '/api/comments/attachments/attachment-1/download',
          },
        ],
      },
    });
  });

  it('preserves delete success response', () => {
    expect(buildCommentSuccessResponse()).toEqual({ success: true });
  });

  it('preserves attachment append response envelope', () => {
    const attachments = [
      {
        id: 'attachment-1',
        filename: 'photo.jpg',
        fileUrl: 'https://storage.example/object/public/documents/comments/project/photo.jpg',
      },
    ];

    expect(buildCommentAttachmentsCreatedResponse(2, attachments)).toEqual({
      count: 2,
      attachments: [
        {
          id: 'attachment-1',
          filename: 'photo.jpg',
          downloadUrl: '/api/comments/attachments/attachment-1/download',
        },
      ],
    });
  });
});
