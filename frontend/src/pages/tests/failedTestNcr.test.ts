import { describe, expect, it } from 'vitest';
import { buildFailedTestNcrContext } from './failedTestNcr';

describe('buildFailedTestNcrContext (M45)', () => {
  it('builds the failed-test payload and a spec-aware description', () => {
    const ctx = buildFailedTestNcrContext({
      testId: 'tr-1',
      testType: 'Compaction',
      resultValue: '92',
      resultUnit: '%',
      specificationMin: '95',
      specificationMax: '',
      lotId: 'lot-1',
    });

    expect(ctx.failedTest).toEqual({
      testId: 'tr-1',
      testType: 'Compaction',
      resultValue: '92',
      lotId: 'lot-1',
    });
    expect(ctx.description).toBe(
      'Test failure: Compaction result (92 %) is outside specification (min: 95, max: N/A)',
    );
  });

  it('defaults a missing lot to null and missing spec bounds to N/A', () => {
    const ctx = buildFailedTestNcrContext({
      testId: 'tr-2',
      testType: 'Slump',
      resultValue: '120',
    });

    expect(ctx.failedTest.lotId).toBeNull();
    expect(ctx.description).toBe(
      'Test failure: Slump result (120 ) is outside specification (min: N/A, max: N/A)',
    );
  });
});
