/**
 * Type definitions for HoldPoints-related pages and components.
 * Extracted from HoldPointsPage.tsx for reusability.
 */

export interface HoldPoint {
  id: string
  lotId: string
  lotNumber: string
  itpChecklistItemId: string
  description: string
  pointType: string
  status: string
  notificationSentAt: string | null
  scheduledDate: string | null
  releasedAt: string | null
  releasedByName: string | null
  releaseNotes: string | null
  sequenceNumber: number
  isCompleted: boolean
  isVerified: boolean
  createdAt: string
}

export interface PrerequisiteItem {
  id: string
  description: string
  sequenceNumber: number
  isHoldPoint: boolean
  isCompleted: boolean
  isVerified: boolean
  completedAt: string | null
}

export interface HoldPointDetails {
  holdPoint: HoldPoint
  prerequisites: PrerequisiteItem[]
  incompletePrerequisites: PrerequisiteItem[]
  canRequestRelease: boolean
  defaultRecipients?: string[] // Feature #697 - HP default recipients
  approvalRequirement?: 'any' | 'superintendent' // Feature #698 - HP approval requirements
}

export interface RequestError {
  message: string
  incompleteItems?: PrerequisiteItem[]
  code?: string
  details?: {
    scheduledDate?: string
    workingDaysNotice?: number
    minimumNoticeDays?: number
    requiresOverride?: boolean
  }
}

export type StatusFilter = 'all' | 'pending' | 'notified' | 'released'

export interface HoldPointStats {
  total: number
  pending: number
  notified: number
  releasedThisWeek: number
  overdue: number
}
