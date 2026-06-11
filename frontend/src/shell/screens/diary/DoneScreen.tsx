/**
 * DoneScreen — /m/diary/done
 *
 * Shell-styled ceremony after successful diary submission.
 * Mirrors the DiaryFinishFlow's SubmitCeremony exactly:
 *   - "confirmed" variant: green tick pop, "Sent to the office."
 *   - "queued"    variant: offline icon, "Diary saved — will send when you're back on signal."
 *
 * Uses framer-motion spring (instant under reduced motion).
 * Android haptic already fired in ReviewScreen at commit point.
 * Auto-returns to /m after 4s or Done button tap.
 *
 * ?queued=1 in the URL switches to the offline variant (same mechanism as
 * the ReviewScreen's offline branch).
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #done
 */

import { useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDiaryShellData } from './useDiaryShellData';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';

const AUTO_DISMISS_MS = 4000;

export function DoneScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { projectId } = useEffectiveProjectId();
  const { diary } = useDiaryShellData();
  const prefersReduced = useReducedMotion();

  const isQueued = searchParams.get('queued') === '1';

  const homePath = projectId ? `/m?projectId=${projectId}` : '/m';

  const handleDone = useCallback(() => {
    navigate(homePath, { replace: true });
  }, [navigate, homePath]);

  // Auto-dismiss after 4s
  useEffect(() => {
    const timer = setTimeout(handleDone, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [handleDone]);

  // Stats from diary
  const activitiesCount = diary?.activities?.length ?? 0;
  const personnelCount = diary?.personnel?.length ?? 0;
  const plantCount = diary?.plant?.length ?? 0;
  const delaysCount = diary?.delays?.length ?? 0;

  // Date label
  const dateLabel = new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  // Spring pop animation — instant when reduced motion
  const iconVariants = {
    hidden: { scale: 0.2, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: prefersReduced
        ? ({ duration: 0.01 } as const)
        : ({
            type: 'spring' as const,
            stiffness: 260,
            damping: 20,
          } as const),
    },
  };

  const isConfirmed = !isQueued;

  // Stats line — mono, uppercase, condensed
  const statsLine = [
    activitiesCount > 0 &&
      `${activitiesCount} ${activitiesCount === 1 ? 'ACTIVITY' : 'ACTIVITIES'}`,
    delaysCount > 0 && `${delaysCount} ${delaysCount === 1 ? 'DELAY' : 'DELAYS'}`,
    personnelCount > 0 && `${personnelCount} CREW`,
    plantCount > 0 && `${plantCount} PLANT`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-8 text-center',
        isConfirmed ? 'bg-success' : 'bg-background',
      )}
      data-testid="diary-done-screen"
    >
      {/* Tick / WiFi-off icon */}
      <motion.div
        variants={iconVariants}
        initial="hidden"
        animate="visible"
        className={cn(
          'flex h-[108px] w-[108px] items-center justify-center rounded-full',
          isConfirmed
            ? 'bg-success-foreground/20 shadow-[0_12px_40px_hsl(142_72%_29%/.3)]'
            : 'bg-muted',
        )}
        aria-hidden="true"
      >
        {isConfirmed ? (
          <Check size={54} strokeWidth={2.4} className="text-success-foreground" />
        ) : (
          <WifiOff size={44} strokeWidth={2} className="text-foreground" />
        )}
      </motion.div>

      {/* Day line */}
      <h1
        className={cn('mt-2', isConfirmed ? 'text-success-foreground' : 'text-foreground')}
        style={{
          fontFamily: "'IBM Plex Sans Condensed', 'IBM Plex Sans', sans-serif",
          fontSize: 27,
          fontWeight: 700,
          letterSpacing: '-0.01em',
        }}
      >
        {isConfirmed
          ? `${new Intl.DateTimeFormat('en-AU', { weekday: 'long' }).format(new Date())} — done.`
          : 'Diary saved'}
      </h1>

      {/* Stats mono line */}
      {statsLine && (
        <p
          className={cn(
            'font-mono text-[12.5px]',
            isConfirmed ? 'text-success-foreground/70' : 'text-muted-foreground',
          )}
        >
          {statsLine}
        </p>
      )}

      {/* Copy */}
      <p
        className={cn(
          'text-[14px]',
          isConfirmed ? 'text-success-foreground/80' : 'text-muted-foreground',
        )}
      >
        {isConfirmed
          ? 'Sent to the office. See you tomorrow.'
          : "Diary saved — will send when you're back on signal."}
      </p>

      {/* Date */}
      <p
        className={cn(
          'text-[13px]',
          isConfirmed ? 'text-success-foreground/60' : 'text-muted-foreground/60',
        )}
      >
        {dateLabel}
      </p>

      {/* Done button */}
      <button
        type="button"
        onClick={handleDone}
        className={cn(
          'mt-4 w-full max-w-xs min-h-[56px] rounded-2xl font-semibold text-[17px] touch-manipulation',
          'transition-transform duration-150 active:scale-[.98]',
          isConfirmed
            ? 'bg-success-foreground/20 text-success-foreground'
            : 'bg-secondary text-foreground',
        )}
        data-testid="ceremony-done-button"
      >
        Done
      </button>
    </div>
  );
}
