// Requirement set `hold_point_release.v1` — what readiness looked like when a
// hold point was released, authenticated or by public token, single or batch
// (F0.4b PR 3 and PR 4).
//
// The verdict shape is the F0.3 contract's `HoldPointPackageVerdict` minus its
// subject identity: `entityType`/`entityId` are already snapshot COLUMNS, so
// repeating them in the JSON would be two sources of truth for one fact
// (execution spec §11 F0.4b PR 0 `[R3.1-B3]`).

import type { HoldPointPackageVerdict, HoldPointReasonCode } from '../contracts/futureConsumers.js';
import {
  blockingReasonCodes,
  decodeAtVersion1,
  type ReadinessItemLike,
  type SnapshotResultRow,
} from './shared.js';

export const HOLD_POINT_RELEASE_REQUIREMENT_SET = 'hold_point_release.v1';
export const HOLD_POINT_RELEASE_RESULT_SCHEMA_VERSION = 1;

/** The hold-point slice of the vocabulary — same set the F0.3 contract narrows to. */
export const HOLD_POINT_RELEASE_REASON_CODES = [
  'unreleased_hold_points',
  'na_hold_point_not_released',
  'unreleased_itp_hold_points',
  'release_gated_hold_points',
  'missing_hold_point_recipients',
] as const satisfies readonly HoldPointReasonCode[];

/**
 * The `result` payload at `resultSchemaVersion: 1`. Reuses the F0.3 verdict so
 * the future hold-point-package consumer and this snapshot cannot drift apart.
 *
 * A `type` alias, not an `interface`, so it is directly assignable to Prisma's
 * `InputJsonValue` (interfaces get no implicit index signature) — the same
 * reason every `*ResultV1` in this folder is a type alias. Route adoption
 * (F0.4b PRs 1–5) therefore needs no casts to store one of these.
 */
export type HoldPointReleaseResultV1 = Omit<
  HoldPointPackageVerdict,
  'subjectType' | 'subjectId'
> & {
  /**
   * PR 4: a public BATCH release is ONE decision with N `hold_point` snapshot
   * rows under one audit row `[R3.1-R4]`. This correlates the row back to the
   * `HoldPointReleaseBatch` it was released in; absent for single releases.
   */
  batchId?: string;
  /** Members in the batch decision, on every row of that batch. Absent for singles. */
  batchSize?: number;
};

export interface HoldPointReleaseEvaluation {
  /** Every hold point in scope is released at decision time. */
  released: boolean;
  /** Readiness items for the hold point (or the batch's review room). */
  items: readonly ReadinessItemLike[];
  batchId?: string;
  batchSize?: number;
}

export function buildHoldPointReleaseResultV1(
  evaluation: HoldPointReleaseEvaluation,
): HoldPointReleaseResultV1 {
  return {
    released: evaluation.released,
    reasonCodes: blockingReasonCodes(evaluation.items, HOLD_POINT_RELEASE_REASON_CODES),
    ...(evaluation.batchId ? { batchId: evaluation.batchId } : {}),
    ...(evaluation.batchSize === undefined ? {} : { batchSize: evaluation.batchSize }),
  };
}

export function decodeHoldPointReleaseResult(row: SnapshotResultRow): HoldPointReleaseResultV1 {
  return decodeAtVersion1(row, HOLD_POINT_RELEASE_REQUIREMENT_SET);
}
