/**
 * RejectFormScreen — /m/dockets/:docketId/reject
 *
 * Full-screen reason form for rejecting a docket. Mirrors the DocketActionModal
 * reject path exactly: the reject sends { reason } and the modal disables submit
 * until a non-empty reason is entered — same here, via the shared useDocketAction
 * → buildDocketActionPayload.
 *
 * Offline: rejecting hits the server; when offline the submit disables with an
 * honest note (no offline queue path for docket actions today).
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #activity (form pattern).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { useDocketsShellContext } from './docketsShellContext';
import { useShellDocketParam } from './useShellDocketParam';
import { useDocketAction } from './useDocketAction';
import { isReasonValid } from './docketsShellState';

export function RejectFormScreen() {
  const navigate = useNavigate();
  const { isOnline } = useOfflineStatus();
  const docketId = useShellDocketParam();
  const { projectId, dockets, refetch } = useDocketsShellContext();
  const { submitting, runAction } = useDocketAction(projectId);
  const [reason, setReason] = useState('');

  const docket = useMemo(() => dockets.find((d) => d.id === docketId) ?? null, [dockets, docketId]);

  const detailPath = projectId
    ? `/m/dockets/${docketId}?projectId=${projectId}`
    : `/m/dockets/${docketId}`;
  const listPath = projectId ? `/m/dockets?projectId=${projectId}` : '/m/dockets';

  const canSubmit = isReasonValid(reason) && isOnline && Boolean(docket);

  const handleSubmit = () => {
    if (!docket || !isReasonValid(reason)) return;
    void runAction({
      docketId: docket.id,
      actionType: 'reject',
      actionNotes: reason,
    }).then((ok) => {
      if (ok) {
        void refetch();
        navigate(listPath);
      }
    });
  };

  return (
    <ShellScreen
      variant="inner"
      title="Reject Docket"
      parent={detailPath}
      sub={
        <span className="text-muted-foreground">
          {docket
            ? `${docket.docketNumber} · ${docket.subcontractor}`
            : 'Send it back to the subbie'}
        </span>
      }
      bottom={
        <div className="shell-cambar flex flex-col gap-2">
          {!isOnline && (
            <p className="px-1 text-center text-[12.5px] font-semibold text-warning" role="status">
              Rejections need signal — reconnect to send.
            </p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className={cn(
              'shell-cambar-btn bg-destructive text-destructive-foreground',
              (!canSubmit || submitting) && 'opacity-50',
            )}
            aria-label="Reject docket"
          >
            {submitting ? (
              <>
                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                Rejecting…
              </>
            ) : (
              'Reject Docket'
            )}
          </button>
        </div>
      }
    >
      <div>
        <label
          htmlFor="docket-reject"
          className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground"
        >
          Reason for rejection *
        </label>
        <textarea
          id="docket-reject"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Please provide a reason for rejection…"
          rows={5}
          autoCapitalize="sentences"
          autoComplete="off"
          spellCheck
          className="w-full min-h-[140px] resize-none rounded-xl border border-border bg-card px-3 py-3 text-[15px] leading-[1.5] text-foreground touch-manipulation focus:border-destructive focus:outline-none focus:ring-2 focus:ring-destructive/30"
        />
        <p className="mt-2 text-[13px] text-muted-foreground">
          The subbie sees your reason and can fix and re-submit.
        </p>
      </div>
    </ShellScreen>
  );
}
