/**
 * Type definitions for Claims-related pages and components.
 * Extracted from ClaimsPage.tsx for reusability.
 */

// Parsed certification metadata surfaced by the read-side parser. The
// who-certified / variation-notes / certificate-document reference live only
// inside the JSON stored in the `disputeNotes` column on the backend, so the
// server parses them out and returns this sub-object for display. Null when
// the claim has no certification metadata (e.g. drafts, plain-string disputes).
export interface ClaimCertification {
  certifiedByName: string | null;
  variationNotes: string | null;
  certificationDocumentId: string | null;
}

export interface Claim {
  id: string;
  claimNumber: number;
  periodStart: string;
  periodEnd: string;
  status: 'draft' | 'submitted' | 'certified' | 'partially_paid' | 'paid' | 'disputed';
  totalClaimedAmount: number;
  certifiedAmount: number | null;
  paidAmount: number | null;
  submittedAt: string | null;
  certifiedAt?: string | null;
  paidAt?: string | null;
  paymentReference?: string | null;
  disputeNotes: string | null;
  disputedAt: string | null;
  lotCount: number;
  variationCount?: number;
  paymentDueDate?: string | null;
  // The project's Australian state/territory (e.g. 'NSW', 'WA'). Drives the
  // per-jurisdiction SOPA certification/payment-due timeframes. Optional so
  // older payloads (and tests) without it fall back to NSW.
  projectState?: string | null;
  // Read-back of who recorded the external certificate, their notes, and the
  // attached certificate document. Optional so older payloads omit it.
  certification?: ClaimCertification | null;
}

/**
 * One band cell on the claim detail page. Money arrives from the API as integer
 * CENTS and is only ever formatted here — the frontend never sums dollars as
 * floats, and never adds cents across rows either: every total in `bands` was
 * computed server-side on Prisma Decimal.
 *
 * `cents === null` means the figure could not be truthfully derived from stored
 * data; `unavailableReason` is the tooltip explaining why, and the cell renders
 * an em-dash rather than a confident $0.
 */
export interface ClaimBandAmount {
  cents: number | null;
  percentage: number | null;
  unavailableReason: string | null;
}

/**
 * How a line's amount actually came to be. `percent_of_lot_budget` is emitted
 * only when that arithmetic reproduces the stored amount exactly; otherwise the
 * server reports `recorded_amount` and the UI must not print a formula.
 */
export interface ClaimLineDerivation {
  basis: 'percent_of_lot_budget' | 'recorded_amount';
  percentage: number | null;
  lotBudgetCents: number | null;
}

/** ITP progress for the lot behind a claim line. An adjacent FACT, never a term
 * in the dollar figure — the claim percentage is entered by a human. */
export interface ClaimLineItpProgress {
  completed: number;
  total: number;
}

export interface ClaimBandLine {
  claimedLotId: string;
  lotId: string;
  lotNumber: string;
  description: string | null;
  activityType: string;
  chainageStart: number | null;
  chainageEnd: number | null;
  previouslyClaimed: ClaimBandAmount;
  thisClaim: ClaimBandAmount;
  claimedToDate: ClaimBandAmount;
  priorClaimCount: number;
  derivation: ClaimLineDerivation;
  itp: ClaimLineItpProgress | null;
}

export interface ClaimBands {
  lines: ClaimBandLine[];
  lineTotals: {
    previouslyClaimed: ClaimBandAmount;
    thisClaim: ClaimBandAmount;
    claimedToDate: ClaimBandAmount;
  };
  /** The claim's own recorded figures. Certified and paid are CLAIM-level: they
   * are never spread across lines. */
  claimLevel: {
    totalClaimedCents: number | null;
    certifiedCents: number | null;
    paidCents: number | null;
  };
  priorClaimCount: number;
  historyStatuses: string[];
}

export interface ClaimDetailVariation {
  id: string;
  variationNumber: string;
  title: string;
  clientReference: string | null;
  approvedAmount: number | null;
}

/** `GET /api/projects/:projectId/claims/:claimId`. The claim row is returned
 * with its raw column names (it is a Prisma row spread), so this declares only
 * the fields the detail page reads. */
export interface ClaimDetail {
  id: string;
  claimNumber: number;
  claimPeriodStart: string;
  claimPeriodEnd: string;
  status: Claim['status'];
  certifiedAt: string | null;
  paidAt: string | null;
  submittedAt: string | null;
  bands: ClaimBands;
  variations: ClaimDetailVariation[];
  certification: ClaimCertification | null;
}

export interface ConformedLot {
  id: string;
  lotNumber: string;
  activity: string;
  budgetAmount: number | null;
  selected: boolean;
  percentComplete: string; // this claim's increment, 0-100, kept as text so invalid input is not coerced
  // Cumulative claiming: how much of the lot has already been claimed on prior
  // claims, and how much is still available to claim this time.
  claimedPercentage: number;
  remainingPercentage: number;
}

export interface NewClaimFormData {
  periodStart: string;
  periodEnd: string;
  selectedLots: string[];
}

export interface CertificationDueStatus {
  text: string;
  className: string;
  isOverdue: boolean;
}

export interface PaymentDueStatus {
  text: string;
  className: string;
}

export type {
  ClaimEvidenceReview as CompletenessData,
  ClaimEvidenceReviewLot as CompletenessLot,
} from '@/types/evidenceReadiness';

export type SubmitMethod = 'download';

export interface ClaimPaymentFormData {
  paidAmount: number;
  paymentDate?: string;
  paymentReference?: string;
  paymentNotes?: string;
  operationKey?: string;
}

export interface ClaimCertificationFormData {
  certifiedAmount: number;
  certificationDate?: string;
  variationNotes?: string;
  // Id of an existing Document (created by the documents-upload endpoint) that
  // holds the external certificate / payment-schedule PDF. The /certify
  // endpoint validates it references a document in this project.
  certificationDocumentId?: string;
}
