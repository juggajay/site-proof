import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.hoisted(() => vi.fn());
const apiUrlMock = vi.hoisted(() => vi.fn((path: string) => `http://localhost:3001${path}`));

vi.mock('./api', () => ({
  apiFetch: apiFetchMock,
  apiUrl: apiUrlMock,
}));

import { clearDocumentAccessCache, getDocumentAccessUrl } from './documentAccess';

describe('document access URLs', () => {
  beforeEach(() => {
    clearDocumentAccessCache();
    apiFetchMock.mockReset();
    apiUrlMock.mockClear();
  });

  it('uses a backend signed URL instead of opening a Supabase storage reference directly', async () => {
    apiFetchMock.mockResolvedValue({
      signedUrl: '/api/documents/download/document-1?token=fixture',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const url = await getDocumentAccessUrl(
      'document-1',
      'supabase://documents/project-a/evidence.pdf',
    );

    expect(url).toBe('/api/documents/download/document-1?token=fixture');
    expect(apiFetchMock).toHaveBeenCalledWith('/api/documents/document-1/signed-url', {
      method: 'POST',
      body: JSON.stringify({ expiresInMinutes: 15, disposition: 'attachment' }),
    });
    expect(apiUrlMock).not.toHaveBeenCalled();
  });

  it('clears cached signed URLs for auth identity changes', async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        signedUrl: '/api/documents/download/document-1?token=first',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })
      .mockResolvedValueOnce({
        signedUrl: '/api/documents/download/document-1?token=second',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });

    await expect(getDocumentAccessUrl('document-1')).resolves.toContain('token=first');
    await expect(getDocumentAccessUrl('document-1')).resolves.toContain('token=first');
    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    clearDocumentAccessCache();

    await expect(getDocumentAccessUrl('document-1')).resolves.toContain('token=second');
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });
});
