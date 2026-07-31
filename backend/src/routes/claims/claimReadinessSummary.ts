// Wave F increment F1 — project-level blocked-value aggregation
// (`docs/plans/wave-f-claim-readiness-spec-2026-07-31.md` §1.2).
//
// ZERO new readiness computation lives here. Every input row is a
// `LotEvidenceReadiness` already produced by `buildLotReadinessFromInputs` on
// the shipped claim-readiness path; this module only sums it and groups it by
// the shipped reason-code vocabulary.
//
// Two deliberate shape decisions, both from the spec:
//
//   1. AGGREGATE ONLY (§1.2 `[FR-B7]`). The route feeds pages of rows through
//      `accumulate` and keeps sums — it never materialises 5,000 view-models.
//      That is why the endpoint fits its budget (§4.3) and why it is the
//      sanctioned replacement for the legacy unpaginated full-list path.
//   2. A LOT APPEARS IN EVERY GROUP THAT BLOCKS IT (§1.2 `[FR-B2]`). Group
//      values therefore OVERLAP and do not sum to `blockedValue`. Primary-reason
//      attribution was rejected upstream: it needs a priority order over 17
//      codes that nothing in the product defines. The UI states the overlap;
//      `AT-F1-OVERLAP` pins it in both directions.

import type { EvidenceReadinessItem, LotEvidenceReadiness } from '../../lib/evidenceReadiness.js';
import {
  CLAIM_MEMBER_REASON_CODES,
  type ClaimMemberReasonCode,
} from '../../lib/readiness/requirements/claimMember.v1.js';
import { blockingReasonCodes } from '../../lib/readiness/requirements/shared.js';

/** Money rounding, per lot, matching `roundClaimAmountToCents`'s grain. */
function round2(value: number): number {
  return Number(value.toFixed(2));
}

/** One lot, reduced to exactly what the aggregate and the drill-down need. */
export interface ClaimReadinessAggregateRow {
  lotId: string;
  lotNumber: string;
  activityType: string | null;
  budgetAmount: number | null;
  claimedPercentage: number;
  remainingPercentage: number;
  /**
   * The shipped definition of "cannot be put on a claim right now" —
   * `CreateClaimModal.tsx:85` disables the checkbox on exactly this predicate.
   * Re-deriving it any other way would let the panel and the modal disagree.
   */
  blocked: boolean;
  /**
   * Empty unless `blocked`. A claimable lot can carry advisory items whose codes
   * are in the vocabulary; letting those form groups would put claimable value
   * under a blocker heading.
   */
  reasonCodes: ClaimMemberReasonCode[];
  /**
   * Value still to claim on this lot. `null` budget stays null rather than
   * becoming `$0` — the count and the value are reported separately so a missing
   * budget is visible instead of silently reading as "nothing blocked here".
   * (Spec §5.5 `[FR-9]`: this is deliberately the opposite of
   * `claims/utils.ts:275`, which nulls to 0. See the F1 PR body.)
   */
  remainingValue: number | null;
}

export function toClaimReadinessAggregateRow(
  lot: { activityType: string | null },
  readiness: LotEvidenceReadiness,
): ClaimReadinessAggregateRow {
  const budgetAmount = readiness.claim.budgetAmount ?? null;
  const claimedPercentage = readiness.claim.claimedPercentage ?? 0;
  const remainingPercentage = readiness.claim.remainingPercentage ?? 100 - claimedPercentage;
  const blocked = readiness.claim.blockers.some((item) => item.blocksAction);

  return {
    lotId: readiness.lotId,
    lotNumber: readiness.lotNumber,
    activityType: lot.activityType,
    budgetAmount,
    claimedPercentage,
    remainingPercentage,
    blocked,
    // Conformance items are read as well as claim items: for a `not_conformed`
    // lot the claim bucket knows only THAT it is not conformed, while the
    // conformance bucket knows why. `blockingReasonCodes` drops non-blocking
    // items and anything outside the closed vocabulary, so this can only ever
    // add codes the claim decision already speaks.
    reasonCodes: blocked
      ? blockingReasonCodes(claimReadinessItems(readiness), CLAIM_MEMBER_REASON_CODES)
      : [],
    remainingValue:
      budgetAmount === null ? null : round2((budgetAmount * remainingPercentage) / 100),
  };
}

/** Every item the two claim-relevant buckets carry, in a stable order. */
export function claimReadinessItems(readiness: LotEvidenceReadiness): EvidenceReadinessItem[] {
  return [
    ...readiness.conformance.blockers,
    ...readiness.conformance.warnings,
    ...readiness.claim.blockers,
    ...readiness.claim.warnings,
  ];
}

export interface ClaimReadinessSummaryGroup {
  code: ClaimMemberReasonCode;
  lotCount: number;
  blockedValue: number;
}

export interface ClaimReadinessSummary {
  /** Full lot budget of every in-scope lot (lots with no budget contribute nothing). */
  totalBudget: number;
  /** Value still to claim on lots that can be selected for a claim now. */
  claimableValue: number;
  /** Value still to claim on lots that cannot. */
  blockedValue: number;
  lotsInScope: number;
  lotsBlocked: number;
  /** Counted here, absent from every value above. */
  lotsWithNullBudget: number;
  /** Overlapping by construction — see the header note and `AT-F1-OVERLAP`. */
  groups: ClaimReadinessSummaryGroup[];
}

/**
 * The running total. Pages of rows are folded in one at a time so the route
 * holds one page, never the whole register.
 */
export class ClaimReadinessAccumulator {
  private totalBudget = 0;
  private claimableValue = 0;
  private blockedValue = 0;
  private lotsInScope = 0;
  private lotsBlocked = 0;
  private lotsWithNullBudget = 0;
  private readonly groups = new Map<ClaimMemberReasonCode, { lotCount: number; value: number }>();

  add(row: ClaimReadinessAggregateRow): void {
    this.lotsInScope += 1;
    if (row.budgetAmount === null) {
      this.lotsWithNullBudget += 1;
    } else {
      this.totalBudget += row.budgetAmount;
    }

    const value = row.remainingValue ?? 0;
    if (row.blocked) {
      this.lotsBlocked += 1;
      this.blockedValue += value;
    } else {
      this.claimableValue += value;
    }

    if (!row.blocked) return;
    for (const code of row.reasonCodes) {
      const group = this.groups.get(code) ?? { lotCount: 0, value: 0 };
      group.lotCount += 1;
      group.value += value;
      this.groups.set(code, group);
    }
  }

  result(): ClaimReadinessSummary {
    return {
      totalBudget: round2(this.totalBudget),
      claimableValue: round2(this.claimableValue),
      blockedValue: round2(this.blockedValue),
      lotsInScope: this.lotsInScope,
      lotsBlocked: this.lotsBlocked,
      lotsWithNullBudget: this.lotsWithNullBudget,
      // Biggest blocked value first; `code` breaks ties so the response is
      // byte-stable for a given dataset.
      groups: [...this.groups]
        .map(([code, group]) => ({
          code,
          lotCount: group.lotCount,
          blockedValue: round2(group.value),
        }))
        .sort((a, b) => b.blockedValue - a.blockedValue || a.code.localeCompare(b.code)),
    };
  }
}

export function summarizeClaimReadiness(
  rows: readonly ClaimReadinessAggregateRow[],
): ClaimReadinessSummary {
  const accumulator = new ClaimReadinessAccumulator();
  for (const row of rows) accumulator.add(row);
  return accumulator.result();
}

/** One drill-down row: the lot, its blocked value, and why it is in this group. */
export function mapBlockedLotForReason(
  row: ClaimReadinessAggregateRow,
  readiness: LotEvidenceReadiness,
  code: ClaimMemberReasonCode,
) {
  return {
    lotId: row.lotId,
    lotNumber: row.lotNumber,
    activityType: row.activityType,
    budgetAmount: row.budgetAmount,
    blockedValue: row.remainingValue,
    claimedPercentage: row.claimedPercentage,
    remainingPercentage: row.remainingPercentage,
    // The engine's own copy — title/detail/actionLabel/actionHref are rendered
    // as-is so the drill-down and the lot page say the same words.
    items: claimReadinessItems(readiness).filter((item) => item.code === code),
  };
}

export function isClaimMemberReasonCode(value: string): value is ClaimMemberReasonCode {
  return (CLAIM_MEMBER_REASON_CODES as readonly string[]).includes(value);
}
