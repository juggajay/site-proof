import { describe, expect, it } from 'vitest';

import {
  buildNcrEvidenceAddedResponse,
  buildNcrEvidenceAlreadyLinkedResponse,
  buildNcrEvidenceListResponse,
  buildNcrEvidenceRemovedResponse,
} from './ncrEvidenceResponses.js';

describe('NCR evidence response helpers', () => {
  it('preserves already-linked and added response messages', () => {
    const evidence = { id: 'evidence-1', evidenceType: 'photo' };

    expect(buildNcrEvidenceAlreadyLinkedResponse(evidence)).toEqual({
      evidence,
      message: 'Evidence already linked to NCR',
    });
    expect(buildNcrEvidenceAddedResponse(evidence)).toEqual({
      evidence,
      message: 'Evidence added to NCR successfully',
    });
  });

  it('strips raw document file URLs from single-evidence responses without mutating input', () => {
    const evidence = {
      id: 'evidence-1',
      evidenceType: 'photo',
      document: {
        id: 'document-1',
        filename: 'photo.jpg',
        fileUrl: 'supabase://documents/project/photo.jpg',
        caption: 'site photo',
      },
    };

    expect(buildNcrEvidenceAddedResponse(evidence)).toEqual({
      evidence: {
        id: 'evidence-1',
        evidenceType: 'photo',
        document: {
          id: 'document-1',
          filename: 'photo.jpg',
          caption: 'site photo',
        },
      },
      message: 'Evidence added to NCR successfully',
    });
    expect(evidence.document.fileUrl).toBe('supabase://documents/project/photo.jpg');
  });

  it('preserves evidence grouping by type', () => {
    const photo = { id: 'photo-1', evidenceType: 'photo' };
    const certificate = { id: 'cert-1', evidenceType: 'certificate' };
    const retest = { id: 'retest-1', evidenceType: 'retest_certificate' };
    const document = { id: 'doc-1', evidenceType: 'other' };
    const evidence = [photo, certificate, retest, document];

    expect(buildNcrEvidenceListResponse(evidence)).toEqual({
      evidence,
      grouped: {
        photos: [photo],
        certificates: [certificate, retest],
        documents: [document],
        all: evidence,
      },
      count: 4,
    });
  });

  it('strips raw document file URLs from all grouped list evidence', () => {
    const evidence = [
      {
        id: 'photo-1',
        evidenceType: 'photo',
        document: {
          id: 'document-1',
          filename: 'photo.jpg',
          fileUrl: 'https://storage.example.com/public/photo.jpg',
        },
      },
      {
        id: 'cert-1',
        evidenceType: 'certificate',
        document: {
          id: 'document-2',
          filename: 'cert.pdf',
          fileUrl: 'supabase://documents/project/cert.pdf',
        },
      },
    ];

    const response = buildNcrEvidenceListResponse(evidence);

    expect(response.evidence).toEqual([
      {
        id: 'photo-1',
        evidenceType: 'photo',
        document: { id: 'document-1', filename: 'photo.jpg' },
      },
      {
        id: 'cert-1',
        evidenceType: 'certificate',
        document: { id: 'document-2', filename: 'cert.pdf' },
      },
    ]);
    expect(response.grouped.photos[0].document).not.toHaveProperty('fileUrl');
    expect(response.grouped.certificates[0].document).not.toHaveProperty('fileUrl');
    expect(evidence[0].document.fileUrl).toBe('https://storage.example.com/public/photo.jpg');
  });

  it('preserves delete response message', () => {
    expect(buildNcrEvidenceRemovedResponse()).toEqual({
      message: 'Evidence removed successfully',
    });
  });
});
