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
 */
export function fracFromPointerX(args: FracFromPointerArgs): number {
  const { clientX, trackLeft, trackWidth, count, layout, scrollLeft = 0 } = args;
  if (count <= 1) return 0;

  const pad = layout.padding;

  if (layout.fits) {
    const inner = Math.max(trackWidth - 2 * pad, 1);
    const frac = ((clientX - trackLeft - pad) / inner) * (count - 1);
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
