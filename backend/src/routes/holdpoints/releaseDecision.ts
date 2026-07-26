// F0.4b PR 3/PR 4 — the readiness a hold-point RELEASE decision records, shared
// by the authenticated route, the public single-token route and the public batch
// review room (execution spec §11 F0.4b PR 3, PR 4).
//
// One module rather than three copies: the three routes reach the same decision
// from different trust boundaries, and a snapshot that meant different things
// depending on which door the releaser came through would be worthless as
// evidence.
//
// Both helpers take a LIST of hold point ids. A single release passes one id, a
// batch release passes all N — same code, and the `notIn` below is what makes
// the batch's sibling count mean the right thing (see below).

import type { Prisma } from '@prisma/client';

import type { DecisionSnapshotInput } from '../../lib/readiness/recordDecision.js';
import {
  HOLD_POINT_RELEASE_REQUIREMENT_SET,
  HOLD_POINT_RELEASE_RESULT_SCHEMA_VERSION,
  buildHoldPointReleaseResultV1,
  type HoldPointReleaseEvaluation,
} from '../../lib/readiness/requirements/holdPointRelease.v1.js';

/** The two statuses `holdPointReleased` treats as done (see publicReleaseExecution). */
const TERMINAL_HOLD_POINT_STATUSES = ['released', 'completed'];

/**
 * Readiness for ONE release decision covering `holdPointIds`, read inside the
 * decision's serializable transaction.
 *
 * `released: true` is the F0.3 verdict's "every hold point in scope is
 * released" — the scope of a release decision is the hold points it decides,
 * and the mutate guards mean the decision only commits if it genuinely released
 * all of them.
 *
 * The one blocker worth recording is the LOT picture this release leaves
 * behind: sibling hold points still outstanding. That is the difference between
 * "released the last hold point on the lot" and "released one of five", which is
 * exactly what a later reader of the evidence wants and cannot reconstruct from
 * the hold point's own row.
 *
 * `notIn` the WHOLE decided set, not just one id: a batch releasing 2 of 3 hold
 * points leaves 1 outstanding, and counting its own siblings as blockers would
 * make every batch row read "unreleased_hold_points" no matter what it cleared.
 * Running BEFORE `mutate` is still correct for the same reason it was for a
 * single release — the excluded ids are exactly the ones about to flip.
 *
 * ponytail: one count for the whole decision, not one per member. Every member
 * of one decision shares one lot picture, so N identical counts would be N-1
 * wasted queries inside a serializable transaction.
 */
export async function evaluateHoldPointReleaseReadiness(
  tx: Prisma.TransactionClient,
  holdPointIds: readonly string[],
  lotId: string,
): Promise<HoldPointReleaseEvaluation> {
  const outstandingSiblings = await tx.holdPoint.count({
    where: {
      lotId,
      id: { notIn: [...holdPointIds] },
      status: { notIn: TERMINAL_HOLD_POINT_STATUSES },
    },
  });

  return {
    released: true,
    items: outstandingSiblings > 0 ? [{ code: 'unreleased_hold_points' }] : [],
  };
}

/**
 * The `hold_point_release.v1` rows one release decision records — ONE per
 * decided hold point, all under the decision's single audit row `[R3.1-R4]`.
 * Distinct `entityId`s, so `@@unique([auditLogId, entityType, entityId])` holds
 * across the whole batch.
 *
 * Every row carries the SAME `result`, and that is the point: one decision has
 * one readiness verdict, and the per-row identity is the `entityId` COLUMN, not
 * something repeated inside the JSON (`[R3.1-B3]`). A single release passes one
 * id and an evaluation with no `batchId` / `batchSize` — an absent `batchId` is
 * how a reader tells a single release from a batch member.
 */
export function holdPointReleaseSnapshots(
  holdPointIds: readonly string[],
  evaluation: HoldPointReleaseEvaluation,
): DecisionSnapshotInput[] {
  const result = buildHoldPointReleaseResultV1(evaluation);
  return holdPointIds.map((entityId) => ({
    entityType: 'hold_point',
    entityId,
    requirementSet: HOLD_POINT_RELEASE_REQUIREMENT_SET,
    resultSchemaVersion: HOLD_POINT_RELEASE_RESULT_SCHEMA_VERSION,
    result,
  }));
}
