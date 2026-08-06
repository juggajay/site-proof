import { describe, expect, it } from 'vitest';
import {
  NCR_EVIDENCE_AFTER_PHOTO,
  NCR_EVIDENCE_BEFORE_PHOTO,
  evidencePhaseCaption,
  groupEvidenceByPhase,
  hasAfterEvidence,
  isPhotoEvidenceType,
} from './ncrEvidencePhase';

const item = (id: string, evidenceType: string) => ({ id, evidenceType });

describe('groupEvidenceByPhase', () => {
  it('splits before, after and untagged evidence without dropping anything', () => {
    const before = item('a', NCR_EVIDENCE_BEFORE_PHOTO);
    const after = item('b', NCR_EVIDENCE_AFTER_PHOTO);
    const legacyPhoto = item('c', 'photo');
    const certificate = item('d', 'retest_certificate');

    const groups = groupEvidenceByPhase([before, after, legacyPhoto, certificate]);

    expect(groups.before).toEqual([before]);
    expect(groups.after).toEqual([after]);
    expect(groups.unphased).toEqual([legacyPhoto, certificate]);
  });

  it('puts a legacy-only evidence set entirely in unphased', () => {
    const groups = groupEvidenceByPhase([item('a', 'photo'), item('b', 'retest_certificate')]);

    expect(groups.before).toEqual([]);
    expect(groups.after).toEqual([]);
    expect(groups.unphased).toHaveLength(2);
  });
});

describe('hasAfterEvidence', () => {
  it('is false only when every item is a before photo', () => {
    expect(hasAfterEvidence([])).toBe(false);
    expect(hasAfterEvidence([item('a', NCR_EVIDENCE_BEFORE_PHOTO)])).toBe(false);
    expect(
      hasAfterEvidence([item('a', NCR_EVIDENCE_BEFORE_PHOTO), item('b', NCR_EVIDENCE_AFTER_PHOTO)]),
    ).toBe(true);
  });

  it('treats legacy untagged evidence as after-evidence so old NCRs stay closable', () => {
    expect(hasAfterEvidence([item('a', 'photo')])).toBe(true);
    expect(hasAfterEvidence([item('a', 'retest_certificate')])).toBe(true);
  });
});

describe('evidence type helpers', () => {
  it('classifies every photo phase as a photo', () => {
    expect(isPhotoEvidenceType('photo')).toBe(true);
    expect(isPhotoEvidenceType(NCR_EVIDENCE_BEFORE_PHOTO)).toBe(true);
    expect(isPhotoEvidenceType(NCR_EVIDENCE_AFTER_PHOTO)).toBe(true);
    expect(isPhotoEvidenceType('retest_certificate')).toBe(false);
  });

  it('captions only phased uploads', () => {
    expect(evidencePhaseCaption(NCR_EVIDENCE_BEFORE_PHOTO)).toBe(' (before rectification)');
    expect(evidencePhaseCaption(NCR_EVIDENCE_AFTER_PHOTO)).toBe(' (after rectification)');
    expect(evidencePhaseCaption('photo')).toBe('');
  });
});
