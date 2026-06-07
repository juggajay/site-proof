/**
 * Constants for Claims-related pages and components.
 * Extracted from ClaimsPage.tsx for reusability.
 */

import type { ClaimPackageOptions } from '@/lib/pdfGenerator';

export const CLAIM_DISPUTE_NOTES_MAX_LENGTH = 5000;
export const CLAIM_VARIATION_NOTES_MAX_LENGTH = 2000;
export const CLAIM_PAYMENT_REFERENCE_MAX_LENGTH = 160;
export const CLAIM_PAYMENT_NOTES_MAX_LENGTH = 3000;

// SOPA timeframes by Australian state (business days for payment)
export const SOPA_TIMEFRAMES: Record<
  string,
  { responseTime: number; paymentTime: number; label: string }
> = {
  NSW: {
    responseTime: 10,
    paymentTime: 15,
    label: 'NSW (Building and Construction Industry Security of Payment Act 1999)',
  },
  VIC: {
    responseTime: 10,
    paymentTime: 15,
    label: 'VIC (Building and Construction Industry Security of Payment Act 2002)',
  },
  QLD: {
    responseTime: 10,
    paymentTime: 15,
    label: 'QLD (Building Industry Fairness (Security of Payment) Act 2017)',
  },
  WA: {
    // WA SOPA Act 2021: payment schedule due within 15 business days; principal
    // must pay a head contractor within 20 business days (28 calendar days) of
    // the claim. addBusinessDays counts business days, so the payment figure is
    // 20 business days here (the previous 28 conflated calendar with business
    // days and overstated the WA due date).
    responseTime: 15,
    paymentTime: 20,
    label: 'WA (Building and Construction Industry (Security of Payment) Act 2021)',
  },
  SA: {
    // SA SOPA Act 2009: payment schedule due within 15 business days; if the
    // contract is silent the progress payment is due 15 business days after the
    // claim (the previous response value of 10 was incorrect).
    responseTime: 15,
    paymentTime: 15,
    label: 'SA (Building and Construction Industry Security of Payment Act 2009)',
  },
  TAS: {
    responseTime: 10,
    paymentTime: 15,
    label: 'TAS (Building and Construction Industry Security of Payment Act 2009)',
  },
  NT: {
    responseTime: 10,
    paymentTime: 15,
    label: 'NT (Construction Contracts (Security of Payments) Act 2004)',
  },
  ACT: {
    responseTime: 10,
    paymentTime: 15,
    label: 'ACT (Building and Construction Industry (Security of Payment) Act 2009)',
  },
};

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
};
