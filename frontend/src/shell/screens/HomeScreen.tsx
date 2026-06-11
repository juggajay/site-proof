/**
 * HomeScreen — the hub entry point for the foreman mobile shell.
 *
 * Implements docs/design-foreman-shell-mock-v4.html § HOME screen exactly.
 *
 * Real data sources:
 *   - Diary hero state: reuses the /api/dashboard/projects/:id/foreman/today
 *     endpoint (same query ForemanBottomNavV2 uses for badges) to derive diary
 *     step progress. Steps: weather, crew/plant, work entries, submitted.
 *   - ITP checks due: from the same foreman/today payload (.dueToday count).
 *   - Dockets pending: from /api/dockets?status=pending_approval (counts items
 *     with status pending_approval; foreman has DOCKET_APPROVER rights).
 *   - NCR open count: from /api/ncrs?projectId=... with status filter.
 *
 * Where a count isn't cheaply available the tile renders without a chip rather
 * than showing fake data.
 *
 * Camera bar: opens the existing CaptureModal — zero changes to CaptureModal
 * itself in this PR.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Camera,
  MapPin,
  FileText,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ShellScreen } from '../components/ShellScreen';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import { CaptureModal } from '@/components/foreman/CaptureModal';
import { cn } from '@/lib/utils';

// ── Types matching the foreman/today endpoint ─────────────────────────────────

interface ForemanTodayPayload {
  blocking?: unknown[];
  dueToday?: unknown[];
  upcoming?: unknown[];
  summary?: {
    totalBlocking: number;
    totalDueToday: number;
    totalUpcoming: number;
  };
}

// Minimal diary shape we need for hero computation
interface DiaryShape {
  id: string;
  status: string;
  weatherConditions?: string | null;
  // Personnel
  personnel?: unknown[];
  // Activities/entries in the diary timeline
  activities?: unknown[];
  delays?: unknown[];
}

interface DiaryListResponse {
  data: DiaryShape[];
}

// Minimal dockets response
interface DocketListResponse {
  data: Array<{ status: string }>;
}

// Minimal NCR response
interface NcrListResponse {
  data: Array<{ status: string }>;
}

// ── Diary hero state computation ───────────────────────────────────────────────

type DiaryHeroState =
  | { kind: 'start' }
  | { kind: 'in-progress'; stepsComplete: number; totalSteps: number; missing: string }
  | { kind: 'submitted' };

const TOTAL_STEPS = 4; // weather, crew, work, submitted

function computeDiaryHero(diary: DiaryShape | null | undefined): DiaryHeroState {
  if (!diary) return { kind: 'start' };
  if (diary.status === 'submitted' || diary.status === 'locked') return { kind: 'submitted' };

  let done = 0;
  if (diary.weatherConditions) done++;
  if ((diary.personnel?.length ?? 0) > 0) done++;
  if ((diary.activities?.length ?? 0) + (diary.delays?.length ?? 0) > 0) done++;
  // step 4 (submit) never done in in-progress state

  if (done === 0) return { kind: 'start' };

  const missing = !diary.weatherConditions
    ? 'Start with weather — it auto-fills from the forecast.'
    : (diary.personnel?.length ?? 0) === 0
      ? 'Log crew & plant — carry from yesterday in one tap.'
      : (diary.activities?.length ?? 0) + (diary.delays?.length ?? 0) === 0
        ? "Log today's work — takes about 30 seconds."
        : "Review and submit when you're ready.";

  return { kind: 'in-progress', stepsComplete: done, totalSteps: TOTAL_STEPS, missing };
}

// ── Hero tile ─────────────────────────────────────────────────────────────────

function DiaryHero({ state, onPress }: { state: DiaryHeroState; onPress: () => void }) {
  const progressPct =
    state.kind === 'submitted'
      ? 100
      : state.kind === 'in-progress'
        ? Math.round((state.stepsComplete / state.totalSteps) * 100)
        : 0;

  const kickerText =
    state.kind === 'submitted'
      ? "TODAY'S DIARY — DONE"
      : state.kind === 'in-progress'
        ? `TODAY'S DIARY — ${state.stepsComplete}/${state.totalSteps}`
        : "TODAY'S DIARY";

  const bigText =
    state.kind === 'submitted'
      ? 'Diary submitted'
      : state.kind === 'in-progress'
        ? "Finish today's diary"
        : "Start today's diary";

  const smallText =
    state.kind === 'submitted'
      ? 'Sent to the office. See you tomorrow.'
      : state.kind === 'in-progress'
        ? state.missing
        : 'Weather, crew, work — then submit. Covers you if anything goes sideways.';

  return (
    <button
      type="button"
      className="shell-hero"
      onClick={onPress}
      aria-label={`Daily diary — ${bigText}`}
    >
      {/* Hazard stripe */}
      <span className="shell-hazard-stripe" aria-hidden="true" />

      {/* Kicker */}
      <div className="relative flex items-center gap-2">
        <span
          className="font-mono text-[11.5px] font-semibold tracking-[0.14em] text-warning"
          aria-hidden="true"
        >
          {kickerText}
        </span>
      </div>

      {/* Big headline */}
      <div
        className="relative mt-2"
        style={{
          fontFamily: "'IBM Plex Sans Condensed', 'IBM Plex Sans', sans-serif",
          fontSize: 25,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          lineHeight: 1.1,
        }}
      >
        {bigText}
      </div>

      {/* Supporting copy */}
      <div className="relative mt-[5px] text-[13.5px] opacity-80">{smallText}</div>

      {/* Progress row */}
      <div className="relative mt-4 flex items-center gap-3">
        <div className="shell-prog-track">
          <i
            className="shell-prog-fill"
            style={{ '--shell-prog-w': `${progressPct}%` } as React.CSSProperties}
            aria-hidden="true"
          />
        </div>
        <span className="shell-mono-badge text-warning">{progressPct}%</span>
      </div>
    </button>
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
      {/* Icon */}
      <span className="shell-hub-ico" aria-hidden="true">
        <Icon size={22} strokeWidth={1.8} />
      </span>

      {/* Text block */}
      <span className="min-w-0 flex-1">
        <span className="shell-tile-title block">{title}</span>
        <span className="mt-[1px] block text-[13px] text-muted-foreground">{description}</span>
      </span>

      {/* Count chip */}
      {chip !== undefined && (
        <span
          className={cn('shell-count-chip', chipOk && 'shell-count-chip-ok')}
          aria-hidden="true"
        >
          {chip}
        </span>
      )}

      {/* Chevron */}
      <ChevronRight
        size={18}
        className="flex-shrink-0 text-muted-foreground/50"
        aria-hidden="true"
      />
    </button>
  );
}

// ── HomeScreen ────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const navigate = useNavigate();
  const [captureOpen, setCaptureOpen] = useState(false);
  const { projectId, isResolving } = useEffectiveProjectId();

  // ── Foreman today endpoint: ITP checks due ─────────────────────────────────
  const { data: todayData } = useQuery<ForemanTodayPayload>({
    queryKey: queryKeys.foremanBadges(projectId ?? 'default'),
    queryFn: () =>
      apiFetch<ForemanTodayPayload>(`/api/dashboard/projects/${projectId}/foreman/today`),
    enabled: !!projectId,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  // ITP checks due — from the worklist dueToday
  const itpChecksDue = (todayData?.dueToday?.length ?? 0) + (todayData?.blocking?.length ?? 0);

  // ── Today's diary: fetch the diary list to compute hero state ──────────────
  const todayKey = new Intl.DateTimeFormat('en-CA').format(new Date()); // YYYY-MM-DD
  const { data: diaryListData } = useQuery<DiaryListResponse>({
    queryKey: [...queryKeys.diaries(projectId ?? 'default'), todayKey],
    queryFn: () =>
      apiFetch<DiaryListResponse>(`/api/diary?projectId=${projectId}&date=${todayKey}`),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const todayDiary = diaryListData?.data?.[0] ?? null;
  const diaryHeroState = computeDiaryHero(todayDiary);

  // ── Pending dockets count ─────────────────────────────────────────────────
  const { data: docketData } = useQuery<DocketListResponse>({
    queryKey: queryKeys.dockets(projectId ?? 'default', 'pending_approval'),
    queryFn: () =>
      apiFetch<DocketListResponse>(`/api/dockets?projectId=${projectId}&status=pending_approval`),
    enabled: !!projectId,
    staleTime: 2 * 60_000,
  });
  const pendingDockets = docketData?.data?.length;

  // ── Open NCR count ────────────────────────────────────────────────────────
  const { data: ncrData } = useQuery<NcrListResponse>({
    queryKey: [...queryKeys.ncrs(projectId ?? undefined), 'open'],
    queryFn: () => apiFetch<NcrListResponse>(`/api/ncrs?projectId=${projectId}&status=open`),
    enabled: !!projectId,
    staleTime: 5 * 60_000,
  });
  const openNcrCount = ncrData?.data?.length;

  // ── Navigation helpers ────────────────────────────────────────────────────
  const navTo = (sub: string) => {
    if (projectId) {
      navigate(`/m/${sub}?projectId=${projectId}`);
    }
  };

  const diaryPath = projectId ? `/projects/${projectId}/diary` : '#';

  if (isResolving) {
    // Skeleton state while project resolves
    return (
      <ShellScreen variant="home">
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        <div className="h-[76px] animate-pulse rounded-2xl bg-muted" />
        <div className="h-[76px] animate-pulse rounded-2xl bg-muted" />
        <div className="h-[76px] animate-pulse rounded-2xl bg-muted" />
      </ShellScreen>
    );
  }

  return (
    <>
      <ShellScreen
        variant="home"
        bottom={
          <div className="shell-cambar">
            <button
              type="button"
              className="shell-cambar-btn"
              aria-label="Take a photo"
              onClick={() => setCaptureOpen(true)}
            >
              <Camera size={24} aria-hidden="true" />
              Take a photo
            </button>
          </div>
        }
      >
        {/* Diary hero tile */}
        <DiaryHero state={diaryHeroState} onPress={() => navigate(diaryPath)} />

        {/* Lots tile */}
        <HubTile
          icon={MapPin}
          title="Lots"
          description="ITP checks &amp; hold points"
          chip={itpChecksDue > 0 ? `${itpChecksDue} due` : undefined}
          onPress={() => navTo('lots')}
          ariaLabel={`Lots${itpChecksDue > 0 ? ` — ${itpChecksDue} checks due` : ''}`}
        />

        {/* Dockets tile */}
        <HubTile
          icon={FileText}
          title="Dockets"
          description="Subbie hours for approval"
          chip={pendingDockets !== undefined ? `${pendingDockets} waiting` : undefined}
          onPress={() => navTo('dockets')}
          ariaLabel={`Dockets${pendingDockets !== undefined ? ` — ${pendingDockets} waiting for approval` : ''}`}
        />

        {/* Issues tile */}
        <HubTile
          icon={AlertTriangle}
          title="Issues"
          description="NCRs &amp; defects"
          chip={openNcrCount !== undefined ? `${openNcrCount} open` : undefined}
          chipOk={openNcrCount === 0}
          onPress={() => navTo('issues')}
          ariaLabel={`Issues${openNcrCount !== undefined ? ` — ${openNcrCount} open` : ''}`}
        />

        {/* Drawings & Docs tile */}
        <HubTile
          icon={FileSpreadsheet}
          title="Drawings &amp; Docs"
          description="Current revisions, by lot"
          onPress={() => navTo('docs')}
          ariaLabel="Drawings and documents"
        />
      </ShellScreen>

      {/* CaptureModal — zero changes to CaptureModal itself */}
      {projectId && (
        <CaptureModal
          projectId={projectId}
          isOpen={captureOpen}
          onClose={() => setCaptureOpen(false)}
        />
      )}
    </>
  );
}
