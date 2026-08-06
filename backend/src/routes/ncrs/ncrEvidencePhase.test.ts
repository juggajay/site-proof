import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/AppError.js';
import {
  AFTER_EVIDENCE_WHERE,
  NCR_EVIDENCE_AFTER_PHOTO,
  NCR_EVIDENCE_BEFORE_PHOTO,
  NCR_EVIDENCE_PHASE_ROLLOUT,
  afterEvidenceGateApplies,
  assertAfterEvidencePresent,
  isCertificateEvidenceType,
  isPhotoEvidenceType,
  ncrPredatesPhaseRollout,
  qualifiesAsAfterEvidence,
} from './ncrEvidencePhase.js';

const AFTER_ROLLOUT = new Date(NCR_EVIDENCE_PHASE_ROLLOUT.getTime() + 86_400_000);
const BEFORE_ROLLOUT = new Date(NCR_EVIDENCE_PHASE_ROLLOUT.getTime() - 86_400_000);

const photo = (evidenceType: string, mimeType: string | null = 'image/jpeg') => ({
  evidenceType,
  document: { mimeType },
});

function gateError(
  ncrEvidence: Array<{ evidenceType: string; document: { mimeType: string | null } | null }>,
  options: { createdAt?: Date; withConcession?: boolean } = {},
) {
  try {
    assertAfterEvidencePresent(
      { createdAt: options.createdAt ?? AFTER_ROLLOUT, ncrEvidence },
      { withConcession: options.withConcession },
    );
    return null;
  } catch (error) {
    return error as AppError;
  }
}

describe('evidence type classification', () => {
  it('treats every photo phase, including the legacy rectification_photo, as a photo', () => {
    expect(isPhotoEvidenceType('photo')).toBe(true);
    expect(isPhotoEvidenceType('rectification_photo')).toBe(true);
    expect(isPhotoEvidenceType(NCR_EVIDENCE_BEFORE_PHOTO)).toBe(true);
    expect(isPhotoEvidenceType(NCR_EVIDENCE_AFTER_PHOTO)).toBe(true);
    expect(isPhotoEvidenceType('retest_certificate')).toBe(false);
  });

  it('keeps certificates out of the photo group', () => {
    expect(isCertificateEvidenceType('retest_certificate')).toBe(true);
    expect(isCertificateEvidenceType('certificate')).toBe(true);
    expect(isCertificateEvidenceType(NCR_EVIDENCE_AFTER_PHOTO)).toBe(false);
  });
});

describe('qualifiesAsAfterEvidence', () => {
  it('requires the after phase AND a stored image document', () => {
    expect(qualifiesAsAfterEvidence(photo(NCR_EVIDENCE_AFTER_PHOTO))).toBe(true);
    expect(qualifiesAsAfterEvidence(photo(NCR_EVIDENCE_AFTER_PHOTO, 'IMAGE/PNG'))).toBe(true);
  });

  it('rejects a PDF mislabelled as an after photo', () => {
    expect(qualifiesAsAfterEvidence(photo(NCR_EVIDENCE_AFTER_PHOTO, 'application/pdf'))).toBe(
      false,
    );
  });

  it('rejects an orphaned upload with no linked document', () => {
    expect(qualifiesAsAfterEvidence({ evidenceType: NCR_EVIDENCE_AFTER_PHOTO })).toBe(false);
    expect(
      qualifiesAsAfterEvidence({ evidenceType: NCR_EVIDENCE_AFTER_PHOTO, document: null }),
    ).toBe(false);
    expect(qualifiesAsAfterEvidence(photo(NCR_EVIDENCE_AFTER_PHOTO, null))).toBe(false);
  });

  it('never promotes a before photo or legacy evidence to "after"', () => {
    expect(qualifiesAsAfterEvidence(photo(NCR_EVIDENCE_BEFORE_PHOTO))).toBe(false);
    expect(qualifiesAsAfterEvidence(photo('photo'))).toBe(false);
    expect(qualifiesAsAfterEvidence(photo('rectification_photo'))).toBe(false);
    expect(qualifiesAsAfterEvidence(photo('retest_certificate', 'application/pdf'))).toBe(false);
  });
});

describe('rollout marker', () => {
  it('exempts NCRs raised before the marker and gates the rest', () => {
    expect(ncrPredatesPhaseRollout(BEFORE_ROLLOUT)).toBe(true);
    expect(ncrPredatesPhaseRollout(AFTER_ROLLOUT)).toBe(false);
    expect(ncrPredatesPhaseRollout(NCR_EVIDENCE_PHASE_ROLLOUT)).toBe(false);
  });

  it('switches the gate off for legacy NCRs and concessions', () => {
    expect(afterEvidenceGateApplies({ createdAt: AFTER_ROLLOUT })).toBe(true);
    expect(afterEvidenceGateApplies({ createdAt: BEFORE_ROLLOUT })).toBe(false);
    expect(afterEvidenceGateApplies({ createdAt: AFTER_ROLLOUT }, { withConcession: true })).toBe(
      false,
    );
  });
});

describe('assertAfterEvidencePresent', () => {
  it('blocks a clean close with no evidence at all', () => {
    const error = gateError([]);
    expect(error).toBeInstanceOf(AppError);
    expect(error?.message).toBe(
      'Add at least one photo of the completed rectification before closing.',
    );
    expect((error?.details as { code?: string })?.code).toBe('NCR_MISSING_AFTER_EVIDENCE');
    expect(error?.statusCode).toBe(400);
  });

  it('blocks a clean close when every item is a before photo', () => {
    expect(
      gateError([photo(NCR_EVIDENCE_BEFORE_PHOTO), photo(NCR_EVIDENCE_BEFORE_PHOTO)]),
    ).toBeInstanceOf(AppError);
  });

  it('blocks a post-rollout NCR carrying only legacy untagged photos', () => {
    expect(gateError([photo('photo'), photo('rectification_photo')])).toBeInstanceOf(AppError);
  });

  it('blocks when the only after-tagged item is a PDF', () => {
    expect(gateError([photo(NCR_EVIDENCE_AFTER_PHOTO, 'application/pdf')])).toBeInstanceOf(
      AppError,
    );
  });

  it('allows a clean close with one qualifying after photo', () => {
    expect(
      gateError([photo(NCR_EVIDENCE_BEFORE_PHOTO), photo(NCR_EVIDENCE_AFTER_PHOTO)]),
    ).toBeNull();
  });

  it('exempts an NCR raised before the rollout marker, whatever its evidence', () => {
    expect(gateError([photo('photo')], { createdAt: BEFORE_ROLLOUT })).toBeNull();
    expect(gateError([], { createdAt: BEFORE_ROLLOUT })).toBeNull();
  });

  it('exempts a concession close — an accepted defect has no rectification to photograph', () => {
    expect(gateError([], { withConcession: true })).toBeNull();
    expect(gateError([photo(NCR_EVIDENCE_BEFORE_PHOTO)], { withConcession: true })).toBeNull();
  });
});

describe('AFTER_EVIDENCE_WHERE', () => {
  it('encodes the same qualification the in-process predicate applies', () => {
    expect(AFTER_EVIDENCE_WHERE).toEqual({
      some: {
        evidenceType: NCR_EVIDENCE_AFTER_PHOTO,
        document: { is: { mimeType: { startsWith: 'image/', mode: 'insensitive' } } },
      },
    });
  });
});
