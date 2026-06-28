import { describe, expect, it } from 'vitest';
import { buildClaimReportAmounts, buildClaimReportFinancialSummary } from './claimRoutes.js';

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

  it('excludes disputed certified amounts from live certified and outstanding totals', () => {
    expect(
      buildClaimReportFinancialSummary([
        {
          status: 'certified',
          totalClaimedAmount: 1000,
          certifiedAmount: 900,
          paidAmount: 400,
          lotCount: 2,
        },
        {
          status: 'disputed',
          totalClaimedAmount: 2000,
          certifiedAmount: 1500,
          paidAmount: 600,
          lotCount: 1,
        },
      ]),
    ).toEqual({
      totalClaimed: 3000,
      totalCertified: 900,
      totalPaid: 1000,
      outstanding: 500,
      certificationRate: '30.0',
      collectionRate: '44.4',
      totalLots: 3,
    });
  });
});
