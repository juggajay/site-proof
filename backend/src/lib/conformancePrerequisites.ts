import { prisma } from './prisma.js';

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
    completions.filter((c) => isItpCompletionFinished(c.status)).map((c) => c.checklistItemId),
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
  testResults: { id: string; testType: string; passFail: string; status: string }[];
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
      testResults: true,
      ncrLots: {
        include: {
          ncr: true,
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

  // Check ITP completion. 'completed' and 'not_applicable' items both count as
  // finished (see buildItpChecklistCompleteness / isItpCompletionFinished above).
  // 'failed', 'pending', 'in_progress', and missing completions still block.
  if (lot.itpInstance) {
    prerequisites.itpAssigned = true;
    const checklistItems = lot.itpInstance.template.checklistItems;

    const completeness = buildItpChecklistCompleteness(checklistItems, lot.itpInstance.completions);

    prerequisites.itpTotalCount = completeness.totalCount;
    prerequisites.itpCompletedCount = completeness.completedCount;
    prerequisites.itpCompleted = completeness.completed;
    prerequisites.itpIncompleteItems = completeness.incompleteItems;

    // A passing verified test is only required when the ITP actually has a test
    // point. Lots whose ITP has no test points must not be forced to invent one.
    prerequisites.testRequired = itpRequiresTest(checklistItems);

    // N/A hold-point bypass guard (owner decision, 2026-06-11):
    // An N/A'd hold-point sign-off item (pointType 'hold_point', or
    // responsibleParty 'superintendent' with pointType !== 'witness') only
    // satisfies conformance when its HoldPoint record is released. Find any
    // such items and check their hold-point release status.
    //
    // Mirror the isHoldPointSignoffItem definition from
    // routes/itp/completions.ts:209-212 so the two definitions stay in sync.
    const naCompletionItemIds = new Set(
      lot.itpInstance.completions
        .filter((c) => c.status === 'not_applicable')
        .map((c) => c.checklistItemId),
    );

    const naHoldPointSignoffItems = checklistItems.filter((item) => {
      if (!naCompletionItemIds.has(item.id)) return false;
      const isHoldPointSignoffItem =
        item.pointType === 'hold_point' ||
        (item.responsibleParty === 'superintendent' && item.pointType !== 'witness');
      return isHoldPointSignoffItem;
    });

    if (naHoldPointSignoffItems.length > 0) {
      // For each N/A'd hold-point sign-off item, check whether a released
      // HoldPoint exists for this lot + checklist item combination.
      const releasedHoldPoints = await prisma.holdPoint.findMany({
        where: {
          lotId: lot.id,
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
  }

  // Check test results - need at least one passing and verified test
  prerequisites.testResults = lot.testResults.map((t) => ({
    id: t.id,
    testType: t.testType,
    passFail: t.passFail,
    status: t.status,
  }));

  // A lot needs at least one passing test that is verified
  prerequisites.hasPassingTest = lot.testResults.some(
    (t) => t.passFail === 'pass' && t.status === 'verified',
  );

  // Check for open NCRs (any NCR that isn't closed)
  // NCRs are linked to lots through the ncrLots join table
  const ncrs = lot.ncrLots.map((ncrLot) => ncrLot.ncr);
  const openNcrs = ncrs.filter(
    (ncr) => ncr.status !== 'closed' && ncr.status !== 'closed_concession',
  );
  prerequisites.openNcrs = openNcrs.map((ncr) => ({
    id: ncr.id,
    ncrNumber: ncr.ncrNumber,
    description: ncr.description,
    status: ncr.status,
  }));
  prerequisites.noOpenNcrs = openNcrs.length === 0;

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
    blockingReasons.push('ITP requires a test, but no passing verified test result was recorded');
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
