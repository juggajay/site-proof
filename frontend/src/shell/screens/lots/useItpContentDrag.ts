/**
 * useItpContentDrag — the v3 "whole-screen scrub" gesture (refinement #2).
 *
 * A horizontal drag ANYWHERE on the question/content area slides the focus along
 * the checklist, mirroring the dot track live, with a velocity FLING on release
 * (one comfortable thumb stroke + flick traverses several checks — the owner's
 * "thumb never runs out of room" requirement for content dragging).
 *
 * Direction lock (the SwipeableCard idiom): the gesture stays undecided until the
 * pointer moves past DRAG_ENGAGE_PX. A mostly-horizontal move engages the scrub
 * (and we capture the pointer); a mostly-vertical move yields to native scrolling
 * (the zone keeps touch-action: pan-y) and never scrubs. Taps under the threshold
 * pass straight through to buttons/photos inside the card.
 *
 * All math lives in itpTrackPhysics (contentFracFromDrag / projectFling /
 * resolveDragAxis) so it is unit-tested without jsdom pointer events. This hook is
 * the thin React wiring: pointer state + the zone's handlers.
 *
 * Reduced motion: the fling is disabled (vx forced to 0 → direct positioning).
 */
import { useCallback, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  contentFracFromDrag,
  releaseVelocity,
  resolveDragAxis,
  settleRelease,
  smoothVelocity,
  type DragAxis,
} from './itpTrackPhysics';

interface UseItpContentDragArgs {
  /** Number of checklist items (for clamping). */
  count: number;
  /** The currently-landed index — the fraction a fresh drag starts from. */
  currentIndex: number;
  /** Commit the landed index after a fling/release. */
  onCommit: (index: number) => void;
  /** Live fractional position while dragging (or null when idle). */
  onScrubChange: (frac: number | null) => void;
}

export interface ItpContentDragHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function useItpContentDrag({
  count,
  currentIndex,
  onCommit,
  onScrubChange,
}: UseItpContentDragArgs): {
  handlers: ItpContentDragHandlers;
  /** Attach to the zone element — installs the native touchmove guard below. */
  zoneRef: (node: HTMLDivElement | null) => void;
  /** True once a horizontal scrub has engaged (suppress the click that follows). */
  engaged: boolean;
} {
  const prefersReduced = useReducedMotion();
  const [engaged, setEngaged] = useState(false);

  const stateRef = useRef({
    active: false,
    axis: 'undecided' as DragAxis,
    startX: 0,
    startY: 0,
    startFrac: 0,
    lastX: 0,
    lastT: 0,
    vx: 0,
    zoneWidth: 1,
    pointerId: -1,
  });

  const zoneNodeRef = useRef<HTMLDivElement | null>(null);

  // Native NON-PASSIVE touchmove guard. React attaches its touch listeners
  // passively, so no synthetic handler can cancel a touchmove. Without this,
  // the zone's touch-action: pan-y still permits the browser to start a native
  // vertical scroll on a slightly diagonal swipe — even AFTER our direction
  // lock chose horizontal — at which point it fires pointercancel and the
  // scrub dies mid-gesture. Which side wins that race varies by device and
  // finger angle: the exact "carousel works on one phone, dead on another"
  // failure. Pointer events dispatch before their touch counterparts, so the
  // lock is already resolved when this runs: once horizontal, every touchmove
  // default is cancelled and the browser can never steal the gesture; while
  // undecided or vertical, defaults pass through and page scrolling is intact.
  const guardTouchMove = useCallback((e: TouchEvent) => {
    const s = stateRef.current;
    if (s.active && s.axis === 'horizontal' && e.cancelable) e.preventDefault();
  }, []);

  const zoneRef = useCallback(
    (node: HTMLDivElement | null) => {
      zoneNodeRef.current?.removeEventListener('touchmove', guardTouchMove);
      zoneNodeRef.current = node;
      node?.addEventListener('touchmove', guardTouchMove, { passive: false });
    },
    [guardTouchMove],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (count <= 1) return;
      const s = stateRef.current;
      s.active = true;
      s.axis = 'undecided';
      s.startX = s.lastX = e.clientX;
      s.startY = e.clientY;
      s.startFrac = currentIndex;
      s.vx = 0;
      s.lastT = performance.now();
      s.zoneWidth = e.currentTarget.getBoundingClientRect().width || 1;
      s.pointerId = e.pointerId;
    },
    [count, currentIndex],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = stateRef.current;
      if (!s.active) return;

      // Resolve direction lock the first time we cross the threshold.
      if (s.axis === 'undecided') {
        const axis = resolveDragAxis(e.clientX - s.startX, e.clientY - s.startY);
        if (axis === 'undecided') return; // still a tap / not enough intent
        s.axis = axis;
        if (axis === 'vertical') {
          // Yield to native vertical scrolling — abandon the scrub for this drag.
          s.active = false;
          return;
        }
        // Horizontal intent: engage. Capture so we keep receiving moves even if
        // the finger leaves the zone, and suppress the trailing click.
        setEngaged(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* jsdom can't capture — safe to ignore */
        }
      }

      if (s.axis !== 'horizontal') return;

      const now = performance.now();
      // Velocity in px/ms (the mock's vx units), exponentially smoothed — raw
      // per-sample velocity is too noisy on real touch hardware to fling on.
      const sample = (e.clientX - s.lastX) / Math.max(1, now - s.lastT);
      s.vx = smoothVelocity(s.vx, sample);
      s.lastX = e.clientX;
      s.lastT = now;

      const f = contentFracFromDrag({
        startFrac: s.startFrac,
        startX: s.startX,
        x: e.clientX,
        zoneWidth: s.zoneWidth,
        count,
      });
      onScrubChange(f);
    },
    [count, onScrubChange],
  );

  const finish = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = stateRef.current;
      if (!s.active && s.axis !== 'horizontal') {
        // Vertical or never-engaged drag: nothing to commit.
        s.active = false;
        return;
      }
      const wasHorizontal = s.axis === 'horizontal';
      s.active = false;
      s.axis = 'undecided';
      if (!wasHorizontal) return;

      onScrubChange(null);
      const f = contentFracFromDrag({
        startFrac: s.startFrac,
        startX: s.startX,
        x: e.clientX,
        zoneWidth: s.zoneWidth,
        count,
      });
      // Release rule (settleRelease): fling projection + directional commit so
      // a deliberate quarter-item drag advances even with a stopped finger.
      // Velocity is zeroed when the finger rested before lift (stale guard) and
      // for reduced motion (direct positioning, no fling).
      const vx = prefersReduced ? 0 : releaseVelocity(s.vx, performance.now() - s.lastT);
      const landed = settleRelease(s.startFrac, f, vx, count);
      onCommit(landed);
      // Let the suppressed-click flag clear after this event loop tick.
      setTimeout(() => setEngaged(false), 0);
    },
    [count, prefersReduced, onCommit, onScrubChange],
  );

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    },
    zoneRef,
    engaged,
  };
}
