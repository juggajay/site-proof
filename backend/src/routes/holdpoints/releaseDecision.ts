// F0.4b PR 3 — the readiness a hold-point RELEASE decision records, shared by
// the authenticated route and the public single-token route (execution spec §11
// F0.4b PR 3). PR 4 reuses both helpers for the batch grain.
//
// One module rather than two copies: the two routes reach the same decision from
// different trust boundaries, and a snapshot that meant different things
// depending on which door the releaser came through would be worthless as
// evidence.

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
 * Readiness for ONE hold-point release, read inside the decision's serializable
 * transaction.
 *
 * `released: true` is the F0.3 verdict's "every hold point in scope is
 * released" — the scope of a single release decision is this hold point, and
 * the mutate guards mean the decision only commits if it genuinely released it.
 *
 * The one blocker worth recording is the LOT picture this release leaves
 * behind: sibling hold points still outstanding. That is the difference between
 * "released the last hold point on the lot" and "released one of five", which is
 * exactly what a later reader of the evidence wants and cannot reconstruct from
 * the hold point's own row.
 *
 * ponytail: one count, not a readiness-engine call. The engine's lot readiness
 * needs ITP/test/NCR reads a release decision has no business taking a
 * serializable lock on — widen only if a consumer asks for a code this set
 * already declares.
 */
export async function evaluateHoldPointReleaseReadiness(
  tx: Prisma.TransactionClient,
  holdPointId: string,
  lotId: string,
): Promise<HoldPointReleaseEvaluation> {
  // Excludes this hold point, and runs BEFORE `mutate`, so the count is the
  // post-release picture either way.
  const outstandingSiblings = await tx.holdPoint.count({
    where: {
      lotId,
      id: { not: holdPointId },
      status: { notIn: TERMINAL_HOLD_POINT_STATUSES },
    },
  });

  return {
    released: true,
    items: outstandingSiblings > 0 ? [{ code: 'unreleased_hold_points' }] : [],
  };
}

/**
 * The single `hold_point_release.v1` row a single release decision records.
 * No `batchId` / `batchSize` — those belong to PR 4's batch grain, and an
 * absent field is how a reader tells a single release from a batch member.
 */
export function holdPointReleaseSnapshot(
  holdPointId: string,
  evaluation: HoldPointReleaseEvaluation,
): DecisionSnapshotInput[] {
  return [
    {
      entityType: 'hold_point',
      entityId: holdPointId,
      requirementSet: HOLD_POINT_RELEASE_REQUIREMENT_SET,
      resultSchemaVersion: HOLD_POINT_RELEASE_RESULT_SCHEMA_VERSION,
      result: buildHoldPointReleaseResultV1(evaluation),
    },
  ];
}
