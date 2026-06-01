import { describe, expect, it } from 'vitest';
import {
  buildDocumentClassificationResponse,
  buildDocumentSignedUrlResponse,
  buildDocumentVersionsResponse,
  buildDocumentsListResponse,
  buildSavedDocumentClassificationResponse,
} from './documentResponses.js';

describe('documentResponses', () => {
  it('builds the document list response', () => {
    const documents = [{ id: 'doc-1', filename: 'qa.pdf' }];
    const categories = { QA: 1 };
    const pagination = { page: 1, limit: 20, total: 1 };

    expect(buildDocumentsListResponse(documents, 1, categories, pagination)).toEqual({
      documents,
      total: 1,
      categories,
      pagination,
    });
  });

  it('builds the document versions response with a derived total', () => {
    const versions = [{ id: 'doc-2', version: 2 }];

    expect(buildDocumentVersionsResponse('doc-1', versions)).toEqual({
      documentId: 'doc-1',
      totalVersions: 1,
      versions,
    });
  });

  it('builds the signed URL response including expiry copy', () => {
    const expiresAt = new Date('2026-06-01T00:00:00.000Z');

    expect(
      buildDocumentSignedUrlResponse({
        signedUrl: 'https://example.test/download?token=abc',
        token: 'abc',
        documentId: 'doc-1',
        filename: 'qa.pdf',
        mimeType: 'application/pdf',
        disposition: 'inline',
        expiresAt,
        expiresInMinutes: 30,
      }),
    ).toEqual({
      signedUrl: 'https://example.test/download?token=abc',
      token: 'abc',
      documentId: 'doc-1',
      filename: 'qa.pdf',
      mimeType: 'application/pdf',
      disposition: 'inline',
      expiresAt: '2026-06-01T00:00:00.000Z',
      expiresInMinutes: 30,
      message: 'Signed URL valid for 30 minutes',
    });
  });

  it('builds the multi-label classification response with backward-compatible primary fields', () => {
    const suggestions = [
      { label: 'Inspection', confidence: 0.92 },
      { label: 'Testing', confidence: 0.71 },
    ];

    expect(
      buildDocumentClassificationResponse('doc-1', suggestions, ['Inspection', 'Testing']),
    ).toEqual({
      documentId: 'doc-1',
      suggestedClassification: 'Inspection',
      confidence: 0.92,
      suggestedClassifications: suggestions,
      isMultiLabel: true,
      categories: ['Inspection', 'Testing'],
    });
  });

  it('builds the saved classification response with parsed labels', () => {
    expect(
      buildSavedDocumentClassificationResponse(
        { id: 'doc-1', aiClassification: 'Inspection, Testing' },
        'Inspection, Testing',
      ),
    ).toEqual({
      id: 'doc-1',
      aiClassification: 'Inspection, Testing',
      classificationLabels: ['Inspection', 'Testing'],
    });
  });
});
