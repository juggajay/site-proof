import { DOCUMENT_TYPES } from './documentsUploadData';

export const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
] as const;

export const WORD_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
] as const;

export function formatDocumentFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function formatDocumentDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Unknown date';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Invalid date';
  }
}

export function getDocumentTypeLabel(type: string): string {
  return DOCUMENT_TYPES.find((documentType) => documentType.id === type)?.label || type;
}

export function isImageDocument(mimeType: string | null): boolean | undefined {
  return mimeType?.startsWith('image/');
}

export function isPdfDocument(mimeType: string | null): boolean {
  return mimeType === 'application/pdf';
}

export function isExcelDocument(mimeType: string | null): boolean {
  return EXCEL_MIME_TYPES.some((excelMimeType) => excelMimeType === mimeType);
}

export function isWordDocument(mimeType: string | null): boolean {
  return WORD_MIME_TYPES.some((wordMimeType) => wordMimeType === mimeType);
}

export function canPreviewDocument(mimeType: string | null): boolean {
  return Boolean(isImageDocument(mimeType)) || isPdfDocument(mimeType);
}
