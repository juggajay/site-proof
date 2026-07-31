/**
 * Wave D Phase `D1a` — QUALITY CLOSEOUT READINESS (spec Rev 3 §4.2, §9).
 *
 *   GET /api/projects/:projectId/closeout-readiness?areaId=&activitySlug=
 *
 * Renamed from "handover readiness" per `[DR-A1]`: this is a QUALITY verdict —
 * conformance, ITP, tests, hold points, NCRs — and nothing here claims the
 * commercial or record dimensions a handover pack also needs.
 *
 * Three prohibitions from §4.2, all structural rather than promised:
 *
 *  - **It stores nothing** `[DH-B4]`. There is no table, no cache and no
 *    invalidation step; every read recomputes. AT-120.
 *  - **It emits no code outside the registry.** The verdict's codes are the
 *    codes the SHIPPED readiness builders emit for that lot, intersected with
 *    `HANDOVER_BLOCKING_REASON_CODES`. There is no second rule engine here and
 *    no place to invent a code — `[DH-B5]`, and the reason AT-119's parity
 *    holds by construction rather than by coincidence.
 *  - **It gates nothing.** Read-only; no caller consults it before refusing an
 *    action.
 *
 * The one code the lot page cannot emit is `open_major_ncrs`: its only shipped
 * emitter is `claimReview.ts`, which needs a whole claim. `D1a-respec` already
 * recorded that divergence (`reasonCodes.ts`, and AT-138(c) compares against
 * `severity: 'blocker'` rather than hard blockers for exactly these two codes).
 * It is added here from one counted input, and AT-119 pins the divergence set to
 * that single code so a second one cannot appear quietly.
 */

import { Router } from 'express';
import { z } from 'zod';

import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { checkConformancePrerequisitesBatch } from '../lib/conformancePrerequisites.js';
import { buildLotReadinessFromInputs } from '../lib/evidenceReadiness.js';
import { prisma } from '../lib/prisma.js';
import { requireInternalProjectAccess } from '../lib/projectAccess.js';
import type {
  CloseoutReadinessResponse,
  HandoverReadinessVerdict,
  HandoverReasonCode,
  LotCloseoutReadinessSnapshot,
} from '../lib/readiness/contracts/futureConsumers.js';
import {
  HANDOVER_BLOCKING_REASON_CODES,
  isHandoverReasonCode,
} from '../lib/readiness/contracts/reasonCodes.js';
import {
  CLOSED_NCR_STATUSES,
  SERIOUS_NCR_SEVERITY,
  lotConformable,
} from '../lib/readiness/predicates.js';
import { prismaRegimeStreamFetcher } from '../lib/readiness/sufficiency/prismaStream.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { parseProjectRouteParam } from './controlLines/validation.js';

const projectCloseoutReadinessRouter = Router();

projectCloseoutReadinessRouter.use(requireAuth);

/** Registry order, so two reads of unchanged data return identical arrays. */
const HANDOVER_CODE_RANK = new Map<string, number>(
  HANDOVER_BLOCKING_REASON_CODES.map((code, index) => [code, index]),
);

function sortHandoverCodes(codes: Iterable<HandoverReasonCode>): HandoverReasonCode[] {
  return [...codes].sort(
    (a, b) => (HANDOVER_CODE_RANK.get(a) ?? 0) - (HANDOVER_CODE_RANK.get(b) ?? 0),
  );
}

// ---------------------------------------------------------------------------
// The fold — pure, and deliberately not a second rule engine.
// ---------------------------------------------------------------------------

/**
 * One lot's closeout verdict, from the batched snapshot §4.1.2 defines.
 *
 * The lot's blocking codes are produced by `buildLotReadinessFromInputs` — the
 * SAME function `GET /api/lots/:id/readiness` calls — and then filtered to the
 * registry. That is why AT-119's set parity is structural: there is only one
 * emitter, so the two endpoints cannot disagree about what a lot's codes are.
 *
 * `canViewCommercial: false` is not a permission decision. D1a is the quality
 * scope, so the commercial builder's budget items must not enter the fold at
 * all — which makes AT-134's redaction a property of the code rather than a
 * filter that a later change could forget to apply.
 *
 * Wave G G1 names three readiness callers to teach about superseded governing
 * revisions (spec §1.3(d)); this is the one deliberately left alone.
 * `governing_revision_superseded` is a WARNING, and this fold reads
 * `.blockers` and then filters to `HANDOVER_BLOCKING_REASON_CODES` — the item
 * is excluded twice over, so fetching it here would be pure cost. That matches
 * §1.7 E4: the warning never appears on the folio as a defect.
 */
export function closeoutVerdict(snapshot: LotCloseoutReadinessSnapshot): HandoverReadinessVerdict {
  const readiness = buildLotReadinessFromInputs({
    lot: {
      id: snapshot.lotId,
      lotNumber: snapshot.lotNumber,
      status: snapshot.status,
      // Gated behind `canViewCommercial`, so it can emit nothing here.
      budgetAmount: null,
      claimedInId: snapshot.claimedInId,
      conformanceOverriddenAt: snapshot.conformanceOverriddenAt,
    },
    canViewCommercial: false,
    conformStatus: {
      // Reproduced with the canonical predicate rather than carried on the
      // snapshot: `lotConformable(prerequisites)` IS `computeConformanceResult`'s
      // `canConform` (predicates.parity.test.ts), so this cannot drift, and it
      // only ever decides the `conformance_prerequisites_met` SUPPORT item.
      canConform: lotConformable(snapshot.prerequisites),
      blockingReasons: [],
      prerequisites: snapshot.prerequisites,
    },
    sufficiency: snapshot.sufficiency,
    evidenceCounts: {
      unreleasedHoldPoints: snapshot.unreleasedHoldPoints,
      // The remaining counts drive SUPPORT items only (`released_hold_points`,
      // `documents`, `photos`, `pending_tests` …), none of them a registered
      // closeout code — so fetching them would be pure cost.
      releasedHoldPoints: 0,
      approvedDockets: 0,
      diaryEntries: 0,
      documents: 0,
      photos: 0,
      pendingTests: 0,
    },
  });

  // `splitItems` buckets by severity, so `.blockers` IS `severity: 'blocker'` —
  // the same set AT-138(c) enumerates.
  const codes = new Set<HandoverReasonCode>();
  for (const readinessItem of [...readiness.conformance.blockers, ...readiness.claim.blockers]) {
    if (isHandoverReasonCode(readinessItem.code)) {
      codes.add(readinessItem.code);
    }
  }

  // The one code no lot-page emitter produces (see the file header).
  if (snapshot.openMajorNcrCount > 0) {
    codes.add('open_major_ncrs');
  }

  return {
    subjectType: 'lot',
    subjectId: snapshot.lotId,
    ready: codes.size === 0,
    reasonCodes: sortHandoverCodes(codes),
  };
}

/** The project rollup — the union of its lots' codes, never a re-derivation. */
export function projectCloseoutVerdict(
  projectId: string,
  lotVerdicts: HandoverReadinessVerdict[],
): HandoverReadinessVerdict {
  const codes = new Set<HandoverReasonCode>(lotVerdicts.flatMap((v) => v.reasonCodes));
  return {
    subjectType: 'project',
    subjectId: projectId,
    ready: codes.size === 0,
    reasonCodes: sortHandoverCodes(codes),
  };
}

// ---------------------------------------------------------------------------
// The batched read — §4.1.2's "one pass", plus the two filters of §4.1.3–4.1.4.
// ---------------------------------------------------------------------------

export interface CloseoutReadinessFilters {
  areaId?: string;
  activitySlug?: string;
}

type ChainageBound = { chainageStart: unknown; chainageEnd: unknown };

/** Chainage is stored as `Decimal?` and real lots are entered both ways round. */
function orderedSpan(row: ChainageBound): [number, number] | null {
  if (row.chainageStart === null || row.chainageEnd === null) return null;
  const a = Number(row.chainageStart);
  const b = Number(row.chainageEnd);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a <= b ? [a, b] : [b, a];
}

/**
 * §4.1.3. `areaId` selects lots whose chainage span OVERLAPS the area window.
 * A lot with a null chainage on either end is never matched — and is counted in
 * `unplacedLots` rather than dropped, because a chainage filter that silently
 * hides every unchainaged lot is a filter that lies, and unchainaged lots are
 * ordinary here. AT-139.
 */
export function overlapsArea(lot: ChainageBound, area: [number, number]): boolean {
  const span = orderedSpan(lot);
  if (!span) return false;
  return span[0] <= area[1] && span[1] >= area[0];
}

/** Null when no `areaId` filter was asked for; throws when the area cannot select. */
export async function resolveAreaWindow(
  projectId: string,
  areaId: string | undefined,
  client: typeof prisma = prisma,
): Promise<[number, number] | null> {
  if (!areaId) return null;

  const area = await client.projectArea.findFirst({
    where: { id: areaId, projectId },
    select: { chainageStart: true, chainageEnd: true },
  });
  if (!area) throw AppError.notFound('Project area');

  const window = orderedSpan(area);
  if (!window) {
    // An interval missing an endpoint is not an interval. Refusing is the honest
    // answer; treating it as unbounded would return every placed lot in the
    // project under one area's name.
    throw AppError.badRequest('This area has no chainage window, so it cannot select lots.');
  }
  return window;
}

/** The per-lot evidence counts §4.1.2 names as the ones the conformance batch omits. */
async function fetchExtraLotInputs(
  lotIds: string[],
  client: typeof prisma,
): Promise<{ unreleasedByLot: Map<string, number>; majorNcrByLot: Map<string, number> }> {
  if (lotIds.length === 0) {
    return { unreleasedByLot: new Map(), majorNcrByLot: new Map() };
  }

  const [unreleasedHoldPoints, majorNcrs] = await Promise.all([
    client.holdPoint.groupBy({
      by: ['lotId'],
      // The lot page's NORMAL unreleased count (`qualityRoutes.ts`), not the
      // N/A-bypass subset behind `na_hold_point_not_released`. §4.1.2.
      where: { lotId: { in: lotIds }, status: { not: 'released' } },
      _count: { _all: true },
    }),
    client.nCRLot.groupBy({
      by: ['lotId'],
      // `ncrOpen` ∧ `ncrSerious`, bound to the predicate library's own constants
      // so the query and the predicate cannot drift.
      where: {
        lotId: { in: lotIds },
        ncr: { status: { notIn: CLOSED_NCR_STATUSES }, severity: SERIOUS_NCR_SEVERITY },
      },
      _count: { _all: true },
    }),
  ]);

  return {
    unreleasedByLot: new Map(unreleasedHoldPoints.map((r) => [r.lotId, r._count._all])),
    majorNcrByLot: new Map(majorNcrs.map((r) => [r.lotId, r._count._all])),
  };
}

export async function buildCloseoutReadiness(
  projectId: string,
  client: typeof prisma = prisma,
  filters: CloseoutReadinessFilters = {},
): Promise<CloseoutReadinessResponse> {
  const areaWindow = await resolveAreaWindow(projectId, filters.areaId, client);

  const lots = await client.lot.findMany({
    where: { projectId },
    select: {
      id: true,
      lotNumber: true,
      status: true,
      chainageStart: true,
      chainageEnd: true,
      activitySlug: true,
      // The two lot-state fields the shipped builders read. Without them the
      // fold diverges from the lot page on force-conformed and mid-claim lots.
      claimedInId: true,
      conformanceOverriddenAt: true,
    },
    orderBy: { lotNumber: 'asc' },
  });

  // Counted independently over the project's lots, and each only when its own
  // filter is applied — these are two disclosures, not a partition of the
  // excluded set. §4.1.3–4.1.4, AT-139.
  const unplacedLots = areaWindow ? lots.filter((lot) => orderedSpan(lot) === null).length : 0;
  const unclassifiedLots = filters.activitySlug
    ? lots.filter((lot) => lot.activitySlug === null).length
    : 0;

  const inScope = lots.filter((lot) => {
    if (areaWindow && !overlapsArea(lot, areaWindow)) return false;
    // §4.1.4: `activityType` is free text; `activitySlug` is the folded
    // canonical value, and null means fold confidence `family`/`none`.
    if (filters.activitySlug && lot.activitySlug !== filters.activitySlug) return false;
    return true;
  });
  const lotIds = inScope.map((lot) => lot.id);

  // ONE pass. The conformance batch is already constant-query (M39).
  const [batch, { unreleasedByLot, majorNcrByLot }] = await Promise.all([
    checkConformancePrerequisitesBatch(lotIds, client, {
      // Mandatory: without it every regime-bearing rule reads `full` and the
      // panel shows a different sufficiency verdict from the lot page's.
      regimeFetcher: prismaRegimeStreamFetcher(client),
    }),
    fetchExtraLotInputs(lotIds, client),
  ]);

  const verdicts: HandoverReadinessVerdict[] = [];
  for (const lot of inScope) {
    const prerequisites = batch.get(lot.id)?.prerequisites;
    // Only reachable if the lot was deleted between the two reads.
    if (!prerequisites) continue;

    const snapshot: LotCloseoutReadinessSnapshot = {
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      status: lot.status,
      chainageStart: lot.chainageStart === null ? null : Number(lot.chainageStart),
      chainageEnd: lot.chainageEnd === null ? null : Number(lot.chainageEnd),
      activitySlug: lot.activitySlug,
      claimedInId: lot.claimedInId,
      conformanceOverriddenAt: lot.conformanceOverriddenAt
        ? lot.conformanceOverriddenAt.toISOString()
        : null,
      prerequisites,
      openMajorNcrCount: majorNcrByLot.get(lot.id) ?? 0,
      unreleasedHoldPoints: unreleasedByLot.get(lot.id) ?? 0,
      sufficiency: batch.get(lot.id)?.sufficiency ?? null,
    };
    verdicts.push(closeoutVerdict(snapshot));
  }

  verdicts.push(projectCloseoutVerdict(projectId, verdicts));

  return { verdicts, unplacedLots, unclassifiedLots };
}

const closeoutQuerySchema = z.object({
  areaId: z.string().min(1).max(64).optional(),
  activitySlug: z.string().min(1).max(120).optional(),
});

projectCloseoutReadinessRouter.get(
  '/:projectId/closeout-readiness',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    // §9 permission matrix: any INTERNAL role with project read access.
    // Subcontractor roles get no handover surface at all — not a scoping
    // question, handover is not their workflow.
    await requireInternalProjectAccess(req.user!, projectId);

    const parsed = closeoutQuerySchema.safeParse(req.query);
    if (!parsed.success) throw AppError.fromZodError(parsed.error);

    res.json(await buildCloseoutReadiness(projectId, prisma, parsed.data));
  }),
);

export { projectCloseoutReadinessRouter };
