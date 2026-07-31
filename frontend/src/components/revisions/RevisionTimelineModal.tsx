// Wave G G1 — the revision timeline for one governed record
// (docs/plans/wave-g-execution-spec-2026-07-31.md §1.6).
//
// Self-gating: `/api/revisions` 404s while REVISION_GOVERNANCE_ENABLED is unset,
// and the modal then says so rather than showing an empty timeline that reads as
// "this record was never issued".
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, apiGet, apiPost } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Button } from '@/components/ui/button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';

export interface RevisionAcknowledgement {
  id: string;
  userId: string | null;
  recipientEmail: string | null;
  notifiedAt: string | null;
  openedAt: string | null;
  acknowledgedAt: string | null;
}

export interface RevisionIssue {
  id: string;
  entityType: string;
  entityId: string;
  revisionLabel: string;
  supersedesId: string | null;
  reason: string | null;
  issuedAt: string;
  issuedBy: { id: string; fullName: string | null; email: string } | null;
  recipients: RevisionAcknowledgement[];
}

interface RevisionTimelineModalProps {
  projectId: string;
  entityType: string;
  entityId: string;
  /** What the record is called, for the heading. */
  recordLabel: string;
  /** The signed-in user, so their own outstanding acknowledgement can be offered. */
  currentUserId: string | null;
  onClose: () => void;
}

function formatInstant(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * "we sent it" / "they opened it" / "they said yes" are three different
 * contractual facts and the model keeps them distinct, so the UI must too.
 */
function recipientState(recipient: RevisionAcknowledgement): string {
  if (recipient.acknowledgedAt) return `Acknowledged ${formatInstant(recipient.acknowledgedAt)}`;
  if (recipient.openedAt) return `Opened ${formatInstant(recipient.openedAt)}`;
  if (recipient.notifiedAt) return `Notified ${formatInstant(recipient.notifiedAt)}`;
  return 'Recorded as a recipient';
}

export function RevisionTimelineModal({
  projectId,
  entityType,
  entityId,
  recordLabel,
  currentUserId,
  onClose,
}: RevisionTimelineModalProps) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.revisionIssues(projectId, entityType, entityId);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () =>
      apiGet<{ issues: RevisionIssue[] }>(
        `/api/revisions?projectId=${encodeURIComponent(projectId)}` +
          `&entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
      ),
    retry: false,
  });

  const acknowledge = useMutation({
    mutationFn: (issueId: string) => apiPost(`/api/revisions/${issueId}/acknowledge`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const governanceDisabled = error instanceof ApiError && error.status === 404;
  const issues = data?.issues ?? [];

  return (
    <Modal onClose={onClose} className="max-w-2xl">
      <ModalHeader>Revision history — {recordLabel}</ModalHeader>
      <ModalBody>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {governanceDisabled && (
          <p className="text-sm text-muted-foreground">
            Revision governance is not enabled in this environment.
          </p>
        )}

        {Boolean(error) && !governanceDisabled && (
          <p className="text-destructive text-sm">Could not load the revision history.</p>
        )}

        {!isLoading && !error && issues.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No issue record for this drawing. Issue records start from the point revision governance
            was adopted — an absent record does not mean the revision was never issued.
          </p>
        )}

        <ol className="space-y-4">
          {issues.map((issue) => {
            const mine = issue.recipients.find(
              (recipient) => recipient.userId && recipient.userId === currentUserId,
            );

            return (
              <li key={issue.id} className="border-border rounded-lg border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium">
                    Rev {issue.revisionLabel}
                    {issue.supersedesId ? ' — superseded the previous revision' : ' — first issue'}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatInstant(issue.issuedAt)}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Issued by {issue.issuedBy?.fullName || issue.issuedBy?.email || 'unknown'}
                </p>
                {issue.reason && <p className="mt-1 text-sm">Reason: {issue.reason}</p>}

                {issue.recipients.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {issue.recipients.map((recipient) => (
                      <li key={recipient.id} className="text-sm text-muted-foreground">
                        {recipient.recipientEmail ?? 'Project member'} — {recipientState(recipient)}
                      </li>
                    ))}
                  </ul>
                )}

                {mine && !mine.acknowledgedAt && (
                  <Button
                    size="sm"
                    className="mt-3"
                    disabled={acknowledge.isPending}
                    onClick={() => acknowledge.mutate(issue.id)}
                  >
                    {acknowledge.isPending ? 'Recording…' : 'I acknowledge this revision'}
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}
