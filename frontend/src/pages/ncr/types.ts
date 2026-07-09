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
  // Batch C: spec reference + concession disposition fields (backend returns them
  // on the NCR detail record). Rendered in the NCR PDF; optional for list rows.
  specificationReference?: string | null;
  concessionJustification?: string | null;
  concessionRiskAssessment?: string | null;
  clientApprovalReference?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: { fullName: string | null; email: string } | null;
  linkedTestResult?: {
    testType: string;
    testRequestNumber: string | null;
    laboratoryReportNumber?: string | null;
  } | null;
  qmApprovalRequired: boolean;
  qmApprovedAt: string | null;
  qmApprovedBy?: { id?: string; fullName: string; email: string } | null;
  raisedBy: { fullName: string; email: string };
  responsibleUser?: { id?: string; fullName: string; email: string } | null;
  responsibleSubcontractor?: { id: string; companyName: string } | null;
  responsibleUserId?: string | null;
  responsibleSubcontractorId?: string | null;
  dueDate?: string;
  createdAt: string;
  // Responsible-party response, submitted via POST /respond. Surfaced read-only
  // in the QM review step so the reviewer can assess what they are approving.
  rootCauseCategory?: string | null;
  rootCauseDescription?: string | null;
  proposedCorrectiveAction?: string | null;
  responseSubmittedAt?: string | null;
  project: { id?: string; name: string; projectNumber: string };
  ncrLots: Array<{ lot: { lotNumber: string; description: string } }>;
  clientNotificationRequired?: boolean;
  clientNotifiedAt?: string | null;
  lessonsLearned?: string | null;
  closedAt?: string | null;
  closedBy?: { fullName: string; email: string } | null;
  verificationNotes?: string | null;
  ncrEvidence?: Array<{
    id: string;
    evidenceType: string;
    uploadedAt?: string | null;
    document: {
      id: string;
      filename: string;
      fileUrl?: string | null;
      mimeType?: string | null;
      uploadedAt?: string | null;
    } | null;
  }>;
}

export interface UserRole {
  role: string;
  isQualityManager: boolean;
  canApproveNCRs: boolean;
}
