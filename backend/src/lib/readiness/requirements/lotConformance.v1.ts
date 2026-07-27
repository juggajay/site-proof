// Requirement set `lot_conformance.v1` — what readiness looked like when a lot
// was conformed, force-conformed or de-conformed (F0.4b PR 1).
//
// Execution spec §11 F0.4b PR 0 `[R3.1-B3]`; `decisionKind` for both
// force-conform and de-conform is `override`, never `waiver` `[R3.1-B4]`.

import type { SufficiencyEvaluation } from '../sufficiency/evaluate.js';
import { buildSufficiencySnapshotV1, type SufficiencySnapshotV1 } from '../sufficiency/snapshot.js';
import type { ReadinessReasonCode } from '../contracts/reasonCodes.js';
import {
  blockingReasonCodes,
  decodeAtVersion1,
  truncateReasonText,
  type ReadinessItemLike,
  type SnapshotResultRow,
} from './shared.js';

export const LOT_CONFORMANCE_REQUIREMENT_SET = 'lot_conformance.v1';
export const LOT_CONFORMANCE_RESULT_SCHEMA_VERSION = 1;

/**
 * The codes `buildConformanceItems` emits (`evidenceReadiness.ts`), minus the
 * positive/short-circuit ones — a snapshot records what BLOCKED, and "nothing"
 * is the empty array.
 */
export const LOT_CONFORMANCE_REASON_CODES = [
  'no_itp_assigned',
  'itp_incomplete',
  'no_passing_verified_test',
  'open_ncrs',
  'na_hold_point_not_released',
] as const satisfies readonly ReadinessReasonCode[];

export type LotConformanceReasonCode = (typeof LOT_CONFORMANCE_REASON_CODES)[number];

/** The `result` payload persisted at `resultSchemaVersion: 1`. */
export type LotConformanceResultV1 = {
  /** The conform gate's verdict at decision time (`conformStatus.canConform`). */
  conformable: boolean;
  /** True when the decision proceeded despite `conformable: false` (force-conform). */
  overridden: boolean;
  /** Sorted, deduped; empty when nothing blocked. */
  blockingReasonCodes: LotConformanceReasonCode[];
  /** Override/de-conform provenance, truncated (spec §6). Absent when not given. */
  reason?: string;
  /**
   * Wave C1.2 (spec §5.4.2 `[C1R-B3]`). OPTIONAL in the type, ALWAYS EMITTED by
   * {@link buildLotConformanceResultV1} — absence marks a pre-C1 row, which is
   * the discriminator a `resultSchemaVersion` bump would have provided, without
   * splitting a live immutable table.
   *
   * This is where a FORCE-CONFORM past a `block` records exactly what was
   * overridden (§14 AT-16): `blocks: true` plus the per-rule required/have
   * numbers and the clause that carries them.
   */
  sufficiency?: SufficiencySnapshotV1;
};

export interface LotConformanceEvaluation {
  /** `LotConformStatusReadiness.canConform` as read inside the decision tx. */
  canConform: boolean;
  /** The conformance bucket's items — blockers are what get recorded. */
  items: readonly ReadinessItemLike[];
  /** Force-conform / de-conform sets this; a plain conform does not. */
  overridden?: boolean;
  reason?: string | null;
  /** C1.2: `ConformanceCheckResult.sufficiency`, read inside the decision tx. */
  sufficiency?: SufficiencyEvaluation | null;
}

export function buildLotConformanceResultV1(
  evaluation: LotConformanceEvaluation,
): LotConformanceResultV1 {
  const reason = truncateReasonText(evaluation.reason);
  return {
    conformable: evaluation.canConform,
    overridden: evaluation.overridden === true,
    blockingReasonCodes: blockingReasonCodes(evaluation.items, LOT_CONFORMANCE_REASON_CODES),
    ...(reason ? { reason } : {}),
    sufficiency: buildSufficiencySnapshotV1(evaluation.sufficiency),
  };
}

export function decodeLotConformanceResult(row: SnapshotResultRow): LotConformanceResultV1 {
  return decodeAtVersion1(row, LOT_CONFORMANCE_REQUIREMENT_SET);
}
