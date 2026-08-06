/**
 * The lot-scoped test requirement summary — "N of M passing", per rule.
 *
 * It computes NOTHING of its own. The verdict is the same `SufficiencyEvaluation`
 * the lot readiness panel and the C3 map overlay already render, produced by the
 * same `checkConformancePrerequisites` with the same regime fetcher, so a lot
 * cannot read "3 of 6" here and something else there.
 *
 * Three shapes are deliberate:
 *
 *  - PER RULE, never one blended ratio. A lot can satisfy its density rule with
 *    zero evidence for a moisture rule; a single fraction would average a
 *    satisfied requirement against an empty one and read as partial progress on
 *    both.
 *  - The numerator is `passingCount` — VERIFIED AND PASSING (`predicates.ts`
 *    `testPassing`). A verified FAILURE is evidence of non-conformance and must
 *    never count toward compliance, which is why `failedCount` rides beside it
 *    rather than being folded in.
 *  - `requiredCount: null` is UNKNOWN, not zero. The caller renders the reason
 *    ("record this lot's quantity…"), never "0 of 0" and never a bare number.
 *    `unknownCauses` carries why; `ruleset.status` carries whether the pack's
 *    numbers have been human-confirmed. Both are disclosed, never asserted away.
 *
 * ACCESS: this is CIVOS's advisory judgement about whether work has been tested
 * enough. The route gates on `requireInternalProjectAccess`, exactly as
 * `projectTestCoverage.ts` does and for the same reason (C3 spec §10.1, J3) — a
 * shortfall is a conversation with a subcontractor, not a number in their portal.
 */

import { checkConformancePrerequisites } from '../../lib/conformancePrerequisites.js';
import { prisma } from '../../lib/prisma.js';
import { prismaRegimeStreamFetcher } from '../../lib/readiness/sufficiency/prismaStream.js';
import type { SufficiencyEvaluation } from '../../lib/readiness/sufficiency/evaluate.js';
import type {
  RuleCitation,
  RuleSufficiency,
  SufficiencyMode,
  SufficiencyState,
  UnknownCause,
} from '../../lib/readiness/sufficiency/types.js';

export interface LotTestRequirementRule {
  ruleId: string;
  testType: string;
  state: SufficiencyState;
  /** Null means UNKNOWN — the caller must render `unknownCauses`, not a number. */
  requiredCount: number | null;
  /** Verified AND passing. The only count that satisfies a requirement. */
  passingCount: number;
  /** Raised, awaiting results. Progress, but NOT compliance. */
  pendingCount: number;
  /** Verified AND failed. Counts toward nothing; the slot still needs a test. */
  failedCount: number;
  /**
   * How many tests are still to raise: required − passing − pending, floored at
   * zero. A verified failure is excluded on purpose — its slot is vacant again.
   * Always 0 when `requiredCount` is null; nothing can be raised against a
   * requirement nobody can compute.
   */
  outstandingCount: number;
  unknownCauses: UnknownCause[];
  citation: RuleCitation | null;
}

export interface LotTestRequirements {
  lotId: string;
  /** Worst state across rules; `unknown` when no rule resolved. */
  state: SufficiencyState;
  /** `off` means the project turned the check off — the caller renders nothing. */
  mode: SufficiencyMode;
  ruleset: {
    id: string;
    status: string;
    revalidationLapsed: boolean;
    /**
     * What this authority CALLS the thing `Lot.testScale` carries — VicRoads
     * regiments by "Compaction Scale A/B/C", TfNSW Q6 by specified relative
     * compaction. Null = the shipped default wording stands. Carried so the
     * `scale_not_selected` help text names the control the user must fill in.
     */
    scaleLabel: string | null;
  } | null;
  rules: LotTestRequirementRule[];
  /** Lot-level causes, populated only when NO rule resolved. */
  unknownCauses: UnknownCause[];
}

type RequirementsPrismaClient = typeof prisma;

export function toRequirementRule(rule: RuleSufficiency): LotTestRequirementRule {
  const outstandingCount =
    rule.requiredCount === null
      ? 0
      : Math.max(0, rule.requiredCount - rule.passingCount - rule.pendingCount);

  return {
    ruleId: rule.ruleId,
    testType: rule.testType,
    state: rule.state,
    requiredCount: rule.requiredCount,
    passingCount: rule.passingCount,
    pendingCount: rule.pendingCount,
    failedCount: rule.failedCount,
    outstandingCount,
    unknownCauses: [...rule.unknownCauses],
    citation: rule.citation ?? null,
  };
}

/** Shape one evaluation. Exported so the batch-raise path reuses one mapper. */
export function toLotTestRequirements(
  lotId: string,
  sufficiency: SufficiencyEvaluation | null,
): LotTestRequirements {
  // No evaluation at all is not "fine" and not "short" — it is `unknown`, the
  // honest third state, same call `projectTestCoverage.ts` makes.
  if (!sufficiency) {
    return {
      lotId,
      state: 'unknown',
      mode: 'warn',
      ruleset: null,
      rules: [],
      unknownCauses: ['no_ruleset_for_project'],
    };
  }

  return {
    lotId,
    state: sufficiency.state,
    mode: sufficiency.mode,
    ruleset: sufficiency.ruleset
      ? {
          id: sufficiency.ruleset.id,
          status: sufficiency.ruleset.status,
          revalidationLapsed: sufficiency.ruleset.revalidationLapsed === true,
          scaleLabel: sufficiency.ruleset.scaleLabel ?? null,
        }
      : null,
    rules: sufficiency.rules.map(toRequirementRule),
    unknownCauses: [...sufficiency.unknownCauses],
  };
}

/**
 * Resolve one lot's requirement summary. Returns null when the lot does not
 * exist, so the route can 404 rather than serve an empty-looking verdict.
 */
export async function buildLotTestRequirements(
  lotId: string,
  client: RequirementsPrismaClient = prisma,
): Promise<LotTestRequirements | null> {
  const result = await checkConformancePrerequisites(lotId, client, {
    regimeFetcher: prismaRegimeStreamFetcher(client),
  });
  if (!result.prerequisites) return null;
  return toLotTestRequirements(lotId, result.sufficiency ?? null);
}
