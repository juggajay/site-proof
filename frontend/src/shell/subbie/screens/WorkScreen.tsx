/**
 * WorkScreen — /p/work — the subbie's assigned-lots list (read-only).
 *
 * Implements docs/design-subbie-shell-mock-v1.html § id="work" on the dark shell.
 * NEW PRESENTATION over EXISTING LOGIC — it reuses the SAME query the classic
 * AssignedWorkPage uses (GET /api/lots?projectId=&portalModule=lots, key
 * queryKeys.portalAssignedWork) so the cache is shared and behaviour is identical.
 *
 * Module gate: `lots`. Disabled → a shell-native access-denied notice (the shell
 * equivalent of PortalAccessDenied), never the classic light-theme component.
 *
 * Lots are grouped In Progress / Not Started / On Hold / Completed exactly as the
 * classic page groups them. Cards show lot number + activity, area (m²), a status
 * pill and a conservative progress bar (status-derived, never a fabricated
 * ratio — the lots-module payload carries no completion count). Tapping a card
 * opens the shell ITP run when the `itps` module is on; otherwise the card is a
 * non-navigating presentation (matching the classic read-only surface).
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ShellScreen } from '@/shell/components/ShellScreen';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';
import { ShellAccessDenied } from './ShellAccessDenied';
import { useSubbieShellContext } from '../subbieShellContext';

// Minimal lot shape from the classic assigned-work contract.
interface Lot {
  id: string;
  lotNumber: string;
  activity?: string;
  status: string;
  area?: number;
}

// Status pill tone + label — mirrors the classic AssignedWorkPage status badges.
const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  on_hold: 'On Hold',
};

const STATUS_PILL_CLASS: Record<string, string> = {
  not_started: 'shell-pill',
  in_progress: 'shell-pill',
  completed: 'shell-pill shell-pill-good',
  on_hold: 'shell-pill shell-pill-attention',
};

// Conservative, honest progress bar from status alone (the lots-module payload
// carries no per-lot completion count). Done → full; in progress → partial;
// everything else empty. Never a fabricated ratio.
function lotProgressPct(status: string): number {
  if (status === 'completed') return 100;
  if (status === 'in_progress') return 55;
  return 0;
}

function LotCard({ lot, onPress }: { lot: Lot; onPress?: () => void }) {
  const label = STATUS_LABEL[lot.status] ?? lot.status;
  const pillClass = STATUS_PILL_CLASS[lot.status] ?? 'shell-pill';
  const pct = lotProgressPct(lot.status);

  const inner = (
    <>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="shell-mono text-[15px] font-semibold text-foreground">
            {lot.lotNumber}
          </span>
          {lot.activity && (
            <span className="ml-2 text-[14px] font-semibold text-muted-foreground">
              — {lot.activity}
            </span>
          )}
        </span>
        {onPress && (
          <ChevronRight size={16} className="flex-shrink-0 text-muted-foreground/50" aria-hidden />
        )}
      </div>

      {lot.area !== undefined && lot.area !== null && (
        <p className="mt-1 text-[13px] text-muted-foreground">{lot.area.toLocaleString()} m²</p>
      )}

      <div className="mt-[10px] flex flex-wrap gap-[7px]">
        <span className={pillClass}>{label.toUpperCase()}</span>
      </div>

      {pct > 0 && (
        <div className="shell-lotprog" aria-hidden>
          <i style={{ '--shell-prog-w': `${pct}%` } as React.CSSProperties} />
        </div>
      )}
    </>
  );

  const ariaLabel = `Lot ${lot.lotNumber}${lot.activity ? ` — ${lot.activity}` : ''}, ${label}`;

  if (onPress) {
    return (
      <button type="button" className="shell-card" onClick={onPress} aria-label={ariaLabel}>
        {inner}
      </button>
    );
  }
  return (
    <div className="shell-card" aria-label={ariaLabel}>
      {inner}
    </div>
  );
}

function LotGroup({
  title,
  lots,
  onPressLot,
}: {
  title: string;
  lots: Lot[];
  onPressLot?: (lotId: string) => void;
}) {
  if (lots.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="shell-mono mt-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {title} ({lots.length})
      </h2>
      {lots.map((lot) => (
        <LotCard
          key={lot.id}
          lot={lot}
          onPress={onPressLot ? () => onPressLot(lot.id) : undefined}
        />
      ))}
    </section>
  );
}

export function WorkScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projectId, projectName, isModuleEnabled } = useSubbieShellContext();

  const lotsEnabled = isModuleEnabled('lots');
  const itpsEnabled = isModuleEnabled('itps');

  const {
    data: lots = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.portalAssignedWork(user?.id, projectId),
    queryFn: async () => {
      const res = await apiFetch<{ lots: Lot[] }>(
        `/api/lots?projectId=${projectId}&portalModule=lots`,
      );
      return res.lots ?? [];
    },
    enabled: !!user?.id && !!projectId && lotsEnabled,
  });

  // Grouping mirrors the classic AssignedWorkPage exactly.
  const groups = useMemo(() => {
    const inProgress = lots.filter((l) => l.status === 'in_progress');
    const notStarted = lots.filter((l) => l.status === 'not_started' || !l.status);
    const onHold = lots.filter((l) => l.status === 'on_hold');
    const completed = lots.filter((l) => l.status === 'completed');
    return { inProgress, notStarted, onHold, completed };
  }, [lots]);

  if (!lotsEnabled) {
    return <ShellAccessDenied title="My Work" moduleName="Assigned work" />;
  }

  // Tapping a lot opens the ITP run only when the itps module is enabled.
  const onPressLot = itpsEnabled
    ? (lotId: string) =>
        navigate(`/p/lots/${lotId}/itp${projectId ? `?projectId=${projectId}` : ''}`)
    : undefined;

  if (isLoading) {
    return (
      <ShellScreen variant="inner" title="My Work" parent="/p" sub={<span>Loading…</span>}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[96px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </ShellScreen>
    );
  }

  const sub = (
    <span>
      {lots.length} lot{lots.length === 1 ? '' : 's'}
      {projectName ? ` · ${projectName}` : ''}
    </span>
  );

  return (
    <ShellScreen variant="inner" title="My Work" parent="/p" sub={sub}>
      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-semibold text-destructive">
          {extractErrorMessage(error, 'Failed to load assigned work')}
        </div>
      ) : null}

      {!error && lots.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <MapPin size={32} className="text-muted-foreground/60" aria-hidden />
          <p className="text-[14px] text-muted-foreground">No lots assigned yet.</p>
          <p className="max-w-[260px] text-[13px] text-muted-foreground">
            Contact your project manager to get lot assignments.
          </p>
        </div>
      )}

      <LotGroup title="In Progress" lots={groups.inProgress} onPressLot={onPressLot} />
      <LotGroup title="Not Started" lots={groups.notStarted} onPressLot={onPressLot} />
      <LotGroup title="On Hold" lots={groups.onHold} onPressLot={onPressLot} />
      <LotGroup title="Completed" lots={groups.completed} onPressLot={onPressLot} />
    </ShellScreen>
  );
}
