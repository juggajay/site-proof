import { apiFetch, apiUrl } from './api';

type SignedUrlResponse = {
  signedUrl: string;
  expiresAt: string;
};

export type DocumentAccessDisposition = 'inline' | 'attachment';

export type DocumentAccessOptions = {
  expiresInMinutes?: number;
  disposition?: DocumentAccessDisposition;
};

export type DocumentAccessUrl = {
  url: string;
  expiresAt: number;
  refreshAt: number;
};

const signedUrlCache = new Map<string, DocumentAccessUrl>();
export const DOCUMENT_ACCESS_EXPIRY_SKEW_MS = 30_000;
const MIN_DOCUMENT_ACCESS_REFRESH_MS = 1_000;

export function rawFileUrl(fileUrl: string | null | undefined): string {
  if (!fileUrl) return '';
  if (/^https?:\/\//i.test(fileUrl)) {
    return fileUrl;
  }
  return apiUrl(fileUrl);
}

function getRefreshAt(expiresAt: number): number {
  if (!Number.isFinite(expiresAt)) return Number.POSITIVE_INFINITY;
  return Math.max(
    Date.now() + MIN_DOCUMENT_ACCESS_REFRESH_MS,
    expiresAt - DOCUMENT_ACCESS_EXPIRY_SKEW_MS,
  );
}

function getResponseExpiry(responseExpiresAt: string, expiresInMinutes: number): number {
  const parsed = Date.parse(responseExpiresAt);
  const fallback = Date.now() + expiresInMinutes * 60_000;
  return Number.isFinite(parsed) && parsed > Date.now() ? parsed : fallback;
}

function normalizeDocumentAccessOptions(
  options: number | DocumentAccessOptions = 15,
): Required<DocumentAccessOptions> {
  if (typeof options === 'number') {
    return {
      expiresInMinutes: options,
      disposition: 'attachment',
    };
  }

  return {
    expiresInMinutes: options.expiresInMinutes ?? 15,
    disposition: options.disposition ?? 'attachment',
  };
}

function getCacheKey(documentId: string, disposition: DocumentAccessDisposition): string {
  return `${documentId}:${disposition}`;
}

export function invalidateDocumentAccessUrl(documentId: string): void {
  signedUrlCache.delete(getCacheKey(documentId, 'attachment'));
  signedUrlCache.delete(getCacheKey(documentId, 'inline'));
}

export async function getDocumentAccess(
  documentId: string,
  fileUrl?: string | null,
  options: number | DocumentAccessOptions = 15,
): Promise<DocumentAccessUrl> {
  const { expiresInMinutes, disposition } = normalizeDocumentAccessOptions(options);

  if (!documentId) {
    return {
      url: rawFileUrl(fileUrl),
      expiresAt: Number.POSITIVE_INFINITY,
      refreshAt: Number.POSITIVE_INFINITY,
    };
  }

  const cacheKey = getCacheKey(documentId, disposition);
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.refreshAt > Date.now()) {
    return cached;
  }

  const response = await apiFetch<SignedUrlResponse>(
    `/api/documents/${encodeURIComponent(documentId)}/signed-url`,
    {
      method: 'POST',
      body: JSON.stringify({ expiresInMinutes, disposition }),
    },
  );

  const expiresAt = getResponseExpiry(response.expiresAt, expiresInMinutes);
  const access = {
    url: response.signedUrl,
    expiresAt,
    refreshAt: getRefreshAt(expiresAt),
  };

  signedUrlCache.set(cacheKey, access);
  return access;
}

export async function getDocumentAccessUrl(
  documentId: string,
  fileUrl?: string | null,
  options: number | DocumentAccessOptions = 15,
): Promise<string> {
  const access = await getDocumentAccess(documentId, fileUrl, options);
  return access.url;
}

export async function openDocumentAccessUrl(
  documentId: string,
  fileUrl?: string | null,
): Promise<void> {
  const url = await getDocumentAccessUrl(documentId, fileUrl, { disposition: 'attachment' });
  window.open(url, '_blank', 'noopener,noreferrer');
}
