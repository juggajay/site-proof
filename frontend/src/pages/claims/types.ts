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
  disputeNotes: string | null;
  disputedAt: string | null;
  lotCount: number;
  paymentDueDate?: string | null;
  // The project's Australian state/territory (e.g. 'NSW', 'WA'). Drives the
  // per-jurisdiction SOPA certification/payment-due timeframes. Optional so
  // older payloads (and tests) without it fall back to NSW.
  projectState?: string | null;
  // Read-back of who recorded the external certificate, their notes, and the
  // attached certificate document. Optional so older payloads omit it.
  certification?: ClaimCertification | null;
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
