export type CertificateDocumentResponseSource = {
  id: string;
  filename: string;
  fileUrl?: string;
  mimeType: string | null;
  uploadedAt?: Date;
} | null;

export function buildCertificateDocumentResponse(document: CertificateDocumentResponseSource) {
  if (!document) {
    return null;
  }

  return {
    id: document.id,
    filename: document.filename,
    mimeType: document.mimeType,
    ...('uploadedAt' in document ? { uploadedAt: document.uploadedAt } : {}),
  };
}
