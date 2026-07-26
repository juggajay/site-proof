// Requirement set `ncr_closure.v1` — what readiness looked like when an NCR was
// closed, closed by concession, or QM-approved (F0.4b PR 2).
//
// A NEW shape: no F0.3 contract covers NCR closure, so this is the minimum the
// spec allows — booleans, reason codes and counts, never an evidence dump
// (execution spec §11 F0.4b PR 0 `[R3.1-B3]`).

import type { ReadinessReasonCode } from '../contracts/reasonCodes.js';
import {
  blockingReasonCodes,
  decodeAtVersion1,
  truncateReasonText,
  type ReadinessItemLike,
  type SnapshotResultRow,
} from './shared.js';

export const NCR_CLOSURE_REQUIREMENT_SET = 'ncr_closure.v1';
export const NCR_CLOSURE_RESULT_SCHEMA_VERSION = 1;

/** The NCR slice of the closed F0.3 vocabulary. */
export const NCR_CLOSURE_REASON_CODES = [
  'open_ncrs',
  'open_major_ncrs',
  'open_minor_ncrs',
] as const satisfies readonly ReadinessReasonCode[];

export type NcrClosureReasonCode = (typeof NCR_CLOSURE_REASON_CODES)[number];

/** The `result` payload persisted at `resultSchemaVersion: 1`. */
export type NcrClosureResultV1 = {
  /** `decisionKind: 'closure'` reached its terminal state (vs a QM approval step). */
  closed: boolean;
  /** Closed by concession rather than by rectification (`decisionKind: 'concession'`). */
  byConcession: boolean;
  /**
   * Serious at decision time — the CANONICAL `ncrSerious` (`severity ===
   * 'major'`, execution spec §2). PR 0's comment cited
   * `ncrSeriousIncludingCritical`; that is the DEPRECATED pre-F0.2b variant with
   * no production call site, so PR 2's adoption binds to the unified predicate
   * instead (identical verdict — `'critical'` is not a schema severity value).
   */
  serious: boolean;
  /** Still-blocking codes at decision time; empty when the NCR closed clean. */
  blockingReasonCodes: NcrClosureReasonCode[];
  /**
   * Lots this closure cascaded a status read over (PR 2 moves that read inside
   * `evaluate(tx)`). A COUNT, not ids — the lot rows are recoverable from
   * `NCRLot` and an id array is how a payload grows without a budget.
   */
  affectedLotCount: number;
  /** Concession/closure provenance, truncated (spec §6). */
  reason?: string;
};

export interface NcrClosureEvaluation {
  closed: boolean;
  byConcession?: boolean;
  serious: boolean;
  items?: readonly ReadinessItemLike[];
  affectedLotCount: number;
  reason?: string | null;
}

export function buildNcrClosureResultV1(evaluation: NcrClosureEvaluation): NcrClosureResultV1 {
  const reason = truncateReasonText(evaluation.reason);
  return {
    closed: evaluation.closed,
    byConcession: evaluation.byConcession === true,
    serious: evaluation.serious,
    blockingReasonCodes: blockingReasonCodes(evaluation.items ?? [], NCR_CLOSURE_REASON_CODES),
    affectedLotCount: evaluation.affectedLotCount,
    ...(reason ? { reason } : {}),
  };
}

export function decodeNcrClosureResult(row: SnapshotResultRow): NcrClosureResultV1 {
  return decodeAtVersion1(row, NCR_CLOSURE_REQUIREMENT_SET);
}
