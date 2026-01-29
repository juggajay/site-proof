/**
 * Type definitions for Lot-related pages and components.
 * Extracted from LotDetailPage.tsx for reusability.
 */

// Tab types for lot detail page
export type LotTab = 'itp' | 'tests' | 'ncrs' | 'photos' | 'documents' | 'comments' | 'history'

export interface TabConfig {
  id: LotTab
  label: string
}

export interface QualityAccess {
  role: string
  isQualityManager: boolean
  canConformLots: boolean
  canVerifyTestResults: boolean
  canCloseNCRs: boolean
  canManageITPTemplates: boolean
}

export interface Lot {
  id: string
  lotNumber: string
  description: string | null
  status: string
  activityType: string | null
  chainageStart: number | null
  chainageEnd: number | null
  offset: string | null
  layer: string | null
  areaZone: string | null
  createdAt: string
  updatedAt: string
  conformedAt: string | null
  conformedBy: {
    id: string
    fullName: string | null
    email: string
  } | null
  assignedSubcontractorId: string | null
  assignedSubcontractor?: {
    id: string
    companyName: string
  } | null
}

export interface SubcontractorCompany {
  id: string
  companyName: string
  status: string
}

export interface TestResult {
  id: string
  testType: string
  testRequestNumber: string | null
  laboratoryName: string | null
  resultValue: number | null
  resultUnit: string | null
  passFail: string
  status: string
  createdAt: string
}

export interface NCR {
  id: string
  ncrNumber: string
  description: string
  category: string
  severity: 'minor' | 'major'
  status: string
  raisedBy: { fullName: string; email: string }
  createdAt: string
}

export interface ITPChecklistItem {
  id: string
  description: string
  category: string
  responsibleParty: 'contractor' | 'subcontractor' | 'superintendent' | 'general'
  isHoldPoint: boolean
  pointType: 'standard' | 'witness' | 'hold_point'
  evidenceRequired: 'none' | 'photo' | 'test' | 'document'
  order: number
  testType?: string | null
  acceptanceCriteria?: string | null
}

export interface ITPAttachmentDocument {
  id: string
  filename: string
  fileUrl: string
  caption: string | null
  uploadedAt: string
  uploadedBy: { id: string; fullName: string; email: string } | null
  gpsLatitude: number | null
  gpsLongitude: number | null
}

export interface ITPAttachment {
  id: string
  documentId: string
  document: ITPAttachmentDocument
}

export interface ITPCompletion {
  id: string
  checklistItemId: string
  isCompleted: boolean
  isNotApplicable?: boolean
  isFailed?: boolean
  notes: string | null
  completedAt: string | null
  completedBy: { id: string; fullName: string; email: string } | null
  isVerified: boolean
  verifiedAt: string | null
  verifiedBy: { id: string; fullName: string; email: string } | null
  attachments: ITPAttachment[]
  linkedNcr?: { id: string; ncrNumber: string } | null
  // Witness point details
  witnessPresent?: boolean | null
  witnessName?: string | null
  witnessCompany?: string | null
}

export interface ITPInstance {
  id: string
  template: {
    id: string
    name: string
    checklistItems: ITPChecklistItem[]
  }
  completions: ITPCompletion[]
}

export interface PhotoDocument {
  id: string
  filename: string
  fileUrl: string
  caption: string | null
  uploadedAt: string
  uploadedBy: { fullName: string | null } | null
  gpsLatitude: number | null
  gpsLongitude: number | null
}

export interface LotDocument {
  id: string
  filename: string
  fileUrl: string
  caption: string | null
  uploadedAt: string
}

export interface LotHistory {
  id: string
  action: string
  description: string
  performedBy: { fullName: string; email: string } | null
  createdAt: string
}

export interface LocationState {
  returnFilters?: string
}

export interface ITPTemplate {
  id: string
  name: string
  activityType: string
  checklistItems: ITPChecklistItem[]
}

export interface ConformStatus {
  canConform: boolean
  blockingReasons: string[]
  prerequisites: {
    itpAssigned: boolean
    itpCompleted: boolean
    itpCompletedCount: number
    itpTotalCount: number
    hasPassingTest: boolean
    noOpenNcrs: boolean
    openNcrs: { id: string; ncrNumber: string; status: string }[]
  }
}

export interface ActivityLog {
  id: string
  action: string
  entityType: string
  entityId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  changes: any
  createdAt: string
  user: {
    id: string
    email: string
    fullName: string | null
  } | null
}

export interface LotSubcontractorAssignment {
  id: string
  subcontractorCompanyId: string
  canCompleteITP: boolean
  itpRequiresVerification: boolean
  subcontractorCompany: {
    id: string
    companyName: string
  }
  assignedBy?: {
    id: string
    fullName: string
  }
}
