/**
 * HomeScreen — the hub entry point for the foreman mobile shell.
 *
 * Implements docs/design-foreman-home-hub-mock-v2-2026-08-06.html exactly.
 *
 * Hub-and-spoke, no bottom nav. The screen encodes one rule: PERMANENT CARDS =
 * PERMANENT JOBS (Lots, Dockets, Issues, Drawings & Docs — always present, in
 * that order), OCCASIONAL JOBS = NOTICE CARDS that appear only while the job
 * exists (unfiled photos). A zero count is ABSENT, not grey — silence means
 * "nothing needs you", so no chip ever renders at zero.
 *
 * Real data sources:
 *   - Diary hero state: reuses the /api/dashboard/projects/:id/foreman/today
 *     endpoint (same query ForemanBottomNavV2 uses for badges) to derive diary
 *     step progress. Steps: weather, crew/plant, work entries, submitted.
 *   - Lots chip: the same foreman/today payload — .blocking (hold points ready
 *     for the foreman) and .dueToday (ITP checks due).
 *   - Dockets pending: from /api/dockets?status=pending_approval (counts items
 *     with status pending_approval; foreman has DOCKET_APPROVER rights).
 *   - NCR open count: from /api/ncrs?projectId=... with status filter.
 *   - Unfiled photos: usePhotosShellData — the SAME hook (and TanStack query
 *     key) the /m/photos surface uses, so the notice and that screen can never
 *     disagree and navigating there hits a warm cache.
 *   - Drawings & Docs NEVER carries a chip: a reference doesn't demand anything.
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
  ClipboardCheck,
  Folder,
  Image as ImageIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ShellScreen } from '../components/ShellScreen';
import { HubTile } from '../components/HubTile';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import { CaptureModal } from '@/components/foreman/CaptureModal';
import { withProjectQuery } from '../shellPaths';
import { deriveDiaryStepState } from './diary/diaryStepState';
import { usePhotosShellData } from './photos/usePhotosShellData';
import type { DailyDiary } from '@/pages/diary/types';

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

// Minimal dockets response
interface DocketListResponse {
  data: Array<{ status: string }>;
}

// Minimal NCR response
interface NcrListResponse {
  data: Array<{ status: string }>;
}

// ── Diary hero state computation — delegates to shared deriveDiaryStepState ───

const TOTAL_STEPS = 4; // weather, crew, work, submitted

type DiaryHeroState =
  | { kind: 'start' }
  | { kind: 'in-progress'; stepsComplete: number; totalSteps: number; missing: string }
  | { kind: 'submitted' };

function computeDiaryHero(diary: DailyDiary | null | undefined): DiaryHeroState {
  const stepState = deriveDiaryStepState(diary);

  if (!diary) return { kind: 'start' };
  if (stepState.allDone) return { kind: 'submitted' };
  if (stepState.stepsComplete === 0) return { kind: 'start' };

  const missing =
    stepState.weather !== 'done'
      ? 'Start with weather — it auto-fills from the forecast.'
      : stepState.crew !== 'done'
        ? 'Log crew & plant — carry from yesterday in one tap.'
        : stepState.work !== 'done'
          ? "Log today's work — takes about 30 seconds."
          : "Review and submit when you're ready.";

  return {
    kind: 'in-progress',
    stepsComplete: stepState.stepsComplete,
    totalSteps: TOTAL_STEPS,
    missing,
  };
}

// ── Lots "what does today expect of me" chip ─────────────────────────────────

/**
 * The one real upgrade in v2: the backend already computes the foreman's day
 * (hold points ready to inspect, ITP checks due) but that never reached this
 * screen. A hold point ready to lift outranks a routine check — it is what
 * stalls a pour — so it leads the chip.
 *
 * Returns undefined when the day asks nothing: no chip at all, never "0 due".
 */
function lotsDayChip(blocking: number, dueToday: number): string | undefined {
  const checks = dueToday === 1 ? '1 check' : `${dueToday} checks`;
  if (blocking > 0) return dueToday > 0 ? `HP ready · ${checks}` : 'HP ready';
  if (dueToday > 0) return `${checks} today`;
  return undefined;
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

// ── HomeScreen ────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const navigate = useNavigate();
  const [captureOpen, setCaptureOpen] = useState(false);
  const { projectId, isResolving, hasNoProject } = useEffectiveProjectId();

  // ── Foreman today endpoint: ITP checks due ─────────────────────────────────
  const { data: todayData } = useQuery<ForemanTodayPayload>({
    queryKey: queryKeys.foremanBadges(projectId ?? 'default'),
    queryFn: () =>
      apiFetch<ForemanTodayPayload>(
        `/api/dashboard/projects/${encodeURIComponent(projectId!)}/foreman/today`,
      ),
    enabled: !!projectId,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  // The foreman's day, split: hold points ready to lift vs routine checks due.
  const blockingCount = todayData?.blocking?.length ?? 0;
  const dueTodayCount = todayData?.dueToday?.length ?? 0;
  const lotsChip = lotsDayChip(blockingCount, dueTodayCount);

  // ── Today's diary: the canonical by-date endpoint (full relations), the
  // same one the diary path uses — `?missing=null` returns null (not 404)
  // when the day hasn't started. The previous list-style URL didn't exist,
  // so the hero always showed 0%.
  const todayKey = new Intl.DateTimeFormat('en-CA').format(new Date()); // YYYY-MM-DD
  const { data: todayDiaryData } = useQuery<DailyDiary | null>({
    queryKey: [...queryKeys.diaries(projectId ?? 'default'), todayKey],
    queryFn: () =>
      apiFetch<DailyDiary | null>(
        `/api/diary/${encodeURIComponent(projectId!)}/${todayKey}?missing=null`,
      ),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const todayDiary: DailyDiary | null = todayDiaryData ?? null;
  const diaryHeroState = computeDiaryHero(todayDiary);

  // ── Pending dockets count ─────────────────────────────────────────────────
  const { data: docketData } = useQuery<DocketListResponse>({
    queryKey: queryKeys.dockets(projectId ?? 'default', 'pending_approval'),
    queryFn: () =>
      apiFetch<DocketListResponse>(
        withProjectQuery('/api/dockets', projectId, { status: 'pending_approval' }),
      ),
    enabled: !!projectId,
    staleTime: 2 * 60_000,
  });
  const pendingDockets = docketData?.data?.length;

  // ── Open NCR count ────────────────────────────────────────────────────────
  const { data: ncrData } = useQuery<NcrListResponse>({
    queryKey: [...queryKeys.ncrs(projectId ?? undefined), 'open'],
    queryFn: () =>
      apiFetch<NcrListResponse>(withProjectQuery('/api/ncrs', projectId, { status: 'open' })),
    enabled: !!projectId,
    staleTime: 5 * 60_000,
  });
  const openNcrCount = ncrData?.data?.length;

  // ── Unfiled photos ────────────────────────────────────────────────────────
  // Same hook + query key as /m/photos, so the notice can never disagree with
  // that screen and tapping through lands on a warm cache.
  // ponytail: this pages the whole photo register client-side (no server-side
  // "unfiled" filter exists). Fine at project scale today; if photo counts grow,
  // add `lotId=null` support + a count to GET /api/documents/:projectId rather
  // than approximating here.
  const { unfiledCount } = usePhotosShellData(projectId);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const navTo = (sub: string) => {
    if (projectId) {
      navigate(withProjectQuery(`/m/${sub}`, projectId));
    }
  };

  const diaryPath = withProjectQuery('/m/diary', projectId);

  if (isResolving) {
    // Skeleton state while project resolves
    return (
      <ShellScreen variant="home">
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        <div className="h-[76px] animate-pulse rounded-2xl bg-muted" />
        <div className="h-[76px] animate-pulse rounded-2xl bg-muted" />
        <div className="h-[76px] animate-pulse rounded-2xl bg-muted" />
        <div className="h-[76px] animate-pulse rounded-2xl bg-muted" />
      </ShellScreen>
    );
  }

  if (hasNoProject) {
    // A newly-invited foreman not yet on a project would otherwise see a hub of
    // dead tiles + a camera bar that silently do nothing. Show a guided empty
    // state with a way forward instead (mirrors ForemanMobileDashboard).
    return (
      <ShellScreen variant="home">
        <div className="rounded-2xl border bg-card p-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <ClipboardCheck className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">No Project Assigned</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            You haven&rsquo;t been added to a project yet. Ask your site manager or admin to add you
            to a project team &mdash; then your foreman hub will appear here.
          </p>
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="inline-flex min-h-[48px] touch-manipulation items-center gap-1 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            View Projects
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
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
        {/* Diary hero tile — navigates to the shell diary path */}
        <DiaryHero state={diaryHeroState} onPress={() => navigate(diaryPath)} />

        {/* Occasional job: photos captured without a lot. Appears only while the
            job exists and vanishes when the last one is filed. */}
        {unfiledCount > 0 && (
          <button
            type="button"
            className="shell-notice shell-notice-warn items-center"
            onClick={() => navTo('photos')}
            aria-label={`${unfiledCount} ${unfiledCount === 1 ? 'photo is' : 'photos are'} not on a lot yet — file them`}
          >
            <ImageIcon
              size={20}
              strokeWidth={1.8}
              className="shrink-0 text-warning"
              aria-hidden="true"
            />
            <span>
              <b className="font-semibold">
                {unfiledCount} {unfiledCount === 1 ? 'photo' : 'photos'}{' '}
                {unfiledCount === 1 ? "isn't" : "aren't"} on a lot yet.
              </b>{' '}
              Tap to file them.
            </span>
            <span
              className="ml-auto whitespace-nowrap font-mono text-[11px] font-bold tracking-[0.08em]"
              aria-hidden="true"
            >
              FILE →
            </span>
          </button>
        )}

        {/* Lots tile */}
        <HubTile
          icon={MapPin}
          title="Lots"
          chip={lotsChip}
          onPress={() => navTo('lots')}
          ariaLabel={`Lots${lotsChip ? ` — ${lotsChip}` : ''}`}
        />

        {/* Dockets tile — a chip only while dockets actually await approval. */}
        <HubTile
          icon={FileText}
          title="Dockets"
          chip={pendingDockets ? `${pendingDockets} to approve` : undefined}
          onPress={() => navTo('dockets')}
          ariaLabel={`Dockets${pendingDockets ? ` — ${pendingDockets} to approve` : ''}`}
        />

        {/* Issues tile */}
        <HubTile
          icon={AlertTriangle}
          title="Issues"
          chip={openNcrCount ? `${openNcrCount} open` : undefined}
          onPress={() => navTo('issues')}
          ariaLabel={`Issues${openNcrCount ? ` — ${openNcrCount} open` : ''}`}
        />

        {/* Drawings & Docs — a reference, never a demand: no chip, ever. */}
        <HubTile
          icon={Folder}
          title="Drawings & Docs"
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
