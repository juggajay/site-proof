import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.hoisted(() => vi.fn());
const apiUrlMock = vi.hoisted(() => vi.fn((path: string) => `http://localhost:3001${path}`));

vi.mock('./api', () => ({
  apiFetch: apiFetchMock,
  apiUrl: apiUrlMock,
}));

import {
  clearDocumentAccessCache,
  getDocumentAccessUrl,
  openDocumentAccessUrl,
} from './documentAccess';

describe('document access URLs', () => {
  beforeEach(() => {
    clearDocumentAccessCache();
    apiFetchMock.mockReset();
    apiUrlMock.mockClear();
    vi.restoreAllMocks();
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

  it('pre-opens a blank tab before awaiting the signed URL, then navigates it', async () => {
    let resolveSignedUrl: ((value: { signedUrl: string; expiresAt: string }) => void) | undefined;
    const signedUrlPromise = new Promise<{ signedUrl: string; expiresAt: string }>((resolve) => {
      resolveSignedUrl = resolve;
    });
    apiFetchMock.mockReturnValue(signedUrlPromise);

    const popup = {
      closed: false,
      close: vi.fn(),
      location: { href: 'about:blank' },
      opener: window,
    } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popup);

    const openPromise = openDocumentAccessUrl('document-1');

    expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank');
    expect(apiFetchMock).toHaveBeenCalledWith('/api/documents/document-1/signed-url', {
      method: 'POST',
      body: JSON.stringify({ expiresInMinutes: 15, disposition: 'attachment' }),
    });
    expect((popup.location as Location).href).toBe('about:blank');

    resolveSignedUrl?.({
      signedUrl: '/api/documents/download/document-1?token=fixture',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await openPromise;

    expect((popup.location as Location).href).toBe(
      '/api/documents/download/document-1?token=fixture',
    );
    expect(popup.opener).toBeNull();
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('passes inline disposition when opening a document for preview', async () => {
    apiFetchMock.mockResolvedValue({
      signedUrl: '/api/documents/download/document-1?token=inline-fixture',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const popup = {
      closed: false,
      close: vi.fn(),
      location: { href: 'about:blank' },
      opener: window,
    } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);

    await openDocumentAccessUrl('document-1', null, { disposition: 'inline' });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/documents/document-1/signed-url', {
      method: 'POST',
      body: JSON.stringify({ expiresInMinutes: 15, disposition: 'inline' }),
    });
    expect((popup.location as Location).href).toBe(
      '/api/documents/download/document-1?token=inline-fixture',
    );
  });

  it('closes the pre-opened tab and rethrows when signed URL minting fails', async () => {
    const error = new Error('signed URL unavailable');
    apiFetchMock.mockRejectedValue(error);
    const popup = {
      closed: false,
      close: vi.fn(),
      location: { href: 'about:blank' },
      opener: window,
    } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);

    await expect(openDocumentAccessUrl('document-1')).rejects.toThrow(error);

    expect(popup.close).toHaveBeenCalled();
  });

  it('falls back to opening the signed URL directly when the blank tab is blocked', async () => {
    apiFetchMock.mockResolvedValue({
      signedUrl: '/api/documents/download/document-1?token=fixture',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const fallbackWindow = {
      closed: false,
      close: vi.fn(),
      location: { href: 'about:blank' },
      opener: window,
    } as unknown as Window;
    const openSpy = vi
      .spyOn(window, 'open')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(fallbackWindow);

    await openDocumentAccessUrl('document-1');

    expect(openSpy).toHaveBeenNthCalledWith(1, 'about:blank', '_blank');
    expect(openSpy).toHaveBeenNthCalledWith(
      2,
      '/api/documents/download/document-1?token=fixture',
      '_blank',
      'noopener,noreferrer',
    );
    expect(fallbackWindow.opener).toBeNull();
  });

  it('rejects when the browser blocks both document window attempts', async () => {
    apiFetchMock.mockResolvedValue({
      signedUrl: '/api/documents/download/document-1?token=fixture',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    vi.spyOn(window, 'open').mockReturnValue(null);

    await expect(openDocumentAccessUrl('document-1')).rejects.toThrow(
      'Your browser blocked the document window',
    );
  });
});
