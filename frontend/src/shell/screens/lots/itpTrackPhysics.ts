/**
 * itpTrackPhysics.ts — Pure decision functions for the ITP "dot track scrubber".
 *
 * SINGLE SOURCE for every geometric / state decision the scrubber makes, so the
 * React component (ItpDotTrack) stays a thin renderer and every rule is
 * exhaustively unit-tested without mounting framer-motion or jsdom pointer events.
 *
 * Reference implementation: docs/design-itp-scrubber-mock.html  #itp <script>.
 * The feel constants below are lifted verbatim from that owner-approved mock:
 *   - magnification falloff: focus 2.2× / ±1 1.6× / ±2 1.15× / else 1×
 *   - in-bubble numbers visible when dist < 1.5 (focus + immediate neighbours)
 *   - strip translateX(-frac * 100%) model (one card per item, 100% wide each)
 *   - fracFromX = (x - left - pad) / (width - 2*pad) * (N - 1), clamped [0, N-1]
 *   - snap-on-release = Math.round(frac)
 *
 * OWNER HARD REQUIREMENT — dots must NEVER run off-screen horizontally. The
 * layout-fit algorithm computes a dot size + gap that fits all N dots inside the
 * available width, shrinking gap first (floor 4px) then dot size (floor 8px). If
 * even the floors cannot fit, the track becomes scrollable over a content width
 * wider than the viewport, and the scrub maps over that content width (the finger
 * near an edge auto-pans). Edge padding is always ≥ half the max magnified dot so
 * an end dot at focus magnification never clips.
 *
 * The advance-to-next-open decision is intentionally NOT re-implemented here — it
 * lives in lotsShellState.advanceToNextIncomplete (the run's single source) and is
 * re-exported below so callers have one import surface.
 */

import type { ITPChecklistItem, ITPCompletion } from '@/pages/lots/types';
import {
  advanceToNextIncomplete,
  holdPointGateDecision,
  itpCompletionDisposition,
} from './lotsShellState';

// Re-export the run's advance primitive so the scrubber and the run screen share
// ONE source of truth for "next open item" (no duplicate forward/wrap logic).
export { advanceToNextIncomplete };

// ── Feel constants (from the mock) ───────────────────────────────────────────

export const TRACK_PHYSICS = {
  /** Base (un-magnified) dot diameter when the track is NOT space-constrained. */
  BASE_DOT_PX: 13,
  /** Resting gap between dots when not space-constrained. */
  BASE_GAP_PX: 7,
  /** Gap may shrink to this floor before the dot size starts shrinking. */
  MIN_GAP_PX: 4,
  /** Dot size may shrink to this floor; below this the track must scroll. */
  MIN_DOT_PX: 8,
  /** Largest magnification applied to any dot (the focused one). */
  MAX_SCALE: 2.2,
  /** Magnification at the focused dot (dist < 0.5). */
  FOCUS_SCALE: 2.2,
  /** Magnification at the immediate neighbours (dist < 1.5). */
  NEAR_SCALE: 1.6,
  /** Magnification at the next ring out (dist < 2.5). */
  FAR_SCALE: 1.15,
  /** Numbers render inside a dot only while it is this close to the focus. */
  NUMBER_VISIBLE_DIST: 1.5,
  /** Snap-back spring (framer-motion) used on pointer release. */
  SNAP_SPRING: { type: 'spring', stiffness: 360, damping: 34 } as const,

  // ── Whole-screen content drag (the v3 "thumb never runs out of room" model) ──
  /**
   * Inset (px) the finger maps INTO from each bezel before the first / last dot
   * is selected — the mock's INSET. A tap ~40px inside the edge already snaps to
   * the end dot, so a thumb stroke never has to reach the glass edge.
   */
  POINTER_INSET_PX: 42,
  /**
   * Max horizontal shift (px) the whole track slides toward centre at the
   * extremes, so the focused end dot "meets" the finger rather than hugging the
   * bezel — the mock's MAX_SHIFT. Only applied live (while scrubbing).
   */
  MAX_TRACK_SHIFT_PX: 30,
  /**
   * Fling factor: extra fractional items carried per px/ms of release velocity
   * (the mock's `f -= vx * 0.9`). vx is measured in px/ms; one comfortable thumb
   * stroke + flick (~1–2 px/ms) projects several checks forward, satisfying the
   * owner's "thumb never runs out of room" requirement for content dragging.
   */
  FLING_FACTOR: 0.9,
  /**
   * Horizontal movement (px) required before a content drag engages, so taps on
   * buttons/photos inside the card aren't swallowed and vertical scroll passes
   * through. Mirrors the SwipeableCard direction-lock threshold idiom.
   */
  DRAG_ENGAGE_PX: 10,
  /**
   * Directional commit threshold: a slow, deliberate drag that has travelled at
   * least this fraction of one item toward a neighbour COMMITS to it on release
   * even with zero velocity — the carousel "tilt" idiom. Without this, a paused
   * finger at lift (vx ≈ 0) snaps back below 0.5 items and the hold-drag feels
   * dead (the exact failure the owner reported on device).
   */
  COMMIT_FRACTION: 0.25,
  /**
   * Velocity smoothing for the content drag: each move sample blends into the
   * running velocity as `vx = α·sample + (1−α)·vx`. Raw per-sample velocity is
   * far too noisy on real touch hardware to gate a fling on.
   */
  VELOCITY_SMOOTHING: 0.6,
  /**
   * If the pointer has not moved for this long before lift-off, the release
   * velocity is treated as zero (the finger STOPPED — a stale earlier flick
   * must not throw the strip somewhere unintended).
   */
  VELOCITY_STALE_MS: 90,
  /** Reserved headroom (px) INSIDE the track's clip box so a dot magnified to
   *  MAX_SCALE, lifted, never clips at the top (the mock's 22px wrap padding). */
  TRACK_TOP_PAD_PX: 22,
  /** Bottom padding (px) inside the track — with the top pad this gives the
   *  pointer surface a ≥44px thumb target (22 + 13 + 10). */
  TRACK_BOTTOM_PAD_PX: 10,
} as const;

// ── Magnification falloff ────────────────────────────────────────────────────

/**
 * Magnified scale for a dot at index `i` given the fractional focus position.
 * Mirrors the mock exactly: 2.2 / 1.6 / 1.15 / 1 by distance band.
 */
export function falloffScale(index: number, frac: number): number {
  const dist = Math.abs(index - frac);
  if (dist < 0.5) return TRACK_PHYSICS.FOCUS_SCALE;
  if (dist < 1.5) return TRACK_PHYSICS.NEAR_SCALE;
  if (dist < 2.5) return TRACK_PHYSICS.FAR_SCALE;
  return 1;
}

/**
 * Whether dot `i` shows its number inside the bubble at focus `frac`. Only the
 * focused dot and its immediate neighbours (dist < 1.5) carry a number; the rest
 * stay clean dots — matching the mock's "numbers live INSIDE the bubbles" rule.
 */
export function isNumberVisible(index: number, frac: number): boolean {
  return Math.abs(index - frac) < TRACK_PHYSICS.NUMBER_VISIBLE_DIST;
}

// ── Snap ─────────────────────────────────────────────────────────────────────

/** Nearest item index for a fractional scrub position (snap-on-release). */
export function snapFrac(frac: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(Math.round(frac), 0), count - 1);
}

/** Clamp a fractional position into the valid [0, count-1] range. */
export function clampFrac(frac: number, count: number): number {
  if (count <= 1) return 0;
  return Math.min(Math.max(frac, 0), count - 1);
}

// ── Layout fit (the no-overflow guarantee) ───────────────────────────────────

export interface TrackLayout {
  /** Resting dot diameter (px). */
  dotSize: number;
  /** Gap between dots (px). */
  gap: number;
  /** Horizontal edge padding (px) — ≥ half the max magnified dot so ends never clip. */
  padding: number;
  /** Total content width the dots occupy incl. both paddings (px). */
  contentWidth: number;
  /** True when content fits the viewport (fixed track); false → horizontally scrolls. */
  fits: boolean;
}

/**
 * Edge padding required so a dot magnified to MAX_SCALE at either end never
 * clips: half the magnified diameter, with a small safety margin. Padding scales
 * with the (possibly shrunk) dot size so dense tracks don't waste edge space.
 */
export function edgePaddingFor(dotSize: number): number {
  return Math.ceil((dotSize * TRACK_PHYSICS.MAX_SCALE) / 2) + 2;
}

/**
 * Width a run of `count` dots occupies for a given dot size + gap, including the
 * edge padding on both sides. Pure helper used by the fit search and tests.
 */
export function contentWidthFor(count: number, dotSize: number, gap: number): number {
  if (count <= 0) return 0;
  const dots = count * dotSize;
  const gaps = Math.max(count - 1, 0) * gap;
  return dots + gaps + 2 * edgePaddingFor(dotSize);
}

/**
 * Compute the dot size, gap and padding that fit `count` dots inside `viewport`
 * px WITHOUT horizontal overflow — the owner's hard requirement.
 *
 * Strategy (matches the spec):
 *   1. Try the comfortable base (13px dot, 7px gap). If it fits → done.
 *   2. Shrink the GAP down to MIN_GAP_PX. If that fits → done.
 *   3. Shrink the DOT SIZE down to MIN_DOT_PX (gap pinned at floor). If it fits → done.
 *   4. If even (MIN_DOT_PX, MIN_GAP_PX) overflows → not fittable: return the floor
 *      layout with fits=false; the track scrolls over `contentWidth` and the
 *      current item auto-centers.
 *
 * Always returns sane positive numbers (guards count<=0 and tiny viewports).
 */
export function computeTrackLayout(viewport: number, count: number): TrackLayout {
  const { BASE_DOT_PX, BASE_GAP_PX, MIN_GAP_PX, MIN_DOT_PX } = TRACK_PHYSICS;

  if (count <= 0) {
    const dotSize = BASE_DOT_PX;
    return {
      dotSize,
      gap: BASE_GAP_PX,
      padding: edgePaddingFor(dotSize),
      contentWidth: 2 * edgePaddingFor(dotSize),
      fits: true,
    };
  }

  const w = Math.max(viewport, 0);

  // 1+2: comfortable dot, gap shrinking from base to floor.
  for (let gap = BASE_GAP_PX; gap >= MIN_GAP_PX; gap -= 1) {
    if (contentWidthFor(count, BASE_DOT_PX, gap) <= w) {
      const padding = edgePaddingFor(BASE_DOT_PX);
      return {
        dotSize: BASE_DOT_PX,
        gap,
        padding,
        contentWidth: contentWidthFor(count, BASE_DOT_PX, gap),
        fits: true,
      };
    }
  }

  // 3: gap pinned at floor, dot size shrinking from base-1 to floor.
  for (let dot = BASE_DOT_PX - 1; dot >= MIN_DOT_PX; dot -= 1) {
    if (contentWidthFor(count, dot, MIN_GAP_PX) <= w) {
      const padding = edgePaddingFor(dot);
      return {
        dotSize: dot,
        gap: MIN_GAP_PX,
        padding,
        contentWidth: contentWidthFor(count, dot, MIN_GAP_PX),
        fits: true,
      };
    }
  }

  // 4: cannot fit even at floors → scrollable track at the floor layout.
  const padding = edgePaddingFor(MIN_DOT_PX);
  return {
    dotSize: MIN_DOT_PX,
    gap: MIN_GAP_PX,
    padding,
    contentWidth: contentWidthFor(count, MIN_DOT_PX, MIN_GAP_PX),
    fits: false,
  };
}

// ── Pointer → fraction mapping ───────────────────────────────────────────────

export interface FracFromPointerArgs {
  /** Pointer clientX. */
  clientX: number;
  /** The track element's left edge in client coords (getBoundingClientRect().left). */
  trackLeft: number;
  /** The track's on-screen (viewport) width. */
  trackWidth: number;
  /** Number of dots. */
  count: number;
  /** Resolved layout (for padding + content width). */
  layout: TrackLayout;
  /** Current horizontal scroll offset of the track content (0 when it fits). */
  scrollLeft?: number;
}

/**
 * Map a pointer X to a fractional item position [0, count-1].
 *
 * Fit regime (layout.fits): identical to the mock —
 *   frac = (clientX - trackLeft - padding) / (innerWidth) * (count - 1)
 * where innerWidth = trackWidth - 2*padding (the span the dot centres occupy).
 *
 * Scroll regime (!layout.fits): the dots live on a content strip wider than the
 * viewport, panned by `scrollLeft`. We convert the pointer to a CONTENT-space x
 * (add scrollLeft) and map over the content's inner width so a finger near either
 * edge resolves to the dots scrolled into view (the caller auto-pans).
 *
 * INSET (fit regime): the finger maps from POINTER_INSET_PX inside each bezel —
 * the mock's INSET=42 — so the last/first dot is already selected ~40px before
 * the glass edge ("thumb never runs out of room"). The inset is never smaller
 * than the layout's edge padding, so an end dot at focus magnification can't
 * clip. The scroll regime keeps its content-space padding mapping unchanged.
 */
export function fracFromPointerX(args: FracFromPointerArgs): number {
  const { clientX, trackLeft, trackWidth, count, layout, scrollLeft = 0 } = args;
  if (count <= 1) return 0;

  const pad = layout.padding;

  if (layout.fits) {
    // Inset the finger mapping (>= padding so ends never clip).
    const inset = Math.max(pad, TRACK_PHYSICS.POINTER_INSET_PX);
    const inner = Math.max(trackWidth - 2 * inset, 1);
    const frac = ((clientX - trackLeft - inset) / inner) * (count - 1);
    return clampFrac(frac, count);
  }

  // Scroll regime: pointer is over the viewport; convert to content space.
  const contentInner = Math.max(layout.contentWidth - 2 * pad, 1);
  const xInContent = clientX - trackLeft + scrollLeft - pad;
  const frac = (xInContent / contentInner) * (count - 1);
  return clampFrac(frac, count);
}

/**
 * The scrollLeft that horizontally centres item `frac` within `viewport` for a
 * scrollable track, clamped so the strip never reveals padding past its ends.
 * Used both to centre the current item and to follow the finger during a scrub.
 *
 * The item centres are evenly spaced across the content's inner width (the span
 * between the two edge paddings), so item `frac` sits at
 *   x = padding + (frac / (count - 1)) * innerWidth
 * which for the strip-of-equal-cells model is `padding + step * frac`.
 */
export function centerScrollLeft(
  frac: number,
  viewport: number,
  layout: TrackLayout,
  count: number,
): number {
  const pad = layout.padding;
  if (count <= 1) return 0;
  const contentInner = Math.max(layout.contentWidth - 2 * pad, 1);
  const itemX = pad + (contentInner * frac) / (count - 1);
  const target = itemX - viewport / 2;
  const maxScroll = Math.max(layout.contentWidth - viewport, 0);
  return Math.min(Math.max(target, 0), maxScroll);
}

// ── Whole-screen content drag (v3 refinement #2) ─────────────────────────────

export interface ContentDragArgs {
  /** Fractional focus position when the drag began (the landed index). */
  startFrac: number;
  /** Pointer clientX at drag start. */
  startX: number;
  /** Current pointer clientX. */
  x: number;
  /** Width of the drag zone (the content area) in px. */
  zoneWidth: number;
  /** Number of items (for clamping). */
  count: number;
}

/**
 * Fractional focus position for a horizontal content drag, mirroring the mock:
 *   frac = startFrac + (startX - x) / zoneWidth
 * Dragging the content LEFT (x < startX) advances forward (frac increases), like
 * scrolling a strip. One full zone-width of travel moves exactly one item, so a
 * thumb stroke is calibrated to the visible content — the release fling then
 * carries several more (see projectFling).
 *
 * Always clamped into [0, count-1]; degenerate widths resolve to startFrac.
 */
export function contentFracFromDrag(args: ContentDragArgs): number {
  const { startFrac, startX, x, zoneWidth, count } = args;
  if (count <= 1) return 0;
  const w = Math.max(zoneWidth, 1);
  const frac = startFrac + (startX - x) / w;
  return clampFrac(frac, count);
}

/**
 * Project a release into a landed index using carried velocity (the mock's
 * `f -= vx * FLING_FACTOR`). `vx` is in px/ms with the SAME sign convention as a
 * pointer's clientX delta: a leftward flick (content moving left → advancing) has
 * negative vx, so subtracting `vx * factor` ADDS forward items. The result is
 * snapped to the nearest index and clamped to both ends so a hard flick at an
 * extreme never overshoots out of range.
 *
 * Reduced motion: callers pass vx = 0 to disable the fling (direct positioning).
 */
export function projectFling(frac: number, vx: number, count: number): number {
  if (count <= 0) return 0;
  const projected = frac - vx * TRACK_PHYSICS.FLING_FACTOR;
  return snapFrac(projected, count);
}

/**
 * Settle a content-drag release into a landed index — the full release rule:
 *
 *   1. Project the fling: `projected = frac − vx · FLING_FACTOR` (vx px/ms).
 *   2. Snap to the nearest index.
 *   3. DIRECTIONAL COMMIT: if the snap would land back on the starting item but
 *      the drag deliberately travelled ≥ COMMIT_FRACTION of an item toward a
 *      neighbour, commit one step in the drag direction instead — the carousel
 *      "tilt" rule. A slow, paused-finger drag (vx ≈ 0) past a quarter item must
 *      advance, never demoralisingly snap back; tiny wiggles still return home.
 *
 * Clamped to [0, count−1] at both ends. Reduced motion passes vx = 0: the fling
 * is disabled but the directional commit still applies (direct positioning).
 */
export function settleRelease(startFrac: number, frac: number, vx: number, count: number): number {
  if (count <= 0) return 0;
  const projected = frac - vx * TRACK_PHYSICS.FLING_FACTOR;
  let target = Math.round(projected);
  const start = Math.round(startFrac);
  const delta = projected - startFrac;
  if (target === start && Math.abs(delta) >= TRACK_PHYSICS.COMMIT_FRACTION) {
    target = start + Math.sign(delta);
  }
  return Math.min(Math.max(target, 0), count - 1);
}

/**
 * Exponentially-smoothed drag velocity: blends the newest per-move sample into
 * the running value (`α·sample + (1−α)·previous`). Raw per-sample velocities on
 * touch hardware are far too noisy to gate a fling on; smoothing makes a real
 * flick register reliably and a jitter not.
 */
export function smoothVelocity(previous: number, sample: number): number {
  const a = TRACK_PHYSICS.VELOCITY_SMOOTHING;
  return a * sample + (1 - a) * previous;
}

/**
 * Release velocity guard: if the pointer rested for longer than
 * VELOCITY_STALE_MS before lift-off, the finger had STOPPED — treat the carried
 * velocity as zero so an earlier flick can't throw the strip after a pause.
 */
export function releaseVelocity(vx: number, msSinceLastMove: number): number {
  return msSinceLastMove > TRACK_PHYSICS.VELOCITY_STALE_MS ? 0 : vx;
}

export type DragAxis = 'undecided' | 'horizontal' | 'vertical';

/**
 * Direction-lock decision for the content drag (the SwipeableCard idiom): until
 * the pointer has moved `threshold` px in some direction the axis is undecided
 * (taps on buttons/photos stay taps). Past the threshold the DOMINANT axis wins:
 * a mostly-horizontal move engages the scrub; a mostly-vertical move yields to
 * native vertical scrolling (touch-action: pan-y) and never scrubs.
 */
export function resolveDragAxis(
  dx: number,
  dy: number,
  threshold: number = TRACK_PHYSICS.DRAG_ENGAGE_PX,
): DragAxis {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < threshold && ay < threshold) return 'undecided';
  return ax > ay ? 'horizontal' : 'vertical';
}

/**
 * The live edge-meet shift (px) the whole track slides toward centre while
 * scrubbing, so the focused end dot meets the finger instead of hugging the
 * bezel — the mock's `((half - frac) / half) * MAX_SHIFT`. Zero at centre, ±MAX
 * at the ends. Returns 0 when not scrubbing or for a single item.
 */
export function trackShiftPx(frac: number, count: number, scrubbing: boolean): number {
  if (!scrubbing || count <= 1) return 0;
  const half = (count - 1) / 2;
  if (half <= 0) return 0;
  return ((half - frac) / half) * TRACK_PHYSICS.MAX_TRACK_SHIFT_PX;
}

// ── Per-dot run state (colour/semantics) ─────────────────────────────────────

export type ItpDotState = 'done' | 'failed' | 'na' | 'hold' | 'open';

/**
 * Derive the on-track visual state for an item from the run's EXISTING data —
 * no new fetch, no new field. Resolution comes from the completion disposition;
 * an un-released hold-point sign-off item shows as `hold` (locked) even while
 * pending, mirroring holdPointGateDecision. There is deliberately no synthetic
 * "due" state: the instance carries no due dates, so the focused item is
 * highlighted by the focus ring (the mock's `cur` boxShadow), not a fake due ring.
 */
export function dotStateFor(
  item: Pick<ITPChecklistItem, 'pointType' | 'responsibleParty'>,
  completion: ITPCompletion | undefined,
): ItpDotState {
  const disposition = itpCompletionDisposition(completion);
  if (disposition === 'completed') return 'done';
  if (disposition === 'failed') return 'failed';
  if (disposition === 'na') return 'na';
  // pending → distinguish a locked hold point from an ordinary open item.
  const gate = holdPointGateDecision(item, completion);
  if (gate.kind === 'awaiting-release') return 'hold';
  return 'open';
}

/** Short uppercase label for the scrub tooltip ("12 · DONE"). */
export function dotStateLabel(state: ItpDotState): string {
  switch (state) {
    case 'done':
      return 'DONE';
    case 'failed':
      return 'FAILED';
    case 'na':
      return 'N/A';
    case 'hold':
      return 'HOLD';
    case 'open':
    default:
      return 'OPEN';
  }
}

// ── Accessibility ────────────────────────────────────────────────────────────

/**
 * aria-valuetext for the track slider, e.g. "Check 15 of 22, fill compaction —
 * open". Built from the 1-based position, total, item description and state so a
 * screen-reader user gets the same context a sighted scrub gives.
 */
export function trackAriaValueText(
  index: number,
  count: number,
  description: string,
  state: ItpDotState,
): string {
  const pos = snapFrac(index, count) + 1;
  const label = state === 'na' ? 'not applicable' : dotStateLabel(state).toLowerCase();
  const desc = description.trim();
  return desc
    ? `Check ${pos} of ${count}, ${desc} — ${label}`
    : `Check ${pos} of ${count} — ${label}`;
}
