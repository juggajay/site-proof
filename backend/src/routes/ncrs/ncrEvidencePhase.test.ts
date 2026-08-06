import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/AppError.js';
import {
  NCR_EVIDENCE_AFTER_PHOTO,
  NCR_EVIDENCE_BEFORE_PHOTO,
  assertAfterEvidencePresent,
  countsAsAfterEvidence,
  isCertificateEvidenceType,
  isPhotoEvidenceType,
} from './ncrEvidencePhase.js';

const evidence = (...types: string[]) => types.map((evidenceType) => ({ evidenceType }));

function closeError(items: Array<{ evidenceType: string }>, withConcession?: boolean) {
  try {
    assertAfterEvidencePresent(items, { withConcession });
    return null;
  } catch (error) {
    return error as AppError;
  }
}

describe('ncr evidence phase classification', () => {
  it('treats every photo phase as a photo', () => {
    expect(isPhotoEvidenceType('photo')).toBe(true);
    expect(isPhotoEvidenceType(NCR_EVIDENCE_BEFORE_PHOTO)).toBe(true);
    expect(isPhotoEvidenceType(NCR_EVIDENCE_AFTER_PHOTO)).toBe(true);
    expect(isPhotoEvidenceType('retest_certificate')).toBe(false);
  });

  it('keeps certificates out of the photo group', () => {
    expect(isCertificateEvidenceType('retest_certificate')).toBe(true);
    expect(isCertificateEvidenceType('certificate')).toBe(true);
    expect(isCertificateEvidenceType(NCR_EVIDENCE_AFTER_PHOTO)).toBe(false);
  });

  it('counts everything except an explicit before photo as after-evidence', () => {
    expect(countsAsAfterEvidence(NCR_EVIDENCE_BEFORE_PHOTO)).toBe(false);
    expect(countsAsAfterEvidence(NCR_EVIDENCE_AFTER_PHOTO)).toBe(true);
    // Legacy, untagged evidence.
    expect(countsAsAfterEvidence('photo')).toBe(true);
    expect(countsAsAfterEvidence('retest_certificate')).toBe(true);
  });
});

describe('assertAfterEvidencePresent (clean close gate)', () => {
  it('blocks a clean close with no evidence at all', () => {
    const error = closeError([]);
    expect(error).toBeInstanceOf(AppError);
    expect(error?.message).toBe(
      'Add at least one photo of the completed rectification before closing.',
    );
    expect((error?.details as { code?: string })?.code).toBe('NCR_MISSING_AFTER_EVIDENCE');
  });

  it('blocks a clean close when every item is a before photo', () => {
    const error = closeError(evidence(NCR_EVIDENCE_BEFORE_PHOTO, NCR_EVIDENCE_BEFORE_PHOTO));
    expect(error).toBeInstanceOf(AppError);
    expect(error?.statusCode).toBe(400);
  });

  it('allows a clean close with one after photo', () => {
    expect(closeError(evidence(NCR_EVIDENCE_BEFORE_PHOTO, NCR_EVIDENCE_AFTER_PHOTO))).toBeNull();
  });

  it('allows a clean close on a legacy NCR whose evidence predates the phase split', () => {
    expect(closeError(evidence('photo'))).toBeNull();
    expect(closeError(evidence('retest_certificate'))).toBeNull();
  });

  it('exempts a concession close — an accepted defect has no rectification to photograph', () => {
    expect(closeError([], true)).toBeNull();
    expect(closeError(evidence(NCR_EVIDENCE_BEFORE_PHOTO), true)).toBeNull();
  });
});
