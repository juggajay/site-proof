export interface SubcontractorHoldPoint {
  id: string;
  lotId: string;
  lotNumber: string;
  description: string;
  status: 'pending' | 'notified' | 'released' | 'rejected';
  requestedAt?: string;
  releasedAt?: string;
  releasedByName: string | null;
  releasedByOrg?: string | null;
  releaseMethod?: string | null;
  releaseRecipientEmail?: string | null;
  checklistItemDescription?: string;
}

export interface ApiSubcontractorHoldPoint {
  id: string;
  lotId: string;
  lotNumber: string;
  description: string;
  status: SubcontractorHoldPoint['status'];
  notificationSentAt?: string | null;
  scheduledDate?: string | null;
  releasedAt?: string | null;
  releasedByName?: string | null;
  releasedByOrg?: string | null;
  releaseMethod?: string | null;
  releaseRecipientEmail?: string | null;
  createdAt?: string | null;
}

export function normalizeSubcontractorHoldPoint(
  holdPoint: ApiSubcontractorHoldPoint,
): SubcontractorHoldPoint {
  return {
    id: holdPoint.id,
    lotId: holdPoint.lotId,
    lotNumber: holdPoint.lotNumber,
    description: holdPoint.description,
    checklistItemDescription: holdPoint.description,
    status: holdPoint.status,
    requestedAt:
      holdPoint.notificationSentAt || holdPoint.scheduledDate || holdPoint.createdAt || undefined,
    releasedAt: holdPoint.releasedAt || undefined,
    releasedByName: holdPoint.releasedByName || null,
    releasedByOrg: holdPoint.releasedByOrg || null,
    releaseMethod: holdPoint.releaseMethod || null,
    releaseRecipientEmail: holdPoint.releaseRecipientEmail || null,
  };
}
