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

  it.each([
    [
      'public URL',
      'https://siteproof-test.supabase.co/storage/v1/object/public/documents/project-1/evidence.pdf',
    ],
    ['private storage reference', 'supabase://documents/project-1/evidence.pdf'],
  ])('streams Supabase attachment downloads from a %s', async (_label, fileUrl) => {
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
        fileUrl,
        filename: 'evidence.pdf',
        mimeType: 'application/pdf',
        projectId: 'project-1',
        documentType: 'photo',
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

  it('does not stream Supabase objects outside the document project scope', async () => {
    const res = makeResponse();

    mockGetSupabaseStoragePath.mockReturnValue(null);
    mockIsSupabaseConfigured.mockReturnValue(true);

    await expect(
      sendDocumentFile(
        {
          fileUrl:
            'https://siteproof-test.supabase.co/storage/v1/object/public/documents/other-project/evidence.pdf',
          filename: 'evidence.pdf',
          mimeType: 'application/pdf',
          projectId: 'project-1',
          documentType: 'photo',
        },
        res,
        'attachment',
      ),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(mockGetSupabaseClient).not.toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  describe('thumbnail variant', () => {
    const fileUrl = 'supabase://documents/project-1/photo.jpg';
    const storagePath = 'project-1/photo.jpg';

    function mockDownload(impl: (key: string) => { data: Blob | null; error: unknown }) {
      const download = vi.fn(async (key: string) => impl(key));
      const from = vi.fn(() => ({ download }));
      mockGetSupabaseStoragePath.mockReturnValue(storagePath);
      mockIsSupabaseConfigured.mockReturnValue(true);
      mockGetSupabaseClient.mockReturnValue({
        storage: { from },
      } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);
      return { download };
    }

    it('serves the thumbnail object as webp when it exists', async () => {
      const res = makeResponse();
      const { download } = mockDownload((key) =>
        key === `${storagePath}.thumb.webp`
          ? { data: new Blob([Buffer.from('thumb bytes')]), error: null }
          : { data: new Blob([Buffer.from('original bytes')]), error: null },
      );

      await sendDocumentFile(
        {
          fileUrl,
          filename: 'photo.jpg',
          mimeType: 'image/jpeg',
          projectId: 'project-1',
          documentType: 'photo',
        },
        res,
        'inline',
        'thumb',
      );

      expect(download).toHaveBeenCalledWith(`${storagePath}.thumb.webp`);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/webp');
      expect(res.send.mock.calls[0][0].toString()).toBe('thumb bytes');
    });

    it('falls back to the original when the thumbnail is absent', async () => {
      const res = makeResponse();
      const { download } = mockDownload((key) =>
        key === `${storagePath}.thumb.webp`
          ? { data: null, error: { message: 'not found' } }
          : { data: new Blob([Buffer.from('original bytes')]), error: null },
      );

      await sendDocumentFile(
        {
          fileUrl,
          filename: 'photo.jpg',
          mimeType: 'image/jpeg',
          projectId: 'project-1',
          documentType: 'photo',
        },
        res,
        'inline',
        'thumb',
      );

      expect(download).toHaveBeenCalledWith(`${storagePath}.thumb.webp`);
      expect(download).toHaveBeenCalledWith(storagePath);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(res.send.mock.calls[0][0].toString()).toBe('original bytes');
    });

    it('rejects an out-of-scope document before any thumbnail lookup', async () => {
      const res = makeResponse();
      mockGetSupabaseStoragePath.mockReturnValue(null);
      mockIsSupabaseConfigured.mockReturnValue(true);

      await expect(
        sendDocumentFile(
          {
            fileUrl:
              'https://siteproof-test.supabase.co/storage/v1/object/public/documents/other-project/photo.jpg',
            filename: 'photo.jpg',
            mimeType: 'image/jpeg',
            projectId: 'project-1',
            documentType: 'photo',
          },
          res,
          'inline',
          'thumb',
        ),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(mockGetSupabaseClient).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });
  });
});
