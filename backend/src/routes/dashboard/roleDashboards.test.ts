import { describe, expect, it } from 'vitest';
import { calculatePendingDocketStats, calculateItpVerificationRate } from './roleDashboards.js';

describe('calculatePendingDocketStats', () => {
  it('uses docket entry hours instead of submitted cost totals', () => {
    const stats = calculatePendingDocketStats([
      {
        totalLabourSubmitted: 800,
        totalPlantSubmitted: 200,
        labourEntries: [{ submittedHours: 8 }],
        plantEntries: [{ hoursOperated: 2 }],
      },
    ]);

    expect(stats).toEqual({
      count: 1,
      totalLabourHours: 8,
      totalPlantHours: 2,
    });
  });
});

describe('calculateItpVerificationRate', () => {
  it('returns the verified share of recorded completions as a percentage', () => {
    expect(calculateItpVerificationRate(3, 4)).toBe(75);
  });

  it('returns 100 when there are no recorded completions yet', () => {
    expect(calculateItpVerificationRate(0, 0)).toBe(100);
  });

  it('never exceeds 100 even if the numerator outruns the denominator', () => {
    // Guards the old bug where per-lot verified completions were divided by a
    // per-template item count, producing rates above 100%.
    expect(calculateItpVerificationRate(12, 8)).toBe(100);
  });

  it('never goes below 0', () => {
    expect(calculateItpVerificationRate(-1, 4)).toBe(0);
  });
});
