/**
 * Wave C3 Phase A — the tested/under-tested map overlay read (spec §4.3).
 *
 *   GET /api/projects/:projectId/lots/test-coverage
 *
 * Read-only. It computes NOTHING of its own: the verdict is
 * `SufficiencyEvaluation.state`, exactly the value the lot page already renders,
 * produced by the same `checkConformancePrerequisitesBatch` the claim-readiness
 * page uses. `[C3S-B2]` no second engine, `[C3S-B5]` one verdict everywhere.
 *
 * Two shapes matter and both are deliberate:
 *
 *  - `[C3R-A1]` It batches GEOMETRY-BEARING lots only. The overlay can only
 *    recolour lots that are drawn, so evaluating the rest is pure waste; a
 *    5,000-lot project with 400 drawn evaluates 400. Everything else resolves to
 *    one `lot.count()` behind the panel's "N lots not on the map" line.
 *  - `[C3R-A2]` `{ lotId, state }` for every lot; the rule detail and the
 *    unknown causes ONLY for `insufficient` and `unknown`. The map needs a
 *    colour per lot; the panel needs detail only for the lots it lists.
 *
 * `[C3S-B5]` The regime fetcher is MANDATORY. Without it `regimeByRuleId` stays
 * empty and every rule reads `full` — a different verdict from the lot page's,
 * which is the whole failure this route exists not to have.
 *
 * J3 (spec §10.1): INTERNAL project roles only. A shortfall is CIVOS's advisory
 * judgement about whether a subcontractor's work has been tested enough, and
 * that is a conversation, not a portal colour.
 */

import { Router } from 'express';

import { asyncHandler } from '../lib/asyncHandler.js';
import { checkConformancePrerequisitesBatch } from '../lib/conformancePrerequisites.js';
import { prisma } from '../lib/prisma.js';
import { requireInternalProjectAccess } from '../lib/projectAccess.js';
import type { SufficiencyEvaluation } from '../lib/readiness/sufficiency/evaluate.js';
import { prismaRegimeStreamFetcher } from '../lib/readiness/sufficiency/prismaStream.js';
import type {
  RuleSufficiency,
  SufficiencyState,
  UnknownCause,
} from '../lib/readiness/sufficiency/types.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { parseProjectRouteParam } from './controlLines/validation.js';

const projectTestCoverageRouter = Router();

projectTestCoverageRouter.use(requireAuth);

/** The per-rule numbers the panel prints. A trimmed `RuleSufficiency`. */
export interface TestCoverageRule {
  testType: string;
  state: SufficiencyState;
  requiredCount: number | null;
  passingCount: number;
  pendingCount: number;
  failedCount: number;
  citation: { authority: string; document: string; clause: string } | null;
}

export interface TestCoverageLot {
  lotId: string;
  state: SufficiencyState;
  /** Detail below is present ONLY for `insufficient` and `unknown` [C3R-A2]. */
  lotNumber?: string;
  ruleset?: { id: string; status: string } | null;
  rules?: TestCoverageRule[];
  unknownCauses?: UnknownCause[];
}

export interface TestCoverageResponse {
  lots: TestCoverageLot[];
  /** Counted, never drawn — the panel's "N lots not on the map" line (§4.2). */
  lotsWithoutGeometry: number;
}

/** The client surface this read needs. Named so a bench can hand in its own. */
type TestCoveragePrismaClient = typeof prisma;

/** Trim one engine rule to the numbers the panel prints. */
function toCoverageRule(rule: RuleSufficiency): TestCoverageRule {
  return {
    testType: rule.testType,
    state: rule.state,
    requiredCount: rule.requiredCount,
    passingCount: rule.passingCount,
    pendingCount: rule.pendingCount,
    failedCount: rule.failedCount,
    citation: rule.citation
      ? {
          authority: rule.citation.authority,
          document: rule.citation.document,
          clause: rule.citation.clause,
        }
      : null,
  };
}

/**
 * The `insufficient` / `unknown` detail `[C3R-A2]`. Separate from the mapper so
 * the "which lots get detail" decision and the "what the detail is" shaping stay
 * one thought each.
 */
function toCoverageDetail(
  lotId: string,
  lotNumber: string,
  state: SufficiencyState,
  sufficiency: SufficiencyEvaluation | null,
): TestCoverageLot {
  const rules = sufficiency?.rules ?? [];
  // Lot-level causes and per-rule causes both reach the panel, deduped — the
  // same union `buildSufficiencyAdvisoryItems` reads.
  const unknownCauses = [
    ...new Set<UnknownCause>([
      ...(sufficiency?.unknownCauses ?? []),
      ...rules.flatMap((rule) => rule.unknownCauses ?? []),
    ]),
  ];
  const ruleset = sufficiency?.ruleset;
  return {
    lotId,
    state,
    lotNumber,
    ruleset: ruleset ? { id: ruleset.id, status: ruleset.status } : null,
    rules: rules.map(toCoverageRule),
    unknownCauses,
  };
}

export async function buildTestCoverage(
  projectId: string,
  client: TestCoveragePrismaClient = prisma,
): Promise<TestCoverageResponse> {
  const [drawnLots, lotsWithoutGeometry] = await Promise.all([
    client.lot.findMany({
      where: { projectId, geometries: { some: {} } },
      select: { id: true, lotNumber: true },
    }),
    client.lot.count({ where: { projectId, geometries: { none: {} } } }),
  ]);

  const batch = await checkConformancePrerequisitesBatch(
    drawnLots.map((lot) => lot.id),
    client,
    { regimeFetcher: prismaRegimeStreamFetcher(client) },
  );

  const lots: TestCoverageLot[] = drawnLots.map(({ id, lotNumber }) => {
    const sufficiency = batch.get(id)?.sufficiency ?? null;
    // No evaluation at all is not "fine" and not "short" — it is `unknown`,
    // which is the honest third colour [C3S-B7].
    const state: SufficiencyState = sufficiency?.state ?? 'unknown';
    return state === 'satisfied'
      ? { lotId: id, state }
      : toCoverageDetail(id, lotNumber, state, sufficiency);
  });

  return { lots, lotsWithoutGeometry };
}

projectTestCoverageRouter.get(
  '/:projectId/lots/test-coverage',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireInternalProjectAccess(req.user!, projectId);

    res.json(await buildTestCoverage(projectId));
  }),
);

export { projectTestCoverageRouter };
