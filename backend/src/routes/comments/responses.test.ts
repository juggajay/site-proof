import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/supabase.js')>('../../lib/supabase.js');
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => true),
  };
});

import {
  buildCommentAttachmentsCreatedResponse,
  buildCommentListResponse,
  buildCommentMutationResponse,
  buildCommentSuccessResponse,
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

  it('serializes comment author Supabase avatars as signed backend URLs', () => {
    const response = buildCommentMutationResponse({
      id: 'comment-1',
      content: 'Updated',
      author: {
        id: 'user-1',
        email: 'user@example.com',
        fullName: 'User One',
        avatarUrl: 'supabase://documents/avatars/user-1/avatar-user-1.png',
      },
      attachments: [],
    }) as {
      comment: { author: { avatarUrl: string } };
    };

    expect(response.comment.author.avatarUrl).toContain('/api/auth/avatar/file/user-1?token=');
    expect(response.comment.author.avatarUrl).not.toContain('supabase://');
    expect(response.comment.author.avatarUrl).not.toContain('/storage/v1/object/public/');
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
