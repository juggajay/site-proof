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
    claimedPercentage?: number;
    remainingPercentage?: number;
  };
  summary: {
    blockerCount: number;
    warningCount: number;
    supportCount: number;
    actionBlockerCount: number;
  };
}

export interface ClaimReadinessLot {
  lotId: string;
  lotNumber: string;
  activityType: string | null;
  claim: ReadinessBucket & {
    budgetAmount?: number | null;
    claimedInId?: string | null;
    claimedPercentage?: number;
    remainingPercentage?: number;
  };
}

export interface ProjectClaimReadiness {
  lots: ClaimReadinessLot[];
}

export interface ClaimEvidenceReviewLot {
  lotId: string;
  lotNumber: string;
  activityType: string;
  claimAmount: number;
  claim: ReadinessBucket;
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
  overallSuggestions: string[];
  lots: ClaimEvidenceReviewLot[];
}
