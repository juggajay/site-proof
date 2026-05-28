export type EvidenceReadinessSeverity = 'blocker' | 'warning' | 'support';

export type EvidenceReadinessArea =
  | 'conformance'
  | 'claim'
  | 'itp'
  | 'hold_point'
  | 'test'
  | 'ncr'
  | 'docket'
  | 'diary'
  | 'document'
  | 'budget'
  | 'permission';

export interface EvidenceReadinessItem {
  code: string;
  severity: EvidenceReadinessSeverity;
  area: EvidenceReadinessArea;
  title: string;
  detail: string;
  blocksAction: boolean;
  actionLabel?: string;
  actionHref?: string;
  count?: number;
  relatedIds?: string[];
}

export interface ReadinessBucket {
  state:
    | 'ready'
    | 'blocked'
    | 'warning'
    | 'already_conformed'
    | 'already_claimed'
    | 'not_conformed';
  blockers: EvidenceReadinessItem[];
  warnings: EvidenceReadinessItem[];
  support: EvidenceReadinessItem[];
}

export interface LotEvidenceReadiness {
  lotId: string;
  lotNumber: string;
  status: string;
  conformance: ReadinessBucket;
  claim: ReadinessBucket & {
    budgetAmount?: number | null;
    claimedInId?: string | null;
  };
  summary: {
    blockerCount: number;
    warningCount: number;
    supportCount: number;
    actionBlockerCount: number;
  };
}

interface ConformancePrerequisiteSnapshot {
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

export interface LotReadinessInput {
  lot: {
    id: string;
    lotNumber: string;
    status: string;
    budgetAmount: number | null;
    claimedInId: string | null;
  };
  canViewCommercial: boolean;
  conformStatus: {
    canConform: boolean;
    blockingReasons: string[];
    prerequisites: ConformancePrerequisiteSnapshot;
  };
  evidenceCounts: {
    unreleasedHoldPoints: number;
    releasedHoldPoints: number;
    approvedDockets: number;
    diaryEntries: number;
    documents: number;
    photos: number;
    pendingTests: number;
  };
}

export interface ClaimEvidenceReviewInput {
  claim: {
    id: string;
    claimNumber: number;
    totalClaimedAmount: number | string | { toString(): string } | null;
    claimedLots: Array<{
      amountClaimed: number | string | { toString(): string } | null;
      lot: {
        id: string;
        lotNumber: string;
        activityType: string | null;
        testResults: Array<{
          id: string;
          status: string;
          passFail: string | null;
          testType?: string | null;
        }>;
        ncrLots: Array<{
          ncr: {
            id: string;
            status: string;
            severity: string;
          };
        }>;
        documents: Array<{
          id: string;
          documentType: string;
        }>;
        itpInstance: {
          template: {
            checklistItems: Array<{
              id: string;
              pointType: string;
            }>;
          };
          completions: Array<{
            id: string;
            status: string;
            verificationStatus: string | null;
            checklistItemId: string;
          }>;
        } | null;
        holdPoints: Array<{
          id: string;
          status: string;
        }>;
      };
    }>;
  };
  analyzedAt?: string;
}

export interface ClaimEvidenceReview {
  claimId: string;
  claimNumber: number;
  analyzedAt: string;
  summary: {
    totalLots: number;
    readyCount: number;
    reviewCount: number;
    blockedCount: number;
    totalClaimAmount: number;
    recommendedAmount: number;
  };
  lots: Array<{
    lotId: string;
    lotNumber: string;
    activityType: string;
    claimAmount: number;
    claim: ReadinessBucket;
  }>;
  overallSuggestions: string[];
}

function item(input: EvidenceReadinessItem): EvidenceReadinessItem {
  return input;
}

function splitItems(items: EvidenceReadinessItem[]): Omit<ReadinessBucket, 'state'> {
  return {
    blockers: items.filter((readinessItem) => readinessItem.severity === 'blocker'),
    warnings: items.filter((readinessItem) => readinessItem.severity === 'warning'),
    support: items.filter((readinessItem) => readinessItem.severity === 'support'),
  };
}

function bucketState(
  items: EvidenceReadinessItem[],
  fallbackReadyState: ReadinessBucket['state'] = 'ready',
): ReadinessBucket['state'] {
  if (items.some((readinessItem) => readinessItem.blocksAction)) {
    return 'blocked';
  }

  if (items.some((readinessItem) => readinessItem.severity === 'blocker')) {
    return 'warning';
  }

  if (items.some((readinessItem) => readinessItem.severity === 'warning')) {
    return 'warning';
  }

  return fallbackReadyState;
}

function summarize(
  conformance: Omit<ReadinessBucket, 'state'>,
  claim: Omit<ReadinessBucket, 'state'>,
): LotEvidenceReadiness['summary'] {
  const allItems = [
    ...conformance.blockers,
    ...conformance.warnings,
    ...conformance.support,
    ...claim.blockers,
    ...claim.warnings,
    ...claim.support,
  ];

  return {
    blockerCount: allItems.filter((readinessItem) => readinessItem.severity === 'blocker').length,
    warningCount: allItems.filter((readinessItem) => readinessItem.severity === 'warning').length,
    supportCount: allItems.filter((readinessItem) => readinessItem.severity === 'support').length,
    actionBlockerCount: allItems.filter((readinessItem) => readinessItem.blocksAction).length,
  };
}

function reviewBucket(items: EvidenceReadinessItem[]): ReadinessBucket {
  const split = splitItems(items);
  const state: ReadinessBucket['state'] =
    split.blockers.length > 0 ? 'blocked' : split.warnings.length > 0 ? 'warning' : 'ready';

  return { state, ...split };
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

export function buildClaimEvidenceReviewFromInputs(
  input: ClaimEvidenceReviewInput,
): ClaimEvidenceReview {
  const lots = input.claim.claimedLots.map((claimedLot) => {
    const lot = claimedLot.lot;
    const items: EvidenceReadinessItem[] = [];
    const itpInstance = lot.itpInstance;

    if (itpInstance) {
      const totalItems = itpInstance.template.checklistItems.length;
      const completedItems = itpInstance.completions.filter(
        (completion) => completion.status === 'completed',
      ).length;
      const missingItems = Math.max(0, totalItems - completedItems);

      if (missingItems > 0) {
        const completionRatio = totalItems > 0 ? completedItems / totalItems : 0;
        items.push(
          item({
            code: 'itp_incomplete',
            severity: completionRatio < 0.5 ? 'blocker' : 'warning',
            area: 'itp',
            title: 'ITP checklist incomplete',
            detail: `${completedItems}/${totalItems} checklist items are complete.`,
            blocksAction: false,
            actionLabel: 'Review ITP',
            count: missingItems,
          }),
        );
      } else {
        items.push(
          item({
            code: 'itp_complete',
            severity: 'support',
            area: 'itp',
            title: 'ITP checklist complete',
            detail: `${completedItems}/${totalItems} checklist items are complete.`,
            blocksAction: false,
            count: completedItems,
          }),
        );
      }

      const holdPointItems = itpInstance.template.checklistItems.filter(
        (checklistItem) => checklistItem.pointType === 'hold_point',
      );
      const unreleasedItpHoldPoints = holdPointItems.filter((holdPointItem) => {
        const completion = itpInstance.completions.find(
          (candidate) => candidate.checklistItemId === holdPointItem.id,
        );
        return !completion || completion.verificationStatus !== 'verified';
      });

      if (unreleasedItpHoldPoints.length > 0) {
        items.push(
          item({
            code: 'unreleased_itp_hold_points',
            severity: 'blocker',
            area: 'hold_point',
            title: 'ITP hold points need release evidence',
            detail: `${unreleasedItpHoldPoints.length} ITP hold point${unreleasedItpHoldPoints.length === 1 ? '' : 's'} are not verified or released.`,
            blocksAction: false,
            actionLabel: 'Review hold points',
            count: unreleasedItpHoldPoints.length,
            relatedIds: unreleasedItpHoldPoints.map((holdPointItem) => holdPointItem.id),
          }),
        );
      }
    } else {
      items.push(
        item({
          code: 'no_itp',
          severity: 'warning',
          area: 'itp',
          title: 'No ITP assigned',
          detail:
            'Assign and complete an ITP when this activity requires formal inspection records.',
          blocksAction: false,
          actionLabel: 'Assign ITP',
        }),
      );
    }

    const unreleasedLotHoldPoints = lot.holdPoints.filter(
      (holdPoint) => holdPoint.status !== 'released',
    );
    const releasedLotHoldPoints = lot.holdPoints.length - unreleasedLotHoldPoints.length;

    if (unreleasedLotHoldPoints.length > 0) {
      items.push(
        item({
          code: 'unreleased_hold_points',
          severity: 'blocker',
          area: 'hold_point',
          title: 'Hold points need release evidence',
          detail: `${unreleasedLotHoldPoints.length} lot hold point${unreleasedLotHoldPoints.length === 1 ? '' : 's'} are not released.`,
          blocksAction: false,
          actionLabel: 'Review hold points',
          count: unreleasedLotHoldPoints.length,
          relatedIds: unreleasedLotHoldPoints.map((holdPoint) => holdPoint.id),
        }),
      );
    } else if (releasedLotHoldPoints > 0) {
      items.push(
        item({
          code: 'released_hold_points',
          severity: 'support',
          area: 'hold_point',
          title: 'Hold points released',
          detail: `${releasedLotHoldPoints} lot hold point${releasedLotHoldPoints === 1 ? '' : 's'} have release evidence.`,
          blocksAction: false,
          count: releasedLotHoldPoints,
        }),
      );
    }

    const failedTests = lot.testResults.filter((testResult) => testResult.passFail === 'fail');
    const pendingTests = lot.testResults.filter((testResult) =>
      ['pending', 'submitted'].includes(testResult.status),
    );
    const passingTests = lot.testResults.filter((testResult) => testResult.passFail === 'pass');

    if (lot.testResults.length === 0) {
      items.push(
        item({
          code: 'no_tests',
          severity: 'warning',
          area: 'test',
          title: 'No test results recorded',
          detail:
            'Attach test results when this activity type requires laboratory or field test evidence.',
          blocksAction: false,
          actionLabel: 'Review tests',
        }),
      );
    }

    if (failedTests.length > 0) {
      items.push(
        item({
          code: 'failed_tests',
          severity: 'blocker',
          area: 'test',
          title: 'Failed tests recorded',
          detail: `${failedTests.length} test result${failedTests.length === 1 ? '' : 's'} failed and should be resolved before sharing this evidence pack.`,
          blocksAction: false,
          actionLabel: 'Review tests',
          count: failedTests.length,
          relatedIds: failedTests.map((testResult) => testResult.id),
        }),
      );
    }

    if (pendingTests.length > 0) {
      items.push(
        item({
          code: 'pending_tests',
          severity: 'warning',
          area: 'test',
          title: 'Tests still pending',
          detail: `${pendingTests.length} test result${pendingTests.length === 1 ? '' : 's'} are not verified yet.`,
          blocksAction: false,
          actionLabel: 'Review tests',
          count: pendingTests.length,
          relatedIds: pendingTests.map((testResult) => testResult.id),
        }),
      );
    }

    if (passingTests.length > 0) {
      items.push(
        item({
          code: 'passing_tests',
          severity: 'support',
          area: 'test',
          title: 'Passing tests attached',
          detail: `${passingTests.length} passing test result${passingTests.length === 1 ? '' : 's'} support this claim line.`,
          blocksAction: false,
          count: passingTests.length,
          relatedIds: passingTests.map((testResult) => testResult.id),
        }),
      );
    }

    const ncrs = lot.ncrLots.map((ncrLot) => ncrLot.ncr);
    const openNcrs = ncrs.filter((ncr) => !['closed', 'closed_concession'].includes(ncr.status));
    const criticalOpenNcrs = openNcrs.filter((ncr) => ['major', 'critical'].includes(ncr.severity));
    const minorOpenNcrs = openNcrs.filter((ncr) => !['major', 'critical'].includes(ncr.severity));

    if (criticalOpenNcrs.length > 0) {
      items.push(
        item({
          code: 'open_major_ncrs',
          severity: 'blocker',
          area: 'ncr',
          title: 'Major NCRs still open',
          detail: `${criticalOpenNcrs.length} major or critical NCR${criticalOpenNcrs.length === 1 ? '' : 's'} remain open.`,
          blocksAction: false,
          actionLabel: 'Review NCRs',
          count: criticalOpenNcrs.length,
          relatedIds: criticalOpenNcrs.map((ncr) => ncr.id),
        }),
      );
    }

    if (minorOpenNcrs.length > 0) {
      items.push(
        item({
          code: 'open_minor_ncrs',
          severity: 'warning',
          area: 'ncr',
          title: 'Minor NCRs still open',
          detail: `${minorOpenNcrs.length} minor NCR${minorOpenNcrs.length === 1 ? '' : 's'} remain open.`,
          blocksAction: false,
          actionLabel: 'Review NCRs',
          count: minorOpenNcrs.length,
          relatedIds: minorOpenNcrs.map((ncr) => ncr.id),
        }),
      );
    }

    if (ncrs.length > 0 && openNcrs.length === 0) {
      items.push(
        item({
          code: 'ncrs_closed',
          severity: 'support',
          area: 'ncr',
          title: 'NCRs closed',
          detail: `${ncrs.length} NCR${ncrs.length === 1 ? '' : 's'} linked to this lot are closed.`,
          blocksAction: false,
          count: ncrs.length,
        }),
      );
    }

    const photos = lot.documents.filter((document) => document.documentType === 'photo');
    if (photos.length === 0) {
      items.push(
        item({
          code: 'no_photos',
          severity: 'warning',
          area: 'document',
          title: 'No photo evidence',
          detail: 'Add photos where they would help the client verify the claimed work.',
          blocksAction: false,
          actionLabel: 'Review documents',
        }),
      );
    } else if (photos.length < 3) {
      items.push(
        item({
          code: 'low_photo_evidence',
          severity: 'warning',
          area: 'document',
          title: 'Limited photo evidence',
          detail: `${photos.length} photo${photos.length === 1 ? '' : 's'} attached. Add more if the client needs visual proof.`,
          blocksAction: false,
          actionLabel: 'Review documents',
          count: photos.length,
        }),
      );
    } else {
      items.push(
        item({
          code: 'photo_evidence',
          severity: 'support',
          area: 'document',
          title: 'Photo evidence attached',
          detail: `${photos.length} photos support this claim line.`,
          blocksAction: false,
          count: photos.length,
        }),
      );
    }

    return {
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      activityType: lot.activityType || 'Unknown',
      claimAmount: claimedLot.amountClaimed ? Number(claimedLot.amountClaimed) : 0,
      claim: reviewBucket(items),
    };
  });

  const totalLots = lots.length;
  const blockedCount = lots.filter((lot) => lot.claim.state === 'blocked').length;
  const reviewCount = lots.filter((lot) => lot.claim.state === 'warning').length;
  const readyCount = lots.filter((lot) => lot.claim.state === 'ready').length;
  const totalClaimAmount = input.claim.totalClaimedAmount
    ? Number(input.claim.totalClaimedAmount)
    : 0;
  const recommendedAmount = lots
    .filter((lot) => lot.claim.state !== 'blocked')
    .reduce((sum, lot) => sum + lot.claimAmount, 0);

  const overallSuggestions: string[] = [];
  if (blockedCount > 0) {
    overallSuggestions.push(
      `Resolve evidence blockers on ${blockedCount} claim line${blockedCount === 1 ? '' : 's'} before sharing the claim pack.`,
    );
  }
  if (reviewCount > 0) {
    overallSuggestions.push(
      `Review warnings on ${reviewCount} claim line${reviewCount === 1 ? '' : 's'} so the client can follow the evidence trail.`,
    );
  }
  if (blockedCount === 0 && reviewCount === 0 && totalLots > 0) {
    overallSuggestions.push('Claim evidence is ready for client review.');
  }

  return {
    claimId: input.claim.id,
    claimNumber: input.claim.claimNumber,
    analyzedAt: input.analyzedAt ?? new Date().toISOString(),
    summary: {
      totalLots,
      readyCount,
      reviewCount,
      blockedCount,
      totalClaimAmount,
      recommendedAmount,
    },
    lots,
    overallSuggestions,
  };
}
