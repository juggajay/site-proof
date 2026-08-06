import { formatStatusLabel } from '@/lib/statusLabels';
import { CATEGORIES, DOCUMENT_TYPES } from './documentsUploadData';

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

/**
 * Acronyms the Title Case fallback gets wrong. Both values are written by
 * backend auto-filing (`routes/ncrs.ts`, `routes/itp/*`), not by the upload
 * form, so neither appears in DOCUMENT_TYPES / CATEGORIES.
 */
const ACRONYM_LABELS: Record<string, string> = {
  ncr_evidence: 'NCR Evidence',
  itp_evidence: 'ITP Evidence',
};

export function getDocumentTypeLabel(type: string): string {
  return (
    DOCUMENT_TYPES.find((documentType) => documentType.id === type)?.label ||
    ACRONYM_LABELS[type] ||
    // Auto-filed types (delivery_docket, ncr_evidence, …) have no option entry;
    // Title Case them rather than leaking the raw enum to the register.
    formatStatusLabel(type, { fallback: '' })
  );
}

/**
 * Category counterpart to `getDocumentTypeLabel`. Categories are a mix of the
 * upload form's CATEGORIES ids, backend auto-filed enums, and free text typed
 * by an operator — the lookup chain covers all three.
 */
export function getDocumentCategoryLabel(category: string): string {
  return (
    CATEGORIES.find((option) => option.id === category)?.label ||
    ACRONYM_LABELS[category] ||
    formatStatusLabel(category, { fallback: '' })
  );
}

/**
 * A document auto-filed by another surface carries the same value as its type
 * and its category (a delivery docket is `delivery_docket` twice), which
 * rendered as two identical chips. The category chip only earns its place when
 * it says something the type chip did not.
 */
export function isRedundantDocumentCategory(
  documentType: string,
  category: string | null,
): boolean {
  if (!category) return true;
  return getDocumentCategoryLabel(category) === getDocumentTypeLabel(documentType);
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
