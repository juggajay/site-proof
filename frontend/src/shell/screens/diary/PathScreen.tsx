/**
 * PathScreen — the /m/diary guided path.
 *
 * Shows four nodes from REAL diary state for today:
 *   1. Weather       — done when diary has weatherConditions
 *   2. Crew & Plant  — done when any personnel or plant recorded
 *   3. Today's Work  — done when any activities/delays/deliveries/events
 *   4. Review & Submit — done when submitted
 *
 * Node states: done (green), now (amber ring, the suggested next step),
 * todo (plain, not started). Every node is always tappable — the path is
 * guidance, not a gate: each save handler creates the diary row on demand,
 * so a foreman can log work before crew before weather if that's how the
 * day went. Header sub shows "STEP n/4".
 * Submitted diary: all nodes done + read-only state per doc 14.
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #diary
 */

import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { withProjectQuery } from '../../shellPaths';
import { deriveDiaryStepState, crewDescription, workDescription } from './diaryStepState';
import { useDiaryShellData } from './useDiaryShellData';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';

// ── Node component ────────────────────────────────────────────────────────────

interface PathNodeProps {
  num: number;
  title: string;
  description: string;
  status: 'done' | 'now' | 'todo';
  onPress?: () => void;
}

function PathNode({ num, title, description, status, onPress }: PathNodeProps) {
  const isDone = status === 'done';
  const isNow = status === 'now';

  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`${title} — ${isDone ? 'complete' : isNow ? 'in progress' : 'not started'}`}
      className={cn(
        'relative flex w-full items-center gap-3.5 rounded-2xl border px-4 py-[15px] text-left',
        'min-h-[78px] shadow-sm',
        'transition-transform [transition-duration:180ms] [transition-timing-function:cubic-bezier(.32,1.15,.35,1)]',
        'active:scale-[.98]',
        'border-border bg-card',
        isNow && [
          'border-warning',
          'shadow-[0_0_0_3px_hsl(var(--warning)/0.14),0_1px_2px_hsl(24_14%_9%/0.04)]',
        ],
      )}
    >
      {/* Node number / check */}
      <span
        aria-hidden="true"
        className={cn(
          'flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center',
          'rounded-full border-[1.5px] font-mono text-[16px] font-semibold',
          isDone && 'border-success bg-success text-white',
          isNow && 'border-warning bg-warning text-white',
          status === 'todo' && 'border-border bg-secondary text-muted-foreground',
        )}
      >
        {isDone ? <Check size={18} strokeWidth={2.4} /> : num}
      </span>

      {/* Text */}
      <span className="min-w-0 flex-1">
        <span
          className="block text-foreground"
          style={{
            fontFamily: "'IBM Plex Sans Condensed', 'IBM Plex Sans', sans-serif",
            fontSize: 17.5,
            fontWeight: 700,
          }}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-[13px] text-muted-foreground">{description}</span>
      </span>

      <ChevronRight
        size={16}
        className="flex-shrink-0 text-muted-foreground/50"
        aria-hidden="true"
      />
    </button>
  );
}

// ── PathScreen ────────────────────────────────────────────────────────────────

export function PathScreen() {
  const navigate = useNavigate();
  const { projectId } = useEffectiveProjectId();
  const { diary, loading } = useDiaryShellData();

  const stepState = deriveDiaryStepState(diary);
  const stepNum = stepState.allDone ? 4 : stepState.currentStep + 1;

  const navTo = (sub: string) => {
    navigate(withProjectQuery(`/m/diary/${sub}`, projectId));
  };

  // Today date string for sub-line
  const dateStr = new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  // Weather description
  const weatherDesc = diary?.weatherConditions
    ? `${diary.weatherConditions}${diary.temperatureMax != null ? ` · ${diary.temperatureMax}°C` : ''}`
    : "Record today's weather conditions.";

  // Crew description
  const crewDesc = crewDescription(diary);

  // Work description
  const workDesc = workDescription(diary);

  // Review description
  const reviewDesc = stepState.allDone
    ? 'Submitted — diary locked for this day.'
    : 'Review everything, then slide to submit.';

  // Loading skeleton
  if (loading && !diary) {
    return (
      <ShellScreen
        variant="inner"
        title="Daily Diary"
        parent="/m"
        sub={<span className="text-muted-foreground">Loading…</span>}
      >
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[78px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </ShellScreen>
    );
  }

  // Sub-line: date + step counter
  const sub = (
    <span className="flex items-center gap-2">
      <span>{dateStr}</span>
      {!stepState.allDone && (
        <span
          className="font-mono text-[11.5px] font-semibold tracking-[0.12em] text-warning"
          aria-label={`Step ${stepNum} of 4`}
        >
          STEP {stepNum}/4
        </span>
      )}
      {stepState.allDone && (
        <span className="font-mono text-[11.5px] font-semibold tracking-[0.12em] text-success">
          SUBMITTED
        </span>
      )}
    </span>
  );

  // Primary action — what the CTA button at the bottom should say/do
  const primaryLabel = stepState.allDone
    ? null
    : stepState.weather === 'now'
      ? 'Record weather'
      : stepState.crew === 'now'
        ? 'Log crew & plant'
        : stepState.work === 'now'
          ? "Add today's work"
          : 'Review & submit';

  const primaryAction = stepState.allDone
    ? null
    : stepState.weather === 'now'
      ? () => navTo('weather')
      : stepState.crew === 'now'
        ? () => navTo('crew')
        : stepState.work === 'now'
          ? () => navTo('work')
          : () => navTo('review');

  // Dashed connector between nodes
  const Connector = () => (
    <div
      aria-hidden="true"
      className="mx-[20px] my-[-4px] h-5 w-[2px] self-center"
      style={{
        background: 'repeating-linear-gradient(hsl(var(--border)) 0 5px, transparent 5px 10px)',
      }}
    />
  );

  return (
    <ShellScreen
      variant="inner"
      title="Daily Diary"
      parent="/m"
      sub={sub}
      bottom={
        primaryAction ? (
          <div className="shell-cambar">
            <button
              type="button"
              onClick={primaryAction}
              className="shell-cambar-btn"
              aria-label={primaryLabel ?? undefined}
            >
              {primaryLabel}
            </button>
          </div>
        ) : undefined
      }
    >
      {/* Submitted banner */}
      {stepState.allDone && (
        <div className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-[13px] font-semibold text-success">
          <Check size={16} strokeWidth={2.4} />
          Diary submitted — read only for today.
        </div>
      )}

      {/* Path nodes with dashed connectors */}
      <div className="relative flex flex-col">
        <PathNode
          num={1}
          title="Weather"
          description={weatherDesc}
          status={stepState.weather}
          onPress={() => navTo('weather')}
        />
        <Connector />
        <PathNode
          num={2}
          title="Crew & Plant"
          description={crewDesc}
          status={stepState.crew}
          onPress={() => navTo('crew')}
        />
        <Connector />
        <PathNode
          num={3}
          title="Today's Work"
          description={workDesc}
          status={stepState.work}
          onPress={() => navTo('work')}
        />
        <Connector />
        <PathNode
          num={4}
          title="Review & Submit"
          description={reviewDesc}
          status={stepState.review}
          onPress={() => navTo('review')}
        />
      </div>
    </ShellScreen>
  );
}
