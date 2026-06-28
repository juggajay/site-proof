import { describe, expect, it } from 'vitest';
import type { Claim } from './types';
import {
  buildClaimSummaryTotals,
  buildCumulativeClaimChartData,
  buildMonthlyClaimBreakdownData,
  findClaimById,
} from './claimsPageData';

function makeClaim(overrides: Partial<Claim>): Claim {
  return {
    id: 'claim-1',
    claimNumber: 1,
    periodStart: '2026-01-01T00:00:00.000Z',
    periodEnd: '2026-01-31T00:00:00.000Z',
    status: 'draft',
    totalClaimedAmount: 0,
    certifiedAmount: null,
    paidAmount: null,
    submittedAt: null,
    disputeNotes: null,
    disputedAt: null,
    lotCount: 1,
    ...overrides,
  };
}

describe('buildClaimSummaryTotals', () => {
  it('totals claimed, certified, paid, and outstanding values', () => {
    const totals = buildClaimSummaryTotals([
      makeClaim({ totalClaimedAmount: 1000, certifiedAmount: 900, paidAmount: 400 }),
      makeClaim({ totalClaimedAmount: 2000, certifiedAmount: null, paidAmount: null }),
      makeClaim({ totalClaimedAmount: 500, certifiedAmount: 500, paidAmount: 500 }),
    ]);

    expect(totals).toEqual({
      totalClaimed: 3500,
      totalCertified: 1400,
      totalPaid: 900,
      outstanding: 500,
    });
  });

  it('excludes disputed claims from Total Certified and Outstanding (M42)', () => {
    const totals = buildClaimSummaryTotals([
      makeClaim({
        status: 'certified',
        totalClaimedAmount: 1000,
        certifiedAmount: 900,
        paidAmount: 400,
      }),
      makeClaim({
        status: 'disputed',
        totalClaimedAmount: 2000,
        certifiedAmount: 1500,
        paidAmount: 600,
      }),
    ]);

    // Disputed certified (1500) and its paid (600) drop out of certified/outstanding.
    expect(totals.totalCertified).toBe(900);
    expect(totals.outstanding).toBe(500); // 900 certified - 400 paid (non-disputed)
    // Gross claimed/paid cards still reflect all claims.
    expect(totals.totalClaimed).toBe(3000);
    expect(totals.totalPaid).toBe(1000);
  });

  it('does not display a negative outstanding total for inconsistent payment data', () => {
    const totals = buildClaimSummaryTotals([
      makeClaim({
        status: 'draft',
        totalClaimedAmount: 1000,
        certifiedAmount: null,
        paidAmount: 400,
      }),
    ]);

    expect(totals).toMatchObject({
      totalClaimed: 1000,
      totalCertified: 0,
      totalPaid: 400,
      outstanding: 0,
    });
  });
});

describe('buildCumulativeClaimChartData', () => {
  it('sorts claims by period end and accumulates claimed, certified, and paid amounts', () => {
    const data = buildCumulativeClaimChartData([
      makeClaim({
        claimNumber: 2,
        periodEnd: '2026-02-28T00:00:00.000Z',
        totalClaimedAmount: 2000,
        certifiedAmount: 1500,
        paidAmount: 1000,
      }),
      makeClaim({
        claimNumber: 1,
        periodEnd: '2026-01-31T00:00:00.000Z',
        totalClaimedAmount: 1000,
        certifiedAmount: 900,
        paidAmount: 400,
      }),
    ]);

    expect(data.map((point) => point.claimNumber)).toEqual([1, 2]);
    expect(data[0]).toMatchObject({ name: 'Jan 26', claimed: 1000, certified: 900, paid: 400 });
    expect(data[1]).toMatchObject({ name: 'Feb 26', claimed: 3000, certified: 2400, paid: 1400 });
  });
});

describe('buildMonthlyClaimBreakdownData', () => {
  it('sorts claims by period end and keeps monthly values non-cumulative', () => {
    const data = buildMonthlyClaimBreakdownData([
      makeClaim({
        claimNumber: 2,
        periodEnd: '2026-02-28T00:00:00.000Z',
        status: 'paid',
        totalClaimedAmount: 2000,
        certifiedAmount: 1500,
        paidAmount: 1000,
      }),
      makeClaim({
        claimNumber: 1,
        periodEnd: '2026-01-31T00:00:00.000Z',
        status: 'certified',
        totalClaimedAmount: 1000,
        certifiedAmount: 900,
        paidAmount: null,
      }),
    ]);

    expect(data).toEqual([
      {
        name: 'Jan 26',
        claimNumber: 1,
        claimed: 1000,
        certified: 900,
        paid: 0,
        status: 'certified',
      },
      {
        name: 'Feb 26',
        claimNumber: 2,
        claimed: 2000,
        certified: 1500,
        paid: 1000,
        status: 'paid',
      },
    ]);
  });
});

describe('findClaimById', () => {
  it('returns a matching claim and null for missing modal ids', () => {
    const claim = makeClaim({ id: 'claim-1', claimNumber: 1 });

    expect(findClaimById([claim], 'claim-1')).toBe(claim);
    expect(findClaimById([claim], 'missing')).toBeNull();
    expect(findClaimById([claim], null)).toBeNull();
  });
});
