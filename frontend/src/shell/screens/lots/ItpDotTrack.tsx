/**
 * ItpDotTrack — the owner-approved ITP "dot track scrubber".
 *
 * A thin horizontal track of dots (one per checklist item in run order) under the
 * run header. Replaces linear-only navigation:
 *   1. TAP a dot       → jump to that item (onCommit).
 *   2. HOLD + DRAG     → scrub: dots magnify under the finger with falloff, the
 *      focused dot + immediate neighbours show their NUMBER inside the bubble, a
 *      dark tooltip above the finger shows "N · STATE", and the QUESTION CONTENT
 *      strip scrolls live in sync (translateX(-frac*100%)). Release → spring-snap
 *      to the nearest item (onCommit).
 *
 * All geometry / state decisions are pure functions in itpTrackPhysics.ts; this
 * component is the renderer + pointer/keyboard wiring only.
 *
 * No-overflow guarantee: computeTrackLayout fits all dots in the measured width
 * (shrinking gap then dot size). If they can't fit even at floors, the track
 * scrolls horizontally, auto-centres the current item (and follows the finger),
 * with edge-fade gradients hinting more dots exist.
 *
 * Reduced motion: useReducedMotion → instant positioning (no springs). Scrubbing
 * still works; the strip just snaps without animating.
 *
 * Reference: docs/design-itp-scrubber-mock.html #itp.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Lock } from 'lucide-react';
import {
  TRACK_PHYSICS,
  computeTrackLayout,
  centerScrollLeft,
  dotStateLabel,
  falloffScale,
  fracFromPointerX,
  isNumberVisible,
  snapFrac,
  trackAriaValueText,
  type ItpDotState,
  type TrackLayout,
} from './itpTrackPhysics';
import type { ITPChecklistItem, ITPCompletion } from '@/pages/lots/types';

export interface ItpDotTrackItem {
  item: ITPChecklistItem;
  completion: ITPCompletion | undefined;
  state: ItpDotState;
}

interface ItpDotTrackProps {
  /** Ordered run items + their derived states (built once by the screen). */
  entries: ItpDotTrackItem[];
  /** The currently-landed item index (the snap target / focus). */
  currentIndex: number;
  /** Commit a jump/snap to an item index (tap or release). */
  onCommit: (index: number) => void;
  /**
   * Live fractional scrub position, or null when not scrubbing. The screen uses
   * this to drive the synced question-content strip and the live CHECK n/m
   * counter. Emitting null signals "scrub ended / not scrubbing".
   */
  onScrubChange?: (frac: number | null) => void;
}

const STATE_DOT_CLASS: Record<ItpDotState, string> = {
  // Colours come from the shared Quiet Authority tokens (index.css).
  done: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]',
  failed: 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]',
  na: 'bg-secondary text-muted-foreground border border-[hsl(var(--muted-foreground)/0.5)] opacity-60',
  hold: 'bg-secondary text-[hsl(var(--warning))] border-[1.5px] border-[hsl(var(--warning))]',
  open: 'bg-card text-foreground border-[1.5px] border-border',
};

/** Dot text colour when a number is shown (white on filled, ink on outlined). */
function numberColor(state: ItpDotState): string {
  return state === 'done' || state === 'failed'
    ? 'hsl(var(--success-foreground))'
    : 'hsl(var(--foreground))';
}

export function ItpDotTrack({ entries, currentIndex, onCommit, onScrubChange }: ItpDotTrackProps) {
  const prefersReduced = useReducedMotion();
  const count = entries.length;

  const trackRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [viewport, setViewport] = useState(0);
  // Live focus fraction. When not scrubbing it equals currentIndex.
  const [frac, setFrac] = useState(currentIndex);
  const [scrubbing, setScrubbing] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; index: number } | null>(null);
  // Scroll offset (scroll regime only) so the pointer mapping stays correct.
  const [scrollLeft, setScrollLeft] = useState(0);

  // Keep focus synced to the landed index whenever we are NOT scrubbing.
  useEffect(() => {
    if (!scrubbing) setFrac(currentIndex);
  }, [currentIndex, scrubbing]);

  // Measure the track width (and re-measure on resize) for the fit algorithm.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setViewport(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout: TrackLayout = useMemo(() => computeTrackLayout(viewport, count), [viewport, count]);

  // Auto-centre the current item in the scroll regime (and follow during scrub).
  useEffect(() => {
    if (layout.fits || viewport <= 0) {
      if (scrollLeft !== 0) setScrollLeft(0);
      return;
    }
    const target = centerScrollLeft(frac, viewport, layout, count);
    setScrollLeft(target);
    const el = scrollRef.current;
    if (el) {
      if (prefersReduced) el.scrollLeft = target;
      else el.scrollTo({ left: target, behavior: scrubbing ? 'auto' : 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frac, layout, viewport, count, scrubbing, prefersReduced]);

  const focusIndex = snapFrac(frac, count);

  const emitScrub = useCallback(
    (next: number | null) => {
      onScrubChange?.(next);
    },
    [onScrubChange],
  );

  const updateFromPointer = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || count === 0) return;
      const rect = el.getBoundingClientRect();
      const f = fracFromPointerX({
        clientX,
        trackLeft: rect.left,
        trackWidth: rect.width,
        count,
        layout,
        scrollLeft,
      });
      setFrac(f);
      emitScrub(f);
      setTooltip({ x: clientX - rect.left, index: snapFrac(f, count) });
    },
    [count, layout, scrollLeft, emitScrub],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (count === 0) return;
      setScrubbing(true);
      try {
        trackRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* setPointerCapture can throw in jsdom — safe to ignore */
      }
      updateFromPointer(e.clientX);
    },
    [count, updateFromPointer],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbing) return;
      updateFromPointer(e.clientX);
    },
    [scrubbing, updateFromPointer],
  );

  const endScrub = useCallback(
    (clientX: number) => {
      if (!scrubbing) return;
      setScrubbing(false);
      setTooltip(null);
      emitScrub(null);
      const el = trackRef.current;
      let landed = focusIndex;
      if (el && count > 0) {
        const rect = el.getBoundingClientRect();
        const f = fracFromPointerX({
          clientX,
          trackLeft: rect.left,
          trackWidth: rect.width,
          count,
          layout,
          scrollLeft,
        });
        landed = snapFrac(f, count);
      }
      setFrac(landed);
      onCommit(landed);
    },
    [scrubbing, focusIndex, count, layout, scrollLeft, emitScrub, onCommit],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => endScrub(e.clientX),
    [endScrub],
  );

  // Keyboard accessibility: arrow keys move prev/next, Home/End jump to ends.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (count === 0) return;
      let next = focusIndex;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(focusIndex + 1, count - 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(focusIndex - 1, 0);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = count - 1;
      else return;
      e.preventDefault();
      setFrac(next);
      onCommit(next);
    },
    [count, focusIndex, onCommit],
  );

  if (count === 0) return null;

  const focusedEntry = entries[focusIndex];
  const ariaValueText = trackAriaValueText(
    focusIndex,
    count,
    focusedEntry?.item.description ?? '',
    focusedEntry?.state ?? 'open',
  );

  const tooltipEntry = tooltip ? entries[tooltip.index] : null;

  return (
    <div className="relative -mx-5">
      {/* ≥40px vertical hit zone via padding even though dots draw small. */}
      <div className="relative" style={{ touchAction: 'none' }}>
        {/* Scroll regime: edge-fade gradients hint more dots exist. */}
        {!layout.fits && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent"
            />
          </>
        )}

        <div ref={scrollRef} className="overflow-x-hidden" style={{ scrollbarWidth: 'none' }}>
          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label="Inspection checks"
            aria-valuemin={1}
            aria-valuemax={count}
            aria-valuenow={focusIndex + 1}
            aria-valuetext={ariaValueText}
            aria-orientation="horizontal"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
            data-testid="itp-dot-track"
            className="relative flex cursor-pointer items-center py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{
              // Fit regime: dots spread evenly across the measured width with the
              // computed edge padding, so a tap maps 1:1 to the frac formula.
              // Scroll regime: dots pack at their fixed size + gap on a wider strip.
              justifyContent: layout.fits ? 'space-between' : 'flex-start',
              gap: layout.fits ? undefined : layout.gap,
              paddingLeft: layout.padding,
              paddingRight: layout.padding,
              width: layout.fits ? '100%' : layout.contentWidth,
            }}
          >
            {entries.map((entry, i) => {
              const scale = falloffScale(i, frac);
              const showNumber = isNumberVisible(i, frac);
              const isFocus = i === focusIndex;
              const transition = prefersReduced
                ? { duration: 0 }
                : scrubbing
                  ? { duration: 0.06 }
                  : TRACK_PHYSICS.SNAP_SPRING;
              return (
                <motion.span
                  key={entry.item.id}
                  aria-hidden
                  className={[
                    'flex flex-shrink-0 items-center justify-center rounded-full',
                    'font-mono font-semibold leading-none',
                    STATE_DOT_CLASS[entry.state],
                  ].join(' ')}
                  style={{
                    width: layout.dotSize,
                    height: layout.dotSize,
                    fontSize: 7,
                    transformOrigin: 'center bottom',
                    boxShadow: isFocus ? '0 0 0 3px hsl(var(--warning) / 0.3)' : 'none',
                  }}
                  animate={{ scale }}
                  transition={transition}
                >
                  {showNumber ? (
                    entry.state === 'hold' ? (
                      <Lock size={Math.max(layout.dotSize * 0.5, 6)} aria-hidden />
                    ) : (
                      <span style={{ color: numberColor(entry.state) }}>{i + 1}</span>
                    )
                  ) : entry.state === 'hold' && layout.dotSize >= 11 ? (
                    <Lock size={Math.max(layout.dotSize * 0.5, 6)} aria-hidden />
                  ) : null}
                </motion.span>
              );
            })}
          </div>
        </div>

        {/* Scrub tooltip — dark "N · STATE" above the finger. */}
        {tooltip && tooltipEntry && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-20 rounded-lg bg-foreground px-2.5 py-1 font-mono text-[12px] font-semibold text-background"
            style={{
              left: tooltip.x,
              top: 0,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {tooltip.index + 1} · {dotStateLabel(tooltipEntry.state)}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ItpContentStrip — the horizontally translating question-content strip, synced
 * to the live scrub fraction (translateX(-frac*100%), the mock's model). One full
 * -width cell per item. Wrapped in its own transform context so the screen's
 * stagger-entry animation never overrides this transform (the mock hit exactly
 * this fight — the parent animates `transform`, so we isolate the strip here).
 */
export function ItpContentStrip({
  count,
  frac,
  scrubbing,
  renderCell,
}: {
  count: number;
  /** Live fractional position (currentIndex when not scrubbing). */
  frac: number;
  scrubbing: boolean;
  renderCell: (index: number) => ReactNode;
}) {
  const prefersReduced = useReducedMotion();
  const cells = Array.from({ length: count }, (_, i) => i);
  const transition = prefersReduced || scrubbing ? { duration: 0 } : TRACK_PHYSICS.SNAP_SPRING;

  return (
    // Isolation wrapper: a fresh stacking/transform context so the parent
    // stagger animation (which animates transform on <main>'s children) cannot
    // clobber the strip's translateX.
    <div className="overflow-hidden" style={{ isolation: 'isolate' }}>
      <motion.div
        className="flex"
        style={{ width: '100%' }}
        animate={{ x: `${-frac * 100}%` }}
        transition={transition}
      >
        {cells.map((i) => (
          <div key={i} className="flex w-full flex-shrink-0 flex-col gap-3">
            {renderCell(i)}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
