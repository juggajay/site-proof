import { prisma } from './prisma.js';
import { isReleaseGatedChecklistItem } from './holdPointReleaseGating.js';
import {
  getChecklistItemsForInstance,
  type ChecklistItem,
} from '../routes/itp/helpers/templateSnapshot.js';

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

interface ConformancePrerequisites {
  itpAssigned: boolean;
  itpCompleted: boolean;
  itpCompletedCount: number;
  itpTotalCount: number;
  itpIncompleteItems: { id: string; description: string; pointType: string }[];
  testRequired: boolean;
  hasPassingTest: boolean;
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

async function applyItpPrerequisites(
  lotId: string,
  itpInstance: ItpInstanceForConformance,
  prerequisites: ConformancePrerequisites,
): Promise<NormalizedChecklistItem[]> {
  prerequisites.itpAssigned = true;
  const checklistItems = getNormalizedChecklistItems(itpInstance);

  const completeness = buildItpChecklistCompleteness(checklistItems, itpInstance.completions);

  prerequisites.itpTotalCount = completeness.totalCount;
  prerequisites.itpCompletedCount = completeness.completedCount;
  prerequisites.itpCompleted = completeness.completed;
  prerequisites.itpIncompleteItems = completeness.incompleteItems;
  prerequisites.testRequired = itpRequiresTest(checklistItems);

  await applyNaHoldPointBypassGuard(lotId, checklistItems, itpInstance.completions, prerequisites);

  return checklistItems;
}

async function applyNaHoldPointBypassGuard(
  lotId: string,
  checklistItems: NormalizedChecklistItem[],
  completions: ChecklistCompletenessCompletion[],
  prerequisites: ConformancePrerequisites,
): Promise<void> {
  const naCompletionItemIds = new Set(
    completions.filter((c) => c.status === 'not_applicable').map((c) => c.checklistItemId),
  );

  const naHoldPointSignoffItems = checklistItems.filter(
    (item) => naCompletionItemIds.has(item.id) && isReleaseGatedChecklistItem(item),
  );

  if (naHoldPointSignoffItems.length === 0) {
    return;
  }

  const releasedHoldPoints = await prisma.holdPoint.findMany({
    where: {
      lotId,
      itpChecklistItemId: { in: naHoldPointSignoffItems.map((item) => item.id) },
      status: 'released',
    },
    select: { itpChecklistItemId: true },
  });

  const releasedItemIds = new Set(releasedHoldPoints.map((hp) => hp.itpChecklistItemId));
  const unreleasedNaCount = naHoldPointSignoffItems.filter(
    (item) => !releasedItemIds.has(item.id),
  ).length;

  prerequisites.naHoldPointBlockerCount = unreleasedNaCount;
  prerequisites.noNaHoldPointBypass = unreleasedNaCount === 0;
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

function hasVerifiedPassingTestForItem(
  item: { id: string; testType?: string | null },
  testResults: {
    itpChecklistItemId?: string | null;
    testType: string;
    passFail: string;
    status: string;
  }[],
): boolean {
  const requiredTestType = normalizeTestType(item.testType);

  return testResults.some((testResult) => {
    if (testResult.passFail !== 'pass' || testResult.status !== 'verified') {
      return false;
    }

    if (testResult.itpChecklistItemId === item.id) {
      return true;
    }

    return Boolean(requiredTestType) && normalizeTestType(testResult.testType) === requiredTestType;
  });
}

export async function checkConformancePrerequisites(
  lotId: string,
): Promise<ConformanceCheckResult> {
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: {
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
    },
  });

  if (!lot) {
    return { error: 'Lot not found', lot: null };
  }

  const prerequisites: ConformancePrerequisites = {
    itpAssigned: false,
    itpCompleted: false,
    itpCompletedCount: 0,
    itpTotalCount: 0,
    itpIncompleteItems: [],
    testRequired: false,
    hasPassingTest: false,
    testResults: [],
    noOpenNcrs: true,
    openNcrs: [],
    naHoldPointBlockerCount: 0,
    noNaHoldPointBypass: true,
  };

  let checklistItems: NormalizedChecklistItem[] = [];
  if (lot.itpInstance) {
    checklistItems = await applyItpPrerequisites(lot.id, lot.itpInstance, prerequisites);
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
