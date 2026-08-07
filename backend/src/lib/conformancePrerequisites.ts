import { prisma } from './prisma.js';
import { isReleaseGatedChecklistItem } from './holdPointReleaseGating.js';
import {
  CLOSED_NCR_STATUSES,
  OPEN_HOLD_POINT_CONDITIONS_WHERE,
  lotConformable,
  testMatchesItem,
  testPassing,
} from './readiness/predicates.js';
import {
  getChecklistItemsForInstance,
  parseTemplateSnapshot,
  type ChecklistItem,
} from '../routes/itp/helpers/templateSnapshot.js';
import {
  evaluateSufficiency,
  type SufficiencyEvaluation,
} from './readiness/sufficiency/evaluate.js';
import { resolveSufficiency, resolveSufficiencyBatch } from './readiness/sufficiency/resolve.js';
import type { RegimeStreamFetcher } from './readiness/sufficiency/regime.js';
import {
  createCategoryResolver,
  type CategoryResolver,
} from './readiness/sufficiency/testCategories.js';
import type { ResolvedSufficiency } from './readiness/sufficiency/types.js';

export type ConformancePrismaClient = Pick<
  typeof prisma,
  'holdPoint' | 'lot' | 'iTPChecklistItem' | 'iTPCompletion'
>;

// A checklist item counts as finished for conformance when its completion
// status is 'completed' OR 'not_applicable'. Owner decision (2026-06-11):
// legitimately N/A items satisfy conformance, consistent with how lot
// auto-progression already counts them. Any other status — 'failed',
// 'pending', 'in_progress', or a missing completion — remains unfinished
// and still blocks.
//
// Hold-point bypass guard: an N/A'd hold-point sign-off item (pointType
// 'hold_point', or superintendent sign-off with pointType !== 'witness')
// only counts as finished when its HoldPoint record is released. If the
// hold point is unreleased, the lot is blocked with a specific message.
// This guard is enforced in checkConformancePrerequisites (conformance-side),
// not in completions.ts (which intentionally leaves N/A open so a contractor
// can record the N/A for field purposes). The conformance gate is the correct
// single enforcement point: it lets field staff record the state freely while
// ensuring the compliance check reflects reality.
export function isItpCompletionFinished(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'not_applicable';
}

interface ChecklistCompletenessItem {
  id: string;
  description: string;
  pointType: string;
}

interface ChecklistCompletenessCompletion {
  checklistItemId: string;
  status: string;
  verificationStatus?: string | null;
}

export interface ChecklistCompleteness {
  completedCount: number;
  totalCount: number;
  completed: boolean;
  incompleteItems: { id: string; description: string; pointType: string }[];
}

// Pure (DB-free) computation of ITP checklist completeness for conformance.
// An item is "finished" when its completion status is 'completed' or
// 'not_applicable' (see isItpCompletionFinished). Extracted so the conformance
// gate can be unit-tested with mocked completions and so the finished-status
// rule stays in one place. Note: the hold-point bypass guard (N/A on a
// hold-point sign-off item requires the hold point to be released) is enforced
// separately in checkConformancePrerequisites — it cannot be expressed here
// because it requires a database lookup.
export function buildItpChecklistCompleteness(
  checklistItems: ChecklistCompletenessItem[],
  completions: ChecklistCompletenessCompletion[],
): ChecklistCompleteness {
  const finishedItemIds = new Set(
    completions
      .filter(
        (c) =>
          isItpCompletionFinished(c.status) &&
          c.verificationStatus !== 'pending_verification' &&
          c.verificationStatus !== 'rejected',
      )
      .map((c) => c.checklistItemId),
  );

  const incompleteItems = checklistItems
    .filter((item) => !finishedItemIds.has(item.id))
    .map((item) => ({
      id: item.id,
      description: item.description,
      pointType: item.pointType,
    }));

  const completedCount = checklistItems.length - incompleteItems.length;

  return {
    completedCount,
    totalCount: checklistItems.length,
    completed: incompleteItems.length === 0 && checklistItems.length > 0,
    incompleteItems,
  };
}

// Pure (DB-free) predicate: does the lot's ITP actually require a test?
// Real civil QA ties testing to specific ITP points/frequencies, not to every
// lot. An item demands a test when its evidence requirement is 'test' OR it has
// a non-empty testType. Mirrors the testItems filter in
// routes/itp/helpers/lotProgression.ts so the two definitions can't drift.
export function itpRequiresTest(
  checklistItems: { evidenceRequired?: string | null; testType?: string | null }[],
): boolean {
  return checklistItems.some((item) => item.evidenceRequired === 'test' || Boolean(item.testType));
}

type OutstandingTestState =
  | 'no_result'
  | 'awaiting_verification'
  | 'failing'
  | 'unmatched_result_exists';

interface OutstandingTestItem {
  itemId: string;
  description: string;
  testType: string | null;
  state: OutstandingTestState;
}

interface ConformancePrerequisites {
  itpAssigned: boolean;
  itpCompleted: boolean;
  itpCompletedCount: number;
  itpTotalCount: number;
  itpIncompleteItems: { id: string; description: string; pointType: string }[];
  testRequired: boolean;
  hasPassingTest: boolean;
  outstandingTestItems: OutstandingTestItem[];
  testResults: {
    id: string;
    itpChecklistItemId: string | null;
    testType: string;
    passFail: string;
    status: string;
  }[];
  noOpenNcrs: boolean;
  openNcrs: { id: string; ncrNumber: string; description: string; status: string }[];
  noOpenHoldPointConditions: boolean;
  openHoldPointConditions: {
    holdPointId: string;
    holdPointName: string;
    openConditionCount: number;
  }[];
  // N/A hold-point bypass guard: hold-point sign-off items marked N/A only
  // satisfy conformance when their HoldPoint is released. This count tracks
  // how many are still blocked (unreleased hold point + N/A status).
  naHoldPointBlockerCount: number;
  noNaHoldPointBypass: boolean;
  // Wave C1 (spec §5.1.1). The ONE sufficiency limb that reaches `lotConformable`,
  // and it is already mode- and status-folded by the evaluator (§5.1.2): it can
  // only be true at `mode: 'block'` on a CONFIRMED ruleset with a real shortfall.
  // Everything else sufficiency has to say is advisory and rides
  // `ConformanceCheckResult.sufficiency` instead.
  sufficiencyBlocks: boolean;
}

interface ClaimConformancePrerequisites {
  itpAssigned: boolean;
  itpCompleted: boolean;
  itpCompletedCount: number;
  itpTotalCount: number;
  testRequired: boolean;
  hasPassingTest: boolean;
  noOpenNcrs: boolean;
  openNcrs: { id: string; ncrNumber: string; description: string; status: string }[];
  noOpenHoldPointConditions?: boolean;
  openHoldPointConditions?: {
    holdPointId: string;
    holdPointName: string;
    openConditionCount: number;
  }[];
  naHoldPointBlockerCount?: number;
  noNaHoldPointBypass?: boolean;
}

interface ConformanceCheckResult {
  error?: string;
  lot: {
    id: string;
    lotNumber: string;
    status: string;
    projectId: string;
  } | null;
  prerequisites?: ConformancePrerequisites;
  canConform?: boolean;
  blockingReasons?: string[];
  /**
   * Wave C1 (spec §5.1.4). The ADVISORY half of the sufficiency verdict — counts,
   * citations, unknown causes, lot-size exceedances. Null when no ruleset
   * resolves, which is every project without a shipped authority pack. Kept OFF
   * `prerequisites` because that shape is snapshotted and consumed by
   * `lotConformable`; only `sufficiencyBlocks` belongs there.
   */
  sufficiency?: SufficiencyEvaluation | null;
}

export function getClaimBlockingReasonsForConformedLot(
  conformance: { prerequisites?: ClaimConformancePrerequisites } | null | undefined,
  options?: { conformanceOverridden?: boolean },
): string[] {
  const prerequisites = conformance?.prerequisites;
  if (!prerequisites) {
    return ['Conformance prerequisites could not be verified'];
  }

  const reasons: string[] = [];
  // A stored conformed lot without an ITP may be a legacy/imported or
  // deliberately force-conformed record. Do not retroactively block claims for
  // that historical state alone, but still enforce regressions like open NCRs.
  //
  // A persisted force-conformance override extends the same accommodation to
  // the ITP-incomplete + test-outstanding checks: an owner/admin already
  // accepted those at conform time, so re-raising them would re-block a
  // deliberately overridden lot. Regressions that arise AFTER conformance —
  // open NCRs and unreleased N/A hold points — are still enforced below.
  const overridden = options?.conformanceOverridden ?? false;
  if (prerequisites.itpAssigned && !overridden) {
    if (!prerequisites.itpCompleted) {
      reasons.push(
        `ITP checklist incomplete (${prerequisites.itpCompletedCount}/${prerequisites.itpTotalCount} items completed)`,
      );
    }
    if (prerequisites.testRequired && !prerequisites.hasPassingTest) {
      reasons.push('ITP requires a matching passing verified test result');
    }
  }
  if (!prerequisites.noOpenNcrs) {
    reasons.push(`${prerequisites.openNcrs.length} open NCR(s) must be closed`);
  }
  if (!(prerequisites.noOpenHoldPointConditions ?? true)) {
    const openConditionCount = (prerequisites.openHoldPointConditions ?? []).reduce(
      (total, holdPoint) => total + holdPoint.openConditionCount,
      0,
    );
    reasons.push(
      `${openConditionCount} hold point release condition${openConditionCount === 1 ? '' : 's'} must be recorded satisfied`,
    );
  }
  if (!(prerequisites.noNaHoldPointBypass ?? true)) {
    const blockerCount = prerequisites.naHoldPointBlockerCount ?? 0;
    reasons.push(
      `${blockerCount} hold point item${blockerCount === 1 ? '' : 's'} marked N/A but not released`,
    );
  }

  return reasons;
}

type NormalizedChecklistItem = ChecklistItem & {
  id: string;
  description: string;
  pointType: string;
};

interface ItpInstanceForConformance {
  templateSnapshot?: string | null;
  template?: { checklistItems?: ChecklistItem[] | null } | null;
  completions: ChecklistCompletenessCompletion[];
}

// Memoized on the fetched instance OBJECT. The batch path derives the same items
// twice per lot — once to build the N/A hold-point union, once inside
// `computeConformanceResult` — and each derivation re-parses a ~2 KB
// `templateSnapshot` JSON and rebuilds 12 objects. At the 5,000-lot claim ceiling
// that second pass measured ~45ms of pure duplicate work.
//
// A `WeakMap` keyed by the instance object, not a cache keyed by the snapshot
// string: entries die with the request's Prisma payload, so nothing is retained
// across requests and two lots that happen to share a snapshot never share an
// items array. Correct because these objects are read-only once fetched —
// `hydrateFetchedLots` builds a NEW instance object when it attaches the legacy
// fallback rather than mutating in place, so a mutated instance is a new key.
const normalizedChecklistItemsByInstance = new WeakMap<object, NormalizedChecklistItem[]>();

function getNormalizedChecklistItems(
  itpInstance: ItpInstanceForConformance,
): NormalizedChecklistItem[] {
  const cached = normalizedChecklistItemsByInstance.get(itpInstance);
  if (cached) return cached;
  const items = getChecklistItemsForInstance(itpInstance).map((item) => ({
    ...item,
    description: item.description ?? 'ITP item',
    pointType: item.pointType ?? 'standard',
  }));
  normalizedChecklistItemsByInstance.set(itpInstance, items);
  return items;
}

// The N/A'd hold-point sign-off items whose HoldPoint must be RELEASED for the
// N/A to satisfy conformance (the bypass-guard inputs). Pure: the released
// lookup is performed by the caller (single or batch path) and the released ids
// are fed back into computeConformanceResult. Extracted from the old
// applyNaHoldPointBypassGuard so the single and batch conformance paths share
// one definition (M39).
function getNaHoldPointSignoffItemIds(
  checklistItems: NormalizedChecklistItem[],
  completions: ChecklistCompletenessCompletion[],
): string[] {
  const naCompletionItemIds = new Set(
    completions.filter((c) => c.status === 'not_applicable').map((c) => c.checklistItemId),
  );

  return checklistItems
    .filter((item) => naCompletionItemIds.has(item.id) && isReleaseGatedChecklistItem(item))
    .map((item) => item.id);
}

function isRequiredTestItem(item: {
  id: string;
  evidenceRequired?: string | null;
  testType?: string | null;
}): boolean {
  return item.evidenceRequired === 'test' || Boolean(item.testType);
}

function hasVerifiedPassingTestForItem(
  item: { id: string; testType?: string | null },
  testResults: {
    itpChecklistItemId?: string | null;
    testType: string;
    passFail: string;
    status: string;
  }[],
): boolean {
  return testResults.some(
    (testResult) => testPassing(testResult) && testMatchesItem(item, testResult),
  );
}

// Presentation-only breakdown of the test-required checklist items that are NOT
// yet satisfied, so the conformance blocker can name them instead of a dead-end
// "no passing verified test". Uses the same match logic as the gate; does not
// change what satisfies conformance.
function buildOutstandingTestItems(
  checklistItems: NormalizedChecklistItem[],
  testResults: {
    itpChecklistItemId?: string | null;
    testType: string;
    passFail: string;
    status: string;
  }[],
): OutstandingTestItem[] {
  const requiredItems = checklistItems.filter(isRequiredTestItem);

  // A lot-level orphan: a recorded test result that matches no required item.
  // When one exists, an unsatisfied item with no direct match is more honestly
  // "a result exists, link it" than "no result yet" — the #1336 misclassification.
  const hasUnmatchedResult = testResults.some(
    (testResult) => !requiredItems.some((item) => testMatchesItem(item, testResult)),
  );

  return requiredItems.flatMap((item) => {
    if (hasVerifiedPassingTestForItem(item, testResults)) {
      return [];
    }
    const matches = testResults.filter((testResult) => testMatchesItem(item, testResult));
    let state: OutstandingTestState;
    if (matches.length === 0) {
      state = hasUnmatchedResult ? 'unmatched_result_exists' : 'no_result';
    } else if (matches.some((testResult) => testResult.passFail === 'pass')) {
      state = 'awaiting_verification';
    } else {
      state = 'failing';
    }
    return [
      { itemId: item.id, description: item.description, testType: item.testType ?? null, state },
    ];
  });
}

// The lot projection shared by the single-lot and batch conformance fetches —
// exactly the columns the conformance computation reads, nothing more. Extracted
// to a const so both paths fetch an identical shape (M39).
//
// It is a `select`, not an `include`, because at the 5,000-lot claim ceiling this
// one query dominates the whole decision: `include`'s all-columns default was
// measured at 1,938ms p50 against 920ms for exactly these columns
// (docs/plans/f0-5-benchmark-results-2026-07-26.md §"Sizing the levers", variants
// 2 and 4). `ITPCompletion` alone has 17 columns — two Decimals, five nullable
// text fields, three timestamps — of which the gate reads three.
//
// `itpInstance.completions` is deliberately absent, and `id` is present so
// `hydrateFetchedLots` can fetch them FLAT — one `iTPCompletion.findMany` over
// the instance ids, grouped into a Map in JS — instead of letting Prisma nest
// them. Same three columns, same rows, same query count; only the joiner moves.
// Prisma's client-side nesting of 60,000 completion rows into 5,000 arrays
// measured 980ms against 734ms for the flat read plus the JS grouping
// (docs/plans/f0-5-benchmark-results-2026-07-26.md §"2026-07-28"). Completion ORDER is not
// observable: both readers (`buildItpChecklistCompleteness`,
// `getNaHoldPointSignoffItemIds`) fold completions into a Set of item ids and
// emit in `checklistItems` order.
//
// `template.checklistItems` is deliberately absent: `getChecklistItemsForInstance`
// returns the parsed `templateSnapshot` and only falls back to live template items
// when an instance has no readable snapshot. Every instance assigned through
// `POST /api/itp/instances` has carried a snapshot since `routes/itp/instances.ts`
// started writing one, so the nested include hydrated ~12 rows per lot that were
// then discarded (60,000 rows at the ceiling). The fallback is real for
// legacy/null-snapshot instances and is preserved by
// `attachLegacyChecklistItems` below — one extra query, deduplicated per
// template rather than repeated per instance.
//
// Wave C1 (spec §4.1.1 Path A) adds the sufficiency inputs. The perf cost was
// MEASURED, not assumed, because this select dominates the 5,000-lot claim
// decision (F0.5 Target 1, p95 < 3s):
//   * six Lot SCALARS — free, they ride the row already being read;
//   * `project` — Prisma resolves a to-one relation with ONE extra query keyed
//     by the distinct parent ids, and every lot in a claim shares one project,
//     so this is 1 query returning 1 row regardless of lot count.
//
// `geometries` is DELIBERATELY ABSENT, against §4.1.1's literal text. It is a
// to-many relation, so it costs O(lots) hydrated rows on the claim path, and it
// buys exactly nothing today: it feeds §3.3's lot-size advisory and the `m2`
// quantity fallback, and NO shipped pack declares `maxLotSize` or `perQuantity`
// [C1C-2] [C1C-3] [C1C-5]. Adding it measured a Target 1 regression. It comes
// back with the first pack that declares either limb — `resolveSufficiency`
// already accepts the geometries and falls back to `quantity.source: 'none'`
// without them.
/**
 * Exported alongside {@link resolveSufficiencyForLot} so D14 AT-50 can fetch a
 * real row with the REAL select and run it through the REAL mapper. Asserting
 * through a stub select would pass with §8.1 edit 1 or edit 3 missing.
 */
export const CONFORMANCE_LOT_SELECT = {
  id: true,
  lotNumber: true,
  status: true,
  projectId: true,
  // C1 sufficiency inputs (§4.1.1).
  activitySlug: true,
  layer: true,
  areaZone: true,
  // D14 §8.1 edit 1. Miss this and Prisma never fetches the column.
  materialType: true,
  testScale: true,
  quantityValue: true,
  quantityUnit: true,
  conformedAt: true,
  project: { select: { state: true, specificationSet: true, testSufficiencyMode: true } },
  itpInstance: {
    select: {
      id: true,
      templateId: true,
      templateSnapshot: true,
    },
  },
  testResults: {
    select: {
      id: true,
      itpChecklistItemId: true,
      testType: true,
      passFail: true,
      status: true,
    },
  },
  ncrLots: {
    where: {
      // Bound to the predicate library's constant rather than re-listed, so this
      // query and `ncrOpen` cannot drift (Wave D `D1a`).
      ncr: {
        status: { notIn: CLOSED_NCR_STATUSES },
      },
    },
    select: {
      ncr: {
        select: {
          id: true,
          ncrNumber: true,
          description: true,
          status: true,
        },
      },
    },
  },
  holdPoints: {
    where: OPEN_HOLD_POINT_CONDITIONS_WHERE,
    select: {
      id: true,
      description: true,
      itpChecklistItem: { select: { description: true } },
      currentRound: {
        select: {
          _count: {
            select: { conditions: { where: { recordedSatisfiedAt: null } } },
          },
        },
      },
    },
  },
};

// The fetched-lot shape the pure conformance computation consumes. Structurally
// a subset of the Prisma payload from CONFORMANCE_LOT_SELECT, so the
// findUnique/findMany results assign directly.
interface OpenConditionHoldPoint {
  id: string;
  description: string | null;
  itpChecklistItem: { description: string };
  currentRound: { _count: { conditions: number } } | null;
}

interface LotForConformance {
  id: string;
  lotNumber: string;
  status: string;
  projectId: string;
  // C1 sufficiency inputs (§4.1.1). `Decimal | null` is widened to the structural
  // shape the resolver already parses.
  //
  // OPTIONAL, like `noNaHoldPointBypass` before them: `CONFORMANCE_LOT_SELECT`
  // always supplies them, so both production paths are complete, but a caller
  // holding a partial lot (unit-test fixtures) stays valid and simply resolves no
  // sufficiency. `project` is the discriminator — without it there is no
  // authority to resolve a ruleset from, so resolution is skipped entirely.
  activitySlug?: string | null;
  layer?: string | null;
  areaZone?: string | null;
  /** D14 §8.1 edit 2 — without it the mapper below is a type error. */
  materialType?: string | null;
  testScale?: string | null;
  quantityValue?: { toString(): string } | null;
  quantityUnit?: string | null;
  conformedAt?: Date | null;
  project?: { state: string; specificationSet: string; testSufficiencyMode: string };
  geometries?: { areaM2: { toString(): string } | null }[];
  itpInstance: ItpInstanceForConformance | null;
  testResults: {
    id: string;
    itpChecklistItemId: string | null;
    testType: string;
    passFail: string;
    status: string;
  }[];
  ncrLots: { ncr: { id: string; ncrNumber: string; description: string; status: string } }[];
  openConditionHoldPoints?: OpenConditionHoldPoint[];
}

// Pure (DB-free) conformance computation. Takes a fetched lot plus the set of
// its checklist-item ids whose hold point is RELEASED, and returns the full
// prerequisites + canConform + blockingReasons. Extracted (M39) so the single
// path and the batched create-claim path produce byte-identical results from
// one place — the only difference between them is HOW the released-hold-point
// ids are fetched (one query per lot vs one query for all lots).
//
// Wave C1 adds a THIRD parameter, mirroring `releasedHoldPointItemIds` exactly
// [C1R-B1] [C1R-C5]: sufficiency is resolved per path (registry lookup, scale,
// quantity and — where a rule is regime-bearing — one history read) and passed
// IN as data. The function stays sync and DB-free, so the M39 byte-identity
// guarantee survives. `null` means "not resolved on this path" and is treated
// exactly like "no ruleset": advisory-free, never blocking.
export function computeConformanceResult(
  lot: LotForConformance,
  releasedHoldPointItemIds: ReadonlySet<string>,
  sufficiency: ResolvedSufficiency | null = null,
  // F1 §4.6 [F1C-B4]. A FOURTH optional parameter, mirroring the third exactly:
  // the batched claim path creates ONE category resolver and passes it to every
  // member, so 5,000 lots share one cache over the few dozen distinct test-type
  // strings they actually carry. Absent (the single-lot path, every unit test)
  // the evaluator makes its own — memoizing a pure function is transparent, so
  // only the cache lifetime differs and M39 byte-identity is unaffected (AT-32).
  resolveCategory?: CategoryResolver,
): ConformanceCheckResult {
  const prerequisites: ConformancePrerequisites = {
    itpAssigned: false,
    itpCompleted: false,
    itpCompletedCount: 0,
    itpTotalCount: 0,
    itpIncompleteItems: [],
    testRequired: false,
    hasPassingTest: false,
    outstandingTestItems: [],
    testResults: [],
    noOpenNcrs: true,
    openNcrs: [],
    noOpenHoldPointConditions: true,
    openHoldPointConditions: [],
    naHoldPointBlockerCount: 0,
    noNaHoldPointBypass: true,
    sufficiencyBlocks: false,
  };

  let checklistItems: NormalizedChecklistItem[] = [];
  if (lot.itpInstance) {
    prerequisites.itpAssigned = true;
    checklistItems = getNormalizedChecklistItems(lot.itpInstance);

    const completeness = buildItpChecklistCompleteness(checklistItems, lot.itpInstance.completions);
    prerequisites.itpTotalCount = completeness.totalCount;
    prerequisites.itpCompletedCount = completeness.completedCount;
    prerequisites.itpCompleted = completeness.completed;
    prerequisites.itpIncompleteItems = completeness.incompleteItems;
    prerequisites.testRequired = itpRequiresTest(checklistItems);

    // N/A hold-point bypass guard: an N/A'd hold-point sign-off item only counts
    // as finished when its hold point is released.
    const naSignoffItemIds = getNaHoldPointSignoffItemIds(
      checklistItems,
      lot.itpInstance.completions,
    );
    const unreleasedNaCount = naSignoffItemIds.filter(
      (id) => !releasedHoldPointItemIds.has(id),
    ).length;
    prerequisites.naHoldPointBlockerCount = unreleasedNaCount;
    prerequisites.noNaHoldPointBypass = unreleasedNaCount === 0;
  }

  // Check test results - need at least one passing and verified test
  prerequisites.testResults = lot.testResults.map((t) => ({
    id: t.id,
    itpChecklistItemId: t.itpChecklistItemId,
    testType: t.testType,
    passFail: t.passFail,
    status: t.status,
  }));

  // Every test-required ITP item needs matching passing verified evidence. A
  // direct checklist-item link is strongest; legacy/manual tests can still
  // satisfy the gate when their test type exactly matches the item's test type.
  const requiredTestItems = checklistItems.filter(isRequiredTestItem);
  prerequisites.hasPassingTest =
    requiredTestItems.length > 0 &&
    requiredTestItems.every((item) => hasVerifiedPassingTestForItem(item, lot.testResults));
  prerequisites.outstandingTestItems = buildOutstandingTestItems(checklistItems, lot.testResults);

  // Check for open NCRs (any NCR that isn't closed). The Prisma query already
  // filters closed NCR links so large historical NCR lists do not get hydrated.
  const ncrs = lot.ncrLots.map((ncrLot) => ncrLot.ncr);
  prerequisites.openNcrs = ncrs.map((ncr) => ({
    id: ncr.id,
    ncrNumber: ncr.ncrNumber,
    description: ncr.description,
    status: ncr.status,
  }));
  prerequisites.noOpenNcrs = ncrs.length === 0;

  prerequisites.openHoldPointConditions = (lot.openConditionHoldPoints ?? []).map((holdPoint) => ({
    holdPointId: holdPoint.id,
    holdPointName:
      holdPoint.description?.trim() ||
      holdPoint.itpChecklistItem.description ||
      'Unnamed hold point',
    openConditionCount: holdPoint.currentRound?._count.conditions ?? 0,
  }));
  prerequisites.noOpenHoldPointConditions = prerequisites.openHoldPointConditions.length === 0;

  // Wave C1 (§5.1.1, §5.1.2). Evaluated before `lotConformable` so its single
  // blocking limb is in the prerequisites the predicate reads. The evaluator owns
  // the structural non-blocking expression, so nothing here needs to re-check the
  // mode or the ruleset status.
  const sufficiencyEvaluation = sufficiency
    ? evaluateSufficiency({
        subjectId: lot.id,
        resolved: sufficiency,
        tests: lot.testResults,
        checklistItems,
        resolveCategory,
      })
    : null;
  prerequisites.sufficiencyBlocks = sufficiencyEvaluation?.sufficiencyBlocks ?? false;

  // Determine if lot can be conformed (shared authoritative predicate).
  const canConform = lotConformable(prerequisites);

  const blockingReasons: string[] = [];
  if (!prerequisites.itpAssigned) {
    blockingReasons.push('No ITP assigned to this lot');
  }
  if (!prerequisites.itpCompleted && prerequisites.itpAssigned) {
    blockingReasons.push(
      `ITP checklist incomplete (${prerequisites.itpCompletedCount}/${prerequisites.itpTotalCount} items completed)`,
    );
  }
  if (prerequisites.testRequired && !prerequisites.hasPassingTest) {
    blockingReasons.push('ITP requires a matching passing verified test result');
  }
  if (!prerequisites.noOpenNcrs) {
    blockingReasons.push(`${prerequisites.openNcrs.length} open NCR(s) must be closed`);
  }
  if (!prerequisites.noOpenHoldPointConditions) {
    const openConditionCount = prerequisites.openHoldPointConditions.reduce(
      (total, holdPoint) => total + holdPoint.openConditionCount,
      0,
    );
    blockingReasons.push(
      `${openConditionCount} hold point release condition${openConditionCount === 1 ? '' : 's'} must be recorded satisfied`,
    );
  }
  if (!prerequisites.noNaHoldPointBypass) {
    blockingReasons.push(
      `${prerequisites.naHoldPointBlockerCount} hold point item${prerequisites.naHoldPointBlockerCount === 1 ? '' : 's'} marked N/A but not released`,
    );
  }
  if (prerequisites.sufficiencyBlocks && sufficiencyEvaluation) {
    for (const reason of describeSufficiencyShortfalls(sufficiencyEvaluation)) {
      blockingReasons.push(reason);
    }
  }

  return {
    lot: {
      id: lot.id,
      lotNumber: lot.lotNumber,
      status: lot.status,
      projectId: lot.projectId,
    },
    prerequisites,
    canConform,
    blockingReasons,
    sufficiency: sufficiencyEvaluation,
  };
}

/**
 * The blocking-reason strings for a sufficiency shortfall — facts only: counts
 * and the clause that carries them, never a quotation of specification prose
 * (§8.4). One line per insufficient rule so a force-conform records exactly
 * which requirement was overridden.
 */
function describeSufficiencyShortfalls(evaluation: SufficiencyEvaluation): string[] {
  return evaluation.rules
    .filter((rule) => rule.state === 'insufficient' && rule.requiredCount !== null)
    .map(
      (rule) =>
        `Requires ${rule.requiredCount} ${rule.testType} test${rule.requiredCount === 1 ? '' : 's'} ` +
        `(${rule.citation.authority} ${rule.citation.document}, clause ${rule.citation.clause}) — ` +
        `${rule.passingCount} verified conforming`,
    );
}

// The shape CONFORMANCE_LOT_SELECT returns: a LotForConformance whose instance
// carries `id` and `templateId` (to fetch completions and to resolve a legacy
// fallback) but neither completions nor live template items yet.
type FetchedLotForConformance = Omit<
  LotForConformance,
  'itpInstance' | 'openConditionHoldPoints'
> & {
  itpInstance: {
    id: string;
    templateId: string;
    templateSnapshot?: string | null;
  } | null;
  holdPoints?: OpenConditionHoldPoint[];
};

// Completions for every fetched instance, in ONE flat query grouped in JS.
//
// Identical rows to the nested `completions` relation the select used to carry —
// same three gate columns, same one extra query Prisma fired anyway — but Prisma
// no longer builds 5,000 nested arrays out of 60,000 rows, which is where the
// time went (§"Levers", 980ms nested vs 734ms flat at the 5,000-lot ceiling).
async function fetchCompletionsByInstanceId(
  instanceIds: string[],
  client: ConformancePrismaClient,
): Promise<Map<string, ChecklistCompletenessCompletion[]>> {
  const byInstanceId = new Map<string, ChecklistCompletenessCompletion[]>();
  if (instanceIds.length === 0) return byInstanceId;

  const completions = await client.iTPCompletion.findMany({
    where: { itpInstanceId: { in: instanceIds } },
    select: {
      itpInstanceId: true,
      checklistItemId: true,
      status: true,
      verificationStatus: true,
    },
  });
  for (const completion of completions) {
    const list = byInstanceId.get(completion.itpInstanceId);
    if (list) list.push(completion);
    else byInstanceId.set(completion.itpInstanceId, [completion]);
  }
  return byInstanceId;
}

// Live template items for the instances whose snapshot does not PARSE — absent or
// unreadable — which is exactly the condition `getChecklistItemsForInstance` falls
// back on, so detection calls the same parser rather than sniffing for null.
//
// One query for the DISTINCT templates that actually need it, so 5,000 lots
// sharing one legacy template cost 12 rows, not 60,000. Modern (snapshot-bearing)
// instances fire no query at all.
async function fetchLegacyChecklistItemsByTemplateId(
  lots: FetchedLotForConformance[],
  client: ConformancePrismaClient,
): Promise<Map<string, ChecklistItem[]>> {
  const itemsByTemplateId = new Map<string, ChecklistItem[]>();
  const legacyTemplateIds = [
    ...new Set(
      lots.flatMap((lot) =>
        lot.itpInstance && !parseTemplateSnapshot(lot.itpInstance.templateSnapshot)
          ? [lot.itpInstance.templateId]
          : [],
      ),
    ),
  ];
  if (legacyTemplateIds.length === 0) return itemsByTemplateId;

  const items = await client.iTPChecklistItem.findMany({
    where: { templateId: { in: legacyTemplateIds } },
  });
  for (const item of items) {
    const list = itemsByTemplateId.get(item.templateId);
    if (list) list.push(item);
    else itemsByTemplateId.set(item.templateId, [item]);
  }
  return itemsByTemplateId;
}

// Turns the raw CONFORMANCE_LOT_SELECT payload into the shape the pure
// computation consumes: completions attached flat, plus the live-template
// fallback for legacy instances. Both the single and the batch path go through
// here, so they still fetch an identical shape (M39).
async function hydrateFetchedLots(
  lots: FetchedLotForConformance[],
  client: ConformancePrismaClient,
): Promise<LotForConformance[]> {
  // Sequential, not `Promise.all`: these run on a `tx` client inside the claim
  // decision's serializable transaction, where concurrent queries on one
  // connection are a Prisma footgun and buy nothing — the legacy query is
  // skipped outright for snapshot-bearing instances, which is every modern one.
  const completionsByInstanceId = await fetchCompletionsByInstanceId(
    lots.flatMap((lot) => (lot.itpInstance ? [lot.itpInstance.id] : [])),
    client,
  );
  const legacyItemsByTemplateId = await fetchLegacyChecklistItemsByTemplateId(lots, client);

  return lots.map((lot) => {
    const openConditionHoldPoints = lot.holdPoints ?? [];
    if (!lot.itpInstance) return { ...lot, itpInstance: null, openConditionHoldPoints };
    const legacyItems = legacyItemsByTemplateId.get(lot.itpInstance.templateId);
    return {
      ...lot,
      openConditionHoldPoints,
      itpInstance: {
        ...lot.itpInstance,
        completions: completionsByInstanceId.get(lot.itpInstance.id) ?? [],
        ...(legacyItems ? { template: { checklistItems: legacyItems } } : {}),
      },
    };
  });
}

// Released-hold-point checklist-item ids for ONE lot (single path). Preserves
// the original query shape and the skip-when-no-na-items behavior so the
// single-lot gate stays byte-identical.
async function fetchReleasedHoldPointItemIdsForLot(
  lot: LotForConformance,
  client: ConformancePrismaClient = prisma,
): Promise<Set<string>> {
  if (!lot.itpInstance) return new Set();
  const checklistItems = getNormalizedChecklistItems(lot.itpInstance);
  const naSignoffItemIds = getNaHoldPointSignoffItemIds(
    checklistItems,
    lot.itpInstance.completions,
  );
  if (naSignoffItemIds.length === 0) return new Set();

  const releasedHoldPoints = await client.holdPoint.findMany({
    where: {
      lotId: lot.id,
      itpChecklistItemId: { in: naSignoffItemIds },
      status: 'released',
    },
    select: { itpChecklistItemId: true },
  });

  return new Set(
    releasedHoldPoints.map((hp) => hp.itpChecklistItemId).filter((id): id is string => id !== null),
  );
}

/**
 * Wave C1 (§3.4.3 [C1R-B7]). The frequency-stream read is a predicate read over
 * exactly the range concurrent conforms write, so it must never run inside the
 * serializable decision transaction. Callers opt IN by supplying a fetcher; the
 * default is `null`, which resolves every regime to `full` — the over-testing,
 * safe direction — and issues no history query at all.
 *
 * In C1.1 the conform DECISION path takes the default, which is behaviour-neutral
 * because no shipped pack carries reduced FIGURES: `requiredCount` is identical
 * at `full` and at an eligibility-only streak (§3.4.1a [C1C-6]). The readiness
 * path, which runs outside any transaction, supplies the real fetcher.
 */
export interface ConformanceSufficiencyOptions {
  regimeFetcher?: RegimeStreamFetcher | null;
  /** Evaluation date for ruleset effectivity; defaults to now. */
  now?: Date;
}

/**
 * The lot columns sufficiency resolution reads — every scalar limb plus
 * `project` and `geometries`, and NONE of the relations the conformance gate
 * reads. Narrower than {@link LotForConformance} on purpose: it is exactly what
 * a raw `CONFORMANCE_LOT_SELECT` payload carries BEFORE
 * {@link hydrateFetchedLots} attaches completions, so D14 AT-50 can keep pinning
 * `sufficiencyInput()` against a real row straight out of the real select.
 */
type SufficiencyLotSource = Omit<LotForConformance, 'itpInstance' | 'testResults' | 'ncrLots'>;

function sufficiencyInput(
  lot: SufficiencyLotSource,
  project: NonNullable<LotForConformance['project']>,
) {
  return {
    id: lot.id,
    projectId: lot.projectId,
    activitySlug: lot.activitySlug ?? null,
    layer: lot.layer ?? null,
    areaZone: lot.areaZone ?? null,
    // D14 §8.1 edit 3 — THE SILENT ONE. `sufficiencyInput()` is the only place
    // lot columns become a `SufficiencyLotInput`, and it is invisible from the
    // field's own name. Miss it and `materialType` is persisted, returned by the
    // API and visible in the form while being NEVER SEEN BY THE EVALUATOR: the
    // Type-A cap never fires, and every test that stubs the resolver still passes.
    materialType: lot.materialType ?? null,
    testScale: lot.testScale ?? null,
    quantityValue: lot.quantityValue ?? null,
    quantityUnit: lot.quantityUnit ?? null,
    conformedAt: lot.conformedAt ?? null,
    project,
    geometries: lot.geometries ?? [],
  };
}

/**
 * Exported so D14 AT-50 can pin the `sufficiencyInput()` mapper against a REAL
 * lot row rather than a stub. That mapper is the only place lot columns become a
 * `SufficiencyLotInput`, and a missing field there is invisible from the field's
 * own name: the value is persisted, returned by the API and visible in the form
 * while never reaching the evaluator (§8.1 edit 3).
 */
export async function resolveSufficiencyForLot(
  lot: SufficiencyLotSource,
  options: ConformanceSufficiencyOptions | undefined,
): Promise<ResolvedSufficiency | null> {
  const project = lot.project;
  if (!project) return null;
  return resolveSufficiency(
    sufficiencyInput(lot, project),
    options?.regimeFetcher ?? null,
    options?.now ?? new Date(),
  );
}

export async function checkConformancePrerequisites(
  lotId: string,
  client: ConformancePrismaClient = prisma,
  options?: ConformanceSufficiencyOptions,
): Promise<ConformanceCheckResult> {
  const fetched = await client.lot.findUnique({
    where: { id: lotId },
    select: CONFORMANCE_LOT_SELECT,
  });

  if (!fetched) {
    return { error: 'Lot not found', lot: null };
  }

  const [lot] = await hydrateFetchedLots([fetched], client);
  const releasedHoldPointItemIds = await fetchReleasedHoldPointItemIdsForLot(lot, client);
  const sufficiency = await resolveSufficiencyForLot(lot, options);
  return computeConformanceResult(lot, releasedHoldPointItemIds, sufficiency);
}

// Batched conformance for many lots — collapses the per-lot ~2N+1 queries the
// create-claim readiness loop used to fire (one lot.findUnique + one
// holdPoint.findMany PER lot) into a constant number: one lot.findMany, one
// iTPCompletion.findMany, at most one holdPoint.findMany and at most one
// legacy-checklist-item findMany for ALL lots (see hydrateFetchedLots). The
// completions query is not a new round trip — Prisma fired exactly the same one
// under the hood when they were a nested relation. Returns a map keyed by lot id; a
// requested lot id missing from the map means the lot was not found (callers
// that require every lot should treat a missing key as not-found). (M39)
export async function checkConformancePrerequisitesBatch(
  lotIds: string[],
  client: ConformancePrismaClient = prisma,
  options?: ConformanceSufficiencyOptions,
): Promise<Map<string, ConformanceCheckResult>> {
  const results = new Map<string, ConformanceCheckResult>();
  if (lotIds.length === 0) return results;

  const lots = await hydrateFetchedLots(
    await client.lot.findMany({
      where: { id: { in: lotIds } },
      select: CONFORMANCE_LOT_SELECT,
    }),
    client,
  );

  // Union of N/A hold-point sign-off item ids across all lots, so a single
  // holdPoint.findMany resolves every lot's bypass guard.
  const allNaSignoffItemIds: string[] = [];
  for (const lot of lots) {
    if (!lot.itpInstance) continue;
    const checklistItems = getNormalizedChecklistItems(lot.itpInstance);
    allNaSignoffItemIds.push(
      ...getNaHoldPointSignoffItemIds(checklistItems, lot.itpInstance.completions),
    );
  }

  const releasedByLot = new Map<string, Set<string>>();
  if (allNaSignoffItemIds.length > 0) {
    const releasedHoldPoints = await client.holdPoint.findMany({
      where: {
        lotId: { in: lotIds },
        itpChecklistItemId: { in: allNaSignoffItemIds },
        status: 'released',
      },
      select: { lotId: true, itpChecklistItemId: true },
    });
    for (const hp of releasedHoldPoints) {
      if (!hp.itpChecklistItemId) continue;
      const set = releasedByLot.get(hp.lotId) ?? new Set<string>();
      set.add(hp.itpChecklistItemId);
      releasedByLot.set(hp.lotId, set);
    }
  }

  // Sufficiency for the whole set in ONE pass (C1.2, spec §11 C1.2, §12).
  //
  // Without a fetcher this is entirely DB-FREE — registry lookup, scale and
  // quantity are pure over rows already fetched — so the batch keeps its
  // constant-query guarantee: one lot.findMany, at most one holdPoint.findMany,
  // at most one legacy-checklist findMany, plus the single `project` row Prisma
  // hydrates for the whole set. That is the shape the claim DECISION path takes,
  // deliberately: it runs inside a serializable transaction, where the
  // frequency-stream read must never go `[C1R-B7]`.
  //
  // With a fetcher (the non-transactional readiness paths) it adds at most ONE
  // grouped query per distinct STREAM — never one per member, which a per-lot
  // loop would have made 5,000 reads on a full claim-readiness page.
  const now = options?.now ?? new Date();
  const withProject = lots.filter(
    (lot): lot is typeof lot & { project: NonNullable<typeof lot.project> } => lot.project != null,
  );
  // F1 §4.6 [F1C-B4]. ONE resolver for the whole batch — the regime fold and
  // every member's evaluation share it. 5,000 lots × ~35 template item strings
  // is ~250,000 resolutions collapsing to a few dozen cache entries; unmemoized
  // that measured +436 ms against 36 ms of headroom on the #1581 claim budget.
  // Garbage-collected when this function returns; nothing is process-lifetime.
  const resolveCategory = createCategoryResolver();
  const sufficiencyByLotId = await resolveSufficiencyBatch(
    withProject.map((lot) => sufficiencyInput(lot, lot.project)),
    options?.regimeFetcher ?? null,
    now,
    resolveCategory,
  );
  for (const lot of lots) {
    results.set(
      lot.id,
      computeConformanceResult(
        lot,
        releasedByLot.get(lot.id) ?? new Set(),
        sufficiencyByLotId.get(lot.id) ?? null,
        resolveCategory,
      ),
    );
  }

  return results;
}
