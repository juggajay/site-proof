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

export function item(input: EvidenceReadinessItem): EvidenceReadinessItem {
  return input;
}

export function splitItems(items: EvidenceReadinessItem[]): Omit<ReadinessBucket, 'state'> {
  return {
    blockers: items.filter((readinessItem) => readinessItem.severity === 'blocker'),
    warnings: items.filter((readinessItem) => readinessItem.severity === 'warning'),
    support: items.filter((readinessItem) => readinessItem.severity === 'support'),
  };
}

export function bucketState(
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

export function summarize(
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

export function reviewBucket(items: EvidenceReadinessItem[]): ReadinessBucket {
  const split = splitItems(items);
  const state: ReadinessBucket['state'] =
    split.blockers.length > 0 ? 'blocked' : split.warnings.length > 0 ? 'warning' : 'ready';

  return { state, ...split };
}
