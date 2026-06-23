/**
 * Data + pure helpers for the project-level "ITP items awaiting verification"
 * queue (finding H4). The backend endpoint
 * `GET /api/itp/pending-verifications?projectId=` is role-gated
 * (ITP_VERIFY_ROLES) and returns every subcontractor completion in the project
 * that is awaiting head-contractor verification.
 */
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface PendingItpVerification {
  id: string;
  status: string;
  verificationStatus: string;
  completedAt: string | null;
  notes: string | null;
  completedBy: { id: string; fullName: string | null; email: string } | null;
  checklistItem: { id: string; description: string; responsibleParty: string | null };
  lot: { id: string; lotNumber: string; description: string | null };
  template: { id: string; name: string } | null;
  subcontractor: { id: string; companyName: string } | null;
}

export interface PendingItpVerificationsResponse {
  pendingVerifications: PendingItpVerification[];
  count: number;
}

/** Flattened, display-ready row for the queue. Dates stay raw for the view to format. */
export interface PendingItpVerificationRow {
  id: string;
  lotId: string;
  lotNumber: string;
  itemDescription: string;
  completedById: string | null;
  completedByName: string;
  subcontractorName: string | null;
  templateName: string | null;
  completedAt: string | null;
}

export function mapPendingItpVerification(raw: PendingItpVerification): PendingItpVerificationRow {
  return {
    id: raw.id,
    lotId: raw.lot.id,
    lotNumber: raw.lot.lotNumber,
    itemDescription: raw.checklistItem.description,
    completedById: raw.completedBy?.id ?? null,
    completedByName: raw.completedBy?.fullName || raw.completedBy?.email || 'Unknown',
    subcontractorName: raw.subcontractor?.companyName ?? null,
    templateName: raw.template?.name ?? null,
    completedAt: raw.completedAt,
  };
}

/**
 * Per-row gate: the backend already restricts the queue to verification roles,
 * so the only client-side gate left is assertDifferentVerifier — the person who
 * completed an item may not verify/reject it themselves.
 */
export function canReviewPendingVerification(
  currentUserId: string | null | undefined,
  completedById: string | null | undefined,
): boolean {
  if (currentUserId && completedById && currentUserId === completedById) {
    return false;
  }
  return true;
}

export function fetchPendingItpVerifications(projectId: string) {
  return apiFetch<PendingItpVerificationsResponse>(
    `/api/itp/pending-verifications?projectId=${encodeURIComponent(projectId)}`,
  );
}

export function verifyItpCompletionRequest(completionId: string) {
  return apiFetch(`/api/itp/completions/${encodeURIComponent(completionId)}/verify`, {
    method: 'POST',
  });
}

export function rejectItpCompletionRequest(completionId: string, reason: string) {
  return apiFetch(`/api/itp/completions/${encodeURIComponent(completionId)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function usePendingItpVerificationsQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: ['itp', 'pending-verifications', projectId],
    queryFn: () => fetchPendingItpVerifications(projectId as string),
    enabled: !!projectId,
    // A field/subcontractor role 403s here; don't hammer the endpoint retrying.
    retry: false,
  });
}
