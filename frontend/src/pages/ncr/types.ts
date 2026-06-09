/**
 * Type definitions for NCR-related pages and components.
 * Extracted from NCRPage.tsx for reusability.
 */

export interface NCR {
  id: string;
  ncrNumber: string;
  description: string;
  category: string;
  severity: 'minor' | 'major';
  status: string;
  qmApprovalRequired: boolean;
  qmApprovedAt: string | null;
  qmApprovedBy?: { fullName: string; email: string } | null;
  raisedBy: { fullName: string; email: string };
  responsibleUser?: { id?: string; fullName: string; email: string } | null;
  responsibleSubcontractor?: { id: string; companyName: string } | null;
  responsibleUserId?: string | null;
  responsibleSubcontractorId?: string | null;
  dueDate?: string;
  createdAt: string;
  project: { id?: string; name: string; projectNumber: string };
  ncrLots: Array<{ lot: { lotNumber: string; description: string } }>;
  clientNotificationRequired?: boolean;
  clientNotifiedAt?: string | null;
  lessonsLearned?: string | null;
  closedAt?: string | null;
  verificationNotes?: string | null;
}

export interface UserRole {
  role: string;
  isQualityManager: boolean;
  canApproveNCRs: boolean;
}
