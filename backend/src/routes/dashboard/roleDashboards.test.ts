import { describe, expect, it } from 'vitest';
import { calculatePendingDocketStats } from './roleDashboards.js';

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
