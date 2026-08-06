import { describe, expect, it } from 'vitest';
import {
  NCR_EVIDENCE_AFTER_PHOTO,
  NCR_EVIDENCE_BEFORE_PHOTO,
  NCR_EVIDENCE_PHASE_ROLLOUT,
  groupEvidenceByPhase,
  hasRequiredAfterEvidence,
  isPhotoEvidenceType,
  ncrPredatesPhaseRollout,
  qualifiesAsAfterEvidence,
} from './ncrEvidencePhase';

const AFTER_ROLLOUT = new Date(NCR_EVIDENCE_PHASE_ROLLOUT + 86_400_000).toISOString();
const BEFORE_ROLLOUT = new Date(NCR_EVIDENCE_PHASE_ROLLOUT - 86_400_000).toISOString();

const item = (id: string, evidenceType: string, mimeType: string | null = 'image/jpeg') => ({
  id,
  evidenceType,
  document: { mimeType },
});

describe('groupEvidenceByPhase', () => {
  it('splits before, after and untagged evidence without dropping anything', () => {
    const before = item('a', NCR_EVIDENCE_BEFORE_PHOTO);
    const after = item('b', NCR_EVIDENCE_AFTER_PHOTO);
    const legacyPhoto = item('c', 'photo');
    const certificate = item('d', 'retest_certificate', 'application/pdf');

    const groups = groupEvidenceByPhase([before, after, legacyPhoto, certificate]);

    expect(groups.before).toEqual([before]);
    expect(groups.after).toEqual([after]);
    expect(groups.unphased).toEqual([legacyPhoto, certificate]);
  });

  it('puts a legacy-only evidence set entirely in unphased', () => {
    const groups = groupEvidenceByPhase([item('a', 'photo'), item('b', 'rectification_photo')]);

    expect(groups.before).toEqual([]);
    expect(groups.after).toEqual([]);
    expect(groups.unphased).toHaveLength(2);
  });
});

describe('qualifiesAsAfterEvidence', () => {
  it('requires the after phase and an image document', () => {
    expect(qualifiesAsAfterEvidence(item('a', NCR_EVIDENCE_AFTER_PHOTO))).toBe(true);
    expect(qualifiesAsAfterEvidence(item('a', NCR_EVIDENCE_AFTER_PHOTO, 'application/pdf'))).toBe(
      false,
    );
    expect(qualifiesAsAfterEvidence(item('a', NCR_EVIDENCE_AFTER_PHOTO, null))).toBe(false);
    expect(qualifiesAsAfterEvidence(item('a', 'photo'))).toBe(false);
  });
});

describe('hasRequiredAfterEvidence', () => {
  it('requires a qualifying after photo on an NCR raised after the rollout', () => {
    expect(hasRequiredAfterEvidence({ createdAt: AFTER_ROLLOUT, ncrEvidence: [] })).toBe(false);
    expect(
      hasRequiredAfterEvidence({
        createdAt: AFTER_ROLLOUT,
        ncrEvidence: [item('a', NCR_EVIDENCE_BEFORE_PHOTO)],
      }),
    ).toBe(false);
    expect(
      hasRequiredAfterEvidence({
        createdAt: AFTER_ROLLOUT,
        ncrEvidence: [item('a', NCR_EVIDENCE_BEFORE_PHOTO), item('b', NCR_EVIDENCE_AFTER_PHOTO)],
      }),
    ).toBe(true);
  });

  it('never counts legacy untagged photos as the after photo', () => {
    expect(
      hasRequiredAfterEvidence({ createdAt: AFTER_ROLLOUT, ncrEvidence: [item('a', 'photo')] }),
    ).toBe(false);
  });

  it('exempts NCRs raised before the rollout, and anything with an unknown raise date', () => {
    expect(
      hasRequiredAfterEvidence({ createdAt: BEFORE_ROLLOUT, ncrEvidence: [item('a', 'photo')] }),
    ).toBe(true);
    expect(hasRequiredAfterEvidence({ createdAt: BEFORE_ROLLOUT, ncrEvidence: [] })).toBe(true);
    expect(hasRequiredAfterEvidence({ ncrEvidence: [] })).toBe(true);
    expect(hasRequiredAfterEvidence({ createdAt: 'not-a-date', ncrEvidence: [] })).toBe(true);
  });
});

describe('rollout marker', () => {
  it('treats the marker instant itself as gated', () => {
    expect(ncrPredatesPhaseRollout(BEFORE_ROLLOUT)).toBe(true);
    expect(ncrPredatesPhaseRollout(new Date(NCR_EVIDENCE_PHASE_ROLLOUT).toISOString())).toBe(false);
    expect(ncrPredatesPhaseRollout(AFTER_ROLLOUT)).toBe(false);
  });
});

describe('isPhotoEvidenceType', () => {
  it('classifies every photo phase as a photo', () => {
    expect(isPhotoEvidenceType('photo')).toBe(true);
    expect(isPhotoEvidenceType('rectification_photo')).toBe(true);
    expect(isPhotoEvidenceType(NCR_EVIDENCE_BEFORE_PHOTO)).toBe(true);
    expect(isPhotoEvidenceType(NCR_EVIDENCE_AFTER_PHOTO)).toBe(true);
    expect(isPhotoEvidenceType('retest_certificate')).toBe(false);
  });
});
