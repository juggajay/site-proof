import { QrCode } from 'lucide-react';
import type { ItpHoldPointState } from '../types';
import { formatHoldPointStatusLabel } from '@/lib/statusLabels';
import { HoldPointConditions } from './HoldPointConditions';

// Benchmark T1 — a hold-point row used to say one of two things: "released by
// X" or a generic lock. A foreman standing at the work could not tell whether
// the office had already called the superintendent, and to change that had to
// leave the checklist and find one row among the register's thousands.
//
// This block renders the full decision lifecycle, including a refused release
// (the HP row itself returns to `pending`) and permission to proceed with open
// conditions. Those derived states come from latestRound, never from status.

export type HoldPointRowState =
  | 'not_requested'
  | 'requested'
  | 'refused'
  | 'conditions_open'
  | 'released';

export function getHoldPointRowState(
  holdPoint: ItpHoldPointState | undefined,
  hasReleaseAttribution: boolean,
): HoldPointRowState {
  if (holdPoint?.latestRound?.outcome === 'rejected') return 'refused';
  if (
    holdPoint?.latestRound?.outcome === 'released_with_conditions' &&
    holdPoint.latestRound.openConditionCount > 0
  ) {
    return 'conditions_open';
  }
  if (holdPoint?.status === 'released' || hasReleaseAttribution) return 'released';
  if (holdPoint?.status === 'notified') return 'requested';
  return 'not_requested';
}

const RELEASE_METHOD_LABELS: Record<string, string> = {
  secure_link: 'secure link',
  email: 'email',
  in_person: 'in person',
  phone: 'phone',
};

export function formatReleaseMethod(method: string): string {
  return RELEASE_METHOD_LABELS[method] ?? method.replace(/_/g, ' ');
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString('en-AU');
}

/** "super@example.com, cc@example.com" -> "super@example.com and 1 other" */
function formatRecipients(notificationSentTo: string | null | undefined): string | null {
  if (!notificationSentTo?.trim()) return null;
  const recipients = notificationSentTo
    .split(/[,\n;]/)
    .map((recipient) => recipient.trim())
    .filter(Boolean);
  if (recipients.length === 0) return null;
  if (recipients.length === 1) return recipients[0];
  return `${recipients[0]} and ${recipients.length - 1} other${recipients.length > 2 ? 's' : ''}`;
}

interface ITPChecklistHoldPointStateProps {
  state: HoldPointRowState;
  holdPoint: ItpHoldPointState | undefined;
  /** Kept for released items whose hold point row is not in the payload. */
  releaseAttribution:
    | {
        releasedByName: string | null;
        releasedByOrg: string | null;
        releaseMethod: string | null;
        releasedAt: string | null;
      }
    | null
    | undefined;
  canRequestRelease: boolean;
  onRequestRelease: () => void;
  onShowQrCode: () => void;
  projectId?: string;
  lotId?: string;
  itemId?: string;
}

export function ITPChecklistHoldPointState({
  state,
  holdPoint,
  releaseAttribution,
  canRequestRelease,
  onRequestRelease,
  onShowQrCode,
  projectId,
  lotId,
  itemId,
}: ITPChecklistHoldPointStateProps) {
  if (state === 'refused' && holdPoint) {
    const round = holdPoint.latestRound;
    const ncrOpen = !round?.ncrStatus || !['closed', 'closed_concession'].includes(round.ncrStatus);
    const label = formatHoldPointStatusLabel(holdPoint);
    const ncrHref =
      projectId && round?.ncrId
        ? `/projects/${encodeURIComponent(projectId)}/ncr?ncr=${encodeURIComponent(round.ncrId)}`
        : null;

    return (
      <div className="mt-2 rounded border border-destructive/30 bg-destructive/10 p-2">
        <p className="text-xs font-medium text-destructive">
          {ncrHref ? (
            <a href={ncrHref} className="underline underline-offset-2">
              {label}
            </a>
          ) : (
            label
          )}
        </p>
        {canRequestRelease && (
          <button
            type="button"
            onClick={onRequestRelease}
            disabled={ncrOpen}
            title={ncrOpen ? 'Close the linked NCR before re-requesting release.' : undefined}
            className="mt-2 rounded border border-destructive/40 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Re-request release
          </button>
        )}
      </div>
    );
  }

  if (state === 'conditions_open' && holdPoint) {
    return (
      <div className="mt-2 rounded border border-warning/30 bg-warning/10 p-2">
        <p className="text-xs font-medium text-warning">{formatHoldPointStatusLabel(holdPoint)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Permission to proceed has been granted. The recorded conditions remain open.
        </p>
        {projectId && lotId && itemId && (
          <HoldPointConditions
            projectId={projectId}
            lotId={lotId}
            itemId={itemId}
            holdPointId={holdPoint.id}
          />
        )}
      </div>
    );
  }

  if (state === 'released') {
    const releasedByName = holdPoint?.releasedByName ?? releaseAttribution?.releasedByName;
    const releasedByOrg = holdPoint?.releasedByOrg ?? releaseAttribution?.releasedByOrg;
    const releaseMethod = holdPoint?.releaseMethod ?? releaseAttribution?.releaseMethod;
    const releasedAt = formatDate(holdPoint?.releasedAt ?? releaseAttribution?.releasedAt);

    return (
      <div className="mt-1">
        <p className="text-xs text-muted-foreground">
          Released by {releasedByName}
          {releasedByOrg && `, ${releasedByOrg}`}
          {releasedAt && ` on ${releasedAt}`}
          {releaseMethod && ` via ${formatReleaseMethod(releaseMethod)}`}
        </p>
      </div>
    );
  }

  if (state === 'requested') {
    const recipient = formatRecipients(holdPoint?.notificationSentTo);
    const due = formatDate(holdPoint?.scheduledDate);

    return (
      <div className="mt-2 rounded border border-warning/30 bg-warning/10 p-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full bg-warning"
            aria-hidden="true"
          />
          Release requested
          {recipient && ` — ${recipient}`}
          {due && `, due ${due}`}
          {holdPoint?.scheduledTime && ` at ${holdPoint.scheduledTime}`}
        </p>
        {canRequestRelease && holdPoint && (
          <button
            type="button"
            onClick={onShowQrCode}
            className="mt-2 inline-flex items-center gap-1.5 rounded border border-warning/40 px-3 py-1 text-xs font-medium text-warning hover:bg-warning/20"
          >
            <QrCode className="h-3.5 w-3.5" />
            Release by QR code
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded border border-border bg-muted/50 p-2">
      <p className="text-xs text-muted-foreground">
        This hold point must be released by the authority before it can be ticked complete.
      </p>
      {canRequestRelease && (
        <button
          type="button"
          onClick={onRequestRelease}
          className="mt-2 rounded border border-primary/40 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10"
        >
          Request release
        </button>
      )}
    </div>
  );
}
