import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', () => ({
  DOCUMENTS_BUCKET: 'documents',
  getSupabaseClient: vi.fn(),
  getSupabasePublicUrl: vi.fn(),
  getSupabaseStoragePath: vi.fn(),
  isSupabaseConfigured: vi.fn(),
}));

import * as supabaseLib from '../../lib/supabase.js';
import { sendCommentAttachmentFile } from './attachmentStorage.js';

const mockGetSupabaseClient = vi.mocked(supabaseLib.getSupabaseClient);
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

  it('streams Supabase comment attachments instead of redirecting to storage', async () => {
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
        fileUrl:
          'https://siteproof-test.supabase.co/storage/v1/object/public/documents/comments/project-1/evidence.png',
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
});
