import type { Claim } from './types';

export interface ClaimSummaryTotals {
  totalClaimed: number;
  totalCertified: number;
  totalPaid: number;
  outstanding: number;
}

export interface CumulativeClaimChartPoint {
  name: string;
  claimNumber: number;
  claimed: number;
  certified: number;
  paid: number;
  claimAmount: number;
  certifiedAmount: number | null;
  paidAmount: number | null;
}

export interface MonthlyClaimBreakdownPoint {
  name: string;
  claimNumber: number;
  claimed: number;
  certified: number;
  paid: number;
  status: Claim['status'];
}

function formatClaimMonth(periodEnd: string): string {
  return new Date(periodEnd).toLocaleDateString('en-AU', {
    month: 'short',
    year: '2-digit',
  });
}

function sortClaimsByPeriodEnd(claims: Claim[]): Claim[] {
  return [...claims].sort(
    (a, b) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime(),
  );
}

export function buildClaimSummaryTotals(claims: Claim[]): ClaimSummaryTotals {
  // Disputed claims are excluded from Total Certified and Outstanding — a
  // contested certification shouldn't be reported as money owed (M42). The gross
  // Claimed/Paid cards still reflect all claims.
  const nonDisputed = claims.filter((c) => c.status !== 'disputed');
  const totalClaimed = claims.reduce((sum, c) => sum + c.totalClaimedAmount, 0);
  const totalCertified = nonDisputed.reduce((sum, c) => sum + (c.certifiedAmount || 0), 0);
  const totalPaid = claims.reduce((sum, c) => sum + (c.paidAmount || 0), 0);
  const nonDisputedPaid = nonDisputed.reduce((sum, c) => sum + (c.paidAmount || 0), 0);

  return {
    totalClaimed,
    totalCertified,
    totalPaid,
    outstanding: totalCertified - nonDisputedPaid,
  };
}

export function buildCumulativeClaimChartData(claims: Claim[]): CumulativeClaimChartPoint[] {
  if (claims.length === 0) return [];

  let cumClaimed = 0;
  let cumCertified = 0;
  let cumPaid = 0;

  return sortClaimsByPeriodEnd(claims).map((c) => {
    cumClaimed += c.totalClaimedAmount;
    cumCertified += c.certifiedAmount || 0;
    cumPaid += c.paidAmount || 0;
    return {
      name: formatClaimMonth(c.periodEnd),
      claimNumber: c.claimNumber,
      claimed: cumClaimed,
      certified: cumCertified,
      paid: cumPaid,
      claimAmount: c.totalClaimedAmount,
      certifiedAmount: c.certifiedAmount,
      paidAmount: c.paidAmount,
    };
  });
}

export function buildMonthlyClaimBreakdownData(claims: Claim[]): MonthlyClaimBreakdownPoint[] {
  if (claims.length === 0) return [];

  return sortClaimsByPeriodEnd(claims).map((c) => ({
    name: formatClaimMonth(c.periodEnd),
    claimNumber: c.claimNumber,
    claimed: c.totalClaimedAmount,
    certified: c.certifiedAmount || 0,
    paid: c.paidAmount || 0,
    status: c.status,
  }));
}

export function findClaimById(claims: Claim[], claimId: string | null): Claim | null {
  return claimId ? (claims.find((claim) => claim.id === claimId) ?? null) : null;
}
