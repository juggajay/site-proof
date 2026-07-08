/**
 * Constants for Claims-related pages and components.
 * Extracted from ClaimsPage.tsx for reusability.
 */

import type { ClaimPackageOptions } from '@/lib/pdfGenerator';

export const CLAIM_DISPUTE_NOTES_MAX_LENGTH = 5000;
export const CLAIM_VARIATION_NOTES_MAX_LENGTH = 2000;
export const CLAIM_PAYMENT_REFERENCE_MAX_LENGTH = 160;
export const CLAIM_PAYMENT_NOTES_MAX_LENGTH = 3000;

// SOPA timeframes by Australian state, in business days.
// responseTime = deadline for the respondent's payment schedule;
// paymentTime  = due date for the progress payment when the contract is silent.
// Values sourced from docs/research/11-sopa-verification-2026-06.md (§2.1/§5).
// NOTE: these statutory values are pending construction-lawyer sign-off before
// release (see that doc's caveat). NT, TAS and ACT are intentionally omitted:
// NT uses the "West Coast" model (no payment-schedule/endorsement mechanics),
// and TAS/ACT were only Low–Med confidence in the research (§F5). Rather than
// fabricate East-Coast dates, the UI shows "not available" for those
// jurisdictions until their Acts are verified; Tier 2/3 civil buyers are
// overwhelmingly NSW/VIC/QLD/WA/SA.
// Still to do in later PRs: NSW/WA sub-contract payment tiers (need claim
// direction), and the VIC post-15-Apr-2026 reform. The utils layer intentionally
// suppresses due-date output for new VIC claims until the post-reform workflow
// is verified.
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
    // Pre-reform fallback only. Claims submitted on/after 15 Apr 2026 are
    // suppressed in utils.ts until VIC's amended regime is lawyer-signed.
    responseTime: 10,
    paymentTime: 15,
    label: 'VIC (Building and Construction Industry Security of Payment Act 2002)',
  },
  QLD: {
    // QLD BIF Act 2017: the respondent's payment schedule is due within 15
    // business days (s76(1)(b)); the statutory default progress payment is due
    // 10 business days after the claim (s73). The previous 10/15 had these two
    // reversed. (QBCC Act tier caps — 15 BD head / 25 BD subcontract — are not
    // modelled yet; see the claim-direction follow-up PR.)
    responseTime: 15,
    paymentTime: 10,
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
  // NT, TAS and ACT intentionally omitted — see the note above SOPA_TIMEFRAMES.
  // Adding TAS/ACT later requires verifying their Acts (research §F5).
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
  includeVariations: true,
  includeDeclaration: true,
};
