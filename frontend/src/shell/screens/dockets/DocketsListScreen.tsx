/**
 * DocketsListScreen — /m/dockets — the subbie-hours approval inbox.
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #dockets.
 * Cards show a mono DKT-#### number + the subbie name, then a mono hours summary
 * (date · N labour hrs · N plant hrs). Pending dockets sort first. Filter chips
 * (Pending/Approved/Rejected/All) follow the existing approvals filter semantics.
 *
 * Foreman-truth (doc 14): the foreman approves / rejects / queries — and NEVER
 * creates a docket. There is deliberately no create affordance on this surface.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { withProjectQuery } from '../../shellPaths';
import { useDocketsShellContext } from './docketsShellContext';
import {
  DOCKET_FILTERS,
  type DocketFilterKey,
  type DocketPillTone,
  docketStatusLabel,
  docketStatusTone,
  filterSubmittedDockets,
  formatHours,
  sortDocketsForShell,
} from './docketsShellState';
import type { Docket } from '@/pages/dockets/docketApprovalsData';

const PILL_TONE_CLASS: Record<DocketPillTone, string> = {
  attention: 'shell-pill shell-pill-attention',
  bad: 'shell-pill shell-pill-bad',
  good: 'shell-pill shell-pill-good',
  neutral: 'shell-pill',
};

function formatDocketDate(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(parsed);
}

function DocketCard({ docket, onPress }: { docket: Docket; onPress: () => void }) {
  return (
    <button
      type="button"
      className="shell-card"
      onClick={onPress}
      aria-label={`Docket ${docket.docketNumber} — ${docket.subcontractor}, ${docketStatusLabel(
        docket.status,
      )}, ${formatHours(docket.labourHours || 0)} labour hours, ${formatHours(
        docket.plantHours || 0,
      )} plant hours`}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="shell-mono text-[15px] font-semibold text-foreground">
            {docket.docketNumber}
          </span>
          <span className="ml-2 text-[14px] font-semibold text-muted-foreground">
            — {docket.subcontractor}
          </span>
        </span>
        <ChevronRight size={16} className="flex-shrink-0 text-muted-foreground/50" aria-hidden />
      </div>

      {/* Mono hours summary line (per mock) */}
      <div className="mt-[6px] text-[13px] text-muted-foreground">
        {formatDocketDate(docket.date)} ·{' '}
        <span className="shell-mono text-foreground">{formatHours(docket.labourHours || 0)}</span>{' '}
        labour hrs ·{' '}
        <span className="shell-mono text-foreground">{formatHours(docket.plantHours || 0)}</span>{' '}
        plant hrs
      </div>

      {docket.status !== 'pending_approval' && (
        <div className="mt-[10px] flex flex-wrap gap-[7px]">
          <span className={PILL_TONE_CLASS[docketStatusTone(docket.status)]}>
            {docketStatusLabel(docket.status).toUpperCase()}
          </span>
        </div>
      )}
    </button>
  );
}

export function DocketsListScreen() {
  const navigate = useNavigate();
  const { projectId, dockets, loading, loadError, pendingCount } = useDocketsShellContext();
  const [filter, setFilter] = useState<DocketFilterKey>('pending_approval');

  const visible = useMemo(
    () => sortDocketsForShell(filterSubmittedDockets(dockets, filter)),
    [dockets, filter],
  );

  const docketHref = (docketId: string) => withProjectQuery(`/m/dockets/${docketId}`, projectId);

  const sub = (
    <span className="flex items-center gap-2">
      {pendingCount > 0 ? (
        <span className="shell-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-warning">
          {pendingCount} waiting for approval
        </span>
      ) : (
        <span>All caught up</span>
      )}
    </span>
  );

  if (loading) {
    return (
      <ShellScreen variant="inner" title="Dockets" parent="/m" sub={<span>Loading…</span>}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </ShellScreen>
    );
  }

  return (
    <ShellScreen variant="inner" title="Dockets" parent="/m" sub={sub}>
      {/* Filter chips */}
      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        role="group"
        aria-label="Filter dockets by status"
      >
        {DOCKET_FILTERS.map((f) => {
          const active = filter === f.key;
          const showCount = f.key === 'pending_approval' && pendingCount > 0;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={cn(
                'min-h-[40px] whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold touch-manipulation',
                active
                  ? 'bg-foreground text-[hsl(40_33%_98%)]'
                  : 'bg-secondary text-muted-foreground',
              )}
            >
              {f.label}
              {showCount ? ` (${pendingCount})` : ''}
            </button>
          );
        })}
      </div>

      {loadError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-semibold text-destructive">
          {loadError}
        </div>
      )}

      {!loadError && visible.length === 0 && (
        <div className="py-16 text-center text-[14px] leading-relaxed text-muted-foreground">
          {filter === 'pending_approval' ? (
            <>
              All caught up.
              <br />
              No dockets waiting for your approval.
            </>
          ) : (
            <>
              No {filter === 'all' ? '' : `${docketStatusLabel(filter).toLowerCase()} `}dockets
              here.
              <br />
              Subbies submit dockets from their portal.
            </>
          )}
        </div>
      )}

      {visible.map((docket) => (
        <DocketCard
          key={docket.id}
          docket={docket}
          onPress={() => navigate(docketHref(docket.id))}
        />
      ))}
    </ShellScreen>
  );
}
