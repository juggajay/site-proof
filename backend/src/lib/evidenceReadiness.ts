import type {
  EvidenceReadinessItem,
  LotEvidenceReadiness,
  LotReadinessInput,
  ManagementPrepCounts,
} from './evidenceReadiness/core.js';
import { bucketState, item, splitItems, summarize } from './evidenceReadiness/core.js';
import { getClaimBlockingReasonsForConformedLot } from './conformancePrerequisites.js';

export type {
  ClaimEvidenceReview,
  ClaimEvidenceReviewInput,
  EvidenceReadinessArea,
  EvidenceReadinessItem,
  EvidenceReadinessSeverity,
  LotEvidenceReadiness,
  LotReadinessInput,
  ManagementPrepBucket,
  ManagementPrepCounts,
  ManagementPrepInput,
  ReadinessBucket,
} from './evidenceReadiness/core.js';
export { buildClaimEvidenceReviewFromInputs } from './evidenceReadiness/claimReview.js';

const OUTSTANDING_TEST_STATE_PHRASE = {
  no_result: 'no result yet',
  awaiting_verification: 'result awaiting verification',
  failing: 'result failed — re-test needed',
  unmatched_result_exists:
    "a test result exists for this lot but isn't linked to this requirement — open the test and link it",
} as const;

// Turn the per-item outstanding-test breakdown into the blocker detail so the
// card names which tests conformance is waiting on. Lists up to 3, then "and N
// more". Falls back to the generic line when no breakdown is available.
function buildOutstandingTestDetail(
  outstanding: NonNullable<
    LotReadinessInput['conformStatus']['prerequisites']['outstandingTestItems']
  >,
): string {
  if (outstanding.length === 0) {
    return 'Add or verify a passing test result before conformance.';
  }
  const shown = outstanding
    .slice(0, 3)
    .map((test) => `"${test.description}" — ${OUTSTANDING_TEST_STATE_PHRASE[test.state]}`);
  const remaining = outstanding.length - shown.length;
  const list = remaining > 0 ? `${shown.join('; ')}; and ${remaining} more` : shown.join('; ');
  return `${outstanding.length} required test${outstanding.length === 1 ? '' : 's'} outstanding: ${list}.`;
}

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

  if (
    lot.status === 'conformed' &&
    getClaimBlockingReasonsForConformedLot(conformStatus).length === 0
  ) {
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

  // Only surface the test blocker when the ITP actually has a test point. A
  // lot whose ITP has no test points must not be shown a blocker the conform
  // gate (which now uses testRequired) would never raise.
  if (prerequisites.testRequired && !prerequisites.hasPassingTest) {
    items.push(
      item({
        code: 'no_passing_verified_test',
        severity: 'blocker',
        area: 'test',
        title: 'Required tests outstanding',
        detail: buildOutstandingTestDetail(prerequisites.outstandingTestItems ?? []),
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
        detail: `${prerequisites.openNcrs.length} NCR${prerequisites.openNcrs.length === 1 ? '' : 's'} ${prerequisites.openNcrs.length === 1 ? 'remains' : 'remain'} open for this lot.`,
        blocksAction: true,
        actionLabel: 'Review NCRs',
        count: prerequisites.openNcrs.length,
        relatedIds: prerequisites.openNcrs.map((ncr) => ncr.id),
      }),
    );
  }

  // N/A hold-point bypass guard: a hold-point sign-off item marked N/A is only
  // accepted when its hold point is released. Surface this as a conformance
  // blocker so field staff know exactly what still needs a superintendent sign-off.
  const naHpBlockerCount = prerequisites.naHoldPointBlockerCount ?? 0;
  if (!(prerequisites.noNaHoldPointBypass ?? true) || naHpBlockerCount > 0) {
    items.push(
      item({
        code: 'na_hold_point_not_released',
        severity: 'blocker',
        area: 'hold_point',
        title: 'Hold point items require release',
        detail: `${naHpBlockerCount} hold point item${naHpBlockerCount === 1 ? '' : 's'} marked N/A but the hold point has not been released. Release the hold point to satisfy conformance.`,
        blocksAction: true,
        actionLabel: 'Review hold points',
        count: naHpBlockerCount,
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

// Round a percentage for display without exposing floating-point noise.
function roundReadinessPercentage(value: number): number {
  return Number(Math.max(0, Math.min(100, value)).toFixed(2));
}

function buildClaimItems(input: LotReadinessInput): EvidenceReadinessItem[] {
  const { lot, evidenceCounts, canViewCommercial, conformStatus } = input;
  const items: EvidenceReadinessItem[] = [];

  const claimedPercentage = roundReadinessPercentage(lot.claimedPercentage ?? 0);
  const remainingPercentage = roundReadinessPercentage(100 - claimedPercentage);

  if (lot.status === 'claimed' || lot.claimedInId) {
    items.push(
      item({
        code: 'already_claimed',
        severity: 'blocker',
        area: 'claim',
        title: 'Fully claimed',
        detail: 'This lot has been claimed in full and cannot be claimed again.',
        blocksAction: true,
      }),
    );
  } else if (lot.status === 'conformed' && claimedPercentage > 0) {
    // Cumulative claiming: a partially-claimed conformed lot stays selectable.
    items.push(
      item({
        code: 'partially_claimed',
        severity: 'support',
        area: 'claim',
        title: `Previously claimed ${claimedPercentage}%`,
        detail: `${remainingPercentage}% of this lot is still available to claim.`,
        blocksAction: false,
        count: remainingPercentage,
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
  } else {
    const currentConformanceBlockers = getClaimBlockingReasonsForConformedLot(conformStatus);
    if (currentConformanceBlockers.length > 0) {
      items.push(
        item({
          code: 'conformance_no_longer_current',
          severity: 'blocker',
          area: 'conformance',
          title: 'Conformance needs review',
          detail: currentConformanceBlockers.join('; '),
          blocksAction: true,
          actionLabel: 'Review conformance',
        }),
      );
    }
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
        detail: `${evidenceCounts.pendingTests} test result${evidenceCounts.pendingTests === 1 ? '' : 's'} ${evidenceCounts.pendingTests === 1 ? 'is' : 'are'} not verified yet.`,
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

function buildManagementPrepItems(input: LotReadinessInput): EvidenceReadinessItem[] {
  const prep = input.managementPrep;
  if (!prep) {
    return [];
  }

  const holdPointsAction = prep.batchRequestHref
    ? {
        actionLabel: 'Batch request',
        actionHref: prep.batchRequestHref,
      }
    : prep.holdPointsHref
      ? {
          actionLabel: 'Open Hold Points',
          actionHref: prep.holdPointsHref,
        }
      : {};

  const items: EvidenceReadinessItem[] = [];

  if (prep.missingRequestEvidence > 0) {
    items.push(
      item({
        code: 'missing_request_evidence',
        severity: 'warning',
        area: 'hold_point',
        title: 'Request evidence missing',
        detail: `${prep.missingRequestEvidence} release-gated hold point${prep.missingRequestEvidence === 1 ? '' : 's'} ${prep.missingRequestEvidence === 1 ? 'has' : 'have'} no request evidence attached yet.`,
        blocksAction: false,
        count: prep.missingRequestEvidence,
        relatedIds: prep.missingRequestEvidenceIds,
        ...holdPointsAction,
      }),
    );
  }

  if (prep.missingRecipients > 0) {
    items.push(
      item({
        code: 'missing_hold_point_recipients',
        severity: 'warning',
        area: 'hold_point',
        title: 'Hold point recipients missing',
        detail: `${prep.missingRecipients} release-gated hold point${prep.missingRecipients === 1 ? '' : 's'} ${prep.missingRecipients === 1 ? 'has' : 'have'} no request recipient or default recipient setting detectable.`,
        blocksAction: false,
        count: prep.missingRecipients,
        relatedIds: prep.missingRecipientIds,
        ...holdPointsAction,
      }),
    );
  }

  if (prep.managementOnlyItems > 0) {
    items.push(
      item({
        code: 'management_only_items',
        severity: 'warning',
        area: 'hold_point',
        title: 'Management-only items',
        detail: `${prep.managementOnlyItems} hold point${prep.managementOnlyItems === 1 ? '' : 's'} need management or superintendent release before field handoff.`,
        blocksAction: false,
        count: prep.managementOnlyItems,
        relatedIds: prep.managementOnlyItemIds,
        ...holdPointsAction,
      }),
    );
  }

  if (prep.releaseGatedHoldPoints > 0) {
    items.push(
      item({
        code: 'release_gated_hold_points',
        severity: 'support',
        area: 'hold_point',
        title: 'Release-gated hold points',
        detail: `${prep.releaseGatedHoldPoints} release-gated hold point${prep.releaseGatedHoldPoints === 1 ? '' : 's'} ${prep.releaseGatedHoldPoints === 1 ? 'is' : 'are'} in this lot's ITP.`,
        blocksAction: false,
        count: prep.releaseGatedHoldPoints,
        relatedIds: prep.releaseGatedHoldPointIds,
      }),
    );
  }

  if (prep.fieldActionableItems > 0) {
    items.push(
      item({
        code: 'field_actionable_items',
        severity: 'support',
        area: 'itp',
        title: 'Field-actionable ITP items',
        detail: `${prep.fieldActionableItems} checklist item${prep.fieldActionableItems === 1 ? '' : 's'} can be worked by field teams.`,
        blocksAction: false,
        count: prep.fieldActionableItems,
        relatedIds: prep.fieldActionableItemIds,
      }),
    );
  }

  return items;
}

function managementPrepCounts(input: LotReadinessInput): ManagementPrepCounts {
  const prep = input.managementPrep;
  return {
    releaseGatedHoldPoints: prep?.releaseGatedHoldPoints ?? 0,
    missingRequestEvidence: prep?.missingRequestEvidence ?? 0,
    missingRecipients: prep?.missingRecipients ?? 0,
    fieldActionableItems: prep?.fieldActionableItems ?? 0,
    managementOnlyItems: prep?.managementOnlyItems ?? 0,
  };
}

export function buildLotReadinessFromInputs(input: LotReadinessInput): LotEvidenceReadiness {
  const conformanceItems = buildConformanceItems(input);
  const claimItems = buildClaimItems(input);
  const managementPrepItems = buildManagementPrepItems(input);

  const conformanceSplit = splitItems(conformanceItems);
  const claimSplit = splitItems(claimItems);
  const managementPrepSplit = splitItems(managementPrepItems);

  const claimedPercentage = roundReadinessPercentage(input.lot.claimedPercentage ?? 0);
  const remainingPercentage = roundReadinessPercentage(100 - claimedPercentage);

  const conformanceState =
    input.lot.status === 'claimed'
      ? 'already_claimed'
      : input.lot.status === 'conformed' &&
          getClaimBlockingReasonsForConformedLot(input.conformStatus).length === 0
        ? 'already_conformed'
        : bucketState(conformanceItems);

  const claimState =
    input.lot.status === 'claimed' || input.lot.claimedInId
      ? 'already_claimed'
      : input.lot.status !== 'conformed'
        ? 'not_conformed'
        : bucketState(claimItems);

  const managementPrep = input.managementPrep
    ? {
        state: bucketState(managementPrepItems),
        counts: managementPrepCounts(input),
        ...managementPrepSplit,
      }
    : undefined;

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
      claimedPercentage: claimedPercentage,
      remainingPercentage: remainingPercentage,
    },
    ...(managementPrep ? { managementPrep } : {}),
    summary: summarize(conformanceSplit, claimSplit, ...(managementPrep ? [managementPrep] : [])),
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
    claimedPercentage: readiness.claim.claimedPercentage,
    remainingPercentage: readiness.claim.remainingPercentage,
  };

  return {
    ...readiness,
    conformance,
    claim,
    summary: summarize(
      conformance,
      claim,
      ...(readiness.managementPrep ? [readiness.managementPrep] : []),
    ),
  };
}
