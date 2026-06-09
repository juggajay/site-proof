import { prisma } from './prisma.js';

// A checklist item counts as finished for conformance only when its completion
// status is 'completed'. This preserves the pre-existing conformance semantics
// (the conform gate has always counted only 'completed' items); any other
// status — including 'not_applicable', 'failed', 'pending', or a missing
// completion — remains unfinished and still blocks. The N/A-as-finished
// question is a separate behaviour decision and is intentionally out of scope
// for the test-requirement change.
export function isItpCompletionFinished(status: string | null | undefined): boolean {
  return status === 'completed';
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
// An item is "finished" when its completion status is 'completed' (see
// isItpCompletionFinished). Extracted so the conformance gate can be
// unit-tested with mocked completions and so the finished-status rule stays in
// one place.
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
  };

  // Check ITP completion. Only 'completed' items count as finished (see
  // buildItpChecklistCompleteness / isItpCompletionFinished above); 'failed',
  // 'not_applicable', and missing items remain incomplete and still block.
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
    prerequisites.noOpenNcrs;

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
