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
  certifiedAt?: Date | null;
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

/**
 * The id, variation notes, and certifier of an external certificate parsed out
 * of the JSON that the certify workflow stores in the `disputeNotes` column.
 */
export interface ParsedClaimCertification {
  certifiedById: string | null;
  variationNotes: string | null;
  certificationDocumentId: string | null;
}

/**
 * Parse the certification metadata the certify workflow stores as JSON in the
 * `disputeNotes` column ({ variationNotes, certificationDocumentId,
 * certifiedBy }). The payment workflow merges `paymentHistory` into the same
 * JSON while retaining these keys, so a certified→partially_paid/paid claim
 * still parses. Returns null for plain-string disputeNotes (legacy or the
 * disputed-claim path) and for JSON without any certification keys, so the raw
 * `disputeNotes` field is never reinterpreted as certification data.
 */
export function parseClaimCertificationMetadata(
  disputeNotes: string | null | undefined,
): ParsedClaimCertification | null {
  if (!disputeNotes) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(disputeNotes);
  } catch {
    // Plain-string disputeNotes (e.g. a dispute reason) is not certification
    // metadata.
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const hasCertificationKeys =
    'certifiedBy' in record || 'variationNotes' in record || 'certificationDocumentId' in record;
  if (!hasCertificationKeys) {
    return null;
  }

  return {
    certifiedById: typeof record.certifiedBy === 'string' ? record.certifiedBy : null,
    variationNotes: typeof record.variationNotes === 'string' ? record.variationNotes : null,
    certificationDocumentId:
      typeof record.certificationDocumentId === 'string' ? record.certificationDocumentId : null,
  };
}

/**
 * Shape the parsed certification metadata into the read-back object the
 * frontend renders, resolving the certifier id to a display name via the
 * provided lookup map. Returns null when there is no certification metadata.
 */
export function buildClaimCertificationView(
  disputeNotes: string | null | undefined,
  certifierNameById?: Map<string, string | null>,
): {
  certifiedByName: string | null;
  variationNotes: string | null;
  certificationDocumentId: string | null;
} | null {
  const parsed = parseClaimCertificationMetadata(disputeNotes);
  if (!parsed) {
    return null;
  }

  const certifiedByName = parsed.certifiedById
    ? (certifierNameById?.get(parsed.certifiedById) ?? null)
    : null;

  return {
    certifiedByName,
    variationNotes: parsed.variationNotes,
    certificationDocumentId: parsed.certificationDocumentId,
  };
}

export function getClaimReadDisputeNotes(disputeNotes: string | null | undefined): string | null {
  if (!disputeNotes) {
    return null;
  }

  try {
    const parsed = JSON.parse(disputeNotes);
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      if ('disputeNotes' in record) {
        return typeof record.disputeNotes === 'string' ? record.disputeNotes : null;
      }
      return null;
    }
  } catch {
    // Plain-string dispute notes are the normal disputed-claim read shape.
  }

  return disputeNotes;
}

export function mapClaimableLot(lot: ClaimableLot) {
  return {
    id: lot.id,
    lotNumber: lot.lotNumber,
    activity: lot.activityType,
    budgetAmount: lot.budgetAmount ? Number(lot.budgetAmount) : 0,
  };
}

export function mapClaimListItem(
  claim: ClaimListItem,
  projectState?: string | null,
  certifierNameById?: Map<string, string | null>,
) {
  return {
    id: claim.id,
    claimNumber: claim.claimNumber,
    periodStart: formatClaimDateKey(claim.claimPeriodStart),
    periodEnd: formatClaimDateKey(claim.claimPeriodEnd),
    status: claim.status,
    totalClaimedAmount: claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0,
    certifiedAmount: claim.certifiedAmount ? Number(claim.certifiedAmount) : null,
    certifiedAt: claim.certifiedAt ? claim.certifiedAt.toISOString() : null,
    paidAmount: claim.paidAmount ? Number(claim.paidAmount) : null,
    submittedAt: claim.submittedAt ? formatClaimDateKey(claim.submittedAt) : null,
    disputeNotes: getClaimReadDisputeNotes(claim.disputeNotes),
    disputedAt: claim.disputedAt ? formatClaimDateKey(claim.disputedAt) : null,
    lotCount: claim._count.claimedLots,
    // The project's jurisdiction drives the SOPA certification/payment-due
    // timeframes the frontend renders. Null when unknown so the client can
    // fall back to NSW (its historical default).
    projectState: projectState ?? null,
    // Read-back of the external certificate metadata parsed out of the JSON the
    // certify workflow stores in `disputeNotes`. Null when there is none.
    certification: buildClaimCertificationView(claim.disputeNotes, certifierNameById),
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
