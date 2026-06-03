import { describe, expect, it } from 'vitest';

import {
  canPreviewDocument,
  formatDocumentDate,
  formatDocumentFileSize,
  getDocumentTypeLabel,
  isExcelDocument,
  isImageDocument,
  isPdfDocument,
  isWordDocument,
} from './documentsDisplayData';

describe('formatDocumentFileSize', () => {
  it('preserves the existing unknown label for null and zero byte sizes', () => {
    expect(formatDocumentFileSize(null)).toBe('Unknown');
    expect(formatDocumentFileSize(0)).toBe('Unknown');
  });

  it('formats bytes, KB, and MB labels', () => {
    expect(formatDocumentFileSize(42)).toBe('42 B');
    expect(formatDocumentFileSize(1536)).toBe('1.5 KB');
    expect(formatDocumentFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});

describe('formatDocumentDate', () => {
  it('returns fallback labels for missing and invalid dates', () => {
    expect(formatDocumentDate(null)).toBe('Unknown date');
    expect(formatDocumentDate(undefined)).toBe('Unknown date');
    expect(formatDocumentDate('not-a-date')).toBe('Invalid date');
  });

  it('formats valid dates using the Australian document timestamp format', () => {
    expect(formatDocumentDate('2026-01-15T12:30:00.000Z')).toContain('15 Jan 2026');
  });
});

describe('getDocumentTypeLabel', () => {
  it('maps known document type ids to labels', () => {
    expect(getDocumentTypeLabel('drawing')).toBe('Drawing');
    expect(getDocumentTypeLabel('photo')).toBe('Photo');
  });

  it('falls back to the raw type for unknown ids', () => {
    expect(getDocumentTypeLabel('custom-type')).toBe('custom-type');
  });
});

describe('document MIME helpers', () => {
  it('detects previewable images and PDFs', () => {
    expect(isImageDocument('image/png')).toBe(true);
    expect(isPdfDocument('application/pdf')).toBe(true);
    expect(canPreviewDocument('image/webp')).toBe(true);
    expect(canPreviewDocument('application/pdf')).toBe(true);
  });

  it('preserves the existing null image result while keeping preview false', () => {
    expect(isImageDocument(null)).toBeUndefined();
    expect(canPreviewDocument(null)).toBe(false);
  });

  it('detects supported Excel and Word MIME types', () => {
    expect(
      isExcelDocument('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe(true);
    expect(isExcelDocument('application/vnd.ms-excel')).toBe(true);
    expect(isExcelDocument('text/csv')).toBe(true);
    expect(
      isWordDocument('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).toBe(true);
    expect(isWordDocument('application/msword')).toBe(true);
  });

  it('returns false for unsupported MIME types', () => {
    expect(isPdfDocument('text/plain')).toBe(false);
    expect(isExcelDocument('text/plain')).toBe(false);
    expect(isWordDocument('text/plain')).toBe(false);
    expect(canPreviewDocument('text/plain')).toBe(false);
  });
});
