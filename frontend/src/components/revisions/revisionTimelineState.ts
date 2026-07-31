/**
 * revisionTimelineState — the shape, the fetch and the pure decisions behind a
 * governed record's revision timeline (Wave G G1).
 *
 * Split out of the component for the same reason docsShellState is: two surfaces
 * render this timeline — the desktop Drawing Register's modal and the foreman
 * shell's doc sheet — and the decisions they must agree on (what a recipient's
 * state IS, who a recipient is called) belong in one exhaustively-tested place
 * rather than in whichever component drew them first.
 *
 * `useRevisionIssues` is here too so both the timeline body and the sheet header
 * read the SAME `queryKeys.revisionIssues` cache entry. Two `useQuery` calls on
 * one key is one fetch, not a race.
 */
import { useQuery } from '@tanstack/react-query';

import { ApiError, apiGet } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export interface RevisionAcknowledgement {
  id: string;
  userId: string | null;
  recipientEmail: string | null;
  notifiedAt: string | null;
  openedAt: string | null;
  acknowledgedAt: string | null;
  /** The internal recipient, when there is one. `recipientEmail` is null then. */
  user?: { id: string; fullName: string | null; email: string } | null;
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

/** en-AU, the same stamp on both surfaces. */
export function formatInstant(value: string | null): string {
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
 *
 * Returns a `statusLabels` KEY rather than a label: the words belong in the one
 * map with every other status vocabulary, and the instant stays SEPARATE text so
 * the chip can read "Opened, Not Acknowledged" in full and never abbreviate it.
 */
export function revisionAckStateKey(recipient: RevisionAcknowledgement): string {
  if (recipient.acknowledgedAt) return 'revision_acknowledged';
  if (recipient.openedAt) return 'revision_opened_not_acknowledged';
  if (recipient.notifiedAt) return 'revision_notified_not_opened';
  return 'revision_recipient_recorded';
}

/** When that state happened, or null for a recipient merely recorded. */
export function revisionAckInstant(recipient: RevisionAcknowledgement): string | null {
  return recipient.acknowledgedAt ?? recipient.openedAt ?? recipient.notifiedAt;
}

/**
 * Who the revision was addressed to. An INTERNAL recipient carries a user and a
 * null `recipientEmail` (the schema permits exactly one of the two), so without
 * the user relation every internal row reads "Project member" — which on four
 * consecutive rows names nobody at all.
 */
export function revisionRecipientName(recipient: RevisionAcknowledgement): string {
  return (
    recipient.user?.fullName ||
    recipient.user?.email ||
    recipient.recipientEmail ||
    'Project member'
  );
}

/**
 * The issues are returned newest-first (`orderBy: { issuedAt: 'desc' }`), so the
 * head is the current revision's issue — what the sheet header attributes.
 */
export function currentRevisionIssue(issues: RevisionIssue[]): RevisionIssue | null {
  return issues[0] ?? null;
}

/** "Issued 24 Jul 2026, 09:14 am by David Harding" — null when unattributable. */
export function revisionIssuedLine(issue: RevisionIssue | null): string | null {
  if (!issue) return null;
  const who = issue.issuedBy?.fullName || issue.issuedBy?.email;
  const when = formatInstant(issue.issuedAt);
  return who ? `Issued ${when} by ${who}` : `Issued ${when}`;
}

export interface RevisionIssuesQuery {
  issues: RevisionIssue[];
  isLoading: boolean;
  error: unknown;
  /** True when the flag is off: `/api/revisions` 404s rather than existing. */
  governanceDisabled: boolean;
}

/** One fetch, one cache entry, however many surfaces are mounted on it. */
export function useRevisionIssues(
  projectId: string,
  entityType: string,
  entityId: string,
): RevisionIssuesQuery {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.revisionIssues(projectId, entityType, entityId),
    queryFn: () =>
      apiGet<{ issues: RevisionIssue[] }>(
        `/api/revisions?projectId=${encodeURIComponent(projectId)}` +
          `&entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
      ),
    retry: false,
    // The shell can mount before the effective project resolves; asking the API
    // to look up an empty id is a guaranteed 400, not a timeline.
    enabled: Boolean(projectId) && Boolean(entityId),
  });

  return {
    issues: data?.issues ?? [],
    isLoading,
    error,
    governanceDisabled: error instanceof ApiError && error.status === 404,
  };
}
