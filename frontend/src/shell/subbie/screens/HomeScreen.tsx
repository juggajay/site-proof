/**
 * HomeScreen — the hub entry point for the subbie portal mobile shell (/p).
 *
 * Implements docs/design-subbie-shell-mock-v1.html § HOME exactly, on the proven
 * foreman ShellScreen home variant.
 *
 * Real data sources (all EXISTING portal query keys — cache shared with the
 * classic portal pages, no new endpoints):
 *   - company / portalAccess / availableProjects: subbieShellData context
 *     (GET /api/subcontractors/my-company).
 *   - today's docket hero: GET /api/dockets?projectId= (queryKeys.portalDockets)
 *     + the dashboard's local-date getToday() key.
 *   - needs-attention: GET /api/notifications?limit=10 (queryKeys.portalDashboard)
 *     fed into the shared buildNeedsAttentionItems.
 *   - assigned-lots count + docket prerequisites: GET
 *     /api/lots?projectId=&portalModule=lots (queryKeys.portalAssignedWork), only
 *     when the lots module is on.
 *
 * Count chips stay within already-fetched data (queried-docket count, assigned-
 * lots count) — no extra endpoints just for badges.
 */
import {
  AlertTriangle,
  Building2,
  FileText,
  Flag,
  FolderOpen,
  MapPin,
  ClipboardCheck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { ShellScreen } from '@/shell/components/ShellScreen';
import { HubTile } from '@/shell/components/HubTile';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';
import {
  buildNeedsAttentionItems,
  getDocketPrerequisiteState,
  getToday,
  type NeedsAttentionItem,
} from '@/pages/subcontractor-portal/subcontractorDashboardHelpers';
import { getDocketDisplayTotalCost } from '@/pages/subcontractor-portal/docketEditData';
import { DocketHero, type Docket, type HeroState } from './HomeScreenHero';
import {
  buildPortalCompanyQuery,
  findPortalCompanyOptionByValue,
  getPortalCompanyOptionLabel,
  getPortalCompanyOptionValue,
  type PortalCompanyOption,
} from '@/pages/subcontractor-portal/portalCompanyScope';
import { useSubbieShellContext } from '../subbieShellContext';

// ── Minimal response shapes (existing portal contracts) ───────────────────────

interface Lot {
  id: string;
  lotNumber: string;
  status: string;
}

interface ItpLot {
  id: string;
  itpInstances?: Array<{ status: string }>;
  subcontractorAssignments?: Array<{ canCompleteITP: boolean }>;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// Derive the docket hero state from today's docket (or none).
function computeHero(todaysDocket: Docket | null): HeroState {
  if (!todaysDocket) return { kind: 'none' };
  const total = getDocketDisplayTotalCost(todaysDocket);
  const kind = (
    ['draft', 'pending_approval', 'approved', 'queried', 'rejected'].includes(todaysDocket.status)
      ? todaysDocket.status
      : 'draft'
  ) as Exclude<HeroState['kind'], 'none'>;
  return { kind, docketId: todaysDocket.id, total, entryHint: '' };
}

// ── Notice card (needs-attention) ─────────────────────────────────────────────

function NoticeCard({ item }: { item: NeedsAttentionItem }) {
  return (
    <Link to={item.link} className="shell-notice shell-notice-warn" aria-label={item.title}>
      <AlertTriangle size={19} aria-hidden="true" className="mt-px shrink-0 text-warning" />
      <div className="min-w-0">
        <b className="block text-[13.5px]">{item.title}</b>
        <span className="block truncate text-[13.5px]">{item.message}</span>
      </div>
    </Link>
  );
}

// ── Project switcher (headerExtra) ────────────────────────────────────────────

function ProjectSwitcher({ value, options }: { value: string; options: PortalCompanyOption[] }) {
  const navigate = useNavigate();
  return (
    <div className="mt-2.5">
      <label htmlFor="subbie-project-switcher" className="sr-only">
        Project
      </label>
      <select
        id="subbie-project-switcher"
        value={value}
        onChange={(e) => {
          const option = findPortalCompanyOptionByValue(options, e.target.value);
          if (!option) return;
          navigate(
            `/p${buildPortalCompanyQuery({
              projectId: option.projectId,
              subcontractorCompanyId: option.subcontractorCompanyId || option.id,
            })}`,
          );
        }}
        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[13px] text-foreground"
      >
        {options.map((o) => (
          <option
            key={`${o.projectId}:${getPortalCompanyOptionValue(o)}`}
            value={getPortalCompanyOptionValue(o)}
          >
            {getPortalCompanyOptionLabel(o, options)}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── HomeScreen ────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    projectId,
    subcontractorCompanyId,
    company,
    companyName,
    projectName,
    availableProjects,
    isModuleEnabled,
  } = useSubbieShellContext();

  const lotsEnabled = isModuleEnabled('lots');
  const ncrsEnabled = isModuleEnabled('ncrs');
  const documentsEnabled = isModuleEnabled('documents');
  const itpsEnabled = isModuleEnabled('itps');
  const currentProjectQuery = buildPortalCompanyQuery({ projectId, subcontractorCompanyId });

  // Dockets — existing portal key; drives the hero + recent/queried counts.
  const { data: docketsData } = useQuery({
    queryKey: queryKeys.portalDockets(user?.id, projectId, subcontractorCompanyId),
    queryFn: async () => {
      const res = await apiFetch<{ dockets: Docket[] }>(
        `/api/dockets${buildPortalCompanyQuery({ projectId, subcontractorCompanyId })}`,
      );
      return res.dockets ?? [];
    },
    enabled: !!user?.id && !!projectId,
  });

  const today = getToday();
  const dockets = docketsData ?? [];
  const todaysDocket = dockets.find((d) => d.date === today) ?? null;
  const recentDockets = dockets.filter((d) => d.date !== today).slice(0, 5);
  const queriedCount = dockets.filter((d) => d.status === 'queried').length;

  // Assigned lots — existing portal key; count chip + prerequisite state.
  const { data: assignedLotsData } = useQuery({
    queryKey: queryKeys.portalAssignedWork(user?.id, projectId, subcontractorCompanyId),
    queryFn: async () => {
      const res = await apiFetch<{ lots: Lot[] }>(
        `/api/lots${currentProjectQuery}${currentProjectQuery ? '&' : '?'}portalModule=lots`,
      );
      return res.lots ?? [];
    },
    enabled: !!user?.id && !!projectId && lotsEnabled,
  });
  const assignedLots = assignedLotsData ?? [];
  const hasAssignedLotsResponse = assignedLotsData !== undefined;

  // ITP checks — existing portal key (shared with ItpsScreen). Drives the My Work
  // chip's actionable "N checks to do" count (lots the crew can complete and has
  // not yet finished). Only fetched when the itps module is on.
  const { data: itpLotsData } = useQuery({
    queryKey: queryKeys.portalITPs(user?.id, projectId, subcontractorCompanyId),
    queryFn: async () => {
      const res = await apiFetch<{ lots: ItpLot[] }>(
        `/api/lots${currentProjectQuery}${currentProjectQuery ? '&' : '?'}includeITP=true&portalModule=itps`,
      );
      return (res.lots ?? []).filter((lot) => (lot.itpInstances?.length ?? 0) > 0);
    },
    enabled: !!user?.id && !!projectId && itpsEnabled,
  });
  const hasItpResponse = itpLotsData !== undefined;
  const checksToDo = (itpLotsData ?? []).filter((lot) => {
    const canComplete = lot.subcontractorAssignments?.some((a) => a.canCompleteITP) ?? false;
    const itp = lot.itpInstances?.[0];
    return canComplete && !!itp && itp.status !== 'completed';
  }).length;
  const checksToDoLabel = `${checksToDo} check${checksToDo === 1 ? '' : 's'} to do`;

  // Notifications — existing portal key; feeds needs-attention.
  const { data: notifData } = useQuery({
    queryKey: queryKeys.portalDashboard(user?.id),
    queryFn: () => apiFetch<{ notifications: Notification[] }>('/api/notifications?limit=10'),
    enabled: !!user?.id && !!company,
  });
  const notifications = notifData?.notifications ?? [];

  // Keep the rate-counter notice inside the shell (My Company lives at /p/company).
  const myCompanyLink = `/p/company${currentProjectQuery}`;

  // buildNeedsAttentionItems emits classic /subcontractor-portal/docket/:id links
  // (shared with the classic dashboard). Rewrite the docket links into the shell
  // so the whole flow stays internal to /p now that the docket surface is real.
  const needsAttention = buildNeedsAttentionItems({
    recentDockets,
    notifications,
    myCompanyLink,
  }).map((item) =>
    item.link.startsWith('/subcontractor-portal/docket/')
      ? {
          ...item,
          link: `/p/docket/${encodeURIComponent(
            item.link.slice('/subcontractor-portal/docket/'.length),
          )}${currentProjectQuery}`,
        }
      : item,
  );

  // Prerequisite state — reused from the shared helper. When unmet it flips the
  // hero into its setup state and puts the "Setup needed" chip on My Company
  // (M78 — no dead-end, no contradiction). Gated on the loaded company
  // bootstrap so we don't flash setup before the real prerequisite state.
  const approvedEmployees = company?.employees?.filter((e) => e.status === 'approved') ?? [];
  const approvedPlant = company?.plant?.filter((p) => p.status === 'approved') ?? [];
  const docketPrerequisites = getDocketPrerequisiteState({
    approvedEmployeeCount: approvedEmployees.length,
    approvedPlantCount: approvedPlant.length,
    lotsModuleEnabled: lotsEnabled,
    assignedLotCount: hasAssignedLotsResponse ? assignedLots.length : 1,
  });
  const companyNeedsSetup = !!company && !docketPrerequisites.prerequisitesMet;

  const hero: HeroState = companyNeedsSetup ? { kind: 'setup' } : computeHero(todaysDocket);
  const heroPath =
    hero.kind === 'setup'
      ? myCompanyLink
      : hero.kind === 'none'
        ? `/p/docket${currentProjectQuery}`
        : `/p/docket/${encodeURIComponent(hero.docketId)}${currentProjectQuery}`;
  const docketsPath = `/p/dockets${currentProjectQuery}`;

  const projectLabel = companyName
    ? `${companyName}${projectName ? ` — ${projectName}` : ''}`
    : (projectName ?? 'Your company');

  return (
    <ShellScreen
      variant="home"
      roleLabel="SUBCONTRACTOR"
      projectLabel={projectLabel}
      headerExtra={
        availableProjects.length > 1 && projectId ? (
          <ProjectSwitcher
            value={subcontractorCompanyId || projectId || ''}
            options={availableProjects}
          />
        ) : undefined
      }
    >
      {/* Today's docket hero — or the setup call-to-action while prerequisites
          are unmet (the hero carries the setup state; no separate notice). */}
      <DocketHero state={hero} onPress={() => navigate(heroPath)} />

      {/* Needs-attention notices */}
      {needsAttention.slice(0, 3).map((item) => (
        <NoticeCard key={item.id} item={item} />
      ))}

      {/* My Dockets */}
      <HubTile
        icon={FileText}
        title="My Dockets"
        chip={queriedCount > 0 ? `${queriedCount} queried` : undefined}
        onPress={() => navigate(docketsPath)}
        ariaLabel={`My Dockets${queriedCount > 0 ? ` — ${queriedCount} queried` : ''}`}
      />

      {/* My Work (lots module) — chip is the actionable "N checks to do" when the
          itps module is on, else the plain lot count. While the ITP query is still
          loading we render no chip at all (avoid a transient green "0 checks to do"
          flash). Per-lot detail (inspection, holds & tests) now lives behind the
          lot in SubbieLotHubScreen. */}
      {lotsEnabled && (
        <HubTile
          icon={MapPin}
          title="My Work"
          chip={
            itpsEnabled
              ? hasItpResponse
                ? checksToDoLabel
                : undefined
              : assignedLots.length > 0
                ? `${assignedLots.length} lots`
                : undefined
          }
          chipOk={itpsEnabled ? checksToDo === 0 : assignedLots.length > 0}
          onPress={() => navigate(`/p/work${currentProjectQuery}`)}
          ariaLabel={
            itpsEnabled
              ? hasItpResponse
                ? `My Work — ${checksToDoLabel}`
                : 'My Work'
              : `My Work${assignedLots.length > 0 ? ` — ${assignedLots.length} lots` : ''}`
          }
        />
      )}

      {/* Fallback Inspections tile — ONLY when lots is off (no lot hub to host
          the inspection run), so inspections stay reachable. */}
      {itpsEnabled && !lotsEnabled && (
        <HubTile
          icon={ClipboardCheck}
          title="Inspections"
          onPress={() => navigate(`/p/itps${currentProjectQuery}`)}
          ariaLabel="Inspections"
        />
      )}

      {/* Fallback NCRs tile — ONLY when lots is off. When lots is on, NCRs live
          behind the lot (SubbieLotHubScreen). */}
      {ncrsEnabled && !lotsEnabled && (
        <HubTile
          icon={Flag}
          title="NCRs"
          onPress={() => navigate(`/p/ncrs${currentProjectQuery}`)}
          ariaLabel="NCRs"
        />
      )}

      {/* Fallback Documents tile — ONLY when lots is off. When lots is on,
          Documents lives behind the lot (SubbieLotHubScreen). */}
      {documentsEnabled && !lotsEnabled && (
        <HubTile
          icon={FolderOpen}
          title="Documents"
          onPress={() => navigate(`/p/docs${currentProjectQuery}`)}
          ariaLabel="Documents"
        />
      )}

      {/* My Company — plain uniform tile (owner FINAL 2026-07-05): just the
          company name as the title, no chips in any state. The hero's setup
          state carries the "set up your company" signal. Falls back to the
          "My Company" label when the bootstrap has no company. */}
      <HubTile
        icon={Building2}
        title={company?.companyName ?? 'My Company'}
        onPress={() => navigate(myCompanyLink)}
        ariaLabel={company?.companyName ? `My Company — ${company.companyName}` : 'My Company'}
      />
    </ShellScreen>
  );
}
