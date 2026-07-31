/**
 * RevisionTimelineBody — the revision timeline for one governed record.
 *
 * EXTRACTED from RevisionTimelineModal, not re-drawn. The desktop Drawing
 * Register keeps its Modal around this body; the foreman shell's doc sheet
 * renders the same body inline, because a foreman must never open a modal on a
 * modal. Both read one `queryKeys.revisionIssues` cache entry.
 *
 * Self-gating: `/api/revisions` 404s while REVISION_GOVERNANCE_ENABLED is unset.
 * Desktop then says so; the shell passes `hideWhenDisabled` and this renders
 * nothing, because a man in a trench has no use for an environment-configuration
 * sentence. That is the ONE deliberate difference between the two surfaces.
 *
 * Read + acknowledge only. No upload, new-revision, supersede, delete or
 * status-change affordance exists here, on either surface.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiPost } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { formatStatusLabel } from '@/lib/statusLabels';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  formatInstant,
  revisionAckInstant,
  revisionAckStateKey,
  revisionRecipientName,
  useRevisionIssues,
} from './revisionTimelineState';

interface RevisionTimelineBodyProps {
  projectId: string;
  entityType: string;
  entityId: string;
  /** The signed-in user, so their own outstanding acknowledgement can be offered. */
  currentUserId: string | null;
  /**
   * Render nothing at all when revision governance is off, instead of the
   * desktop's "not enabled in this environment" sentence. The shell's branch.
   */
  hideWhenDisabled?: boolean;
}

export function RevisionTimelineBody({
  projectId,
  entityType,
  entityId,
  currentUserId,
  hideWhenDisabled = false,
}: RevisionTimelineBodyProps) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.revisionIssues(projectId, entityType, entityId);
  const { issues, isLoading, error, governanceDisabled } = useRevisionIssues(
    projectId,
    entityType,
    entityId,
  );

  const acknowledge = useMutation({
    mutationFn: (issueId: string) => apiPost(`/api/revisions/${issueId}/acknowledge`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (governanceDisabled && hideWhenDisabled) return null;

  return (
    <>
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
                <ul className="mt-2 space-y-[7px]">
                  {issue.recipients.map((recipient) => {
                    const stateKey = revisionAckStateKey(recipient);
                    const instant = revisionAckInstant(recipient);
                    return (
                      <li
                        key={recipient.id}
                        className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {revisionRecipientName(recipient)}
                        </span>
                        {instant && (
                          <span className="shrink-0 text-xs">{formatInstant(instant)}</span>
                        )}
                        <span
                          className={cn(
                            'shell-pill shrink-0',
                            stateKey === 'revision_acknowledged' && 'shell-pill-good',
                            stateKey === 'revision_opened_not_acknowledged' &&
                              'shell-pill-attention',
                          )}
                        >
                          {formatStatusLabel(stateKey).toUpperCase()}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {mine && !mine.acknowledgedAt && (
                <Button
                  size="sm"
                  className="mt-3 w-full"
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
    </>
  );
}
