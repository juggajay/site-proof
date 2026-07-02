/**
 * SubbieLotHubScreen — /p/lots/:lotId — the subbie lot mini-hub.
 *
 * Mirrors the foreman `LotHubScreen` anatomy (ShellScreen variant="inner", lot
 * number title, a few HubTile rows, a bottom primary action) but on the subbie's
 * world: Inspection (with the load-bearing canCompleteITP permission signal) and
 * Holds & Tests on THIS lot. Per-lot detail lives behind the lot, not as
 * top-level tiles.
 *
 * NEW PRESENTATION over EXISTING LOGIC — every read reuses an EXISTING portal
 * query key (cache shared with WorkScreen / ItpsScreen / QualityScreen, no new
 * endpoints). Lot-scoping is client-side:
 *   - lot identity/status: queryKeys.portalAssignedWork (portalModule=lots)
 *   - inspection + permission: queryKeys.portalITPs (includeITP=true)
 *   - hold-point count: queryKeys.portalHoldPoints (subcontractorView=true)
 *
 * NCRs tile is deliberately omitted: the portal NCR payload carries lot NUMBER
 * but not lot id, so a lotId-scoped filter can't match client-side (see the
 * Home screen, which keeps the NCRs tile top-level when the module is on). The
 * "Docs on this lot" tile from the plan is deferred for the same class of
 * reason: portal documents aren't lot-scoped in the payload, so they can't be
 * filtered down to this lot client-side.
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, Eye, FlaskConical, Inbox } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ShellScreen } from '@/shell/components/ShellScreen';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';
import { formatStatusLabel } from '@/lib/statusLabels';
import { buildPortalCompanyQuery } from '@/pages/subcontractor-portal/portalCompanyScope';
import {
  normalizeSubcontractorHoldPoint,
  type ApiSubcontractorHoldPoint,
} from '@/pages/subcontractor-portal/subcontractorHoldPointData';
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

// ── Plain hub tile (chevron row) — matches the foreman/Home HubTile ───────────

function HubTile({
  icon: Icon,
  title,
  description,
  chip,
  onPress,
  ariaLabel,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  chip?: string;
  onPress: () => void;
  ariaLabel: string;
}) {
  return (
    <button type="button" className="shell-hub" onClick={onPress} aria-label={ariaLabel}>
      <span className="shell-hub-ico" aria-hidden="true">
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="shell-tile-title block">{title}</span>
        <span className="mt-[1px] block text-[13px] text-muted-foreground">{description}</span>
      </span>
      {chip !== undefined && (
        <span className="shell-count-chip" aria-hidden="true">
          {chip}
        </span>
      )}
      <ChevronRight
        size={18}
        className="flex-shrink-0 text-muted-foreground/50"
        aria-hidden="true"
      />
    </button>
  );
}

// ── Inspection tile — richer, carries the canCompleteITP permission signal ────

function InspectionTile({
  itp,
  canComplete,
  onPress,
}: {
  itp: ITPInstanceSummary | undefined;
  canComplete: boolean;
  onPress: () => void;
}) {
  const status = itp?.status ?? 'not_started';
  const statusLabel = ITP_STATUS_LABEL[status] ?? status;
  const templateName = itp ? itp.template.name : 'No ITP assigned yet';

  return (
    <button
      type="button"
      className="shell-hub items-start"
      onClick={onPress}
      aria-label={`Inspection — ${templateName}, ${statusLabel}, ${
        canComplete ? 'you can complete' : 'view only'
      }`}
    >
      <span className="shell-hub-ico" aria-hidden="true">
        <ClipboardCheck size={22} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="shell-tile-title block">Inspection</span>
        <span className="mt-[1px] block truncate text-[13px] text-muted-foreground">
          {templateName}
        </span>
        <span className="mt-[8px] flex flex-wrap gap-[7px]">
          <span className={status === 'completed' ? 'shell-pill shell-pill-good' : 'shell-pill'}>
            {statusLabel.toUpperCase()}
          </span>
          {canComplete ? (
            <span className="shell-pill shell-pill-good">YOU CAN COMPLETE</span>
          ) : (
            <span className="shell-pill inline-flex items-center gap-1">
              <Eye size={11} aria-hidden="true" />
              VIEW ONLY — ASK YOUR PM
            </span>
          )}
        </span>
      </span>
      <ChevronRight
        size={18}
        className="mt-1 flex-shrink-0 text-muted-foreground/50"
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
  const holdsEnabled = isModuleEnabled('holdPoints');
  const testsEnabled = isModuleEnabled('testResults');
  const holdsOrTests = holdsEnabled || testsEnabled;

  const projectQuery = buildPortalCompanyQuery({ projectId, subcontractorCompanyId });
  const encodedProjectId = projectId ? encodeURIComponent(projectId) : '';
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
  const { data: itpLots = [] } = useQuery({
    queryKey: queryKeys.portalITPs(user?.id, projectId, subcontractorCompanyId),
    queryFn: async () => {
      const res = await apiFetch<{ lots: ItpLot[] }>(
        `/api/lots${projectQuery}${projectQuery ? '&' : '?'}includeITP=true&portalModule=itps`,
      );
      return (res.lots ?? []).filter((lot) => (lot.itpInstances?.length ?? 0) > 0);
    },
    enabled: !!user?.id && !!projectId && itpsEnabled,
  });

  // Hold-point count on this lot — shared portalHoldPoints cache.
  const { data: holdPoints = [] } = useQuery({
    queryKey: queryKeys.portalHoldPoints(user?.id, projectId, subcontractorCompanyId),
    queryFn: async () => {
      const scopeQuery = buildPortalCompanyQuery({ subcontractorCompanyId });
      const res = await apiFetch<{ holdPoints: ApiSubcontractorHoldPoint[] }>(
        `/api/holdpoints/project/${encodedProjectId}${scopeQuery ? `${scopeQuery}&` : '?'}subcontractorView=true`,
      );
      return (res.holdPoints || []).map(normalizeSubcontractorHoldPoint);
    },
    enabled: !!user?.id && !!projectId && holdsEnabled,
  });

  const workLot = useMemo(() => workLots.find((l) => l.id === lotId), [workLots, lotId]);
  const itpLot = useMemo(() => itpLots.find((l) => l.id === lotId), [itpLots, lotId]);
  const itp = itpLot?.itpInstances?.[0];
  const canComplete = itpLot?.subcontractorAssignments?.some((a) => a.canCompleteITP) ?? false;
  const holdCount = holdPoints.filter((hp) => hp.lotId === lotId).length;

  const lotNumber = workLot?.lotNumber ?? itpLot?.lotNumber ?? 'Lot';
  const status = workLot?.status ?? '';

  const itpPath = `/p/lots/${encodedLotId}/itp${projectQuery}`;
  const qualityPath = `/p/quality${projectQuery}${projectQuery ? '&' : '?'}lotId=${encodedLotId}`;

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
        <InspectionTile itp={itp} canComplete={canComplete} onPress={() => navigate(itpPath)} />
      )}

      {holdsOrTests && (
        <HubTile
          icon={FlaskConical}
          title="Holds & Tests"
          description="Hold points & test results on this lot"
          chip={holdsEnabled && holdCount > 0 ? `${holdCount}` : undefined}
          onPress={() => navigate(qualityPath)}
          ariaLabel={`Holds and Tests on this lot${
            holdsEnabled && holdCount > 0 ? ` — ${holdCount} hold points` : ''
          }`}
        />
      )}

      {/* Nothing enabled for this lot (itps, holds, and tests all off) — an
          honest empty state rather than a blank screen. */}
      {!itpsEnabled && !holdsOrTests && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Inbox size={32} className="text-muted-foreground/60" aria-hidden />
          <p className="text-[14px] text-muted-foreground">Nothing enabled for this lot yet.</p>
          <p className="max-w-[280px] text-[13px] text-muted-foreground">
            No inspections, hold points, or tests are turned on for your crew here. Check with your
            project manager.
          </p>
        </div>
      )}
    </ShellScreen>
  );
}
