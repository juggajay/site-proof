import { prisma } from './prisma.js';
import { isReleaseGatedChecklistItem } from './holdPointReleaseGating.js';
import {
  getChecklistItemsForInstance,
  type ChecklistItem,
} from '../routes/itp/helpers/templateSnapshot.js';

type ConformancePrismaClient = Pick<typeof prisma, 'holdPoint' | 'lot'>;

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

type OutstandingTestState = 'no_result' | 'awaiting_verification' | 'failing';

interface OutstandingTestItem {
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
  // N/A hold-point bypass guard: hold-point sign-off items marked N/A only
  // satisfy conformance when their HoldPoint is released. This count tracks
  // how many are still blocked (unreleased hold point + N/A status).
  naHoldPointBlockerCount: number;
  noNaHoldPointBypass: boolean;
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
}

export function getClaimBlockingReasonsForConformedLot(
  conformance: { prerequisites?: ClaimConformancePrerequisites } | null | undefined,
): string[] {
  const prerequisites = conformance?.prerequisites;
  if (!prerequisites) {
    return ['Conformance prerequisites could not be verified'];
  }

  const reasons: string[] = [];
  // A stored conformed lot without an ITP may be a legacy/imported or
  // deliberately force-conformed record. Do not retroactively block claims for
  // that historical state alone, but still enforce regressions like open NCRs.
  if (prerequisites.itpAssigned) {
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

function getNormalizedChecklistItems(
  itpInstance: ItpInstanceForConformance,
): NormalizedChecklistItem[] {
  return getChecklistItemsForInstance(itpInstance).map((item) => ({
    ...item,
    description: item.description ?? 'ITP item',
    pointType: item.pointType ?? 'standard',
  }));
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

function normalizeTestType(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function isRequiredTestItem(item: {
  id: string;
  evidenceRequired?: string | null;
  testType?: string | null;
}): boolean {
  return item.evidenceRequired === 'test' || Boolean(item.testType);
}

function testResultMatchesItem(
  item: { id: string; testType?: string | null },
  testResult: { itpChecklistItemId?: string | null; testType: string },
): boolean {
  if (testResult.itpChecklistItemId === item.id) {
    return true;
  }
  const requiredTestType = normalizeTestType(item.testType);
  return Boolean(requiredTestType) && normalizeTestType(testResult.testType) === requiredTestType;
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
    (testResult) =>
      testResult.passFail === 'pass' &&
      testResult.status === 'verified' &&
      testResultMatchesItem(item, testResult),
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
  return checklistItems.filter(isRequiredTestItem).flatMap((item) => {
    if (hasVerifiedPassingTestForItem(item, testResults)) {
      return [];
    }
    const matches = testResults.filter((testResult) => testResultMatchesItem(item, testResult));
    let state: OutstandingTestState;
    if (matches.length === 0) {
      state = 'no_result';
    } else if (matches.some((testResult) => testResult.passFail === 'pass')) {
      state = 'awaiting_verification';
    } else {
      state = 'failing';
    }
    return [{ description: item.description, testType: item.testType ?? null, state }];
  });
}

// The deep lot include shared by the single-lot and batch conformance fetches —
// exactly the fields the conformance computation reads, nothing more. Extracted
// to a const so both paths fetch an identical shape (M39).
const CONFORMANCE_LOT_INCLUDE = {
  itpInstance: {
    include: {
      template: {
        include: {
          checklistItems: true,
        },
      },
      completions: true,
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
      ncr: {
        status: { notIn: ['closed', 'closed_concession'] },
      },
    },
    include: {
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
};

// The fetched-lot shape the pure conformance computation consumes. Structurally
// a subset of the Prisma payload from CONFORMANCE_LOT_INCLUDE, so the
// findUnique/findMany results assign directly.
interface LotForConformance {
  id: string;
  lotNumber: string;
  status: string;
  projectId: string;
  itpInstance: ItpInstanceForConformance | null;
  testResults: {
    id: string;
    itpChecklistItemId: string | null;
    testType: string;
    passFail: string;
    status: string;
  }[];
  ncrLots: { ncr: { id: string; ncrNumber: string; description: string; status: string } }[];
}

// Pure (DB-free) conformance computation. Takes a fetched lot plus the set of
// its checklist-item ids whose hold point is RELEASED, and returns the full
// prerequisites + canConform + blockingReasons. Extracted (M39) so the single
// path and the batched create-claim path produce byte-identical results from
// one place — the only difference between them is HOW the released-hold-point
// ids are fetched (one query per lot vs one query for all lots).
export function computeConformanceResult(
  lot: LotForConformance,
  releasedHoldPointItemIds: ReadonlySet<string>,
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
    naHoldPointBlockerCount: 0,
    noNaHoldPointBypass: true,
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

  // Determine if lot can be conformed
  const canConform =
    prerequisites.itpAssigned &&
    prerequisites.itpCompleted &&
    (!prerequisites.testRequired || prerequisites.hasPassingTest) &&
    prerequisites.noOpenNcrs &&
    prerequisites.noNaHoldPointBypass;

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
  if (!prerequisites.noNaHoldPointBypass) {
    blockingReasons.push(
      `${prerequisites.naHoldPointBlockerCount} hold point item${prerequisites.naHoldPointBlockerCount === 1 ? '' : 's'} marked N/A but not released`,
    );
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
  };
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

export async function checkConformancePrerequisites(
  lotId: string,
  client: ConformancePrismaClient = prisma,
): Promise<ConformanceCheckResult> {
  const lot = await client.lot.findUnique({
    where: { id: lotId },
    include: CONFORMANCE_LOT_INCLUDE,
  });

  if (!lot) {
    return { error: 'Lot not found', lot: null };
  }

  const releasedHoldPointItemIds = await fetchReleasedHoldPointItemIdsForLot(lot, client);
  return computeConformanceResult(lot, releasedHoldPointItemIds);
}

// Batched conformance for many lots — collapses the per-lot ~2N+1 queries the
// create-claim readiness loop used to fire (one lot.findUnique + one
// holdPoint.findMany PER lot) into a constant number: one lot.findMany and at
// most one holdPoint.findMany for ALL lots. Returns a map keyed by lot id; a
// requested lot id missing from the map means the lot was not found (callers
// that require every lot should treat a missing key as not-found). (M39)
export async function checkConformancePrerequisitesBatch(
  lotIds: string[],
  client: ConformancePrismaClient = prisma,
): Promise<Map<string, ConformanceCheckResult>> {
  const results = new Map<string, ConformanceCheckResult>();
  if (lotIds.length === 0) return results;

  const lots = await client.lot.findMany({
    where: { id: { in: lotIds } },
    include: CONFORMANCE_LOT_INCLUDE,
  });

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

  for (const lot of lots) {
    results.set(lot.id, computeConformanceResult(lot, releasedByLot.get(lot.id) ?? new Set()));
  }

  return results;
}
