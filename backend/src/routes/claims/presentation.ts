import {
  buildClaimEvidenceReviewFromInputs,
  type ClaimEvidenceReviewInput,
} from '../../lib/evidenceReadiness.js';

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

type ClaimCreateItem = {
  id: string;
  claimNumber: number;
  claimPeriodStart: Date;
  claimPeriodEnd: Date;
  status: string;
  totalClaimedAmount: unknown;
  _count: {
    claimedLots: number;
  };
};

type ClaimReadinessLot = {
  activityType: string;
};

type ClaimReadinessSummary = {
  lotId: string;
  lotNumber: string;
  claim: unknown;
};

type ClaimCertificationItem = {
  id: string;
  claimNumber: number;
  claimPeriodStart: Date;
  claimPeriodEnd: Date;
  status: string;
  totalClaimedAmount: unknown;
  certifiedAmount: unknown;
  certifiedAt: Date | null;
  paidAmount: unknown;
  claimedLots: unknown[];
};

type ClaimPaymentItem = {
  id: string;
  claimNumber: number;
  claimPeriodStart: Date;
  claimPeriodEnd: Date;
  status: string;
  totalClaimedAmount: unknown;
  certifiedAmount: unknown;
  paidAmount: unknown;
  paidAt: Date | null;
  paymentReference: string | null;
  claimedLots: unknown[];
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

export function mapClaimCreateItem(claim: ClaimCreateItem) {
  return {
    id: claim.id,
    claimNumber: claim.claimNumber,
    periodStart: formatClaimDateKey(claim.claimPeriodStart),
    periodEnd: formatClaimDateKey(claim.claimPeriodEnd),
    status: claim.status,
    totalClaimedAmount: claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0,
    certifiedAmount: null,
    paidAmount: null,
    submittedAt: null,
    lotCount: claim._count.claimedLots,
  };
}

export function mapClaimReadinessItem(lot: ClaimReadinessLot, readiness: ClaimReadinessSummary) {
  return {
    lotId: readiness.lotId,
    lotNumber: readiness.lotNumber,
    activityType: lot.activityType,
    claim: readiness.claim,
  };
}

export function buildClaimableLotsResponse<TLot>(lots: TLot[]) {
  return { lots };
}

export function buildClaimReadinessResponse<TLot>(lots: TLot[]) {
  return { lots };
}

export function buildClaimsListResponse<TClaim>(claims: TClaim[]) {
  return { claims };
}

export function buildClaimDetailResponse<TClaim>(claim: TClaim) {
  return { claim };
}

export function buildClaimCreatedResponse<TClaim>(claim: TClaim) {
  return { claim };
}

export function buildClaimEvidencePackageResponse<TEvidencePackage>(
  evidencePackage: TEvidencePackage,
) {
  return evidencePackage;
}

export function buildClaimEvidenceReviewResponse(claim: ClaimEvidenceReviewInput['claim']) {
  return buildClaimEvidenceReviewFromInputs({ claim });
}

export function buildClaimDeletedResponse() {
  return { success: true };
}

export function mapClaimCertificationItem(
  claim: ClaimCertificationItem,
  variationNotes: string | undefined,
  certificationDocumentId: string | null,
) {
  return {
    id: claim.id,
    claimNumber: claim.claimNumber,
    periodStart: formatClaimDateKey(claim.claimPeriodStart),
    periodEnd: formatClaimDateKey(claim.claimPeriodEnd),
    status: claim.status,
    totalClaimedAmount: claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0,
    certifiedAmount: claim.certifiedAmount ? Number(claim.certifiedAmount) : null,
    certifiedAt: claim.certifiedAt?.toISOString() || null,
    paidAmount: claim.paidAmount ? Number(claim.paidAmount) : null,
    lotCount: claim.claimedLots.length,
    variationNotes: variationNotes || null,
    certificationDocumentId,
  };
}

export function buildClaimCertifiedResponse(
  claim: ClaimCertificationItem,
  previousStatus: string,
  variationNotes: string | undefined,
  certificationDocumentId: string | null,
) {
  return {
    claim: mapClaimCertificationItem(claim, variationNotes, certificationDocumentId),
    previousStatus,
    message: 'Claim certified successfully',
  };
}

export function mapClaimPaymentItem(claim: ClaimPaymentItem) {
  return {
    id: claim.id,
    claimNumber: claim.claimNumber,
    periodStart: formatClaimDateKey(claim.claimPeriodStart),
    periodEnd: formatClaimDateKey(claim.claimPeriodEnd),
    status: claim.status,
    totalClaimedAmount: claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0,
    certifiedAmount: claim.certifiedAmount ? Number(claim.certifiedAmount) : null,
    paidAmount: claim.paidAmount ? Number(claim.paidAmount) : null,
    paidAt: claim.paidAt?.toISOString() || null,
    paymentReference: claim.paymentReference || null,
    lotCount: claim.claimedLots.length,
  };
}

export function buildClaimPaymentRecordedResponse(
  claim: ClaimPaymentItem,
  payment: {
    amount: number;
    date: string;
    reference?: string;
    notes?: string;
  },
  outstanding: number,
  previousStatus: string,
  paymentHistory: unknown[],
) {
  return {
    claim: mapClaimPaymentItem(claim),
    payment: {
      amount: payment.amount,
      date: payment.date,
      reference: payment.reference || null,
      notes: payment.notes || null,
    },
    outstanding: Math.max(0, outstanding),
    isFullyPaid: outstanding <= 0,
    previousStatus,
    paymentHistory,
    message:
      outstanding <= 0
        ? 'Claim fully paid'
        : `Partial payment recorded. Outstanding: $${outstanding.toFixed(2)}`,
  };
}
