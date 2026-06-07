import { prisma } from './prisma.js';

// A checklist item counts as finished for conformance when its completion is
// either 'completed' or 'not_applicable'. N/A is a first-class status that the
// app requires a reason for (itp/completions.ts) and renders as done; treating
// it as unfinished would make a lot with any N/A item impossible to conform.
// 'failed' and missing completions remain unfinished (they still block). This
// mirrors the isFinished semantics in routes/itp/helpers/lotProgression.ts.
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
// 'not_applicable'. Extracted so the conformance gate can be unit-tested with
// mocked completions and so the N/A semantics stay in one place.
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

interface ConformancePrerequisites {
  itpAssigned: boolean;
  itpCompleted: boolean;
  itpCompletedCount: number;
  itpTotalCount: number;
  itpIncompleteItems: { id: string; description: string; pointType: string }[];
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
    hasPassingTest: false,
    testResults: [],
    noOpenNcrs: true,
    openNcrs: [],
  };

  // Check ITP completion. N/A items count as finished (see
  // buildItpChecklistCompleteness / isItpCompletionFinished above) so a lot
  // with an N/A item can still be conformed; 'failed' and missing items block.
  if (lot.itpInstance) {
    prerequisites.itpAssigned = true;
    const checklistItems = lot.itpInstance.template.checklistItems;

    const completeness = buildItpChecklistCompleteness(checklistItems, lot.itpInstance.completions);

    prerequisites.itpTotalCount = completeness.totalCount;
    prerequisites.itpCompletedCount = completeness.completedCount;
    prerequisites.itpCompleted = completeness.completed;
    prerequisites.itpIncompleteItems = completeness.incompleteItems;
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
    prerequisites.hasPassingTest &&
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
  if (!prerequisites.hasPassingTest) {
    blockingReasons.push('No passing verified test result');
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
