/**
 * Type definitions for HoldPoints-related pages and components.
 * Extracted from HoldPointsPage.tsx for reusability.
 */

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
 * Register filter views. The first four mirror backend hold-point statuses;
 * 'notice-expired' is a derived view — awaiting release ('notified') with the
 * minimum notice window already elapsed (see isNoticeExpired).
 */
export type StatusFilter = 'all' | 'pending' | 'notified' | 'released' | 'notice-expired';

/** Sortable register columns. 'lot' is the server order (lot number, then sequence). */
export type HoldPointSortField = 'lot' | 'status' | 'notified' | 'scheduled' | 'released';

export type HoldPointSortDirection = 'asc' | 'desc';

export interface HoldPointStats {
  total: number;
  pending: number;
  notified: number;
  releasedThisWeek: number;
  overdue: number;
}

export interface HoldPointLotOption {
  lotId: string;
  lotNumber: string;
  holdPointCount: number;
}
