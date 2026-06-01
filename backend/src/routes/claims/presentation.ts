type ClaimableLot = {
  id: string;
  lotNumber: string;
  activityType: string;
  budgetAmount: unknown;
};

type ClaimListItem = {
  id: string;
  claimNumber: number;
  claimPeriodStart: Date;
  claimPeriodEnd: Date;
  status: string;
  totalClaimedAmount: unknown;
  certifiedAmount: unknown;
  paidAmount: unknown;
  submittedAt: Date | null;
  disputeNotes: string | null;
  disputedAt: Date | null;
  _count: {
    claimedLots: number;
  };
};

function formatClaimDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function mapClaimableLot(lot: ClaimableLot) {
  return {
    id: lot.id,
    lotNumber: lot.lotNumber,
    activity: lot.activityType,
    budgetAmount: lot.budgetAmount ? Number(lot.budgetAmount) : 0,
  };
}

export function mapClaimListItem(claim: ClaimListItem) {
  return {
    id: claim.id,
    claimNumber: claim.claimNumber,
    periodStart: formatClaimDateKey(claim.claimPeriodStart),
    periodEnd: formatClaimDateKey(claim.claimPeriodEnd),
    status: claim.status,
    totalClaimedAmount: claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0,
    certifiedAmount: claim.certifiedAmount ? Number(claim.certifiedAmount) : null,
    paidAmount: claim.paidAmount ? Number(claim.paidAmount) : null,
    submittedAt: claim.submittedAt ? formatClaimDateKey(claim.submittedAt) : null,
    disputeNotes: claim.disputeNotes || null,
    disputedAt: claim.disputedAt ? formatClaimDateKey(claim.disputedAt) : null,
    lotCount: claim._count.claimedLots,
  };
}
