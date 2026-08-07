// Type-only: no runtime edge from the readiness shapes to the sufficiency engine.
import type { SufficiencyEvaluation } from '../readiness/sufficiency/evaluate.js';
// Type-only: the canonical reasonCode vocabulary. Wave D `D1a-respec` §4.1.1.
import type { ReadinessReasonCode } from '../readiness/contracts/reasonCodes.js';

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
  // Wave C5.2. Deliveries deliberately reuse `diary` rather than minting a
  // second area — they are diary rows. A survey is not.
  | 'survey'
  | 'document'
  | 'budget'
  | 'permission';

export interface EvidenceReadinessItem {
  /**
   * Wave D `D1a-respec` (spec §4.1.1 step 2, `[DR2-B2]`). NARROWED from
   * `string`. While this was `string` any builder could emit anything and no
   * registry could be authoritative — the emitter-side half of the parity
   * contract simply did not exist. An unregistered code is now a COMPILE ERROR
   * at the emitter, which is where it should fail; adding a code to the engine
   * means adding it (and its provenance) to `READINESS_REASON_CODES` in the
   * same change, exactly as that file's header already required.
   */
  code: ReadinessReasonCode;
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
  // Current conditional-release rounds with conditions not yet recorded
  // satisfied. Optional for compatibility with pre-PR-D callers and fixtures.
  noOpenHoldPointConditions?: boolean;
  openHoldPointConditions?: {
    holdPointId: string;
    holdPointName: string;
    openConditionCount: number;
  }[];
  // N/A hold-point bypass guard — optional for backward compatibility with
  // callers that predate the field (e.g. existing tests / routes that haven't
  // been regenerated yet). Defaults to no bypass blockers when absent.
  naHoldPointBlockerCount?: number;
  noNaHoldPointBypass?: boolean;
  // Wave C1 (spec §5.1.1). Optional for the same back-compat reason as the two
  // fields above; absent reads as false, so no existing caller changes outcome.
  sufficiencyBlocks?: boolean;
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
  /**
   * Wave C1 (spec §5.1.4). The advisory half of the sufficiency verdict, as
   * produced by `checkConformancePrerequisites`. Absent/null on every project
   * that resolves no authority ruleset — which today is every project without a
   * shipped pack — and then no sufficiency item is emitted at all (§7.1: a
   * resolved-nothing state produces nothing, not a warning on every panel).
   */
  sufficiency?: SufficiencyEvaluation | null;
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
  /**
   * Wave G G1 (spec §1.3(d)). The lot's ACTIVE governing-revision links whose
   * target record has since been superseded, as loaded by
   * `lib/revisionGovernance.ts`. The engine stays pure and Prisma-free: the
   * caller fetches, the engine decides.
   *
   * Absent (or empty) on every caller not taught to fetch it, and on every
   * caller at all while `REVISION_GOVERNANCE_ENABLED` is off — and then no item
   * is emitted, exactly as the flag-off contract requires.
   */
  supersededGoverningRevisions?: {
    entityType: string;
    entityId: string;
    revisionLabel: string;
  }[];
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

/**
 * Wave D `D1a-respec` (spec §4.1.1 step 3, `[DR2-B2]`). The one typed
 * constructor for a HARD blocker — `severity: 'blocker'` ∧ `blocksAction: true`,
 * neither of them a caller's choice. Blocking emitters go through it so the set
 * of hard blockers is a property of one call site rather than a grep, and
 * AT-138 can enumerate the codes by running the emitters.
 *
 * `severity: 'blocker'` with `blocksAction: false` is a DIFFERENT, live thing —
 * the advisory review surfaces (claimReview, the claim card's hold-point item)
 * emit it deliberately. Those keep using `item()`; folding them in here would
 * make every advisory item start gating an action.
 */
export function blockingItem(
  input: Omit<EvidenceReadinessItem, 'severity' | 'blocksAction'>,
): EvidenceReadinessItem {
  // Key order is load-bearing: the readiness characterization snapshots are
  // `JSON.stringify` of the response, so a spread that appended `severity` and
  // `blocksAction` at the end would diff every blocker in the corpus. This
  // reproduces the literal order the six call sites used before the extraction,
  // which is how the refactor stays byte-identical.
  const { code, area, title, detail, ...rest } = input;
  return { code, severity: 'blocker', area, title, detail, blocksAction: true, ...rest };
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
