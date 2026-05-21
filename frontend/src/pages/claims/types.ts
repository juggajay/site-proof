/**
 * Type definitions for Claims-related pages and components.
 * Extracted from ClaimsPage.tsx for reusability.
 */

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
  disputeNotes: string | null;
  disputedAt: string | null;
  lotCount: number;
  paymentDueDate?: string | null;
}

export interface ConformedLot {
  id: string;
  lotNumber: string;
  activity: string;
  budgetAmount: number | null;
  selected: boolean;
  percentComplete: string; // 0-100, kept as text so invalid input is not coerced
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
}
