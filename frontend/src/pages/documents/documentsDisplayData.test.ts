import { describe, expect, it } from 'vitest';

import {
  canPreviewDocument,
  formatDocumentDate,
  formatDocumentFileSize,
  getDocumentCategoryLabel,
  getDocumentTypeLabel,
  isRedundantDocumentCategory,
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

  it('never leaks a raw enum for auto-filed types with no option entry', () => {
    expect(getDocumentTypeLabel('delivery_docket')).toBe('Delivery Docket');
    expect(getDocumentTypeLabel('custom-type')).toBe('Custom Type');
  });

  it('spells acronyms out instead of title-casing them', () => {
    expect(getDocumentTypeLabel('ncr_evidence')).toBe('NCR Evidence');
    expect(getDocumentTypeLabel('itp_evidence')).toBe('ITP Evidence');
  });
});

describe('getDocumentCategoryLabel', () => {
  it('maps upload-form category ids, auto-filed enums, and free text', () => {
    expect(getDocumentCategoryLabel('quality')).toBe('Quality');
    expect(getDocumentCategoryLabel('test_results')).toBe('Test Results');
    expect(getDocumentCategoryLabel('ncr_evidence')).toBe('NCR Evidence');
    expect(getDocumentCategoryLabel('Site Photos')).toBe('Site Photos');
  });
});

describe('isRedundantDocumentCategory', () => {
  it('suppresses the category chip when it just repeats the type chip', () => {
    // The live bug: a filed delivery docket rendered "delivery_docket" twice.
    expect(isRedundantDocumentCategory('delivery_docket', 'delivery_docket')).toBe(true);
    expect(isRedundantDocumentCategory('ncr_evidence', 'ncr_evidence')).toBe(true);
  });

  it('keeps a category that says something the type did not', () => {
    expect(isRedundantDocumentCategory('photo', 'quality')).toBe(false);
    expect(isRedundantDocumentCategory('photo', null)).toBe(true);
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
