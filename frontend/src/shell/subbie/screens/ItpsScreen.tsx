/**
 * ItpsScreen — /p/itps — the subbie's inspection (ITP) list.
 *
 * Implements docs/design-subbie-shell-mock-v1.html § id="itps" on the dark shell.
 * NEW PRESENTATION over EXISTING LOGIC — reuses the SAME query the classic
 * SubcontractorITPsPage uses (GET /api/lots?projectId=&includeITP=true&
 * portalModule=itps, key queryKeys.portalITPs), filtered to lots that carry
 * itpInstances, so the cache is shared and behaviour is identical.
 *
 * Module gate: `itps`. Disabled → the shell-native access-denied notice.
 *
 * Per-lot card: lot number + ITP template name, a status-derived progress bar,
 * and the load-bearing permission pill — `canCompleteITP` ? "YOU CAN COMPLETE"
 * (good tone) : "VIEW ONLY — ASK YOUR PM" (eye icon). Tapping opens the shell ITP
 * run (/p/lots/:lotId/itp).
 *
 * The list endpoint returns a derived instance `status` plus completionPercentage
 * from the server-side completion rows. The full per-check breakdown lives one
 * tap deeper, on the run screen.
 *
 * With the lots module ON this list screen has no nav entry point anymore: the
 * Home "Inspections" tile only renders as the lots-OFF fallback, and the lot hub
 * deep-links straight to the run screen (/p/lots/:lotId/itp). It is kept as the
 * lots-OFF fallback surface; retiring it belongs to the desktop-retirement slice
 * (1c).
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardList, Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ShellScreen } from '@/shell/components/ShellScreen';
import { fetchAllLotPages } from '@/lib/lots';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';
import { buildPortalCompanyQuery } from '@/pages/subcontractor-portal/portalCompanyScope';
import { ShellAccessDenied } from './ShellAccessDenied';
import { useSubbieShellContext } from '../subbieShellContext';
import { useModuleAccessRevoked } from '../useModuleAccessRevoked';
import { ModuleAccessChangedNotice } from '../ModuleAccessChangedNotice';

interface ITPInstanceSummary {
  id: string;
  status: string;
  completionPercentage?: number;
  template: { id: string; name: string; activityType?: string };
}

interface LotAssignment {
  canCompleteITP: boolean;
  itpRequiresVerification: boolean;
}

interface Lot {
  id: string;
  lotNumber: string;
  status: string;
  itpInstances?: ITPInstanceSummary[];
  subcontractorAssignments?: LotAssignment[];
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Complete',
};

// Prefer the server-derived percentage; keep the old status fallback for older
// cached responses while a deploy rolls through.
function itpProgressPct(status: string, completionPercentage?: number): number {
  if (typeof completionPercentage === 'number' && completionPercentage > 0) {
    return completionPercentage;
  }
  if (status === 'completed') return 100;
  if (status === 'in_progress') return 55;
  return 0;
}

function ItpLotCard({ lot, onPress }: { lot: Lot; onPress: () => void }) {
  const itp = lot.itpInstances?.[0];
  const canComplete = lot.subcontractorAssignments?.some((a) => a.canCompleteITP) ?? false;
  const status = itp?.status ?? 'not_started';
  const statusLabel = STATUS_LABEL[status] ?? status;
  const pct = itpProgressPct(status, itp?.completionPercentage);

  return (
    <button
      type="button"
      className="shell-card"
      onClick={onPress}
      aria-label={`${lot.lotNumber}${itp ? ` — ${itp.template.name}` : ''}, ${statusLabel}, ${
        canComplete ? 'you can complete' : 'view only'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-secondary">
            <ClipboardList size={18} className="text-muted-foreground" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="shell-mono block text-[15px] font-semibold text-foreground">
              {lot.lotNumber}
            </span>
            {itp && (
              <span className="mt-[1px] block truncate text-[13px] text-muted-foreground">
                {itp.template.name}
              </span>
            )}
          </span>
        </span>
        <ChevronRight size={16} className="flex-shrink-0 text-muted-foreground/50" aria-hidden />
      </div>

      <div className="mt-[10px] flex flex-wrap gap-[7px]">
        <span className={status === 'completed' ? 'shell-pill shell-pill-good' : 'shell-pill'}>
          {statusLabel.toUpperCase()}
        </span>
        {canComplete ? (
          <span className="shell-pill shell-pill-good">YOU CAN COMPLETE</span>
        ) : (
          <span className="shell-pill inline-flex items-center gap-1">
            <Eye size={11} aria-hidden />
            VIEW ONLY — ASK YOUR PM
          </span>
        )}
      </div>

      {pct > 0 && (
        <div className="shell-lotprog" aria-hidden>
          <i style={{ '--shell-prog-w': `${pct}%` } as React.CSSProperties} />
        </div>
      )}
    </button>
  );
}

function ItpGroup({
  title,
  lots,
  onPressLot,
}: {
  title: string;
  lots: Lot[];
  onPressLot: (lotId: string) => void;
}) {
  if (lots.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="shell-mono mt-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {title} ({lots.length})
      </h2>
      {lots.map((lot) => (
        <ItpLotCard key={lot.id} lot={lot} onPress={() => onPressLot(lot.id)} />
      ))}
    </section>
  );
}

export function ItpsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projectId, projectName, subcontractorCompanyId, isModuleEnabled } =
    useSubbieShellContext();

  const itpsEnabled = isModuleEnabled('itps');
  const projectQuery = buildPortalCompanyQuery({ projectId, subcontractorCompanyId });

  const {
    data: lots = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.portalITPs(user?.id, projectId, subcontractorCompanyId),
    queryFn: async () => {
      const lots = await fetchAllLotPages<Lot>(
        `/api/lots${projectQuery}${projectQuery ? '&' : '?'}includeITP=true&portalModule=itps`,
      );
      return lots.filter((lot) => (lot.itpInstances?.length ?? 0) > 0);
    },
    enabled: !!user?.id && !!projectId && itpsEnabled,
  });
  const accessRevoked = useModuleAccessRevoked(error);

  // Grouping mirrors the classic SubcontractorITPsPage exactly.
  const groups = useMemo(() => {
    const inProgress = lots.filter((l) =>
      l.itpInstances?.some((itp) => itp.status === 'in_progress'),
    );
    const notStarted = lots.filter((l) =>
      l.itpInstances?.every((itp) => itp.status === 'not_started'),
    );
    const completed = lots.filter((l) =>
      l.itpInstances?.every((itp) => itp.status === 'completed'),
    );
    return { inProgress, notStarted, completed };
  }, [lots]);

  if (!itpsEnabled) {
    return <ShellAccessDenied title="Inspections" moduleName="ITPs" />;
  }

  const onPressLot = (lotId: string) =>
    navigate(`/p/lots/${encodeURIComponent(lotId)}/itp${projectQuery}`);

  if (isLoading) {
    return (
      <ShellScreen
        variant="inner"
        title="Inspections"
        parent={`/p${projectQuery}`}
        sub={<span>Loading…</span>}
      >
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[110px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </ShellScreen>
    );
  }

  const sub = (
    <span>
      ITP checks on your lots
      {projectName ? ` · ${projectName}` : ''}
    </span>
  );

  return (
    <ShellScreen variant="inner" title="Inspections" parent={`/p${projectQuery}`} sub={sub}>
      {accessRevoked ? (
        <ModuleAccessChangedNotice />
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-semibold text-destructive">
          {extractErrorMessage(error, 'Failed to load ITPs')}
        </div>
      ) : null}

      {!error && lots.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ClipboardList size={32} className="text-muted-foreground/60" aria-hidden />
          <p className="text-[14px] text-muted-foreground">No ITPs assigned yet.</p>
          <p className="max-w-[280px] text-[13px] text-muted-foreground">
            ITPs appear here once you are assigned to lots that carry an inspection plan.
          </p>
        </div>
      )}

      <ItpGroup title="In Progress" lots={groups.inProgress} onPressLot={onPressLot} />
      <ItpGroup title="Not Started" lots={groups.notStarted} onPressLot={onPressLot} />
      <ItpGroup title="Completed" lots={groups.completed} onPressLot={onPressLot} />
    </ShellScreen>
  );
}
