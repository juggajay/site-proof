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

  it('preserves delete response message', () => {
    expect(buildNcrEvidenceRemovedResponse()).toEqual({
      message: 'Evidence removed successfully',
    });
  });
});
