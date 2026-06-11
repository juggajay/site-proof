/**
 * DocketDetailScreen — /m/dockets/:docketId — review one subbie docket.
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #docket.
 * Labour / Plant / Notes cards with mono figures, a demoted "Wrong hours?
 * Query · Reject" line, and ONE filled primary action: "Approve — 48 labour +
 * 16 plant" carrying the submitted hours in its label.
 *
 * Reuse: the Labour/Plant entry breakdowns come from the existing
 * useDocketDetailEntriesQuery (same keyed fetch the DocketActionModal uses); the
 * approve mutation runs through useDocketAction (verbatim payload parity). Query
 * and Reject are quiet text affordances that route to full-screen reason forms.
 * "Adjust hours" routes to the approve-with-adjustment form so the hours-
 * adjustment capability the modal supports is preserved as a shell screen.
 *
 * Offline: docket approval is online-only today (no offline queue path). When
 * offline the Approve button disables with an honest note — we never fake an
 * offline approval.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { useDocketsShellContext } from './docketsShellContext';
import { useShellDocketParam } from './useShellDocketParam';
import { useDocketAction } from './useDocketAction';
import {
  type DocketPillTone,
  approveButtonLabel,
  docketStatusLabel,
  docketStatusTone,
  formatHours,
} from './docketsShellState';
import { useDocketDetailEntriesQuery } from '@/pages/dockets/docketActionData';

const PILL_TONE_CLASS: Record<DocketPillTone, string> = {
  attention: 'shell-pill shell-pill-attention',
  bad: 'shell-pill shell-pill-bad',
  good: 'shell-pill shell-pill-good',
  neutral: 'shell-pill',
};

export function DocketDetailScreen() {
  const navigate = useNavigate();
  const { isOnline } = useOfflineStatus();
  const docketId = useShellDocketParam();
  const { projectId, dockets, loading, refetch } = useDocketsShellContext();
  const { submitting, runAction } = useDocketAction(projectId);

  const docket = useMemo(() => dockets.find((d) => d.id === docketId) ?? null, [dockets, docketId]);

  const detailQuery = useDocketDetailEntriesQuery(docket ? docket.id : null);
  const labourEntries = detailQuery.data?.labourEntries ?? [];
  const plantEntries = detailQuery.data?.plantEntries ?? [];

  const backPath = projectId ? `/m/dockets?projectId=${projectId}` : '/m/dockets';
  const withProject = (path: string) => (projectId ? `${path}?projectId=${projectId}` : path);

  // ── Not-found / loading guards ─────────────────────────────────────────────
  if (loading && !docket) {
    return (
      <ShellScreen variant="inner" title="Docket" parent={backPath} sub={<span>Loading…</span>}>
        <div className="h-[88px] animate-pulse rounded-2xl bg-muted" />
        <div className="h-[88px] animate-pulse rounded-2xl bg-muted" />
      </ShellScreen>
    );
  }

  if (!docket) {
    return (
      <ShellScreen variant="inner" title="Docket" parent={backPath} sub={<span>Not found</span>}>
        <div className="py-16 text-center text-[14px] leading-relaxed text-muted-foreground">
          This docket isn’t here anymore.
          <br />
          It may have been actioned already.
        </div>
      </ShellScreen>
    );
  }

  const isPending = docket.status === 'pending_approval';

  const sub = (
    <span className="flex items-center gap-2 text-muted-foreground">
      <span className="min-w-0 truncate">{docket.subcontractor}</span>
      <span aria-hidden>·</span>
      <span className="shell-mono">{docket.date}</span>
    </span>
  );

  const handleApprove = () => {
    void runAction({ docketId: docket.id, actionType: 'approve' }).then((ok) => {
      if (ok) {
        void refetch();
        navigate(backPath);
      }
    });
  };

  // The detail title is the mono docket number, matching the mock header.
  return (
    <ShellScreen
      variant="inner"
      title={docket.docketNumber}
      parent={backPath}
      sub={sub}
      bottom={
        isPending ? (
          <div className="shell-cambar flex flex-col gap-2">
            {!isOnline && (
              <p
                className="px-1 text-center text-[12.5px] font-semibold text-warning"
                role="status"
              >
                Approvals need signal — reconnect to approve.
              </p>
            )}
            <button
              type="button"
              onClick={handleApprove}
              disabled={!isOnline || submitting}
              className={cn('shell-cambar-btn', (!isOnline || submitting) && 'opacity-50')}
              aria-label={approveButtonLabel(docket)}
            >
              {submitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                  Approving…
                </>
              ) : (
                approveButtonLabel(docket)
              )}
            </button>
          </div>
        ) : undefined
      }
    >
      {/* Status pill for non-pending dockets (read-only) */}
      {!isPending && (
        <div className="flex flex-wrap gap-[7px]">
          <span className={PILL_TONE_CLASS[docketStatusTone(docket.status)]}>
            {docketStatusLabel(docket.status).toUpperCase()}
          </span>
        </div>
      )}

      {/* Labour card */}
      <div className="shell-card">
        <div className="text-[15px] font-semibold text-foreground">
          Labour — <span className="shell-mono">{formatHours(docket.labourHours || 0)} hrs</span>
        </div>
        {labourEntries.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {labourEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground"
              >
                <span className="min-w-0 truncate">
                  {entry.employee.name}
                  {entry.employee.role ? ` · ${entry.employee.role}` : ''}
                </span>
                <span className="shell-mono flex-shrink-0 text-foreground">
                  {formatHours(entry.submittedHours)}h
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-1 text-[13px] text-muted-foreground">
            {detailQuery.isLoading ? 'Loading entries…' : 'No labour entries logged.'}
          </div>
        )}
      </div>

      {/* Plant card */}
      <div className="shell-card">
        <div className="text-[15px] font-semibold text-foreground">
          Plant — <span className="shell-mono">{formatHours(docket.plantHours || 0)} hrs</span>
        </div>
        {plantEntries.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {plantEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground"
              >
                <span className="min-w-0 truncate">
                  {entry.plant.description}
                  {entry.plant.idRego ? ` (${entry.plant.idRego})` : ''}
                  {entry.wetOrDry ? ` · ${entry.wetOrDry}` : ''}
                </span>
                <span className="shell-mono flex-shrink-0 text-foreground">
                  {formatHours(entry.hoursOperated)}h
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-1 text-[13px] text-muted-foreground">
            {detailQuery.isLoading ? 'Loading entries…' : 'No plant entries logged.'}
          </div>
        )}
      </div>

      {/* Notes card */}
      <div className="shell-card">
        <div className="text-[15px] font-semibold text-foreground">Notes</div>
        <div className="mt-1 text-[13px] text-muted-foreground">
          {docket.notes?.trim() ? docket.notes : 'No notes from the subbie.'}
        </div>
      </div>

      {/* Quiet affordances — only while pending. "Wrong hours?" demotes the
          query/reject/adjust paths beneath the single filled Approve action. */}
      {isPending && (
        <div className="pt-1 text-center text-[13px] text-muted-foreground">
          Wrong hours?{' '}
          <button
            type="button"
            onClick={() => navigate(withProject(`/m/dockets/${docket.id}/adjust`))}
            className="font-semibold text-foreground underline underline-offset-2 touch-manipulation"
          >
            Adjust hours
          </button>{' '}
          ·{' '}
          <button
            type="button"
            onClick={() => navigate(withProject(`/m/dockets/${docket.id}/query`))}
            className="font-semibold text-foreground underline underline-offset-2 touch-manipulation"
          >
            Query
          </button>{' '}
          ·{' '}
          <button
            type="button"
            onClick={() => navigate(withProject(`/m/dockets/${docket.id}/reject`))}
            className="font-semibold text-foreground underline underline-offset-2 touch-manipulation"
          >
            Reject
          </button>
        </div>
      )}
    </ShellScreen>
  );
}
