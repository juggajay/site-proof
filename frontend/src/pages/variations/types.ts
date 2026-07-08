export const VARIATION_STATUSES = [
  'proposed',
  'submitted',
  'approved',
  'rejected',
  'claimed',
] as const;

export type VariationStatus = (typeof VARIATION_STATUSES)[number];
export type VariationStatusFilter = VariationStatus | 'all';

export interface VariationEvidence {
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
}

export interface Variation {
  id: string;
  projectId: string;
  variationNumber: string;
  title: string;
  description: string | null;
  status: VariationStatus;
  approvedAmount: number | null;
  clientReference: string | null;
  lotId: string | null;
  claimedInId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  evidence: VariationEvidence[];
}

export interface VariationLot {
  id: string;
  lotNumber: string;
  description?: string | null;
}

export interface VariationFormData {
  title: string;
  description?: string | null;
  clientReference?: string | null;
  lotId?: string | null;
  approvedAmount?: number | null;
}

export interface VariationEvidencePayload {
  documentId: string;
  evidenceType: string;
}
