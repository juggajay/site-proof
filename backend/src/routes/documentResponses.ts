import {
  DOCUMENTS_BUCKET,
  getSupabaseStoragePath,
  getSupabaseStorageReference,
} from '../lib/supabase.js';

type ClassificationSuggestion = { label: string; confidence: number };
type DocumentResponseRecord = Record<string, unknown>;

function getDocumentResponseStoragePrefixes(projectId: string, documentType?: unknown): string[] {
  const prefixes = [`${projectId}/`];
  if (documentType === 'drawing') {
    prefixes.push(`drawings/${projectId}/`);
  }
  if (documentType === 'test_certificate') {
    prefixes.push(`certificates/${projectId}/`);
  }
  return prefixes;
}

function getDocumentResponseStoragePath(document: DocumentResponseRecord): string | null {
  const { fileUrl, projectId, documentType } = document;
  if (typeof fileUrl !== 'string') {
    return null;
  }

  if (typeof projectId === 'string') {
    for (const expectedPrefix of getDocumentResponseStoragePrefixes(projectId, documentType)) {
      const storagePath = getSupabaseStoragePath(fileUrl, {
        bucket: DOCUMENTS_BUCKET,
        expectedPrefix,
      });
      if (storagePath) return storagePath;
    }
  }

  return getSupabaseStoragePath(fileUrl, DOCUMENTS_BUCKET);
}

export function normalizeDocumentFileUrlForResponse<T>(document: T): T {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return document;
  }

  const storagePath = getDocumentResponseStoragePath(document as DocumentResponseRecord);
  if (!storagePath) {
    return document;
  }

  return {
    ...(document as DocumentResponseRecord),
    fileUrl: getSupabaseStorageReference(DOCUMENTS_BUCKET, storagePath),
  } as T;
}

export function buildDocumentResponse<T>(document: T): T {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return document;
  }

  const { fileUrl: _fileUrl, ...documentWithoutFileUrl } = document as DocumentResponseRecord;
  return documentWithoutFileUrl as T;
}

export function buildDocumentsListResponse(
  documents: unknown[],
  total: number,
  categories: Record<string, number>,
  pagination: unknown,
) {
  return {
    documents: documents.map(buildDocumentResponse),
    total,
    categories,
    pagination,
  };
}

export function buildDocumentVersionsResponse(documentId: string, versions: unknown[]) {
  return {
    documentId,
    totalVersions: versions.length,
    versions: versions.map(buildDocumentResponse),
  };
}

export function buildDocumentSignedUrlResponse({
  signedUrl,
  token,
  documentId,
  filename,
  mimeType,
  disposition,
  expiresAt,
  expiresInMinutes,
}: {
  signedUrl: string;
  token: string;
  documentId: string;
  filename: string;
  mimeType: string | null;
  disposition: 'attachment' | 'inline';
  expiresAt: Date;
  expiresInMinutes: number;
}) {
  return {
    signedUrl,
    token,
    documentId,
    filename,
    mimeType,
    disposition,
    expiresAt: expiresAt.toISOString(),
    expiresInMinutes,
    message: `Signed URL valid for ${expiresInMinutes} minutes`,
  };
}

export function buildInvalidDocumentSignedUrlTokenResponse(expired?: boolean) {
  return {
    valid: false,
    expired: expired || false,
    message: expired ? 'Token has expired' : 'Token is invalid',
  };
}

export function buildDocumentSignedUrlTokenResponse({
  documentId,
  expiresAt,
  createdAt,
}: {
  documentId: string;
  expiresAt?: Date;
  createdAt?: Date;
}) {
  return {
    valid: true,
    expired: false,
    documentId,
    expiresAt: expiresAt?.toISOString(),
    createdAt: createdAt?.toISOString(),
    message: 'Token is valid',
  };
}

export function buildDocumentClassificationResponse(
  documentId: string,
  suggestedClassifications: ClassificationSuggestion[],
  categories: readonly string[],
) {
  const primaryClassification = suggestedClassifications[0]!;
  return {
    documentId,
    suggestedClassification: primaryClassification.label,
    confidence: primaryClassification.confidence,
    suggestedClassifications,
    isMultiLabel: suggestedClassifications.length > 1,
    categories,
  };
}

export function buildSavedDocumentClassificationResponse<T extends object>(
  updatedDocument: T,
  finalClassification: string,
) {
  return {
    ...buildDocumentResponse(updatedDocument),
    classificationLabels: finalClassification.split(', ').filter(Boolean),
  };
}
