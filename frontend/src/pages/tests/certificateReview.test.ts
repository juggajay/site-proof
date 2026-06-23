import { describe, expect, it } from 'vitest';
import { recomputeReviewPassFail } from './certificateReview';

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
