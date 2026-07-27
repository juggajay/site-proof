// Requirement set `claim_member.v1` — the compact verdict stored on each
// `claim_lot` (ClaimedLot.id) / `claim_variation` (Variation.id) snapshot row of
// a claim decision (F0.4b PR 5).
//
// HARD BUDGET: ≤ 1 KB serialized — `recordDecision`'s `MEMBER_RESULT_MAX_BYTES`
// rejects the whole decision otherwise, and 5,000 of these ride on one claim
// (execution spec §3 `[R3-3]`, §11 F0.4b PR 0 `[R3.1-B3]`). That is why this
// payload is booleans + reason codes + one value, and why it can never grow an
// evidence list: the full detail stays request-time computable from the same
// predicates.

import type { SufficiencyEvaluation } from '../sufficiency/evaluate.js';
import {
  buildSufficiencyAggregateV1,
  type SufficiencyAggregateV1,
} from '../sufficiency/snapshot.js';
import type { ReadinessReasonCode } from '../contracts/reasonCodes.js';
import {
  blockingReasonCodes,
  decodeAtVersion1,
  type ReadinessItemLike,
  type SnapshotResultRow,
} from './shared.js';

export const CLAIM_MEMBER_REQUIREMENT_SET = 'claim_member.v1';
export const CLAIM_MEMBER_RESULT_SCHEMA_VERSION = 1;

/**
 * The claim slice of the closed F0.3 vocabulary: `buildClaimItems`
 * (`evidenceReadiness.ts`) plus the per-lot review items (`claimReview.ts`) that
 * gate inclusion. Positive codes are excluded — a snapshot records what blocked.
 */
export const CLAIM_MEMBER_REASON_CODES = [
  'already_claimed',
  'partially_claimed',
  'not_conformed',
  'conformance_no_longer_current',
  'conformance_overridden',
  'missing_budget',
  'unreleased_hold_points',
  'pending_tests',
  'itp_incomplete',
  'no_itp',
  'unreleased_itp_hold_points',
  'no_tests',
  'failed_tests',
  'open_major_ncrs',
  'open_minor_ncrs',
  'no_photos',
  'low_photo_evidence',
] as const satisfies readonly ReadinessReasonCode[];

export type ClaimMemberReasonCode = (typeof CLAIM_MEMBER_REASON_CODES)[number];

/** The `result` payload persisted at `resultSchemaVersion: 1`. */
export type ClaimMemberResultV1 = {
  /** Which grain this row is — the snapshot's `entityType` says the same, in DB terms. */
  memberType: 'lot' | 'variation';
  /** Nothing blocked this member's inclusion at decision time. */
  ready: boolean;
  /** Sorted, deduped, bounded by {@link CLAIM_MEMBER_REASON_CODES}. */
  blockingReasonCodes: ClaimMemberReasonCode[];
  /**
   * The amount claimed for this member, UNFILTERED (spec §5) — any future read
   * surface must re-apply `filterCommercialReadiness` before showing it.
   */
  claimedValue: number;
  /** Cumulative percentage claimed after this decision, when the member is a lot. */
  claimedPercentage?: number;
  /**
   * Wave C1.2 (spec §5.4.3 `[C1R-B4]`). The FIXED-WIDTH aggregate — never the
   * rule list. `MEMBER_RESULT_MAX_BYTES` is 1 KB with ~595 bytes of headroom
   * today, `assertSnapshotSizes` THROWS 500 instead of truncating, and it runs
   * regardless of the snapshot flag — so an oversized member payload would 500
   * a whole 5,000-member claim create. At the spec's 35-character rule-id
   * format ~11 rules would exhaust the headroom, and `Ruleset.rules` has no
   * cap. Three scalars cannot. §14 AT-13 asserts it at 10,000 synthetic rules.
   *
   * ALWAYS EMITTED; optional in the type so a pre-C1 row still decodes.
   */
  sufficiency?: SufficiencyAggregateV1;
};

export interface ClaimMemberEvaluation {
  memberType: 'lot' | 'variation';
  items?: readonly ReadinessItemLike[];
  claimedValue: number;
  claimedPercentage?: number;
  /** Null for a variation member: sufficiency is a LOT concept (§5.3). */
  sufficiency?: SufficiencyEvaluation | null;
}

/** Money/percentage rounding, so a float sum never lands `100.00000000000001` in evidence. */
function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function buildClaimMemberResultV1(evaluation: ClaimMemberEvaluation): ClaimMemberResultV1 {
  const codes = blockingReasonCodes(evaluation.items ?? [], CLAIM_MEMBER_REASON_CODES);
  return {
    memberType: evaluation.memberType,
    ready: codes.length === 0,
    blockingReasonCodes: codes,
    claimedValue: round2(evaluation.claimedValue),
    ...(evaluation.claimedPercentage === undefined
      ? {}
      : { claimedPercentage: round2(evaluation.claimedPercentage) }),
    sufficiency: buildSufficiencyAggregateV1(evaluation.sufficiency),
  };
}

export function decodeClaimMemberResult(row: SnapshotResultRow): ClaimMemberResultV1 {
  return decodeAtVersion1(row, CLAIM_MEMBER_REQUIREMENT_SET);
}
