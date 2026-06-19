import { afterEach, describe, expect, it } from 'vitest';
import {
  buildDocumentResponse,
  buildDocumentsListResponse,
  buildSavedDocumentClassificationResponse,
  buildDocumentSignedUrlTokenResponse,
  buildDocumentVersionsResponse,
  buildInvalidDocumentSignedUrlTokenResponse,
  normalizeDocumentFileUrlForResponse,
} from './documentResponses.js';

describe('document response helpers', () => {
  const originalSupabaseUrl = process.env.SUPABASE_URL;

  afterEach(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    }
  });

  it('builds an invalid signed URL token response', () => {
    expect(buildInvalidDocumentSignedUrlTokenResponse(false)).toEqual({
      valid: false,
      expired: false,
      message: 'Token is invalid',
    });
  });

  it('builds an expired signed URL token response', () => {
    expect(buildInvalidDocumentSignedUrlTokenResponse(true)).toEqual({
      valid: false,
      expired: true,
      message: 'Token has expired',
    });
  });

  it('builds a valid signed URL token response with ISO timestamps', () => {
    expect(
      buildDocumentSignedUrlTokenResponse({
        documentId: 'doc-123',
        expiresAt: new Date('2026-06-01T01:02:03.000Z'),
        createdAt: new Date('2026-06-01T00:02:03.000Z'),
      }),
    ).toEqual({
      valid: true,
      expired: false,
      documentId: 'doc-123',
      expiresAt: '2026-06-01T01:02:03.000Z',
      createdAt: '2026-06-01T00:02:03.000Z',
      message: 'Token is valid',
    });
  });

  it('normalizes owned legacy Supabase public document URLs to storage references', () => {
    process.env.SUPABASE_URL = 'https://siteproof-test.supabase.co';

    expect(
      normalizeDocumentFileUrlForResponse({
        id: 'doc-1',
        projectId: 'project-1',
        documentType: 'photo',
        fileUrl:
          'https://siteproof-test.supabase.co/storage/v1/object/public/documents/project-1/evidence photo.png',
      }),
    ).toMatchObject({
      fileUrl: 'supabase://documents/project-1/evidence%20photo.png',
    });
  });

  it('normalizes owned drawing and certificate legacy Supabase URLs', () => {
    process.env.SUPABASE_URL = 'https://siteproof-test.supabase.co';

    expect(
      normalizeDocumentFileUrlForResponse({
        id: 'drawing-doc',
        projectId: 'project-1',
        documentType: 'drawing',
        fileUrl:
          'https://siteproof-test.supabase.co/storage/v1/object/public/documents/drawings/project-1/site-plan.pdf',
      }),
    ).toMatchObject({
      fileUrl: 'supabase://documents/drawings/project-1/site-plan.pdf',
    });

    expect(
      normalizeDocumentFileUrlForResponse({
        id: 'cert-doc',
        projectId: 'project-1',
        documentType: 'test_certificate',
        fileUrl:
          'https://siteproof-test.supabase.co/storage/v1/object/public/documents/certificates/project-1/test-cert.pdf',
      }),
    ).toMatchObject({
      fileUrl: 'supabase://documents/certificates/project-1/test-cert.pdf',
    });
  });

  it('normalizes foreign Supabase public URLs so responses do not expose public storage URLs', () => {
    process.env.SUPABASE_URL = 'https://siteproof-test.supabase.co';
    const foreignUrl =
      'https://siteproof-test.supabase.co/storage/v1/object/public/documents/other-project/evidence.pdf';

    expect(
      normalizeDocumentFileUrlForResponse({
        id: 'doc-1',
        projectId: 'project-1',
        documentType: 'photo',
        fileUrl: foreignUrl,
      }),
    ).toMatchObject({ fileUrl: 'supabase://documents/other-project/evidence.pdf' });
  });

  it('omits stored file URLs from document API responses', () => {
    expect(
      buildDocumentResponse({
        id: 'doc-1',
        filename: 'photo.png',
        fileUrl: 'supabase://documents/project-1/photo.png',
      }),
    ).toEqual({
      id: 'doc-1',
      filename: 'photo.png',
    });
  });

  it('omits stored file URLs from document list and version responses', () => {
    process.env.SUPABASE_URL = 'https://siteproof-test.supabase.co';
    const document = {
      id: 'doc-1',
      projectId: 'project-1',
      documentType: 'photo',
      fileUrl:
        'https://siteproof-test.supabase.co/storage/v1/object/public/documents/project-1/photo.png',
    };

    const listResponse = buildDocumentsListResponse([document], 1, {}, null);
    expect(listResponse.documents[0]).toMatchObject({ id: 'doc-1' });
    expect(listResponse.documents[0]).not.toHaveProperty('fileUrl');

    const versionResponse = buildDocumentVersionsResponse('doc-1', [document]);
    expect(versionResponse.versions[0]).toMatchObject({ id: 'doc-1' });
    expect(versionResponse.versions[0]).not.toHaveProperty('fileUrl');
  });

  it('omits stored file URLs from saved classification responses', () => {
    const response = buildSavedDocumentClassificationResponse(
      {
        id: 'doc-1',
        filename: 'photo.png',
        fileUrl: 'supabase://documents/project-1/photo.png',
      },
      'quality, hold-point',
    );

    expect(response).toMatchObject({
      id: 'doc-1',
      filename: 'photo.png',
      classificationLabels: ['quality', 'hold-point'],
    });
    expect(response).not.toHaveProperty('fileUrl');
  });
});
