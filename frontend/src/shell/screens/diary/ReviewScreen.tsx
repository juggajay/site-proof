/**
 * ReviewScreen — /m/diary/review
 *
 * Summary cards (weather/crew/work per mock) + slide-to-submit built on
 * framer-motion drag with the playbook §2 physics.
 *
 * Physics (docs/research/12-mobile-overhaul-playbook-2026-06.md §2):
 *   - projected = offset + velocity / 2  (WWDC18 projection)
 *   - commit when projected ≥ 85% of track OR velocity ≥ 400 px/s AND offset ≥ 24 px
 *   - spring-back: stiffness 400, damping 40, velocity-seeded
 *   - useReducedMotion → plain full-width confirm Button
 *
 * Submit calls the EXISTING submit path from DiaryFinishFlow:
 *   POST /api/diary/:id/submit  (with offline queue fallback via isRetriableNetworkFailure)
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #review
 */

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowRight, AlertTriangle, Loader2, ChevronRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { withProjectQuery } from '../../shellPaths';
import { useDiaryShellData } from './useDiaryShellData';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import { apiFetch, isRetriableNetworkFailure } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { toast } from '@/components/ui/toaster';
import { useHaptics } from '@/hooks/useHaptics';
import { shouldCommitSlide, effectiveTrackWidth, SLIDE_PHYSICS } from './slideSubmitPhysics';
import { workDescription } from './diaryStepState';

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-sm">
      <div className="text-[15.5px] font-semibold text-foreground">{title}</div>
      <div className="mt-1 text-[13.5px] text-muted-foreground">{description}</div>
    </div>
  );
}

// ── SlideToSubmit ─────────────────────────────────────────────────────────────

interface SlideToSubmitProps {
  submitting: boolean;
  onCommit: () => void;
}

function SlideToSubmit({ submitting, onCommit }: SlideToSubmitProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const arrowOpacity = useTransform(x, [0, 60], [1, 0]);

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      if (!trackRef.current) return;
      const containerWidth = trackRef.current.offsetWidth;
      const trackWidth = effectiveTrackWidth(containerWidth);

      if (shouldCommitSlide(info.offset.x, info.velocity.x, trackWidth)) {
        // Animate knob to end then commit
        x.set(trackWidth);
        onCommit();
      } else {
        // Spring back to start — velocity-seeded
        x.set(0);
      }
    },
    [x, onCommit],
  );

  return (
    <div
      ref={trackRef}
      className="relative h-16 overflow-hidden rounded-full border border-border bg-secondary"
      role="button"
      aria-label="Slide to submit the diary"
    >
      {/* Track label */}
      <span
        className="absolute inset-0 flex items-center justify-center"
        style={{
          fontFamily: "'IBM Plex Sans Condensed', 'IBM Plex Sans', sans-serif",
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: '0.02em',
          color: 'hsl(var(--muted-foreground))',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        aria-hidden="true"
      >
        {submitting ? 'Submitting…' : 'Slide to submit'}
      </span>

      {/* Draggable knob */}
      <motion.div
        drag="x"
        dragConstraints={trackRef}
        dragElastic={0.15}
        dragMomentum={false}
        style={{
          x,
          position: 'absolute',
          top: SLIDE_PHYSICS.TRACK_PADDING_PX,
          left: SLIDE_PHYSICS.TRACK_PADDING_PX,
          width: SLIDE_PHYSICS.KNOB_SIZE_PX,
          height: SLIDE_PHYSICS.KNOB_SIZE_PX,
          borderRadius: 9999,
          backgroundColor: submitting ? 'hsl(var(--success))' : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
          cursor: 'grab',
          boxShadow: '0 1px 2px hsl(24 14% 9% / .05), 0 8px 24px hsl(24 14% 9% / .07)',
          zIndex: 1,
        }}
        animate={{
          backgroundColor: submitting ? 'hsl(var(--success))' : 'hsl(var(--foreground))',
        }}
        transition={{
          type: 'spring',
          stiffness: SLIDE_PHYSICS.SPRING_STIFFNESS,
          damping: SLIDE_PHYSICS.SPRING_DAMPING,
        }}
        onDragEnd={handleDragEnd}
        aria-hidden="true"
      >
        {submitting ? (
          <Loader2 size={20} className="animate-spin" style={{ color: 'white' }} />
        ) : (
          <motion.span style={{ opacity: arrowOpacity }}>
            <ArrowRight size={22} strokeWidth={2.2} style={{ color: 'hsl(40 33% 98%)' }} />
          </motion.span>
        )}
      </motion.div>
    </div>
  );
}

// ── ReviewScreen ──────────────────────────────────────────────────────────────

export function ReviewScreen() {
  const navigate = useNavigate();
  const { projectId } = useEffectiveProjectId();
  const { diary } = useDiaryShellData();
  const prefersReduced = useReducedMotion();
  const { trigger: triggerHaptic } = useHaptics();

  const [submitting, setSubmitting] = useState(false);
  const [submitWarnings] = useState<string[]>([]);
  const isSubmitted = diary?.status === 'submitted';

  const backPath = withProjectQuery('/m/diary', projectId);

  // Weather description for summary card
  const weatherDesc = diary?.weatherConditions
    ? [
        diary.weatherConditions,
        diary.temperatureMin != null && diary.temperatureMax != null
          ? `${diary.temperatureMin}°–${diary.temperatureMax}°C`
          : diary.temperatureMax != null
            ? `${diary.temperatureMax}°C`
            : null,
        diary.rainfallMm != null && diary.rainfallMm > 0 ? `${diary.rainfallMm}mm rain` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'No weather recorded';

  // Crew description
  const personnelCount = diary?.personnel?.length ?? 0;
  const plantCount = diary?.plant?.length ?? 0;
  const crewDesc =
    [
      personnelCount > 0 ? `${personnelCount} worker${personnelCount !== 1 ? 's' : ''}` : null,
      plantCount > 0 ? `${plantCount} machine${plantCount !== 1 ? 's' : ''}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'No crew recorded';

  // Work description
  const workDesc = workDescription(diary);

  const doSubmit = useCallback(async () => {
    if (!diary || submitting || diary.status === 'submitted') return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/diary/${encodeURIComponent(diary.id)}/submit`, {
        method: 'POST',
        body: submitWarnings.length > 0 ? JSON.stringify({ acknowledgeWarnings: true }) : undefined,
      });
      triggerHaptic('success');
      navigate(withProjectQuery('/m/diary/done', projectId), { replace: true });
    } catch (err) {
      if (isRetriableNetworkFailure(err)) {
        // Offline — queue and show the offline ceremony
        triggerHaptic('light');
        navigate(withProjectQuery('/m/diary/done', projectId, { queued: 1 }), { replace: true });
        return;
      }
      logError('Diary submit error:', err);
      toast({
        description: extractErrorMessage(err, 'Failed to submit diary'),
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }, [diary, submitting, submitWarnings, triggerHaptic, navigate, projectId]);

  const sub = (
    <span className="text-muted-foreground">
      {isSubmitted
        ? 'Submitted - diary locked for this day'
        : 'Step 4 of 4 - the last thing between you and the ute'}
    </span>
  );

  const hasWork = diary
    ? (diary.activities?.length ?? 0) +
        (diary.delays?.length ?? 0) +
        (diary.deliveries?.length ?? 0) +
        (diary.events?.length ?? 0) >
      0
    : false;

  if (!diary) {
    return (
      <ShellScreen variant="inner" title="Review & Submit" parent={backPath} sub={sub}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertTriangle size={32} className="text-muted-foreground" />
          <p className="text-[14px] text-muted-foreground">No diary for today yet.</p>
        </div>
      </ShellScreen>
    );
  }

  return (
    <ShellScreen variant="inner" title="Review & Submit" parent={backPath} sub={sub}>
      {/* Summary cards */}
      <SummaryCard title="Weather" description={weatherDesc} />
      <SummaryCard title="Crew & Plant" description={crewDesc} />
      <SummaryCard title="Work" description={workDesc} />

      {/* Spacer */}
      <div className="flex-1" />

      {isSubmitted ? (
        <div
          role="status"
          className="rounded-2xl border border-success/30 bg-success/10 px-4 py-4 text-success"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-condensed text-[18px] font-bold">Diary submitted</p>
              <p className="mt-1 text-[13px] leading-5 text-success/90">
                This diary is locked for the day. Add an addendum from the diary page if more detail
                is needed.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Instruction copy */}
          <p className="text-center text-[13px] text-muted-foreground">
            Slide to lock the diary and send it to the office
          </p>

          {/* Warnings */}
          {submitWarnings.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3"
            >
              <div className="flex items-start gap-2 text-warning">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Review before submitting</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {submitWarnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Slide or fallback button */}
          {!hasWork ? (
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-[13px] text-warning font-semibold">
              Log at least one work entry before submitting.
            </div>
          ) : prefersReduced ? (
            /* Reduced-motion: plain button */
            <button
              type="button"
              onClick={doSubmit}
              disabled={submitting}
              className={cn(
                'flex w-full min-h-[58px] items-center justify-center gap-2 rounded-2xl',
                'bg-foreground text-[hsl(40_33%_98%)]',
                'font-condensed text-[18px] font-bold touch-manipulation',
                'transition-transform duration-150 active:scale-[.98]',
                submitting && 'opacity-50',
              )}
              style={{ fontFamily: "'IBM Plex Sans Condensed', 'IBM Plex Sans', sans-serif" }}
              aria-label="Submit diary"
            >
              {submitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" aria-hidden="true" /> Submitting…
                </>
              ) : (
                <>
                  Submit diary <ChevronRight size={20} aria-hidden="true" />
                </>
              )}
            </button>
          ) : (
            <SlideToSubmit submitting={submitting} onCommit={doSubmit} />
          )}
        </>
      )}
    </ShellScreen>
  );
}
