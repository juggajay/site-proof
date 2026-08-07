// The per-lot money bands behind one progress claim — the projection the claim
// detail page renders ("Previously claimed" / "This claim" / "Claimed to date").
//
// Two rules govern everything in this file.
//
// 1. HONESTY. A band is emitted only when it can be truthfully derived from
//    stored data. Anything else is `cents: null` with an `unavailableReason`
//    the UI renders as an em-dash plus a tooltip. Nothing here invents a
//    figure, and nothing here derives a PER-LINE certified amount: certification
//    is recorded at claim level only (`ProgressClaim.certifiedAmount`), so the
//    page shows it at claim level and labels it as such.
//
// 2. DECIMAL SAFETY. Money never touches a JavaScript float. Every stored
//    `Decimal` is converted to integer cents exactly once (see
//    `amountToCents`), and every sum is an integer-cent sum. The API ships
//    cents; the frontend formats but never adds.

import { Prisma } from '@prisma/client';

/**
 * The claim statuses that count as CLAIM HISTORY for the "Previously claimed"
 * band. Every status the codebase can store is accounted for here:
 *
 * - `draft`          EXCLUDED. A draft has not been claimed from anyone; its
 *                    lines are a work in progress that can still be deleted
 *                    (deleting a draft cascades its `ClaimedLot` rows).
 * - `submitted`      included — the claim went to the principal.
 * - `disputed`       included — a disputed claim was submitted first
 *                    (`submitted -> disputed`); the dispute is about the
 *                    response, not about whether the amount was claimed.
 * - `certified`      included.
 * - `partially_paid` included.
 * - `paid`           included.
 *
 * There is no `withdrawn` or `rejected` claim status in this system (see
 * `GENERIC_CLAIM_STATUS_TRANSITIONS` in `workflowValidation.ts`); if one is
 * ever added it must be classified here explicitly rather than falling through.
 *
 * NOTE — this is deliberately a DIFFERENT rule from the draft-reservation logic
 * in `cumulativeClaims.ts`, which sums EVERY claim including drafts. That rule
 * answers "how much of this lot is still available to claim" (a draft reserves
 * the percentage so two drafts cannot both claim it); this rule answers "how
 * much of this lot has actually been claimed to date". Reservation is not
 * history, and the two must not be collapsed.
 */
export const CLAIM_HISTORY_STATUSES = [
  'submitted',
  'disputed',
  'certified',
  'partially_paid',
  'paid',
] as const;

const HUNDRED = new Prisma.Decimal(100);

/**
 * The one rounding policy in this file: a stored money `Decimal` becomes
 * integer cents ONCE, rounded half-up, and every band total is an integer-cent
 * sum of those values.
 *
 * Rounding per stored amount (rather than summing at full precision and
 * rounding the total) is what makes the bands reconcile: "Previously claimed" +
 * "This claim" is exactly "Claimed to date", by integer addition, always. On
 * data this app wrote the rounding is a no-op — `roundClaimAmountToCents`
 * already stores whole cents — so it only bites on legacy/imported rows, where
 * a per-line figure that matches the line as printed is the right answer.
 */
export function amountToCents(
  value: Prisma.Decimal | string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const decimal = new Prisma.Decimal(value);
  if (!decimal.isFinite()) return null;
  return decimal.times(HUNDRED).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

/** A percentage as a plain number at 2dp. Percentages are not money; they are
 * never summed on the client either, but they carry no cent-rounding policy. */
export function percentageToNumber(
  value: Prisma.Decimal | string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  const decimal = new Prisma.Decimal(value);
  if (!decimal.isFinite()) return null;
  return decimal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * One band's value. `cents === null` means the band could not be truthfully
 * derived and `unavailableReason` says why — the UI renders an em-dash with
 * that reason as its tooltip rather than printing a confident $0.
 */
export interface ClaimBandAmount {
  cents: number | null;
  percentage: number | null;
  unavailableReason: string | null;
}

export const BAND_UNAVAILABLE = {
  thisLineHasNoAmount: 'This claim line was recorded without an amount.',
  priorLineHasNoAmount: 'An earlier claim recorded this lot without an amount.',
  dependsOnMissingAmount:
    'Cannot be derived while this line or an earlier claim has no recorded amount.',
} as const;

function band(cents: number | null, percentage: number | null, reason: string | null) {
  return { cents, percentage, unavailableReason: reason };
}

/** Add two bands, propagating unavailability rather than treating null as 0. */
function addBands(a: ClaimBandAmount, b: ClaimBandAmount): ClaimBandAmount {
  if (a.cents === null || b.cents === null) {
    return band(null, null, BAND_UNAVAILABLE.dependsOnMissingAmount);
  }
  const percentage =
    a.percentage === null || b.percentage === null
      ? null
      : percentageToNumber(new Prisma.Decimal(a.percentage).plus(b.percentage));
  return band(a.cents + b.cents, percentage, null);
}

/** A `ClaimedLot` row from an EARLIER claim in the same project. */
export interface PriorClaimedLotRow {
  lotId: string;
  amountClaimed: Prisma.Decimal | string | number | null;
  percentageComplete: Prisma.Decimal | string | number | null;
}

export interface PriorClaimedTotals {
  amount: ClaimBandAmount;
  /** How many earlier claims contributed — the page states its derivation basis. */
  claimCount: number;
}

/**
 * Fold this lot's earlier claim lines into the "Previously claimed" band.
 * A single prior line with a null amount makes the whole band unavailable:
 * silently treating it as $0 would understate history and, worse, would make
 * "Claimed to date" look complete when it is not.
 */
export function foldPriorClaimedLots(rows: PriorClaimedLotRow[]): PriorClaimedTotals {
  let cents = 0;
  let percentage = new Prisma.Decimal(0);
  let missingAmount = false;

  for (const row of rows) {
    const rowCents = amountToCents(row.amountClaimed);
    if (rowCents === null) {
      missingAmount = true;
    } else {
      cents += rowCents;
    }
    const rowPercentage = row.percentageComplete;
    if (rowPercentage !== null && rowPercentage !== undefined) {
      percentage = percentage.plus(new Prisma.Decimal(rowPercentage));
    }
  }

  return {
    amount: missingAmount
      ? band(null, null, BAND_UNAVAILABLE.priorLineHasNoAmount)
      : band(cents, percentageToNumber(percentage), null),
    claimCount: rows.length,
  };
}

/**
 * The Prisma filter for "the same lot's lines on this project's EARLIER claims
 * that count as history". Earlier is by `claimNumber`, which is allocated
 * monotonically per project and is unique per project.
 *
 * Exported so the rule is testable without a database and so there is exactly
 * one place the definition lives.
 */
export function priorClaimedLotsWhere(
  projectId: string,
  claimNumber: number,
  lotIds: string[],
): Prisma.ClaimedLotWhereInput {
  return {
    lotId: { in: lotIds },
    claim: {
      projectId,
      claimNumber: { lt: claimNumber },
      status: { in: [...CLAIM_HISTORY_STATUSES] },
    },
  };
}

/**
 * How a line's amount actually came to be. This is NOT a formula we invent to
 * look clever: claim line amounts are written as
 * `round(lot.budgetAmount * percentageComplete / 100)`
 * (`inclusionDecision.ts`), so `percent_of_lot_budget` is printed only when
 * recomputing that expression against the lot's CURRENT budget reproduces the
 * stored amount exactly. If the lot budget has since been edited (or was never
 * set, or the row predates the rule), the arithmetic would no longer produce
 * the number on screen, so the basis degrades to `recorded_amount` and the UI
 * says the amount is as recorded instead of printing a lie.
 */
export type ClaimLineDerivationBasis = 'percent_of_lot_budget' | 'recorded_amount';

export interface ClaimLineDerivation {
  basis: ClaimLineDerivationBasis;
  percentage: number | null;
  lotBudgetCents: number | null;
}

export function buildClaimLineDerivation(input: {
  amountClaimed: Prisma.Decimal | string | number | null;
  percentageComplete: Prisma.Decimal | string | number | null;
  lotBudgetAmount: Prisma.Decimal | string | number | null;
}): ClaimLineDerivation {
  const percentage = percentageToNumber(input.percentageComplete);
  const lotBudgetCents = amountToCents(input.lotBudgetAmount);
  const amountCents = amountToCents(input.amountClaimed);

  if (
    amountCents === null ||
    lotBudgetCents === null ||
    input.percentageComplete === null ||
    input.percentageComplete === undefined
  ) {
    return { basis: 'recorded_amount', percentage, lotBudgetCents };
  }

  const recomputed = amountToCents(
    new Prisma.Decimal(input.lotBudgetAmount as Prisma.Decimal | string | number)
      .times(new Prisma.Decimal(input.percentageComplete))
      .dividedBy(HUNDRED),
  );

  return {
    basis: recomputed === amountCents ? 'percent_of_lot_budget' : 'recorded_amount',
    percentage,
    lotBudgetCents,
  };
}

/**
 * ITP progress for a lot, as a SEPARATE adjacent fact to the money. It is not a
 * term in any dollar figure on this page: the claim percentage is entered by a
 * human, not derived from the checklist, and printing them as one expression
 * would assert a causal link the data does not have.
 *
 * The completed-item rule mirrors the claim evidence review
 * (`lib/evidenceReadiness/claimReview.ts`): done or N/A counts, but an item
 * that was rejected or is still awaiting verification does not.
 */
export interface ClaimLineItpProgress {
  completed: number;
  total: number;
}

export function buildItpProgress(
  itpInstance: {
    completions: Array<{ status: string; verificationStatus: string }>;
    template: { _count: { checklistItems: number } };
  } | null,
): ClaimLineItpProgress | null {
  if (!itpInstance) return null;
  const completed = itpInstance.completions.filter(
    (completion) =>
      (completion.status === 'completed' || completion.status === 'not_applicable') &&
      completion.verificationStatus !== 'rejected' &&
      completion.verificationStatus !== 'pending_verification',
  ).length;
  return { completed, total: itpInstance.template._count.checklistItems };
}

export interface ClaimBandLotRow {
  id: string;
  amountClaimed: Prisma.Decimal | string | number | null;
  percentageComplete: Prisma.Decimal | string | number | null;
  lot: {
    id: string;
    lotNumber: string;
    description: string | null;
    activityType: string;
    chainageStart: Prisma.Decimal | string | number | null;
    chainageEnd: Prisma.Decimal | string | number | null;
    budgetAmount: Prisma.Decimal | string | number | null;
    itpInstance: {
      completions: Array<{ status: string; verificationStatus: string }>;
      template: { _count: { checklistItems: number } };
    } | null;
  };
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

export interface ClaimBandTotals {
  previouslyClaimed: ClaimBandAmount;
  thisClaim: ClaimBandAmount;
  claimedToDate: ClaimBandAmount;
}

/**
 * The claim's own recorded figures, in cents. Certified and paid are recorded
 * at CLAIM level and are reproduced here verbatim — they are never spread
 * across the lot lines. `totalClaimedCents` may exceed the lot-line subtotal
 * because it also carries variation value.
 */
export interface ClaimLevelAmounts {
  totalClaimedCents: number | null;
  certifiedCents: number | null;
  paidCents: number | null;
}

export interface ClaimBandsProjection {
  lines: ClaimBandLine[];
  /** Totals of the LOT LINES only — a claim's recorded total may also include
   * variations, so these are labelled as a lot-line subtotal and never
   * presented as reconciling to `totalClaimedAmount`. */
  lineTotals: ClaimBandTotals;
  claimLevel: ClaimLevelAmounts;
  /** How many distinct earlier claims fed the "Previously claimed" band, so the
   * page can state its derivation basis instead of implying a frozen ledger. */
  priorClaimCount: number;
  historyStatuses: string[];
}

function chainageToNumber(value: Prisma.Decimal | string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const decimal = new Prisma.Decimal(value);
  return decimal.isFinite() ? decimal.toNumber() : null;
}

/**
 * Build the whole projection.
 *
 * LIVE DERIVATION, BY DESIGN: "Previously claimed" is recomputed from the
 * earlier claims that exist RIGHT NOW. If an earlier claim is later disputed,
 * deleted while a draft, or a new one lands out of order, this band changes.
 * That is why the response carries `priorClaimCount` for the page to state its
 * basis. Snapshotting the bands at submission is a Wave-4 financial-model
 * decision and is deliberately NOT built here.
 */
export function buildClaimBands(input: {
  claimedLots: ClaimBandLotRow[];
  priorRows: PriorClaimedLotRow[];
  /** Distinct earlier claims that contributed any prior row. */
  priorClaimCount: number;
  claim: {
    totalClaimedAmount: Prisma.Decimal | string | number | null;
    certifiedAmount: Prisma.Decimal | string | number | null;
    paidAmount: Prisma.Decimal | string | number | null;
  };
}): ClaimBandsProjection {
  const priorByLotId = new Map<string, PriorClaimedLotRow[]>();
  for (const row of input.priorRows) {
    const existing = priorByLotId.get(row.lotId);
    if (existing) existing.push(row);
    else priorByLotId.set(row.lotId, [row]);
  }

  const lines: ClaimBandLine[] = input.claimedLots.map((claimedLot) => {
    const prior = foldPriorClaimedLots(priorByLotId.get(claimedLot.lot.id) ?? []);
    const thisCents = amountToCents(claimedLot.amountClaimed);
    const thisClaim =
      thisCents === null
        ? band(
            null,
            percentageToNumber(claimedLot.percentageComplete),
            BAND_UNAVAILABLE.thisLineHasNoAmount,
          )
        : band(thisCents, percentageToNumber(claimedLot.percentageComplete), null);

    return {
      claimedLotId: claimedLot.id,
      lotId: claimedLot.lot.id,
      lotNumber: claimedLot.lot.lotNumber,
      description: claimedLot.lot.description,
      activityType: claimedLot.lot.activityType,
      chainageStart: chainageToNumber(claimedLot.lot.chainageStart),
      chainageEnd: chainageToNumber(claimedLot.lot.chainageEnd),
      previouslyClaimed: prior.amount,
      thisClaim,
      claimedToDate: addBands(prior.amount, thisClaim),
      priorClaimCount: prior.claimCount,
      derivation: buildClaimLineDerivation({
        amountClaimed: claimedLot.amountClaimed,
        percentageComplete: claimedLot.percentageComplete,
        lotBudgetAmount: claimedLot.lot.budgetAmount,
      }),
      itp: buildItpProgress(claimedLot.lot.itpInstance),
    };
  });

  return {
    lines,
    lineTotals: {
      previouslyClaimed: totalBand(lines.map((line) => line.previouslyClaimed)),
      thisClaim: totalBand(lines.map((line) => line.thisClaim)),
      claimedToDate: totalBand(lines.map((line) => line.claimedToDate)),
    },
    claimLevel: {
      totalClaimedCents: amountToCents(input.claim.totalClaimedAmount),
      certifiedCents: amountToCents(input.claim.certifiedAmount),
      paidCents: amountToCents(input.claim.paidAmount),
    },
    priorClaimCount: input.priorClaimCount,
    historyStatuses: [...CLAIM_HISTORY_STATUSES],
  };
}

/**
 * Sum a column of bands. A single unavailable cell makes the column total
 * unavailable — a total that quietly skipped a row would be a number nobody
 * could reconcile against the rows above it.
 */
function totalBand(values: ClaimBandAmount[]): ClaimBandAmount {
  if (values.length === 0) return band(0, null, null);
  if (values.some((value) => value.cents === null)) {
    return band(null, null, BAND_UNAVAILABLE.dependsOnMissingAmount);
  }
  return band(
    values.reduce((sum, value) => sum + (value.cents ?? 0), 0),
    null,
    null,
  );
}
