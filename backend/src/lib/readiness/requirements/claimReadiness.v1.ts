// Requirement set `claim_readiness.v1` — the AGGREGATE row of a claim decision
// (entityType `claim`, one per decision alongside its N member rows; F0.4b PR 5).
//
// COUNTS AND TOTALS ONLY. No member-id arrays, ever: 5,000 uuids is ~185 KB and
// would blow `RESULT_MAX_BYTES` (64 KB) — and the member ids are already the
// `entity_id` column of the member rows written under the same audit row, so an
// array here would be a second, unindexed copy (execution spec §3 `[R3-3]`, §11
// F0.4b PR 0 `[R3.1-B3]`).

import type { ClaimMemberReasonCode, ClaimMemberResultV1 } from './claimMember.v1.js';
import { decodeAtVersion1, type SnapshotResultRow } from './shared.js';

export const CLAIM_READINESS_REQUIREMENT_SET = 'claim_readiness.v1';
export const CLAIM_READINESS_RESULT_SCHEMA_VERSION = 1;

/** The `result` payload persisted at `resultSchemaVersion: 1`. */
export type ClaimReadinessResultV1 = {
  memberCounts: {
    total: number;
    /** `claim_lot` rows (keyed by ClaimedLot.id). */
    lots: number;
    /** `claim_variation` rows (keyed by Variation.id). */
    variations: number;
    ready: number;
    blocked: number;
  };
  /** UNFILTERED commercial total (spec §5) — sum of the member `claimedValue`s. */
  totalClaimedValue: number;
  /**
   * How many members each blocking code stopped. Bounded by the vocabulary
   * (`CLAIM_MEMBER_REASON_CODES`, 17 entries), so this object's size does NOT
   * grow with member count — that is the property the 5,000-member budget test
   * pins.
   */
  blockingReasonCounts: Partial<Record<ClaimMemberReasonCode, number>>;
};

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * Built FROM the member verdicts, not alongside them — the aggregate cannot
 * disagree with the rows it summarises if it is derived from them.
 */
export function buildClaimReadinessResultV1(
  members: readonly ClaimMemberResultV1[],
): ClaimReadinessResultV1 {
  const blockingReasonCounts: Partial<Record<ClaimMemberReasonCode, number>> = {};
  let lots = 0;
  let ready = 0;
  let totalClaimedValue = 0;

  for (const member of members) {
    if (member.memberType === 'lot') lots += 1;
    if (member.ready) ready += 1;
    totalClaimedValue += member.claimedValue;
    for (const code of member.blockingReasonCodes) {
      blockingReasonCounts[code] = (blockingReasonCounts[code] ?? 0) + 1;
    }
  }

  return {
    memberCounts: {
      total: members.length,
      lots,
      variations: members.length - lots,
      ready,
      blocked: members.length - ready,
    },
    totalClaimedValue: round2(totalClaimedValue),
    blockingReasonCounts,
  };
}

export function decodeClaimReadinessResult(row: SnapshotResultRow): ClaimReadinessResultV1 {
  return decodeAtVersion1(row, CLAIM_READINESS_REQUIREMENT_SET);
}
