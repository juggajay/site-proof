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

  it('rounds report amount arithmetic to cents', () => {
    expect(
      buildClaimReportAmounts({
        totalClaimedAmount: 0.1 + 0.2,
        certifiedAmount: 0.1,
        paidAmount: 0.03,
      }),
    ).toEqual({
      totalClaimedAmount: 0.3,
      certifiedAmount: 0.1,
      paidAmount: 0.03,
      variance: 0.2,
      outstanding: 0.07,
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

  it('rounds report financial summary totals to cents', () => {
    expect(
      buildClaimReportFinancialSummary([
        {
          status: 'certified',
          totalClaimedAmount: 0.1,
          certifiedAmount: 0.1,
          paidAmount: 0.03,
          lotCount: 1,
        },
        {
          status: 'certified',
          totalClaimedAmount: 0.2,
          certifiedAmount: 0.2,
          paidAmount: 0.04,
          lotCount: 1,
        },
      ]),
    ).toMatchObject({
      totalClaimed: 0.3,
      totalCertified: 0.3,
      totalPaid: 0.07,
      outstanding: 0.23,
    });
  });
});
