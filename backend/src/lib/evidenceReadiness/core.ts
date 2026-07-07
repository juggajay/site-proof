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
  // Named outstanding tests behind this item (the test blocker), so the UI can
  // offer a per-requirement "Add result" action that pre-links the ITP item and
  // show each test's state (the prose only states counts).
  outstandingTests?: {
    itemId: string;
    description: string;
    testType: string | null;
    state: 'no_result' | 'awaiting_verification' | 'failing' | 'unmatched_result_exists';
  }[];
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

export interface ManagementPrepCounts {
  releaseGatedHoldPoints: number;
  missingRequestEvidence: number;
  missingRecipients: number;
  fieldActionableItems: number;
  managementOnlyItems: number;
}

export interface ManagementPrepInput extends ManagementPrepCounts {
  holdPointsHref?: string;
  batchRequestHref?: string;
  releaseGatedHoldPointIds?: string[];
  missingRequestEvidenceIds?: string[];
  missingRecipientIds?: string[];
  fieldActionableItemIds?: string[];
  managementOnlyItemIds?: string[];
}

export type ManagementPrepBucket = ReadinessBucket & {
  counts: ManagementPrepCounts;
};

export interface LotConformStatusReadiness {
  canConform: boolean;
  blockingReasons: string[];
  prerequisites: ConformancePrerequisiteSnapshot;
}

export interface LotEvidenceReadiness {
  lotId: string;
  lotNumber: string;
  status: string;
  conformStatus: LotConformStatusReadiness;
  conformance: ReadinessBucket;
  claim: ReadinessBucket & {
    budgetAmount?: number | null;
    claimedInId?: string | null;
    // Cumulative percentage already claimed (0-100) and the percentage still
    // available to claim. Lets the UI show "previously claimed X%".
    claimedPercentage?: number;
    remainingPercentage?: number;
  };
  managementPrep?: ManagementPrepBucket;
  summary: {
    blockerCount: number;
    warningCount: number;
    supportCount: number;
    actionBlockerCount: number;
  };
}

export interface ConformancePrerequisiteSnapshot {
  itpAssigned: boolean;
  itpCompleted: boolean;
  itpCompletedCount: number;
  itpTotalCount: number;
  itpIncompleteItems: { id: string; description: string; pointType: string }[];
  // True only when the lot's ITP actually has a test point. The readiness layer
  // must gate the "no passing verified test" blocker on this so a no-test-point
  // lot is not shown a contradictory test blocker that the conform gate allows.
  testRequired: boolean;
  hasPassingTest: boolean;
  // Per-item breakdown of unsatisfied test-required items, so the readiness
  // blocker can name the outstanding tests. Optional for back-compat with
  // callers/tests that predate the field.
  outstandingTestItems?: {
    itemId: string;
    description: string;
    testType: string | null;
    state: 'no_result' | 'awaiting_verification' | 'failing' | 'unmatched_result_exists';
  }[];
  testResults: {
    id: string;
    itpChecklistItemId?: string | null;
    testType: string;
    passFail: string;
    status: string;
  }[];
  noOpenNcrs: boolean;
  openNcrs: { id: string; ncrNumber: string; description: string; status: string }[];
  // N/A hold-point bypass guard — optional for backward compatibility with
  // callers that predate the field (e.g. existing tests / routes that haven't
  // been regenerated yet). Defaults to no bypass blockers when absent.
  naHoldPointBlockerCount?: number;
  noNaHoldPointBypass?: boolean;
}

export interface LotReadinessInput {
  lot: {
    id: string;
    lotNumber: string;
    status: string;
    budgetAmount: number | null;
    claimedInId: string | null;
    // Cumulative percentage already claimed across all prior claims (0-100).
    // Defaults to 0 when omitted, preserving legacy single-claim behaviour.
    claimedPercentage?: number;
    // ISO timestamp of a persisted force-conformance override, or null. When
    // set, the claim gate suppresses ITP-incomplete + test-outstanding reasons
    // (an owner/admin accepted them at conform time) while still enforcing
    // post-conformance regressions (open NCRs, N/A hold points).
    conformanceOverriddenAt?: string | null;
  };
  canViewCommercial: boolean;
  conformStatus: LotConformStatusReadiness;
  evidenceCounts: {
    unreleasedHoldPoints: number;
    releasedHoldPoints: number;
    approvedDockets: number;
    diaryEntries: number;
    documents: number;
    photos: number;
    pendingTests: number;
  };
  managementPrep?: ManagementPrepInput;
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
  ...buckets: Array<Omit<ReadinessBucket, 'state'>>
): LotEvidenceReadiness['summary'] {
  const allItems = buckets.flatMap((bucket) => [
    ...bucket.blockers,
    ...bucket.warnings,
    ...bucket.support,
  ]);

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
