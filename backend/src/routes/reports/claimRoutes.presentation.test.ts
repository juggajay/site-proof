import { describe, expect, it } from 'vitest';
import { buildClaimReportAmounts } from './claimRoutes.js';

describe('claim report amount presentation', () => {
  it('preserves zero certified amounts as real values', () => {
    expect(
      buildClaimReportAmounts({
        totalClaimedAmount: 5000,
        certifiedAmount: 0,
        paidAmount: null,
      }),
    ).toEqual({
      totalClaimedAmount: 5000,
      certifiedAmount: 0,
      paidAmount: null,
      variance: 5000,
      outstanding: 0,
    });
  });
});
