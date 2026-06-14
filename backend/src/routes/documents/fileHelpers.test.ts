import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', () => ({
  DOCUMENTS_BUCKET: 'documents',
  getSupabaseClient: vi.fn(),
  getSupabaseStoragePath: vi.fn(),
  isSupabaseConfigured: vi.fn(),
}));

import * as supabaseLib from '../../lib/supabase.js';
import { sendDocumentFile } from './fileHelpers.js';

const mockGetSupabaseClient = vi.mocked(supabaseLib.getSupabaseClient);
const mockGetSupabaseStoragePath = vi.mocked(supabaseLib.getSupabaseStoragePath);
const mockIsSupabaseConfigured = vi.mocked(supabaseLib.isSupabaseConfigured);

function makeResponse() {
  return {
    redirect: vi.fn(),
    send: vi.fn(),
    sendFile: vi.fn(),
    setHeader: vi.fn(),
  } as unknown as Response & {
    redirect: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    sendFile: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
  };
}

describe('sendDocumentFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('streams Supabase attachment downloads instead of redirecting to storage', async () => {
    const storagePath = 'project-1/evidence.pdf';
    const download = vi.fn().mockResolvedValue({
      data: new Blob([Buffer.from('document bytes')], { type: 'application/pdf' }),
      error: null,
    });
    const from = vi.fn(() => ({ download }));
    const res = makeResponse();

    mockGetSupabaseStoragePath.mockReturnValue(storagePath);
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetSupabaseClient.mockReturnValue({
      storage: { from },
    } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

    await sendDocumentFile(
      {
        fileUrl:
          'https://siteproof-test.supabase.co/storage/v1/object/public/documents/project-1/evidence.pdf',
        filename: 'evidence.pdf',
        mimeType: 'application/pdf',
      },
      res,
      'attachment',
    );

    expect(res.redirect).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith('documents');
    expect(download).toHaveBeenCalledWith(storagePath);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="evidence.pdf"',
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.send.mock.calls[0][0].toString()).toBe('document bytes');
  });
});
