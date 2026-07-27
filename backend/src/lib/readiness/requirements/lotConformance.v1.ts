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
 *
 * ADDED IN C1.2: `insufficient_test_count` (external review F5). The
 * `lotConformable` limb `sufficiencyBlocks` makes the blocker builder emit that
 * code (`evidenceReadiness/conformanceItems.ts`), but this allowlist omitted it
 * and `blockingReasonCodes` drops anything outside the allowlist — so a
 * SUFFICIENCY-ONLY force-conform in `block` mode recorded `conformable: false,
 * overridden: true, blockingReasonCodes: []`. The immutable record could not
 * say what had been overridden, which is the one thing a force-conform snapshot
 * exists to say.
 *
 * V1 EXPANSION, NOT V2 — the same discipline as §5.4.2 `[C1R-B3]`, applied to
 * the enum instead of the payload:
 *
 *  - It is ADDITIVE. A pre-C1.2 row simply never contains the code, and decodes
 *    unchanged: "no sufficiency blocker recorded". Nothing is REINTERPRETED,
 *    because the code could not previously appear from any other cause.
 *  - `decodeAtVersion1` dispatches on the version integer and does not validate
 *    the code set, and there is no read surface for snapshot payloads at all
 *    (`[C1R-C3]`), so no reader can throw on the new value.
 *  - ROLLBACK is symmetric: reverted code stops emitting the code; rows that
 *    already carry it keep decoding, because the version never moved. A bump to
 *    v2 would instead have split `lot_conformance.v1` from `.v2` in the
 *    `requirement_set` column of a live immutable table and made rolled-back
 *    code hard-throw on every v2 row (`shared.ts` `decodeAtVersion1`).
 */
export const LOT_CONFORMANCE_REASON_CODES = [
  'no_itp_assigned',
  'itp_incomplete',
  'no_passing_verified_test',
  'open_ncrs',
  'na_hold_point_not_released',
  'insufficient_test_count',
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
