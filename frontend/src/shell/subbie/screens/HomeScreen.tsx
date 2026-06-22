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
  ChevronRight,
  Clock,
  FileText,
  Flag,
  FlaskConical,
  MapPin,
  ClipboardCheck,
  Building2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { ShellScreen } from '@/shell/components/ShellScreen';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  buildNeedsAttentionItems,
  getDocketPrerequisiteState,
  formatCurrency,
  getToday,
  type NeedsAttentionItem,
} from '@/pages/subcontractor-portal/subcontractorDashboardHelpers';
import { getDocketDisplayTotalCost } from '@/pages/subcontractor-portal/docketEditData';
import {
  buildPortalCompanyQuery,
  findPortalCompanyOptionByValue,
  getPortalCompanyOptionLabel,
  getPortalCompanyOptionValue,
  type PortalCompanyOption,
} from '@/pages/subcontractor-portal/portalCompanyScope';
import { useSubbieShellContext } from '../subbieShellContext';

// ── Minimal response shapes (existing portal contracts) ───────────────────────

interface Docket {
  id: string;
  date: string;
  status: string;
  totalLabourSubmitted: number;
  totalPlantSubmitted: number;
  totalLabourApprovedCost?: number | null;
  totalPlantApprovedCost?: number | null;
  foremanNotes?: string;
}

interface Lot {
  id: string;
  lotNumber: string;
  status: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ── Hero state ────────────────────────────────────────────────────────────────

type HeroState =
  | { kind: 'none' }
  | {
      kind: 'draft' | 'pending_approval' | 'approved' | 'queried' | 'rejected';
      docketId: string;
      total: number;
      entryHint: string;
    };

const HERO_COPY: Record<
  Exclude<HeroState['kind'], 'none'>,
  { kicker: string; big: string; small: string }
> = {
  draft: {
    kicker: "TODAY'S DOCKET — DRAFT",
    big: 'Keep adding hours',
    small: "Submit when the day's done.",
  },
  pending_approval: {
    kicker: "TODAY'S DOCKET — SENT",
    big: 'Sent — waiting on approval',
    small: "You'll be notified when it's approved.",
  },
  approved: {
    kicker: "TODAY'S DOCKET — APPROVED",
    big: 'Approved',
    small: "Today's docket is approved.",
  },
  queried: {
    kicker: "TODAY'S DOCKET — QUERIED",
    big: 'Answer the foreman',
    small: 'There’s a question to answer before this can be approved.',
  },
  rejected: {
    kicker: "TODAY'S DOCKET — REJECTED",
    big: 'Fix & resubmit',
    small: 'The foreman sent this back — fix it and resubmit.',
  },
};

function computeHero(todaysDocket: Docket | null): HeroState {
  if (!todaysDocket) return { kind: 'none' };
  const total = getDocketDisplayTotalCost(todaysDocket);
  const kind = (
    ['draft', 'pending_approval', 'approved', 'queried', 'rejected'].includes(todaysDocket.status)
      ? todaysDocket.status
      : 'draft'
  ) as Exclude<HeroState['kind'], 'none'>;
  return {
    kind,
    docketId: todaysDocket.id,
    total,
    entryHint: '',
  };
}

// ── Hero tile ─────────────────────────────────────────────────────────────────

function DocketHero({ state, onPress }: { state: HeroState; onPress: () => void }) {
  if (state.kind === 'none') {
    return (
      <button
        type="button"
        className="shell-hero"
        onClick={onPress}
        aria-label="Start today's docket"
      >
        <span className="shell-hazard-stripe" aria-hidden="true" />
        <div className="relative font-mono text-[11.5px] font-semibold tracking-[0.14em] text-warning">
          TODAY'S DOCKET
        </div>
        <div className="shell-hero-big relative mt-2">Start today's docket</div>
        <div className="relative mt-[5px] text-[13.5px] opacity-80">
          Log crew & plant hours, then submit at knock-off.
        </div>
      </button>
    );
  }

  const copy = HERO_COPY[state.kind];
  return (
    <button
      type="button"
      className="shell-hero"
      onClick={onPress}
      aria-label={`Today's docket — ${copy.big}`}
    >
      <span className="shell-hazard-stripe" aria-hidden="true" />
      <div className="relative font-mono text-[11.5px] font-semibold tracking-[0.14em] text-warning">
        {copy.kicker}
      </div>
      <div className="shell-hero-big relative mt-2">{copy.big}</div>
      <div className="relative mt-[5px] text-[13.5px] opacity-80">{copy.small}</div>
      <div className="relative mt-4 flex items-baseline gap-2.5">
        <span className="shell-hero-money">{formatCurrency(state.total)}</span>
        <span className="text-[12px] opacity-65">
          {state.kind === 'approved' ? 'approved today' : 'so far today'}
        </span>
      </div>
    </button>
  );
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

// ── Hub tile ──────────────────────────────────────────────────────────────────

function HubTile({
  icon: Icon,
  title,
  description,
  chip,
  chipOk,
  onPress,
  ariaLabel,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  chip?: string;
  chipOk?: boolean;
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
        <span
          className={cn('shell-count-chip', chipOk && 'shell-count-chip-ok')}
          aria-hidden="true"
        >
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
  const holdsOrTests = isModuleEnabled('holdPoints') || isModuleEnabled('testResults');
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
  const { data: assignedLots = [] } = useQuery({
    queryKey: queryKeys.portalAssignedWork(user?.id, projectId, subcontractorCompanyId),
    queryFn: async () => {
      const res = await apiFetch<{ lots: Lot[] }>(
        `/api/lots${currentProjectQuery}${currentProjectQuery ? '&' : '?'}portalModule=lots`,
      );
      return res.lots ?? [];
    },
    enabled: !!user?.id && !!projectId && lotsEnabled,
  });

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

  // Prerequisite state — reused from the shared helper (drives nothing fatal in
  // the shell yet, but keeps the same honest model for later screens).
  const approvedEmployees = company?.employees?.filter((e) => e.status === 'approved') ?? [];
  const approvedPlant = company?.plant?.filter((p) => p.status === 'approved') ?? [];
  getDocketPrerequisiteState({
    approvedEmployeeCount: approvedEmployees.length,
    approvedPlantCount: approvedPlant.length,
    lotsModuleEnabled: lotsEnabled,
    assignedLotCount: assignedLots.length,
  });

  const hero = computeHero(todaysDocket);
  const docketPath =
    hero.kind === 'none'
      ? `/p/docket${currentProjectQuery}`
      : `/p/docket/${encodeURIComponent(
          (hero as { docketId: string }).docketId,
        )}${currentProjectQuery}`;
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
      bottom={
        <div className="shell-cambar">
          <button
            type="button"
            className="shell-cambar-btn"
            aria-label="Add today's hours"
            onClick={() => navigate(docketPath)}
          >
            <Clock size={22} aria-hidden="true" />
            Add today's hours
          </button>
        </div>
      }
    >
      {/* Today's docket hero */}
      <DocketHero state={hero} onPress={() => navigate(docketPath)} />

      {/* Needs-attention notices */}
      {needsAttention.slice(0, 3).map((item) => (
        <NoticeCard key={item.id} item={item} />
      ))}

      {/* My Dockets */}
      <HubTile
        icon={FileText}
        title="My Dockets"
        description="Drafts, approvals & payment trail"
        chip={queriedCount > 0 ? `${queriedCount} queried` : undefined}
        onPress={() => navigate(docketsPath)}
        ariaLabel={`My Dockets${queriedCount > 0 ? ` — ${queriedCount} queried` : ''}`}
      />

      {/* My Work (lots module) */}
      {lotsEnabled && (
        <HubTile
          icon={MapPin}
          title="My Work"
          description="Lots assigned to your crew"
          chip={assignedLots.length > 0 ? `${assignedLots.length} lots` : undefined}
          chipOk={assignedLots.length > 0}
          onPress={() => navigate(`/p/work${currentProjectQuery}`)}
          ariaLabel={`My Work${assignedLots.length > 0 ? ` — ${assignedLots.length} lots` : ''}`}
        />
      )}

      {/* Inspections (itps module) */}
      {itpsEnabled && (
        <HubTile
          icon={ClipboardCheck}
          title="Inspections"
          description="ITP checks on your lots"
          onPress={() => navigate(`/p/itps${currentProjectQuery}`)}
          ariaLabel="Inspections"
        />
      )}

      {/* Holds & Tests (holdPoints OR testResults) */}
      {holdsOrTests && (
        <HubTile
          icon={FlaskConical}
          title="Holds & Tests"
          description="Hold points, test results"
          onPress={() => navigate(`/p/quality${currentProjectQuery}`)}
          ariaLabel="Holds and Tests"
        />
      )}

      {/* NCRs — only when the ncrs module is enabled (defaults OFF) */}
      {ncrsEnabled && (
        <HubTile
          icon={Flag}
          title="NCRs"
          description="Non-conformances on your lots"
          onPress={() => navigate(`/p/ncrs${currentProjectQuery}`)}
          ariaLabel="NCRs"
        />
      )}

      {/* Documents (documents module) */}
      {documentsEnabled && (
        <HubTile
          icon={FileText}
          title="Documents"
          description="Specs & drawings shared with you"
          onPress={() => navigate(`/p/docs${currentProjectQuery}`)}
          ariaLabel="Documents"
        />
      )}

      {/* My Company */}
      <HubTile
        icon={Building2}
        title="My Company"
        description="Crew, plant & rates"
        onPress={() => navigate(myCompanyLink)}
        ariaLabel="My Company"
      />
    </ShellScreen>
  );
}
