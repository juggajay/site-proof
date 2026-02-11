/**
 * Type definitions for Claims-related pages and components.
 * Extracted from ClaimsPage.tsx for reusability.
 */

export interface Claim {
  id: string
  claimNumber: number
  periodStart: string
  periodEnd: string
  status: 'draft' | 'submitted' | 'certified' | 'paid' | 'disputed'
  totalClaimedAmount: number
  certifiedAmount: number | null
  paidAmount: number | null
  submittedAt: string | null
  disputeNotes: string | null
  disputedAt: string | null
  lotCount: number
  paymentDueDate?: string | null
}

export interface ConformedLot {
  id: string
  lotNumber: string
  activity: string
  budgetAmount: number
  selected: boolean
  percentComplete: number  // 0-100, for partial claims
}

export interface NewClaimFormData {
  periodStart: string
  periodEnd: string
  selectedLots: string[]
}

export interface CertificationDueStatus {
  text: string
  className: string
  isOverdue: boolean
}

export interface PaymentDueStatus {
  text: string
  className: string
}

export interface CompletenessIssue {
  type: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  suggestion: string
}

export interface CompletenessLotSummary {
  itpStatus: string
  testStatus: string
  holdPointStatus: string
  ncrStatus: string
  photoCount: number
}

export interface CompletenessLot {
  lotId: string
  lotNumber: string
  activityType: string
  claimAmount: number
  completenessScore: number
  recommendation: 'include' | 'review' | 'exclude'
  issues: CompletenessIssue[]
  summary: CompletenessLotSummary
}

export interface CompletenessSummary {
  totalLots: number
  includeCount: number
  reviewCount: number
  excludeCount: number
  averageCompletenessScore: number
  totalClaimAmount: number
  recommendedAmount: number
}

export interface CompletenessData {
  claimId: string
  claimNumber: number
  analyzedAt: string
  summary: CompletenessSummary
  overallSuggestions: string[]
  lots: CompletenessLot[]
}

export type SubmitMethod = 'email' | 'download' | 'portal'
