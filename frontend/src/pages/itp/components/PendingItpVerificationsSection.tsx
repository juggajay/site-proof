/**
 * H4: project-level "ITP items awaiting verification" queue. Lists every
 * subcontractor completion in the project that needs head-contractor
 * verification and lets a reviewer Verify or Reject (with a reason) in place.
 *
 * The backend endpoint is role-gated (ITP_VERIFY_ROLES) and 403s for everyone
 * else, so a query error simply collapses the section — there is no separate
 * client-side role gate here. The only per-row gate is assertDifferentVerifier:
 * a reviewer cannot action an item they completed themselves.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from '@/components/ui/toaster';
import { handleApiError } from '@/lib/errorHandling';
import {
  canReviewPendingVerification,
  mapPendingItpVerification,
  rejectItpCompletionRequest,
  usePendingItpVerificationsQuery,
  verifyItpCompletionRequest,
} from '../pendingItpVerifications';

interface PendingItpVerificationsSectionProps {
  projectId: string;
  currentUserId: string | undefined;
}

export function PendingItpVerificationsSection({
  projectId,
  currentUserId,
}: PendingItpVerificationsSectionProps) {
  const query = usePendingItpVerificationsQuery(projectId);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{
    completionId: string;
    itemDescription: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  // Non-reviewers 403 here; collapse the section rather than surface an error.
  if (query.isError || query.isLoading || !query.data) {
    return null;
  }

  const rows = query.data.pendingVerifications.map(mapPendingItpVerification);

  const handleVerify = async (completionId: string) => {
    setReviewingId(completionId);
    try {
      await verifyItpCompletionRequest(completionId);
      toast({ title: 'Item verified', description: 'The ITP item has been verified.' });
      await query.refetch();
    } catch (err) {
      handleApiError(err, 'Failed to verify item');
    } finally {
      setReviewingId(null);
    }
  };

  const handleSubmitReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for rejecting this item.',
        variant: 'error',
      });
      return;
    }
    setReviewingId(rejectModal.completionId);
    setSubmittingReject(true);
    try {
      await rejectItpCompletionRequest(rejectModal.completionId, rejectReason.trim());
      toast({
        title: 'Item rejected',
        description: 'The subcontractor has been notified to correct and resubmit it.',
      });
      setRejectModal(null);
      setRejectReason('');
      await query.refetch();
    } catch (err) {
      handleApiError(err, 'Failed to reject item');
    } finally {
      setReviewingId(null);
      setSubmittingReject(false);
    }
  };

  return (
    <section className="rounded-lg border p-4" aria-label="ITP items awaiting verification">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-semibold">ITP items awaiting verification</h2>
        {rows.length > 0 && (
          <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">
            {rows.length}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ITP items are awaiting verification.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => {
            const canReview = canReviewPendingVerification(currentUserId, row.completedById);
            const isBusy = reviewingId === row.id;
            return (
              <li key={row.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/projects/${encodeURIComponent(projectId)}/lots/${encodeURIComponent(row.lotId)}?tab=itp`}
                      className="font-medium text-primary hover:underline"
                    >
                      Lot {row.lotNumber}
                    </Link>
                    <span className="text-sm">{row.itemDescription}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Completed by {row.completedByName}
                    {row.subcontractorName && ` · ${row.subcontractorName}`}
                    {row.completedAt &&
                      ` · ${new Date(row.completedAt).toLocaleDateString('en-AU')}`}
                  </p>
                </div>
                {canReview ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleVerify(row.id)}
                      disabled={isBusy}
                      className="inline-flex items-center rounded border border-primary/40 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                    >
                      Verify
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectReason('');
                        setRejectModal({
                          completionId: row.id,
                          itemDescription: row.itemDescription,
                        });
                      }}
                      disabled={isBusy}
                      className="inline-flex items-center rounded border border-destructive/40 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground shrink-0">
                    You completed this — another reviewer must verify it.
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {rejectModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Reject ITP item"
        >
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-1">Reject ITP item</h2>
            <p className="text-sm text-muted-foreground mb-3">{rejectModal.itemDescription}</p>
            <label htmlFor="pending-itp-reject-reason" className="block text-sm font-medium mb-1">
              Reason for rejection <span className="text-destructive">*</span>
            </label>
            <textarea
              id="pending-itp-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={3000}
              rows={4}
              className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
              placeholder="Explain what needs to be corrected before this item can be verified..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason('');
                }}
                disabled={submittingReject}
                className="px-4 py-2 border rounded-lg hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReject}
                disabled={submittingReject || !rejectReason.trim()}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {submittingReject ? 'Rejecting...' : 'Reject item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
