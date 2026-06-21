export type DocumentAccessDisposition = 'inline' | 'attachment';

export type DocumentAccessUrl = {
  url: string;
  expiresAt: number;
  refreshAt: number;
};

const signedUrlCache = new Map<string, DocumentAccessUrl>();

export function getDocumentAccessCacheKey(
  documentId: string,
  disposition: DocumentAccessDisposition,
): string {
  return `${documentId}:${disposition}`;
}

export function getCachedDocumentAccessUrl(cacheKey: string): DocumentAccessUrl | undefined {
  return signedUrlCache.get(cacheKey);
}

export function setCachedDocumentAccessUrl(cacheKey: string, access: DocumentAccessUrl): void {
  signedUrlCache.set(cacheKey, access);
}

export function invalidateDocumentAccessUrl(documentId: string): void {
  signedUrlCache.delete(getDocumentAccessCacheKey(documentId, 'attachment'));
  signedUrlCache.delete(getDocumentAccessCacheKey(documentId, 'inline'));
}

export function clearDocumentAccessCache(): void {
  signedUrlCache.clear();
}
