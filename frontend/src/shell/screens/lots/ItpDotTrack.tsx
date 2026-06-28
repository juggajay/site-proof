/**
 * ItpDotTrack — the owner-approved ITP "dot track scrubber" (v3).
 *
 * A thin horizontal track of dots (one per checklist item in run order), pinned
 * at the TOP of the run screen inside the sticky header (under the sub-line).
 * Replaces linear-only navigation:
 *   1. TAP a dot       → jump to that item (onCommit).
 *   2. HOLD + DRAG the track → fast travel: dots magnify under the finger with
 *      falloff, the focused dot + neighbours show their NUMBER, the whole track
 *      slides toward centre at the extremes so an end dot meets the finger
 *      (edge-meet shift), a dark "N · STATE" BUBBLE sits BELOW the track anchored
 *      to the focused dot (clamped on-screen), and the question content mirrors
 *      live. Release → spring-snap to the nearest item (onCommit).
 *
 * The whole-screen content drag (drag anywhere on the question area) is wired in
 * ItpRunScreen via ItpContentStrip; the track here mirrors that live scrub by
 * receiving an external `scrubFrac` so both gestures share one focus model.
 *
 * Focus is shown with a HALO (a bg gap + neutral ink outline) so the current
 * dot keeps its own state colour and reads as "selected" on every colour — no
 * amber focus ring (v3 refinement #3).
 *
 * All geometry / state decisions are pure functions in itpTrackPhysics.ts; this
 * component is the renderer + pointer/keyboard wiring only.
 *
 * Reduced motion: useReducedMotion → instant positioning (no springs).
 *
 * Reference: docs/design-itp-scrubber-mock.html #itp (v3: top track, halo,
 * bubble-below-anchored-to-dot, whole-screen drag).
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
  trackShiftPx,
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
   * Live fractional scrub position emitted by the TRACK's own gesture (or null
   * when its gesture is idle). The screen forwards this to the content strip.
   */
  onScrubChange?: (frac: number | null) => void;
  /**
   * Live fractional position driven by the WHOLE-SCREEN content drag (or null
   * when that gesture is idle). When set, the track mirrors it (same falloff /
   * numbers / bubble) so both gestures share one focus model. The track's own
   * pointer gesture takes precedence while active.
   */
  externalFrac?: number | null;
}

const STATE_DOT_CLASS: Record<ItpDotState, string> = {
  // Colours come from the shared Quiet Authority tokens (index.css).
  done: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]',
  failed: 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]',
  na: 'bg-secondary text-muted-foreground border border-[hsl(var(--muted-foreground)/0.5)] opacity-60',
  hold: 'bg-secondary text-[hsl(var(--warning))] border-[1.5px] border-[hsl(var(--warning))]',
  review:
    'bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))] border-[1.5px] border-[hsl(var(--warning))]',
  rejected:
    'bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))] border-[1.5px] border-[hsl(var(--destructive))]',
  open: 'bg-card text-foreground border-[1.5px] border-border',
};

/** Dot text colour when a number is shown (white on filled, ink on outlined). */
function numberColor(state: ItpDotState): string {
  return state === 'done' || state === 'failed'
    ? 'hsl(var(--success-foreground))'
    : 'hsl(var(--foreground))';
}

/**
 * HALO focus shadow (v3 refinement #3): a background-coloured gap then a neutral
 * ink ring. Reads as "selected" on top of every state colour (no amber clash)
 * and is the same selected-swatch idiom that works on every colour.
 */
const HALO_SHADOW = '0 0 0 2px hsl(var(--background)), 0 0 0 3.5px hsl(var(--foreground))';

export function ItpDotTrack({
  entries,
  currentIndex,
  onCommit,
  onScrubChange,
  externalFrac = null,
}: ItpDotTrackProps) {
  const prefersReduced = useReducedMotion();
  const count = entries.length;

  const trackRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [viewport, setViewport] = useState(0);
  // Live focus fraction. When not scrubbing it equals currentIndex.
  const [frac, setFrac] = useState(currentIndex);
  const [scrubbing, setScrubbing] = useState(false);
  // Bubble anchor — measured x of the focused dot (clamped on-screen) + its top.
  const [bubble, setBubble] = useState<{ x: number; top: number; index: number } | null>(null);
  // Scroll offset (scroll regime only) so the pointer mapping stays correct.
  const [scrollLeft, setScrollLeft] = useState(0);

  // The whole-screen content drag drives focus too; when it's active and the
  // track isn't being touched directly, mirror its fraction.
  const externalActive = externalFrac !== null && !scrubbing;
  const liveScrubbing = scrubbing || externalActive;

  // Keep focus synced to the landed index whenever neither gesture is active.
  useEffect(() => {
    if (!scrubbing && externalFrac === null) setFrac(currentIndex);
  }, [currentIndex, scrubbing, externalFrac]);

  // Mirror the whole-screen content drag onto the track.
  useEffect(() => {
    if (externalActive && externalFrac !== null) setFrac(externalFrac);
  }, [externalActive, externalFrac]);

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
      else el.scrollTo({ left: target, behavior: liveScrubbing ? 'auto' : 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frac, layout, viewport, count, liveScrubbing, prefersReduced]);

  const focusIndex = snapFrac(frac, count);

  // Position the bubble below the track, anchored to the FOCUSED dot's centre
  // (not the finger), clamped fully on-screen (v3 refinement #4).
  const positionBubble = useCallback(
    (f: number) => {
      const idx = snapFrac(f, count);
      const dotEl = trackRef.current?.children[idx] as HTMLElement | undefined;
      const wrapEl = trackRef.current?.parentElement;
      if (!dotEl || !wrapEl) {
        setBubble({ x: 0, top: 0, index: idx });
        return;
      }
      const dr = dotEl.getBoundingClientRect();
      const wr = wrapEl.getBoundingClientRect();
      const HALF_BUBBLE = 58; // keeps the rounded label fully on-screen
      const vw = typeof window === 'undefined' ? wr.width : window.innerWidth;
      const x = Math.max(HALF_BUBBLE, Math.min(vw - HALF_BUBBLE, dr.left + dr.width / 2));
      setBubble({ x, top: wr.bottom + 6, index: idx });
    },
    [count],
  );

  // Reposition the bubble when the external (content-drag) fraction moves.
  useEffect(() => {
    if (externalActive && externalFrac !== null) positionBubble(externalFrac);
    else if (!scrubbing) setBubble(null);
  }, [externalActive, externalFrac, scrubbing, positionBubble]);

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
      onScrubChange?.(f);
      positionBubble(f);
    },
    [count, layout, scrollLeft, onScrubChange, positionBubble],
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
      setBubble(null);
      onScrubChange?.(null);
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
    [scrubbing, focusIndex, count, layout, scrollLeft, onScrubChange, onCommit],
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

  const bubbleEntry = bubble ? entries[bubble.index] : null;
  // Edge-meet shift: slide the whole track toward centre at the extremes while
  // either gesture is live (the mock's MAX_SHIFT). Disabled for reduced motion.
  const shift = prefersReduced ? 0 : trackShiftPx(frac, count, liveScrubbing);

  return (
    <div className="relative -mx-5 mt-1" style={{ overflow: 'visible' }}>
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

        {/* The wrapper clips horizontally in the scroll regime; the magnified-
            dot headroom + the ≥44px thumb hit zone live as padding ON the track
            element itself, INSIDE this clip box, so a dot scaled to 2.2× and
            lifted never clips at the top (the bug behind "the dots slide behind
            the header") and the pointer surface is a real thumb target. */}
        <div
          ref={scrollRef}
          className={layout.fits ? undefined : 'overflow-x-hidden'}
          style={{ scrollbarWidth: 'none' }}
        >
          <motion.div
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
            className="relative flex cursor-pointer items-end outline-none focus-visible:ring-2 focus-visible:ring-ring"
            animate={{ x: shift }}
            transition={
              prefersReduced
                ? { duration: 0 }
                : liveScrubbing
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 420, damping: 36 }
            }
            style={{
              // Fit regime: dots spread evenly across the measured width with the
              // computed edge padding, so a tap maps 1:1 to the frac formula.
              // Scroll regime: dots pack at their fixed size + gap on a wider strip.
              justifyContent: layout.fits ? 'space-between' : 'flex-start',
              gap: layout.fits ? undefined : layout.gap,
              paddingLeft: layout.padding,
              paddingRight: layout.padding,
              // Headroom for the 2.2× magnified + lifted dot, and a ≥44px-tall
              // pointer surface (TOP_PAD + dot + BOTTOM_PAD).
              paddingTop: TRACK_PHYSICS.TRACK_TOP_PAD_PX,
              paddingBottom: TRACK_PHYSICS.TRACK_BOTTOM_PAD_PX,
              width: layout.fits ? '100%' : layout.contentWidth,
            }}
          >
            {entries.map((entry, i) => {
              const scale = falloffScale(i, frac);
              const showNumber = isNumberVisible(i, frac);
              const isFocus = i === focusIndex;
              const transition = prefersReduced
                ? { duration: 0 }
                : liveScrubbing
                  ? { duration: 0.06 }
                  : TRACK_PHYSICS.SNAP_SPRING;
              // Lift magnified dots upward into the reserved top padding (the #851
              // lift): proportional to how far past resting they are, divided out
              // of the scale so the visual rise is constant.
              const lift = ((scale - 1) * 11) / scale;
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
                    // HALO focus: dot keeps its own colour; a bg gap + neutral ink
                    // outline reads as "selected" on every state colour.
                    boxShadow: isFocus ? HALO_SHADOW : 'none',
                    zIndex: isFocus ? 3 : Math.abs(i - frac) < 1.5 ? 2 : 1,
                  }}
                  animate={{ scale, y: -lift }}
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
          </motion.div>
        </div>
      </div>

      {/* Scrub bubble — dark "N · STATE" BELOW the track, anchored to the focused
          dot (clamped on-screen). Fixed so it can sit just under the header. */}
      {bubble && bubbleEntry && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-30 rounded-[10px] bg-foreground px-3 py-1.5 font-mono text-[13px] font-semibold text-background shadow-lg"
          style={{
            left: bubble.x,
            top: bubble.top,
            transform: 'translate(-50%, 0)',
            whiteSpace: 'nowrap',
          }}
        >
          {bubble.index + 1} · {dotStateLabel(bubbleEntry.state)}
        </div>
      )}
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
    // clobber the strip's translateX. flex-1 lets the strip absorb the zone's
    // spare height so siblings below it sit at the bottom (thumb zone);
    // min-h-0 + overflow-y-auto lets an unusually tall question/criteria cell
    // scroll vertically instead of clipping (the direction lock yields vertical
    // drags to this native scroll).
    <div
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
      style={{ isolation: 'isolate', scrollbarWidth: 'none' }}
    >
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
