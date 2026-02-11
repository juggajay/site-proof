/**
 * Constants for Claims-related pages and components.
 * Extracted from ClaimsPage.tsx for reusability.
 */

import type { ClaimPackageOptions } from '@/lib/pdfGenerator'

// SOPA timeframes by Australian state (business days for payment)
export const SOPA_TIMEFRAMES: Record<string, { responseTime: number; paymentTime: number; label: string }> = {
  NSW: { responseTime: 10, paymentTime: 15, label: 'NSW (Building and Construction Industry Security of Payment Act 1999)' },
  VIC: { responseTime: 10, paymentTime: 15, label: 'VIC (Building and Construction Industry Security of Payment Act 2002)' },
  QLD: { responseTime: 10, paymentTime: 15, label: 'QLD (Building Industry Fairness (Security of Payment) Act 2017)' },
  WA: { responseTime: 14, paymentTime: 28, label: 'WA (Building and Construction Industry (Security of Payment) Act 2021)' },
  SA: { responseTime: 10, paymentTime: 15, label: 'SA (Building and Construction Industry Security of Payment Act 2009)' },
  TAS: { responseTime: 10, paymentTime: 15, label: 'TAS (Building and Construction Industry Security of Payment Act 2009)' },
  NT: { responseTime: 10, paymentTime: 15, label: 'NT (Construction Contracts (Security of Payments) Act 2004)' },
  ACT: { responseTime: 10, paymentTime: 15, label: 'ACT (Building and Construction Industry (Security of Payment) Act 2009)' },
}

// Default package options for evidence package generation
export const DEFAULT_PACKAGE_OPTIONS: ClaimPackageOptions = {
  includeLotSummary: true,
  includeLotDetails: true,
  includeITPChecklists: true,
  includeTestResults: true,
  includeNCRs: true,
  includeHoldPoints: true,
  includePhotos: true,
  includeDeclaration: true,
}

// Demo data for claims when API is unavailable
export const DEMO_CLAIMS = [
  {
    id: '1',
    claimNumber: 1,
    periodStart: '2025-09-01',
    periodEnd: '2025-09-30',
    status: 'paid' as const,
    totalClaimedAmount: 85000,
    certifiedAmount: 82000,
    paidAmount: 82000,
    submittedAt: '2025-10-05',
    disputeNotes: null,
    disputedAt: null,
    lotCount: 6
  },
  {
    id: '2',
    claimNumber: 2,
    periodStart: '2025-10-01',
    periodEnd: '2025-10-31',
    status: 'paid' as const,
    totalClaimedAmount: 112000,
    certifiedAmount: 110000,
    paidAmount: 110000,
    submittedAt: '2025-11-05',
    disputeNotes: null,
    disputedAt: null,
    lotCount: 9
  },
  {
    id: '3',
    claimNumber: 3,
    periodStart: '2025-11-01',
    periodEnd: '2025-11-30',
    status: 'paid' as const,
    totalClaimedAmount: 145000,
    certifiedAmount: 142500,
    paidAmount: 142500,
    submittedAt: '2025-12-05',
    disputeNotes: null,
    disputedAt: null,
    lotCount: 12
  },
  {
    id: '4',
    claimNumber: 4,
    periodStart: '2025-12-01',
    periodEnd: '2025-12-31',
    status: 'certified' as const,
    totalClaimedAmount: 168000,
    certifiedAmount: 165000,
    paidAmount: null,
    submittedAt: '2026-01-05',
    disputeNotes: null,
    disputedAt: null,
    lotCount: 14
  },
  {
    id: '5',
    claimNumber: 5,
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    status: 'submitted' as const,
    totalClaimedAmount: 89500,
    certifiedAmount: null,
    paidAmount: null,
    submittedAt: '2026-01-07',
    disputeNotes: null,
    disputedAt: null,
    lotCount: 8
  }
]

// Demo conformed lots when API is unavailable
export const DEMO_CONFORMED_LOTS = [
  { id: '1', lotNumber: 'LOT-005', activity: 'Earthworks', budgetAmount: 25000, selected: false, percentComplete: 100 },
  { id: '2', lotNumber: 'LOT-006', activity: 'Drainage', budgetAmount: 18000, selected: false, percentComplete: 100 },
  { id: '3', lotNumber: 'LOT-007', activity: 'Pavement', budgetAmount: 32000, selected: false, percentComplete: 100 }
]
