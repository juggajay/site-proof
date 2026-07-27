import { describe, expect, it } from 'vitest';
import {
  recomputeReviewPassFail,
  seedAttachReviewForm,
  type AttachReviewRow,
} from './certificateReview';

describe('recomputeReviewPassFail (H13)', () => {
  it('sets fail when the value is below the spec min', () => {
    expect(
      recomputeReviewPassFail({ resultValue: '5', specificationMin: '10', specificationMax: '' }),
    ).toMatchObject({ passFail: 'fail' });
  });

  it('sets pass when the value is within the spec range', () => {
    expect(
      recomputeReviewPassFail({
        resultValue: '15',
        specificationMin: '10',
        specificationMax: '20',
      }),
    ).toMatchObject({ passFail: 'pass' });
  });

  it('leaves the form (and any manual passFail) untouched when the outcome is indeterminate', () => {
    const form = {
      resultValue: '',
      specificationMin: '10',
      specificationMax: '',
      passFail: 'pass',
    };
    expect(recomputeReviewPassFail(form)).toBe(form);
  });

  it('preserves the other fields', () => {
    const result = recomputeReviewPassFail({
      testType: 'Compaction',
      resultValue: '5',
      specificationMin: '10',
      specificationMax: '',
    });
    expect(result.testType).toBe('Compaction');
    expect(result.passFail).toBe('fail');
  });
});

// C2 Phase 1. The row a QM filled in by hand before the certificate arrived.
const POPULATED_ROW: AttachReviewRow = {
  testType: 'Field Density (Nuclear)',
  laboratoryName: 'Metro Materials Lab',
  laboratoryReportNumber: 'LAB-2026-0042',
  sampleDate: '2026-04-10T00:00:00.000Z',
  testDate: '2026-04-12T00:00:00.000Z',
  sampleLocation: 'CH 1234+50',
  resultValue: 98.5,
  resultUnit: '% MDD',
  specificationMin: 95,
  specificationMax: 100,
  passFail: 'pass',
  lotId: 'lot-1',
};

// What extractCertificateFields returns whenever the AI call fails or no API key
// is configured (createManualReviewExtraction over a filename that matches no
// keyword): every field empty, testType a low-confidence placeholder.
const DEGRADED_EXTRACTION = {
  testType: { value: 'Certificate Review Required', confidence: 0.15 },
  laboratoryName: { value: '', confidence: 0 },
  laboratoryReportNumber: { value: '', confidence: 0 },
  sampleDate: { value: '', confidence: 0 },
  testDate: { value: '', confidence: 0 },
  sampleLocation: { value: '', confidence: 0 },
  resultValue: { value: '', confidence: 0 },
  resultUnit: { value: '', confidence: 0 },
  specificationMin: { value: '', confidence: 0 },
  specificationMax: { value: '', confidence: 0 },
};

const EMPTY_EXTRACTION = { ...DEGRADED_EXTRACTION, testType: { value: '', confidence: 0 } };

describe('seedAttachReviewForm — AT-66: an empty extraction never blanks a populated row', () => {
  it('keeps every hand-entered value when the extraction read nothing', () => {
    const seeded = seedAttachReviewForm(EMPTY_EXTRACTION, POPULATED_ROW);

    // Field by field, per AT-66.
    expect(seeded.testType).toBe('Field Density (Nuclear)');
    expect(seeded.laboratoryName).toBe('Metro Materials Lab');
    expect(seeded.laboratoryReportNumber).toBe('LAB-2026-0042');
    expect(seeded.sampleDate).toBe('2026-04-10');
    expect(seeded.testDate).toBe('2026-04-12');
    expect(seeded.sampleLocation).toBe('CH 1234+50');
    expect(seeded.resultValue).toBe('98.5');
    expect(seeded.resultUnit).toBe('% MDD');
    expect(seeded.specificationMin).toBe('95');
    expect(seeded.specificationMax).toBe('100');
    expect(seeded.passFail).toBe('pass');
  });

  it('keeps the lot link, so the confirm payload cannot null it', () => {
    expect(seedAttachReviewForm(EMPTY_EXTRACTION, POPULATED_ROW).lotId).toBe('lot-1');
  });

  it('never seeds itpChecklistItemId, so the stored ITP link survives the confirm', () => {
    expect(seedAttachReviewForm(EMPTY_EXTRACTION, POPULATED_ROW)).not.toHaveProperty(
      'itpChecklistItemId',
    );
  });

  // Proof of catch: the guard is a real branch, not a tautology. Feed the same
  // empty extraction to the naive "take whatever the AI said" rule this filter
  // replaces and the row's values are gone.
  it('proof of catch: taking extracted values unconditionally would wipe the row', () => {
    const naive = Object.fromEntries(
      Object.entries(EMPTY_EXTRACTION).map(([field, data]) => [field, data.value]),
    );

    expect(naive.resultValue).toBe('');
    expect(naive.sampleDate).toBe('');
    expect(naive.laboratoryName).toBe('');
    expect(seedAttachReviewForm(EMPTY_EXTRACTION, POPULATED_ROW).resultValue).not.toBe(
      naive.resultValue,
    );
  });

  it('still takes every value the extraction did read', () => {
    const seeded = seedAttachReviewForm(
      {
        ...EMPTY_EXTRACTION,
        resultValue: { value: '92.1', confidence: 0.95 },
        laboratoryName: { value: 'Southern Testing', confidence: 0.9 },
      },
      POPULATED_ROW,
    );

    expect(seeded.resultValue).toBe('92.1');
    expect(seeded.laboratoryName).toBe('Southern Testing');
    // …and recomputes the outcome from the new value against the row's bounds.
    expect(seeded.passFail).toBe('fail');
    expect(seeded.sampleLocation).toBe('CH 1234+50');
  });

  it('leaves a blank row blank rather than inventing values', () => {
    const emptyRow: AttachReviewRow = {
      testType: 'Compaction Test',
      laboratoryName: null,
      laboratoryReportNumber: null,
      sampleDate: null,
      testDate: null,
      sampleLocation: null,
      resultValue: null,
      resultUnit: null,
      specificationMin: null,
      specificationMax: null,
      passFail: 'pending',
      lotId: null,
    };

    const seeded = seedAttachReviewForm(EMPTY_EXTRACTION, emptyRow);
    expect(seeded.laboratoryName).toBe('');
    expect(seeded.resultValue).toBe('');
    expect(seeded.lotId).toBe('');
    expect(seeded.passFail).toBe('pending');
  });
});

describe('seedAttachReviewForm — AT-75: testType is protected', () => {
  it("does not let the 'Certificate Review Required' fallback replace the QM's test type", () => {
    // The degraded extraction carries the placeholder as a real non-empty value,
    // which is exactly the case that would silently re-attribute the test.
    const seeded = seedAttachReviewForm(DEGRADED_EXTRACTION, POPULATED_ROW);
    expect(seeded.testType).toBe('Field Density (Nuclear)');
    expect(seeded.testType).not.toBe('Certificate Review Required');
  });

  it('still takes a testType the certificate actually stated', () => {
    const seeded = seedAttachReviewForm(
      { ...EMPTY_EXTRACTION, testType: { value: 'Compaction Test', confidence: 0.96 } },
      POPULATED_ROW,
    );
    expect(seeded.testType).toBe('Compaction Test');
  });
});
