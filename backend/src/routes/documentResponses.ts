type ClassificationSuggestion = { label: string; confidence: number };

export function buildDocumentsListResponse(
  documents: unknown[],
  total: number,
  categories: Record<string, number>,
  pagination: unknown,
) {
  return {
    documents,
    total,
    categories,
    pagination,
  };
}

export function buildDocumentVersionsResponse(documentId: string, versions: unknown[]) {
  return {
    documentId,
    totalVersions: versions.length,
    versions,
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
    ...updatedDocument,
    classificationLabels: finalClassification.split(', ').filter(Boolean),
  };
}
