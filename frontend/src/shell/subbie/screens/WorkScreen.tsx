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
 * opens the per-lot hub (`/p/lots/:lotId`), which surfaces the inspection run and
 * this lot's holds & tests behind the lot. Below the lot groups, standard hub
 * cards (same style as home) keep project-wide Holds & Tests, NCRs, and
 * Documents reachable — one uniform card hierarchy, no mixed link/card styles.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Flag, FlaskConical, FolderOpen, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ShellScreen } from '@/shell/components/ShellScreen';
import { HubTile } from '../components/HubTile';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';
import { formatStatusLabel } from '@/lib/statusLabels';
import { getAssignedWorkStatusGroup } from '@/pages/subcontractor-portal/assignedWorkStatus';
import { buildPortalCompanyQuery } from '@/pages/subcontractor-portal/portalCompanyScope';
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

const STATUS_PILL_CLASS: Record<string, string> = {
  not_started: 'shell-pill',
  in_progress: 'shell-pill',
  awaiting_test: 'shell-pill shell-pill-attention',
  hold_point: 'shell-pill shell-pill-attention',
  ncr_raised: 'shell-pill shell-pill-attention',
  on_hold: 'shell-pill shell-pill-attention',
  completed: 'shell-pill shell-pill-good',
  conformed: 'shell-pill shell-pill-good',
  claimed: 'shell-pill shell-pill-good',
};

// Conservative, honest progress bar from status alone (the lots-module payload
// carries no per-lot completion count). Done → full; in progress → partial;
// everything else empty. Never a fabricated ratio.
function lotProgressPct(status: string): number {
  if (['completed', 'conformed', 'claimed'].includes(status)) return 100;
  if (['in_progress', 'awaiting_test', 'hold_point', 'ncr_raised', 'on_hold'].includes(status)) {
    return 55;
  }
  return 0;
}

function LotCard({ lot, onPress }: { lot: Lot; onPress?: () => void }) {
  const label = formatStatusLabel(lot.status, { fallback: 'Not Started' });
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
  const { projectId, projectName, subcontractorCompanyId, isModuleEnabled } =
    useSubbieShellContext();

  const lotsEnabled = isModuleEnabled('lots');
  const holdsOrTests = isModuleEnabled('holdPoints') || isModuleEnabled('testResults');
  const ncrsEnabled = isModuleEnabled('ncrs');
  const documentsEnabled = isModuleEnabled('documents');
  const projectQuery = buildPortalCompanyQuery({ projectId, subcontractorCompanyId });

  const {
    data: lots = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.portalAssignedWork(user?.id, projectId, subcontractorCompanyId),
    queryFn: async () => {
      const res = await apiFetch<{ lots: Lot[] }>(
        `/api/lots${projectQuery}${projectQuery ? '&' : '?'}portalModule=lots`,
      );
      return res.lots ?? [];
    },
    enabled: !!user?.id && !!projectId && lotsEnabled,
  });

  // Grouping mirrors the classic AssignedWorkPage exactly.
  const groups = useMemo(() => {
    const inProgress = lots.filter((l) => getAssignedWorkStatusGroup(l.status) === 'inProgress');
    const notStarted = lots.filter((l) => getAssignedWorkStatusGroup(l.status) === 'notStarted');
    const onHold = lots.filter((l) => getAssignedWorkStatusGroup(l.status) === 'onHold');
    const completed = lots.filter((l) => getAssignedWorkStatusGroup(l.status) === 'completed');
    const other = lots.filter((l) => getAssignedWorkStatusGroup(l.status) === 'other');
    return { inProgress, notStarted, onHold, completed, other };
  }, [lots]);

  if (!lotsEnabled) {
    return <ShellAccessDenied title="My Work" moduleName="Assigned work" />;
  }

  // Tapping a lot opens the per-lot hub (which degrades to whatever modules are
  // enabled). The lots module is on here (screen is gated on it), so cards are
  // always tappable.
  const onPressLot = (lotId: string) =>
    navigate(`/p/lots/${encodeURIComponent(lotId)}${projectQuery}`);

  if (isLoading) {
    return (
      <ShellScreen
        variant="inner"
        title="My Work"
        parent={`/p${projectQuery}`}
        sub={<span>Loading…</span>}
      >
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
    <ShellScreen variant="inner" title="My Work" parent={`/p${projectQuery}`} sub={sub}>
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
      <LotGroup title="Other" lots={groups.other} onPressLot={onPressLot} />

      {/* Project-wide QA & references below the lot groups — same standard hub
          cards as home (one uniform hierarchy). Holds & Tests also keeps
          un-lotted QA items reachable. */}
      {holdsOrTests && (
        <HubTile
          icon={FlaskConical}
          title="Holds & Tests"
          onPress={() => navigate(`/p/quality${projectQuery}`)}
          ariaLabel="Holds and Tests"
        />
      )}

      {ncrsEnabled && (
        <HubTile
          icon={Flag}
          title="NCRs"
          onPress={() => navigate(`/p/ncrs${projectQuery}`)}
          ariaLabel="NCRs"
        />
      )}

      {documentsEnabled && (
        <HubTile
          icon={FolderOpen}
          title="Documents"
          onPress={() => navigate(`/p/docs${projectQuery}`)}
          ariaLabel="Documents"
        />
      )}
    </ShellScreen>
  );
}
