import { describe, expect, it } from 'vitest';
import {
  buildItpCompletionAttachmentDeletedResponse,
  buildItpCompletionAttachmentResponse,
  buildItpCompletionAttachmentsResponse,
  buildItpCompletionResponse,
  buildItpCompletionResultResponse,
  buildItpCompletionStatusResponse,
  buildPendingItpVerificationsResponse,
} from './completionResponses.js';

describe('completionResponses', () => {
  it('builds the completion result response with optional side effects', () => {
    const completion = { id: 'completion-1', status: 'completed' };
    const ncr = { id: 'ncr-1' };
    const witnessPointNotification = { notificationsSent: 2 };
    const subbieCompletionNotification = { notificationsSent: 1 };

    expect(
      buildItpCompletionResultResponse(
        completion,
        ncr,
        witnessPointNotification,
        subbieCompletionNotification,
      ),
    ).toEqual({
      completion,
      ncr,
      witnessPointNotification,
      subbieCompletionNotification,
    });
  });

  it('builds the shared completion envelope', () => {
    const completion = { id: 'completion-1' };

    expect(buildItpCompletionResponse(completion)).toEqual({ completion });
  });

  it('strips raw attachment document file URLs from completion envelopes', () => {
    const completion = {
      id: 'completion-1',
      attachments: [
        {
          id: 'attachment-1',
          document: {
            id: 'document-1',
            filename: 'photo.jpg',
            fileUrl: 'supabase://documents/project/photo.jpg',
          },
        },
      ],
    };

    expect(buildItpCompletionResponse(completion)).toEqual({
      completion: {
        id: 'completion-1',
        attachments: [
          {
            id: 'attachment-1',
            document: { id: 'document-1', filename: 'photo.jpg' },
          },
        ],
      },
    });
    expect(completion.attachments[0].document.fileUrl).toBe(
      'supabase://documents/project/photo.jpg',
    );
  });

  it('builds the completion status response with derived completion flags', () => {
    const completion = { id: 'completion-1', status: 'not_applicable' };

    expect(buildItpCompletionStatusResponse(completion, true)).toEqual({
      completion: {
        id: 'completion-1',
        status: 'not_applicable',
        isCompleted: true,
      },
    });
  });

  it('builds the pending verification response with derived count', () => {
    const pendingVerifications = [
      {
        id: 'completion-1',
        attachments: [
          {
            id: 'attachment-1',
            document: {
              id: 'document-1',
              filename: 'pending.jpg',
              fileUrl: 'https://storage.example.com/public/pending.jpg',
            },
          },
        ],
      },
      { id: 'completion-2' },
    ];

    expect(buildPendingItpVerificationsResponse(pendingVerifications)).toEqual({
      pendingVerifications: [
        {
          id: 'completion-1',
          attachments: [
            {
              id: 'attachment-1',
              document: { id: 'document-1', filename: 'pending.jpg' },
            },
          ],
        },
        { id: 'completion-2' },
      ],
      count: 2,
    });
  });

  it('maps a single completion attachment response', () => {
    const document = {
      id: 'document-1',
      filename: 'photo.jpg',
      fileUrl: 'supabase://documents/project/photo.jpg',
    };
    const attachment = { id: 'attachment-1', documentId: 'document-1', document };

    expect(buildItpCompletionAttachmentResponse(attachment)).toEqual({
      attachment: {
        id: 'attachment-1',
        documentId: 'document-1',
        document: { id: 'document-1', filename: 'photo.jpg' },
      },
    });
    expect(document.fileUrl).toBe('supabase://documents/project/photo.jpg');
  });

  it('maps the completion attachment list response', () => {
    const attachments = [
      {
        id: 'attachment-1',
        documentId: 'document-1',
        document: { id: 'document-1', fileUrl: 'supabase://documents/project/one.jpg' },
      },
      {
        id: 'attachment-2',
        documentId: 'document-2',
        document: { id: 'document-2', fileUrl: 'supabase://documents/project/two.jpg' },
      },
    ];

    expect(buildItpCompletionAttachmentsResponse(attachments)).toEqual({
      attachments: [
        { id: 'attachment-1', documentId: 'document-1', document: { id: 'document-1' } },
        { id: 'attachment-2', documentId: 'document-2', document: { id: 'document-2' } },
      ],
    });
  });

  it('builds the attachment delete success response', () => {
    expect(buildItpCompletionAttachmentDeletedResponse()).toEqual({ success: true });
  });
});
