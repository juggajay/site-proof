import { describe, expect, it } from 'vitest';

import { buildCertificateDocumentResponse } from './certificateDocumentResponse.js';

describe('certificate document response helpers', () => {
  it('omits storage URLs from certificate document responses', () => {
    const uploadedAt = new Date('2026-06-01T01:02:03.000Z');

    expect(
      buildCertificateDocumentResponse({
        id: 'doc-1',
        filename: 'certificate.pdf',
        fileUrl: 'https://siteproof-test.supabase.co/storage/v1/object/public/documents/cert.pdf',
        mimeType: 'application/pdf',
        uploadedAt,
      }),
    ).toEqual({
      id: 'doc-1',
      filename: 'certificate.pdf',
      mimeType: 'application/pdf',
      uploadedAt,
    });
  });

  it('preserves null certificate documents', () => {
    expect(buildCertificateDocumentResponse(null)).toBeNull();
  });
});
