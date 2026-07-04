/**
 * SubbieLotHubScreen — /p/lots/:lotId — the subbie lot mini-hub.
 *
 * Mirrors the foreman `LotHubScreen` anatomy (ShellScreen variant="inner", lot
 * number title, a few HubTile rows, a bottom primary action) but on the subbie's
 * world. Cards are exactly: Inspection (with the load-bearing canCompleteITP
 * permission signal), NCRs, Documents. Holds & Tests is gone from the subbie
 * UI entirely — subbies never act on hold points (the HC releases them).
 *
 * NEW PRESENTATION over EXISTING LOGIC — every read reuses an EXISTING portal
 * query key (cache shared with WorkScreen / ItpsScreen, no new endpoints):
 *   - lot identity/status: queryKeys.portalAssignedWork (portalModule=lots)
 *   - inspection + permission: queryKeys.portalITPs (includeITP=true)
 *
 * NCRs card deep-links to /p/ncrs?lotId= — the portal NCR list endpoint
 * accepts lotId server-side (ncrLots.some.lotId), so NcrsScreen fetches a
 * lot-scoped list. Documents card navigates UNSCOPED to /p/docs: portal
 * documents aren't lot-scoped in the payload or the endpoint, so a per-lot
 * docs filter can't exist yet.
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, Eye, Flag, FolderOpen, Inbox } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ShellScreen } from '@/shell/components/ShellScreen';
import { HubTile } from '@/shell/components/HubTile';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';
import { formatStatusLabel } from '@/lib/statusLabels';
import { buildPortalCompanyQuery } from '@/pages/subcontractor-portal/portalCompanyScope';
import { useSubbieShellContext } from '../subbieShellContext';

// ── Minimal response shapes (existing portal contracts) ───────────────────────

interface WorkLot {
  id: string;
  lotNumber: string;
  status: string;
}

interface ITPInstanceSummary {
  id: string;
  status: string;
  template: { id: string; name: string };
}

interface ItpLot {
  id: string;
  lotNumber: string;
  itpInstances?: ITPInstanceSummary[];
  subcontractorAssignments?: Array<{ canCompleteITP: boolean }>;
}

const ITP_STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Complete',
};

// ── Inspection tile — richer, carries the canCompleteITP permission signal ────

function InspectionTile({
  itp,
  canComplete,
  resolved,
  onPress,
}: {
  itp: ITPInstanceSummary | undefined;
  canComplete: boolean;
  // False while the portalITPs query is still loading — render no pill until it
  // resolves, so the card doesn't flash "VIEW ONLY" before canComplete lands.
  resolved: boolean;
  onPress: () => void;
}) {
  const status = itp?.status ?? 'not_started';
  const statusLabel = ITP_STATUS_LABEL[status] ?? status;
  const templateName = itp ? itp.template.name : 'No ITP assigned yet';

  return (
    <button
      type="button"
      className="shell-hub"
      onClick={onPress}
      aria-label={`Inspection — ${templateName}, ${statusLabel}, ${
        canComplete ? 'you can complete' : 'view only — ask your PM'
      }`}
    >
      <span className="shell-hub-ico" aria-hidden="true">
        <ClipboardCheck size={22} strokeWidth={1.8} />
      </span>
      {/* Uniform card height: title + the single permission pill share ONE
          horizontal row (wrapping only when genuinely too narrow), so this card
          matches its icon+label+chevron siblings. No ITP status pill and no
          description line — status + template name stay in the aria-label. The
          short "VIEW ONLY" keeps the pill on one row at 390px; the full "ask
          your PM" guidance lives in the aria-label. */}
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-[7px] gap-y-1">
        <span className="shell-tile-title">Inspection</span>
        {resolved &&
          (canComplete ? (
            <span className="shell-pill shell-pill-good">YOU CAN COMPLETE</span>
          ) : (
            <span className="shell-pill inline-flex items-center gap-1">
              <Eye size={11} aria-hidden="true" />
              VIEW ONLY
            </span>
          ))}
      </span>
      <ChevronRight
        size={18}
        className="flex-shrink-0 text-muted-foreground/50"
        aria-hidden="true"
      />
    </button>
  );
}

export function SubbieLotHubScreen() {
  const navigate = useNavigate();
  const { lotId = '' } = useParams();
  const { user } = useAuth();
  const { projectId, subcontractorCompanyId, isModuleEnabled } = useSubbieShellContext();

  const lotsEnabled = isModuleEnabled('lots');
  const itpsEnabled = isModuleEnabled('itps');
  const ncrsEnabled = isModuleEnabled('ncrs');
  const documentsEnabled = isModuleEnabled('documents');

  const projectQuery = buildPortalCompanyQuery({ projectId, subcontractorCompanyId });
  const encodedLotId = encodeURIComponent(lotId);

  // Lot identity/status — shared portalAssignedWork cache.
  const { data: workLots = [] } = useQuery({
    queryKey: queryKeys.portalAssignedWork(user?.id, projectId, subcontractorCompanyId),
    queryFn: async () => {
      const res = await apiFetch<{ lots: WorkLot[] }>(
        `/api/lots${projectQuery}${projectQuery ? '&' : '?'}portalModule=lots`,
      );
      return res.lots ?? [];
    },
    enabled: !!user?.id && !!projectId && lotsEnabled,
  });

  // Inspection + permission — shared portalITPs cache (same query as ItpsScreen).
  const { data: itpLotsData } = useQuery({
    queryKey: queryKeys.portalITPs(user?.id, projectId, subcontractorCompanyId),
    queryFn: async () => {
      const res = await apiFetch<{ lots: ItpLot[] }>(
        `/api/lots${projectQuery}${projectQuery ? '&' : '?'}includeITP=true&portalModule=itps`,
      );
      return (res.lots ?? []).filter((lot) => (lot.itpInstances?.length ?? 0) > 0);
    },
    enabled: !!user?.id && !!projectId && itpsEnabled,
  });

  // undefined until the query resolves — gates the permission pill so it doesn't
  // flash VIEW ONLY (canComplete defaults falsy) before the data lands.
  const itpResolved = itpLotsData !== undefined;
  const itpLots = itpLotsData ?? [];

  const workLot = useMemo(() => workLots.find((l) => l.id === lotId), [workLots, lotId]);
  const itpLot = useMemo(() => itpLots.find((l) => l.id === lotId), [itpLots, lotId]);
  const itp = itpLot?.itpInstances?.[0];
  const canComplete = itpLot?.subcontractorAssignments?.some((a) => a.canCompleteITP) ?? false;

  const lotNumber = workLot?.lotNumber ?? itpLot?.lotNumber ?? 'Lot';
  const status = workLot?.status ?? '';

  const itpPath = `/p/lots/${encodedLotId}/itp${projectQuery}`;
  // Server-side lot scope — GET /api/ncrs accepts lotId (ncrLots.some.lotId).
  const ncrsPath = `/p/ncrs${projectQuery}${projectQuery ? '&' : '?'}lotId=${encodedLotId}`;

  // Bottom primary only when the subbie can actually action the ITP and it is not
  // already done — mirrors the foreman "Continue inspections" affordance.
  const showContinue = canComplete && !!itp && itp.status !== 'completed';

  const sub = (
    <span className="flex items-center gap-2">
      <span>This lot</span>
      {status && (
        <span className="shell-mono text-[12px] font-semibold uppercase text-muted-foreground">
          {formatStatusLabel(status).toUpperCase()}
        </span>
      )}
    </span>
  );

  return (
    <ShellScreen
      variant="inner"
      title={lotNumber}
      parent={`/p/work${projectQuery}`}
      sub={sub}
      bottom={
        showContinue ? (
          <div className="shell-primary">
            <button
              type="button"
              className="shell-primary-btn"
              onClick={() => navigate(itpPath)}
              aria-label="Continue inspection"
            >
              Continue inspection
            </button>
          </div>
        ) : undefined
      }
    >
      {itpsEnabled && (
        <InspectionTile
          itp={itp}
          canComplete={canComplete}
          resolved={itpResolved}
          onPress={() => navigate(itpPath)}
        />
      )}

      {/* NCRs on this lot — server-side lotId scope on the portal NCR list. */}
      {ncrsEnabled && (
        <HubTile
          icon={Flag}
          title="NCRs"
          onPress={() => navigate(ncrsPath)}
          ariaLabel="NCRs on this lot"
        />
      )}

      {/* Documents — UNSCOPED (portal docs aren't lot-scoped; see header). */}
      {documentsEnabled && (
        <HubTile
          icon={FolderOpen}
          title="Documents"
          onPress={() => navigate(`/p/docs${projectQuery}`)}
          ariaLabel="Documents"
        />
      )}

      {/* Nothing enabled for this lot (itps, ncrs, and documents all off) — an
          honest empty state rather than a blank screen. */}
      {!itpsEnabled && !ncrsEnabled && !documentsEnabled && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Inbox size={32} className="text-muted-foreground/60" aria-hidden />
          <p className="text-[14px] text-muted-foreground">Nothing enabled for this lot yet.</p>
          <p className="max-w-[280px] text-[13px] text-muted-foreground">
            No inspections, NCRs, or documents are turned on for your crew here. Check with your
            project manager.
          </p>
        </div>
      )}
    </ShellScreen>
  );
}
