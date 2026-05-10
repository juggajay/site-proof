import { apiFetch, apiUrl } from './api';

type SignedUrlResponse = {
  signedUrl: string;
  expiresAt: string;
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

export function invalidateDocumentAccessUrl(documentId: string): void {
  signedUrlCache.delete(documentId);
}

export async function getDocumentAccess(
  documentId: string,
  fileUrl?: string | null,
  expiresInMinutes = 15,
): Promise<DocumentAccessUrl> {
  if (!documentId) {
    return {
      url: rawFileUrl(fileUrl),
      expiresAt: Number.POSITIVE_INFINITY,
      refreshAt: Number.POSITIVE_INFINITY,
    };
  }

  const cached = signedUrlCache.get(documentId);
  if (cached && cached.refreshAt > Date.now()) {
    return cached;
  }

  const response = await apiFetch<SignedUrlResponse>(
    `/api/documents/${encodeURIComponent(documentId)}/signed-url`,
    {
      method: 'POST',
      body: JSON.stringify({ expiresInMinutes }),
    },
  );

  const expiresAt = getResponseExpiry(response.expiresAt, expiresInMinutes);
  const access = {
    url: response.signedUrl,
    expiresAt,
    refreshAt: getRefreshAt(expiresAt),
  };

  signedUrlCache.set(documentId, access);
  return access;
}

export async function getDocumentAccessUrl(
  documentId: string,
  fileUrl?: string | null,
  expiresInMinutes = 15,
): Promise<string> {
  const access = await getDocumentAccess(documentId, fileUrl, expiresInMinutes);
  return access.url;
}

export async function openDocumentAccessUrl(
  documentId: string,
  fileUrl?: string | null,
): Promise<void> {
  const url = await getDocumentAccessUrl(documentId, fileUrl);
  window.open(url, '_blank', 'noopener,noreferrer');
}
