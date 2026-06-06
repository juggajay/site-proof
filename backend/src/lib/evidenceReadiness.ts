import type {
  EvidenceReadinessItem,
  LotEvidenceReadiness,
  LotReadinessInput,
} from './evidenceReadiness/core.js';
import { bucketState, item, splitItems, summarize } from './evidenceReadiness/core.js';

export type {
  ClaimEvidenceReview,
  ClaimEvidenceReviewInput,
  EvidenceReadinessArea,
  EvidenceReadinessItem,
  EvidenceReadinessSeverity,
  LotEvidenceReadiness,
  LotReadinessInput,
  ReadinessBucket,
} from './evidenceReadiness/core.js';
export { buildClaimEvidenceReviewFromInputs } from './evidenceReadiness/claimReview.js';
function buildConformanceItems(input: LotReadinessInput): EvidenceReadinessItem[] {
  const { lot, conformStatus } = input;
  const { prerequisites } = conformStatus;

  if (lot.status === 'claimed') {
    return [
      item({
        code: 'lot_already_claimed',
        severity: 'support',
        area: 'conformance',
        title: 'Conformance complete',
        detail: 'This lot passed conformance before being included in a progress claim.',
        blocksAction: false,
      }),
    ];
  }

  if (lot.status === 'conformed') {
    return [
      item({
        code: 'lot_already_conformed',
        severity: 'support',
        area: 'conformance',
        title: 'Lot already conformed',
        detail:
          'This lot is conformed and can be considered for claiming if commercial rules are met.',
        blocksAction: false,
      }),
    ];
  }

  const items: EvidenceReadinessItem[] = [];

  if (!prerequisites.itpAssigned) {
    items.push(
      item({
        code: 'no_itp_assigned',
        severity: 'blocker',
        area: 'itp',
        title: 'No ITP assigned',
        detail: 'Assign an ITP before this lot can be conformed.',
        blocksAction: true,
        actionLabel: 'Assign ITP',
      }),
    );
  } else if (!prerequisites.itpCompleted) {
    items.push(
      item({
        code: 'itp_incomplete',
        severity: 'blocker',
        area: 'itp',
        title: 'ITP checklist incomplete',
        detail: `${prerequisites.itpCompletedCount}/${prerequisites.itpTotalCount} checklist items are complete.`,
        blocksAction: true,
        actionLabel: 'Complete ITP',
        count: prerequisites.itpTotalCount - prerequisites.itpCompletedCount,
        relatedIds: prerequisites.itpIncompleteItems.map((itpItem) => itpItem.id),
      }),
    );
  }

  if (!prerequisites.hasPassingTest) {
    items.push(
      item({
        code: 'no_passing_verified_test',
        severity: 'blocker',
        area: 'test',
        title: 'No passing verified test result',
        detail: 'Add or verify a passing test result before conformance.',
        blocksAction: true,
        actionLabel: 'Review tests',
      }),
    );
  }

  if (!prerequisites.noOpenNcrs) {
    items.push(
      item({
        code: 'open_ncrs',
        severity: 'blocker',
        area: 'ncr',
        title: 'Open NCRs must be closed',
        detail: `${prerequisites.openNcrs.length} NCR${prerequisites.openNcrs.length === 1 ? '' : 's'} remain open for this lot.`,
        blocksAction: true,
        actionLabel: 'Review NCRs',
        count: prerequisites.openNcrs.length,
        relatedIds: prerequisites.openNcrs.map((ncr) => ncr.id),
      }),
    );
  }

  if (conformStatus.canConform && items.length === 0) {
    items.push(
      item({
        code: 'conformance_prerequisites_met',
        severity: 'support',
        area: 'conformance',
        title: 'Conformance prerequisites met',
        detail: 'ITP, test, and NCR checks are ready for conformance.',
        blocksAction: false,
      }),
    );
  }

  return items;
}

function buildClaimItems(input: LotReadinessInput): EvidenceReadinessItem[] {
  const { lot, evidenceCounts, canViewCommercial } = input;
  const items: EvidenceReadinessItem[] = [];

  if (lot.status === 'claimed' || lot.claimedInId) {
    items.push(
      item({
        code: 'already_claimed',
        severity: 'blocker',
        area: 'claim',
        title: 'Already claimed',
        detail: 'This lot is already attached to a progress claim.',
        blocksAction: true,
      }),
    );
  } else if (lot.status !== 'conformed') {
    items.push(
      item({
        code: 'not_conformed',
        severity: 'blocker',
        area: 'claim',
        title: 'Not conformed',
        detail: 'Only conformed lots can be selected for a progress claim.',
        blocksAction: true,
      }),
    );
  }

  if (canViewCommercial && lot.status === 'conformed' && lot.budgetAmount === null) {
    items.push(
      item({
        code: 'missing_budget',
        severity: 'blocker',
        area: 'budget',
        title: 'Budget missing',
        detail: 'Add a lot budget before including this lot in a progress claim.',
        blocksAction: true,
        actionLabel: 'Add budget',
      }),
    );
  }

  if (evidenceCounts.unreleasedHoldPoints > 0) {
    items.push(
      item({
        code: 'unreleased_hold_points',
        severity: 'blocker',
        area: 'hold_point',
        title: 'Hold points unreleased',
        detail: `${evidenceCounts.unreleasedHoldPoints} hold point${evidenceCounts.unreleasedHoldPoints === 1 ? '' : 's'} still need release evidence.`,
        blocksAction: false,
        actionLabel: 'Review hold points',
        count: evidenceCounts.unreleasedHoldPoints,
      }),
    );
  }

  if (evidenceCounts.pendingTests > 0) {
    items.push(
      item({
        code: 'pending_tests',
        severity: 'warning',
        area: 'test',
        title: 'Tests still pending',
        detail: `${evidenceCounts.pendingTests} test result${evidenceCounts.pendingTests === 1 ? '' : 's'} are not verified yet.`,
        blocksAction: false,
        actionLabel: 'Review tests',
        count: evidenceCounts.pendingTests,
      }),
    );
  }

  const supportItems: EvidenceReadinessItem[] = [
    {
      code: 'released_hold_points',
      severity: 'support',
      area: 'hold_point',
      title: 'Released hold points',
      detail: `${evidenceCounts.releasedHoldPoints} hold point${evidenceCounts.releasedHoldPoints === 1 ? '' : 's'} released.`,
      blocksAction: false,
      count: evidenceCounts.releasedHoldPoints,
    },
    {
      code: 'approved_dockets',
      severity: 'support',
      area: 'docket',
      title: 'Approved dockets',
      detail: `${evidenceCounts.approvedDockets} approved docket${evidenceCounts.approvedDockets === 1 ? '' : 's'} linked to this lot.`,
      blocksAction: false,
      count: evidenceCounts.approvedDockets,
    },
    {
      code: 'diary_entries',
      severity: 'support',
      area: 'diary',
      title: 'Diary coverage',
      detail: `${evidenceCounts.diaryEntries} diary entr${evidenceCounts.diaryEntries === 1 ? 'y' : 'ies'} reference this lot.`,
      blocksAction: false,
      count: evidenceCounts.diaryEntries,
    },
    {
      code: 'documents',
      severity: 'support',
      area: 'document',
      title: 'Documents attached',
      detail: `${evidenceCounts.documents} document${evidenceCounts.documents === 1 ? '' : 's'} attached to this lot.`,
      blocksAction: false,
      count: evidenceCounts.documents,
    },
    {
      code: 'photos',
      severity: 'support',
      area: 'document',
      title: 'Photos attached',
      detail: `${evidenceCounts.photos} photo${evidenceCounts.photos === 1 ? '' : 's'} attached to this lot.`,
      blocksAction: false,
      count: evidenceCounts.photos,
    },
  ];

  items.push(...supportItems.filter((supportItem) => (supportItem.count ?? 0) > 0));

  return items;
}

export function buildLotReadinessFromInputs(input: LotReadinessInput): LotEvidenceReadiness {
  const conformanceItems = buildConformanceItems(input);
  const claimItems = buildClaimItems(input);

  const conformanceSplit = splitItems(conformanceItems);
  const claimSplit = splitItems(claimItems);

  const conformanceState =
    input.lot.status === 'claimed'
      ? 'already_claimed'
      : input.lot.status === 'conformed'
        ? 'already_conformed'
        : bucketState(conformanceItems);

  const claimState =
    input.lot.status === 'claimed' || input.lot.claimedInId
      ? 'already_claimed'
      : input.lot.status !== 'conformed'
        ? 'not_conformed'
        : bucketState(claimItems);

  const readiness: LotEvidenceReadiness = {
    lotId: input.lot.id,
    lotNumber: input.lot.lotNumber,
    status: input.lot.status,
    conformance: {
      state: conformanceState,
      ...conformanceSplit,
    },
    claim: {
      state: claimState,
      ...claimSplit,
      ...(input.canViewCommercial ? { budgetAmount: input.lot.budgetAmount } : {}),
      claimedInId: input.lot.claimedInId,
    },
    summary: summarize(conformanceSplit, claimSplit),
  };

  return input.canViewCommercial ? readiness : filterCommercialReadiness(readiness);
}

export function filterCommercialReadiness(readiness: LotEvidenceReadiness): LotEvidenceReadiness {
  const filterItems = (items: EvidenceReadinessItem[]) =>
    items.filter((readinessItem) => readinessItem.area !== 'budget');

  const conformance = {
    ...readiness.conformance,
    blockers: filterItems(readiness.conformance.blockers),
    warnings: filterItems(readiness.conformance.warnings),
    support: filterItems(readiness.conformance.support),
  };

  const claim = {
    state: readiness.claim.state,
    blockers: filterItems(readiness.claim.blockers),
    warnings: filterItems(readiness.claim.warnings),
    support: filterItems(readiness.claim.support),
    claimedInId: readiness.claim.claimedInId,
  };

  return {
    ...readiness,
    conformance,
    claim,
    summary: summarize(conformance, claim),
  };
}
