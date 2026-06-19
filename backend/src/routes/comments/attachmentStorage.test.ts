import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', () => ({
  DOCUMENTS_BUCKET: 'documents',
  getSupabaseClient: vi.fn(),
  getSupabaseStorageReference: vi.fn(
    (bucket: string, storagePath: string) => `supabase://${bucket}/${storagePath}`,
  ),
  getSupabaseStoragePath: vi.fn(),
  isSupabaseConfigured: vi.fn(),
}));

import * as supabaseLib from '../../lib/supabase.js';
import {
  getValidAttachments,
  sendCommentAttachmentFile,
  storeCommentAttachmentFiles,
} from './attachmentStorage.js';

const mockGetSupabaseClient = vi.mocked(supabaseLib.getSupabaseClient);
const mockGetSupabaseStorageReference = vi.mocked(supabaseLib.getSupabaseStorageReference);
const mockGetSupabaseStoragePath = vi.mocked(supabaseLib.getSupabaseStoragePath);
const mockIsSupabaseConfigured = vi.mocked(supabaseLib.isSupabaseConfigured);

function makeResponse() {
  return {
    redirect: vi.fn(),
    send: vi.fn(),
    sendFile: vi.fn(),
    setHeader: vi.fn(),
  } as unknown as Pick<Response, 'redirect' | 'send' | 'sendFile' | 'setHeader'> & {
    redirect: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    sendFile: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
  };
}

describe('sendCommentAttachmentFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [
      'public URL',
      'https://siteproof-test.supabase.co/storage/v1/object/public/documents/comments/project-1/evidence.png',
    ],
    ['private storage reference', 'supabase://documents/comments/project-1/evidence.png'],
  ])('streams Supabase comment attachments from a %s', async (_label, fileUrl) => {
    const storagePath = 'comments/project-1/evidence.png';
    const download = vi.fn().mockResolvedValue({
      data: new Blob([Buffer.from('comment evidence')], { type: 'image/png' }),
      error: null,
    });
    const from = vi.fn(() => ({ download }));
    const res = makeResponse();

    mockGetSupabaseStoragePath.mockReturnValue(storagePath);
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetSupabaseClient.mockReturnValue({
      storage: { from },
    } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

    await sendCommentAttachmentFile(
      {
        fileUrl,
        filename: 'evidence.png',
        mimeType: 'image/png',
      },
      'project-1',
      res,
    );

    expect(res.redirect).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith('documents');
    expect(download).toHaveBeenCalledWith(storagePath);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="evidence.png"',
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.send.mock.calls[0][0].toString()).toBe('comment evidence');
  });

  it('accepts owned private storage references when validating supplied attachments', () => {
    mockGetSupabaseStoragePath.mockImplementation((fileUrl) =>
      fileUrl === 'supabase://documents/comments/project-1/evidence.png'
        ? 'comments/project-1/evidence.png'
        : null,
    );
    mockIsSupabaseConfigured.mockReturnValue(true);

    expect(
      getValidAttachments(
        [
          {
            filename: 'evidence.png',
            fileUrl: 'supabase://documents/comments/project-1/evidence.png',
            fileSize: 10,
            mimeType: 'image/png',
          },
        ],
        'project-1',
      ),
    ).toEqual([
      {
        filename: 'evidence.png',
        fileUrl: 'supabase://documents/comments/project-1/evidence.png',
        fileSize: 10,
        mimeType: 'image/png',
      },
    ]);
  });
});

describe('storeCommentAttachmentFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores Supabase uploads as private storage references', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upload }));

    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetSupabaseClient.mockReturnValue({
      storage: { from },
    } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

    const attachments = await storeCommentAttachmentFiles(
      [
        {
          originalname: 'evidence.png',
          buffer: Buffer.from('comment evidence'),
          mimetype: 'image/png',
          size: 16,
        } as Express.Multer.File,
      ],
      'project-1',
    );

    expect(from).toHaveBeenCalledWith('documents');
    const [storagePath, body, uploadOptions] = upload.mock.calls[0];
    expect(storagePath).toMatch(/^comments\/project-1\/\d+-[0-9a-f-]+-evidence\.png$/);
    expect(body.toString()).toBe('comment evidence');
    expect(uploadOptions).toEqual({ contentType: 'image/png', upsert: false });
    expect(mockGetSupabaseStorageReference).toHaveBeenCalledWith('documents', storagePath);
    expect(attachments).toEqual([
      {
        filename: 'evidence.png',
        fileUrl: `supabase://documents/${storagePath}`,
        fileSize: 16,
        mimeType: 'image/png',
      },
    ]);
    expect(attachments[0]?.fileUrl).not.toContain('/storage/v1/object/public/');
  });
});
