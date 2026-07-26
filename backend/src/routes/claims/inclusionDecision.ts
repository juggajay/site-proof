// F0.4b PR 5 — the readiness a claim INCLUSION decision records (execution spec
// §11 F0.4b PR 5, §3 `[R3-3]`).
//
// Claim create IS the inclusion decision: there is no separate "add lot to
// claim" route. It is the one decision in the system with a MULTI-GRAIN
// snapshot, which is what the `RequirementEvaluation` schema was designed for:
//
//   1 × `claim`           — the aggregate, keyed by ProgressClaim.id, COUNTS AND
//                           TOTALS ONLY (never member-id arrays `[R3.1-B3]`).
//   N × `claim_lot`       — one per member, keyed by **ClaimedLot.id** (the join
//                           row), NOT the lot id: the same lot can be claimed
//                           across several claims, so the lot id would not be
//                           unique per decision.
//   M × `claim_variation` — one per member, keyed by **Variation.id**; there is
//                           no claim-variation join row (variations link back
//                           via `Variation.claimedInId`) `[R3-3]`.
//
// All three grains come from ONE evaluation, computed inside the decision's
// serializable transaction and never re-queried post-commit — a snapshot that
// re-read the database after committing would be recording a different moment
// than the one it claims to describe.

import type { Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import {
  checkConformancePrerequisitesBatch,
  getClaimBlockingReasonsForConformedLot,
} from '../../lib/conformancePrerequisites.js';
import type { DecisionSnapshotInput } from '../../lib/readiness/recordDecision.js';
import {
  CLAIM_MEMBER_REQUIREMENT_SET,
  CLAIM_MEMBER_RESULT_SCHEMA_VERSION,
  buildClaimMemberResultV1,
  type ClaimMemberResultV1,
} from '../../lib/readiness/requirements/claimMember.v1.js';
import {
  CLAIM_READINESS_REQUIREMENT_SET,
  CLAIM_READINESS_RESULT_SCHEMA_VERSION,
  buildClaimReadinessResultV1,
} from '../../lib/readiness/requirements/claimReadiness.v1.js';
import { getCumulativeClaimedPercentByLot } from './cumulativeClaims.js';
import {
  assertClaimIncrementWithinRemaining,
  getRequestedClaimPercentage,
  isLotFullyClaimed,
  roundClaimAmountToCents,
} from './workflowValidation.js';

/** The lot columns the decision needs — a subset of `Lot`, so tests can fake it. */
type ClaimableLot = {
  id: string;
  lotNumber: string;
  budgetAmount: Prisma.Decimal | null;
  conformanceOverriddenAt: Date | null;
};

type ClaimableVariation = {
  id: string;
  variationNumber: string;
  status: string;
  claimedInId: string | null;
  approvedAmount: Prisma.Decimal | null;
};

export interface ClaimInclusionLotMember {
  lot: ClaimableLot;
  /** Pre-minted `ClaimedLot.id` — the `claim_lot` snapshot's `entityId`. */
  claimedLotId: string;
  percentageComplete: number;
  amountClaimed: number;
  /** Cumulative percentage claimed once THIS claim commits. */
  cumulativePercentage: number;
  fullyClaimed: boolean;
}

export interface ClaimInclusionVariationMember {
  variation: ClaimableVariation;
  claimedValue: number;
}

export interface ClaimInclusionEvaluation {
  nextClaimNumber: number;
  lotMembers: ClaimInclusionLotMember[];
  variationMembers: ClaimInclusionVariationMember[];
  totalClaimedAmount: number;
  /** Lots this claim takes to 100% — the ones `mutate` flips to `claimed`. */
  fullyClaimedLotIds: string[];
}

export interface ClaimInclusionEvaluationInput {
  projectId: string;
  uniqueLotIds: string[];
  uniqueVariationIds: string[];
  percentageByLotId: Map<string, number>;
  /** lotId -> pre-minted ClaimedLot id, so the snapshot key exists before the write. */
  claimedLotIdByLotId: Map<string, string>;
}

function assertVariationClaimable(variation: ClaimableVariation): void {
  const approvedAmount = Number(variation.approvedAmount ?? 0);
  if (
    variation.status !== 'approved' ||
    variation.claimedInId !== null ||
    !Number.isFinite(approvedAmount) ||
    approvedAmount <= 0
  ) {
    throw AppError.badRequest(`Variation ${variation.variationNumber} is not claimable`, {
      code: 'VARIATION_NOT_CLAIMABLE',
      variationNumber: variation.variationNumber,
      status: variation.status,
      claimedInId: variation.claimedInId,
      approvedAmount,
    });
  }
}

/**
 * Everything the claim decision reads, in the ORDER the route validated it
 * before F0.4b — the sequence of 400s a client sees is pinned behaviour, so it
 * is preserved statement for statement. The only change is where this runs:
 * inside `recordDecision`'s serializable transaction, re-run fresh on every
 * retry attempt, so a lot that loses its conformance mid-decision cannot be
 * claimed on the strength of a stale read.
 *
 * `nextClaimNumber` is read HERE rather than in `mutate` for the same reason:
 * a retried attempt must allocate a fresh number, and the retry re-runs
 * `evaluate`.
 */
export async function evaluateClaimInclusion(
  tx: Prisma.TransactionClient,
  input: ClaimInclusionEvaluationInput,
): Promise<ClaimInclusionEvaluation> {
  const { projectId, uniqueLotIds, uniqueVariationIds, percentageByLotId, claimedLotIdByLotId } =
    input;

  const lastClaim = await tx.progressClaim.findFirst({
    where: { projectId },
    orderBy: { claimNumber: 'desc' },
  });
  const nextClaimNumber = (lastClaim?.claimNumber || 0) + 1;

  // Progress claims are cumulative, so a partially-claimed lot stays
  // `conformed` (claimedInId null) and remains selectable until its cumulative
  // claimed percentage reaches 100%. Only fully-claimed lots are flipped.
  const lots =
    uniqueLotIds.length > 0
      ? await tx.lot.findMany({
          where: { id: { in: uniqueLotIds }, projectId, status: 'conformed', claimedInId: null },
        })
      : [];

  if (uniqueLotIds.length > 0 && lots.length === 0) {
    throw AppError.badRequest('No valid conformed lots found');
  }
  if (lots.length !== uniqueLotIds.length) {
    throw AppError.badRequest(
      'All selected lots must be conformed, unclaimed, and belong to this project',
    );
  }

  const conformanceByLotId = await checkConformancePrerequisitesBatch(uniqueLotIds, tx);
  const staleConformanceLots = lots
    .map((lot) => ({
      lot,
      blockingReasons: getClaimBlockingReasonsForConformedLot(conformanceByLotId.get(lot.id), {
        conformanceOverridden: lot.conformanceOverriddenAt != null,
      }),
    }))
    .filter(({ blockingReasons }) => blockingReasons.length > 0);

  if (staleConformanceLots.length > 0) {
    throw AppError.badRequest(
      'One or more selected lots no longer satisfy conformance prerequisites',
      {
        code: 'CONFORMANCE_STALE',
        lots: staleConformanceLots.map(({ lot, blockingReasons }) => ({
          id: lot.id,
          lotNumber: lot.lotNumber,
          blockingReasons,
        })),
      },
    );
  }

  // Feature #894: every lot needs a rate (budgetAmount) before it can be claimed.
  const lotsWithoutRate = lots.filter((lot) => !lot.budgetAmount || Number(lot.budgetAmount) <= 0);
  if (lotsWithoutRate.length > 0) {
    throw AppError.badRequest(
      `The following lots do not have a rate set: ${lotsWithoutRate.map((l) => l.lotNumber).join(', ')}. Please set a budget amount for each lot before adding to a claim.`,
      {
        code: 'RATE_REQUIRED',
        lotsWithoutRate: lotsWithoutRate.map((l) => ({ id: l.id, lotNumber: l.lotNumber })),
      },
    );
  }

  // Cumulative claiming: reject any increment that would push a lot past 100%
  // of its budget across all of its claims so far.
  const priorCumulativeByLotId =
    uniqueLotIds.length > 0
      ? await getCumulativeClaimedPercentByLot(uniqueLotIds, tx)
      : new Map<string, number>();

  const lotMembers: ClaimInclusionLotMember[] = lots.map((lot) => {
    const percentageComplete = getRequestedClaimPercentage(percentageByLotId, lot.id);
    const priorCumulative = priorCumulativeByLotId.get(lot.id) ?? 0;
    assertClaimIncrementWithinRemaining(priorCumulative, percentageComplete, lot.lotNumber);

    const budgetAmount = lot.budgetAmount ? Number(lot.budgetAmount) : 0;
    const cumulativePercentage = priorCumulative + percentageComplete;
    const claimedLotId = claimedLotIdByLotId.get(lot.id);
    if (!claimedLotId) {
      // Unreachable: the map is built from the same requested-lot id set.
      throw AppError.badRequest(`Lot ${lot.lotNumber} is not part of this claim request`);
    }

    return {
      lot,
      claimedLotId,
      percentageComplete,
      // The line amount is THIS claim's increment percentage of the lot budget,
      // so claim totals always reconcile to the budget.
      amountClaimed: roundClaimAmountToCents((budgetAmount * percentageComplete) / 100),
      cumulativePercentage,
      fullyClaimed: isLotFullyClaimed(cumulativePercentage),
    };
  });

  const variations =
    uniqueVariationIds.length > 0
      ? await tx.variation.findMany({
          where: { id: { in: uniqueVariationIds }, projectId },
          select: {
            id: true,
            variationNumber: true,
            status: true,
            claimedInId: true,
            approvedAmount: true,
          },
        })
      : [];

  if (variations.length !== uniqueVariationIds.length) {
    throw AppError.badRequest('All selected variations must belong to this project', {
      code: 'VARIATION_NOT_CLAIMABLE',
    });
  }

  const variationMembers: ClaimInclusionVariationMember[] = variations.map((variation) => {
    assertVariationClaimable(variation);
    return {
      variation,
      claimedValue: roundClaimAmountToCents(Number(variation.approvedAmount ?? 0)),
    };
  });

  const lotClaimedAmount = roundClaimAmountToCents(
    lotMembers.reduce((sum, member) => sum + member.amountClaimed, 0),
  );
  const variationClaimedAmount = roundClaimAmountToCents(
    variationMembers.reduce((sum, member) => sum + member.claimedValue, 0),
  );

  return {
    nextClaimNumber,
    lotMembers,
    variationMembers,
    totalClaimedAmount: roundClaimAmountToCents(lotClaimedAmount + variationClaimedAmount),
    fullyClaimedLotIds: lotMembers.filter((m) => m.fullyClaimed).map((m) => m.lot.id),
  };
}

/**
 * `claim_member.v1` verdicts for one decision, in the order the snapshot rows
 * are written.
 *
 * ponytail: no `items` are passed, so every committed member is
 * `ready: true, blockingReasonCodes: []`. That is not a gap — it is the
 * decision's actual verdict. `evaluateClaimInclusion` REJECTS the whole claim
 * (400 `CONFORMANCE_STALE` / `RATE_REQUIRED` / `VARIATION_NOT_CLAIMABLE`) if any
 * member is blocked, so a committed claim has no blocked members by
 * construction, and `ready: true` is the recorded assertion that every
 * prerequisite held at inclusion time. The field exists because the payload is
 * shared with read surfaces that DO evaluate unclaimed lots; inventing blocker
 * plumbing here for a branch the guards make unreachable would be dead code.
 */
function claimMemberResults(evaluation: ClaimInclusionEvaluation): {
  entityType: 'claim_lot' | 'claim_variation';
  entityId: string;
  result: ClaimMemberResultV1;
}[] {
  return [
    ...evaluation.lotMembers.map((member) => ({
      entityType: 'claim_lot' as const,
      entityId: member.claimedLotId,
      result: buildClaimMemberResultV1({
        memberType: 'lot',
        claimedValue: member.amountClaimed,
        claimedPercentage: member.cumulativePercentage,
      }),
    })),
    ...evaluation.variationMembers.map((member) => ({
      entityType: 'claim_variation' as const,
      entityId: member.variation.id,
      result: buildClaimMemberResultV1({
        memberType: 'variation',
        claimedValue: member.claimedValue,
      }),
    })),
  ];
}

/**
 * The aggregate + member rows one claim decision records: `[aggregate, ...members]`.
 *
 * The aggregate is built FROM the member verdicts (`buildClaimReadinessResultV1`),
 * so it cannot disagree with the rows it summarises, and it carries counts and
 * totals only — the member IDENTITIES are the member rows' `entity_id` column,
 * never a duplicated array inside the aggregate JSON `[R3.1-B3]`.
 */
export function claimInclusionSnapshots(
  claimId: string,
  evaluation: ClaimInclusionEvaluation,
): DecisionSnapshotInput[] {
  const members = claimMemberResults(evaluation);

  return [
    {
      entityType: 'claim',
      entityId: claimId,
      requirementSet: CLAIM_READINESS_REQUIREMENT_SET,
      resultSchemaVersion: CLAIM_READINESS_RESULT_SCHEMA_VERSION,
      result: buildClaimReadinessResultV1(members.map((member) => member.result)),
    },
    ...members.map((member) => ({
      entityType: member.entityType,
      entityId: member.entityId,
      requirementSet: CLAIM_MEMBER_REQUIREMENT_SET,
      resultSchemaVersion: CLAIM_MEMBER_RESULT_SCHEMA_VERSION,
      result: member.result,
    })),
  ];
}
