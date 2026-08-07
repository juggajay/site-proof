/**
 * Type definitions for HoldPoints-related pages and components.
 * Extracted from HoldPointsPage.tsx for reusability.
 */

export interface LatestHoldPointDecisionRound {
  outcome: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  ncrId: string | null;
  ncrNumber: string | null;
  ncrStatus: string | null;
  openConditionCount: number;
  conditions?: HoldPointReleaseCondition[];
}

export interface HoldPointReleaseCondition {
  id: string;
  sequence: number;
  text: string;
  recordedSatisfiedAt: string | null;
  recordedSatisfiedByName: string | null;
  satisfactionNote: string | null;
  satisfactionEvidenceDocumentId: string | null;
}

export interface HoldPoint {
  id: string;
  lotId: string;
  lotNumber: string;
  itpChecklistItemId: string;
  description: string;
  pointType: string;
  status: string;
  notificationSentAt: string | null;
  scheduledDate: string | null;
  releasedAt: string | null;
  releasedByName: string | null;
  releasedByOrg?: string | null;
  releaseMethod?: string | null;
  releaseRecipientEmail?: string | null;
  releaseNotes: string | null;
  latestRound?: LatestHoldPointDecisionRound | null;
  sequenceNumber: number;
  isCompleted: boolean;
  isVerified: boolean;
  canRequestRelease?: boolean;
  incompletePrerequisiteCount?: number;
  createdAt: string;
}

export interface PrerequisiteItem {
  id: string;
  description: string;
  sequenceNumber: number;
  isHoldPoint: boolean;
  isCompleted: boolean;
  isVerified: boolean;
  completedAt: string | null;
}

export interface HoldPointDetails {
  holdPoint: HoldPoint;
  prerequisites: PrerequisiteItem[];
  incompletePrerequisites: PrerequisiteItem[];
  canRequestRelease: boolean;
  defaultRecipients?: string[]; // Feature #697 - HP default recipients
  approvalRequirement?: 'any' | 'superintendent'; // Feature #698 - HP approval requirements
}

export interface RequestError {
  message: string;
  incompleteItems?: PrerequisiteItem[];
  code?: string;
  details?: {
    scheduledDate?: string;
    workingDaysNotice?: number;
    minimumNoticeDays?: number;
    requiresOverride?: boolean;
  };
}

/**
 * Register filter views. Pending/notified/released mirror backend status;
 * refused and conditions-open derive from latestRound, while notice-expired
 * derives from an awaiting-release request whose notice window has elapsed.
 */
export type StatusFilter =
  | 'all'
  | 'pending'
  | 'notified'
  | 'released'
  | 'refused'
  | 'conditions-open'
  | 'notice-expired';

/**
 * Sortable register columns. 'lot' is the server order (lot number, then
 * sequence); 'waiting' is the derived ageing column (see getWaitingDays).
 */
export type HoldPointSortField =
  | 'lot'
  | 'status'
  | 'waiting'
  | 'notified'
  | 'scheduled'
  | 'released';

export type HoldPointSortDirection = 'asc' | 'desc';

export interface HoldPointStats {
  total: number;
  pending: number;
  notified: number;
  refused: number;
  conditionsOpen: number;
  releasedThisWeek: number;
  overdue: number;
}

export interface HoldPointLotOption {
  lotId: string;
  lotNumber: string;
  holdPointCount: number;
}
