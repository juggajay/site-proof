/**
 * Exhaustive tests for itpTrackPhysics — the pure decision layer for the ITP dot
 * track scrubber. Covers the mock's feel (falloff, number visibility, snap), the
 * pointer→fraction mapping in BOTH the fit and scroll regimes, the no-overflow
 * layout-fit algorithm across N=12 / N=22 (fit) and N=60 (scroll), centring, the
 * per-dot state derivation (incl. hold-point locking), and the a11y value text.
 */
import { describe, it, expect } from 'vitest';
import {
  TRACK_PHYSICS,
  advanceToNextIncomplete,
  centerScrollLeft,
  clampFrac,
  computeTrackLayout,
  contentFracFromDrag,
  contentWidthFor,
  dotStateFor,
  dotStateLabel,
  edgePaddingFor,
  falloffScale,
  fracFromPointerX,
  isNumberVisible,
  projectFling,
  releaseVelocity,
  resolveDragAxis,
  settleRelease,
  smoothVelocity,
  snapFrac,
  trackAriaValueText,
  trackShiftPx,
  type ItpDotState,
} from '../itpTrackPhysics';
import type { ITPChecklistItem, ITPCompletion } from '@/pages/lots/types';

// Typical phone viewport (375px) minus the screen's 20px side padding ×2,
// but the track is rendered edge-to-edge (-mx-5) so it uses the full 375.
const PHONE_W = 375;

function makeItem(over: Partial<ITPChecklistItem> = {}): ITPChecklistItem {
  return {
    id: 'item-1',
    description: 'Check fill compaction',
    category: 'Earthworks',
    responsibleParty: 'contractor',
    isHoldPoint: false,
    pointType: 'standard',
    evidenceRequired: 'none',
    order: 0,
    ...over,
  };
}

function makeCompletion(over: Partial<ITPCompletion> = {}): ITPCompletion {
  return {
    id: 'c-1',
    checklistItemId: 'item-1',
    isCompleted: false,
    notes: null,
    completedAt: null,
    completedBy: null,
    isVerified: false,
    verifiedAt: null,
    verifiedBy: null,
    attachments: [],
    ...over,
  };
}

// ── falloffScale ──────────────────────────────────────────────────────────────

describe('falloffScale — magnification falloff (mock parity)', () => {
  it('focused dot magnifies to 2.2×', () => {
    expect(falloffScale(5, 5)).toBe(2.2);
    expect(falloffScale(5, 5.2)).toBe(2.2); // dist 0.2 < 0.5
  });

  it('immediate neighbours magnify to 1.6×', () => {
    expect(falloffScale(6, 5)).toBe(1.6); // dist 1
    expect(falloffScale(4, 5)).toBe(1.6);
    expect(falloffScale(5, 6.4)).toBe(1.6); // dist 1.4 < 1.5
  });

  it('±2 ring magnifies to 1.15×', () => {
    expect(falloffScale(7, 5)).toBe(1.15); // dist 2
    expect(falloffScale(5, 7.4)).toBe(1.15); // dist 2.4 < 2.5
  });

  it('far dots stay at 1×', () => {
    expect(falloffScale(10, 5)).toBe(1);
    expect(falloffScale(0, 5)).toBe(1);
    expect(falloffScale(5, 7.5)).toBe(1); // dist exactly 2.5 → 1
  });

  it('boundaries are exclusive on the low side (0.5/1.5/2.5)', () => {
    expect(falloffScale(5, 5.5)).toBe(1.6); // dist exactly .5 → not <.5
    expect(falloffScale(5, 6.5)).toBe(1.15); // dist exactly 1.5 → not <1.5
  });
});

// ── isNumberVisible ───────────────────────────────────────────────────────────

describe('isNumberVisible — numbers on focus + immediate neighbours only', () => {
  it('shows the number on the focused dot and ±1', () => {
    expect(isNumberVisible(5, 5)).toBe(true);
    expect(isNumberVisible(4, 5)).toBe(true);
    expect(isNumberVisible(6, 5)).toBe(true);
  });

  it('hides the number beyond dist 1.5', () => {
    expect(isNumberVisible(7, 5)).toBe(false); // dist 2
    expect(isNumberVisible(5, 6.5)).toBe(false); // dist exactly 1.5 → not <
  });

  it('shows within a fractional 1.5 band', () => {
    expect(isNumberVisible(5, 6.4)).toBe(true); // dist 1.4
  });
});

// ── snapFrac / clampFrac ──────────────────────────────────────────────────────

describe('snapFrac', () => {
  it('rounds to the nearest index', () => {
    expect(snapFrac(5.4, 22)).toBe(5);
    expect(snapFrac(5.6, 22)).toBe(6);
    expect(snapFrac(5.5, 22)).toBe(6); // .5 rounds up
  });
  it('clamps into [0, count-1]', () => {
    expect(snapFrac(-3, 10)).toBe(0);
    expect(snapFrac(99, 10)).toBe(9);
  });
  it('returns 0 for empty', () => {
    expect(snapFrac(3, 0)).toBe(0);
  });
});

describe('clampFrac', () => {
  it('keeps in-range values', () => {
    expect(clampFrac(3.2, 10)).toBe(3.2);
  });
  it('clamps out-of-range', () => {
    expect(clampFrac(-1, 10)).toBe(0);
    expect(clampFrac(50, 10)).toBe(9);
  });
  it('returns 0 for count <= 1', () => {
    expect(clampFrac(5, 1)).toBe(0);
    expect(clampFrac(5, 0)).toBe(0);
  });
});

// ── computeTrackLayout — the no-overflow guarantee ────────────────────────────

describe('computeTrackLayout — fit regime (no horizontal overflow)', () => {
  it('N=12 fits comfortably on a phone with content ≤ viewport', () => {
    const layout = computeTrackLayout(PHONE_W, 12);
    expect(layout.fits).toBe(true);
    expect(layout.contentWidth).toBeLessThanOrEqual(PHONE_W);
    // Comfortable base size preserved when there's room.
    expect(layout.dotSize).toBe(TRACK_PHYSICS.BASE_DOT_PX);
  });

  it('N=22 still fits (gap and/or dot may shrink) without overflow', () => {
    const layout = computeTrackLayout(PHONE_W, 22);
    expect(layout.fits).toBe(true);
    expect(layout.contentWidth).toBeLessThanOrEqual(PHONE_W);
    // Gap never goes below the floor; dot never below its floor.
    expect(layout.gap).toBeGreaterThanOrEqual(TRACK_PHYSICS.MIN_GAP_PX);
    expect(layout.dotSize).toBeGreaterThanOrEqual(TRACK_PHYSICS.MIN_DOT_PX);
  });

  it('shrinks the GAP before the DOT size', () => {
    // A count that fits with base dot only once the gap is below base.
    const layout = computeTrackLayout(PHONE_W, 22);
    if (layout.dotSize === TRACK_PHYSICS.BASE_DOT_PX) {
      expect(layout.gap).toBeLessThanOrEqual(TRACK_PHYSICS.BASE_GAP_PX);
    } else {
      // If the dot had to shrink, the gap must already be pinned at the floor.
      expect(layout.gap).toBe(TRACK_PHYSICS.MIN_GAP_PX);
    }
  });

  it('edge padding is always ≥ half the max magnified dot (ends never clip)', () => {
    const layout = computeTrackLayout(PHONE_W, 22);
    expect(layout.padding).toBeGreaterThanOrEqual((layout.dotSize * TRACK_PHYSICS.MAX_SCALE) / 2);
  });
});

describe('computeTrackLayout — scroll regime (very long templates)', () => {
  it('N=60 cannot fit even at floors → scrolls over a wider content width', () => {
    const layout = computeTrackLayout(PHONE_W, 60);
    expect(layout.fits).toBe(false);
    expect(layout.contentWidth).toBeGreaterThan(PHONE_W);
    // Uses the floor layout.
    expect(layout.dotSize).toBe(TRACK_PHYSICS.MIN_DOT_PX);
    expect(layout.gap).toBe(TRACK_PHYSICS.MIN_GAP_PX);
  });

  it('contentWidthFor matches the layout content width at the floor', () => {
    const layout = computeTrackLayout(PHONE_W, 60);
    expect(layout.contentWidth).toBe(
      contentWidthFor(60, TRACK_PHYSICS.MIN_DOT_PX, TRACK_PHYSICS.MIN_GAP_PX),
    );
  });

  it('the fit/scroll boundary is monotonic — more dots never re-fit', () => {
    let sawScroll = false;
    for (let n = 5; n <= 80; n += 1) {
      const fits = computeTrackLayout(PHONE_W, n).fits;
      if (!fits) sawScroll = true;
      // Once we cross into scroll, we must never report fit again.
      if (sawScroll) expect(fits).toBe(false);
    }
  });

  it('handles degenerate counts and viewports', () => {
    expect(computeTrackLayout(PHONE_W, 0).fits).toBe(true);
    expect(computeTrackLayout(0, 10).fits).toBe(false);
    expect(computeTrackLayout(PHONE_W, 1).fits).toBe(true);
  });
});

describe('edgePaddingFor / contentWidthFor', () => {
  it('padding covers half a max-magnified dot plus margin', () => {
    expect(edgePaddingFor(13)).toBe(Math.ceil((13 * 2.2) / 2) + 2);
  });
  it('content width sums dots + gaps + two paddings', () => {
    expect(contentWidthFor(3, 10, 5)).toBe(3 * 10 + 2 * 5 + 2 * edgePaddingFor(10));
  });
  it('content width of a single dot has no gaps', () => {
    expect(contentWidthFor(1, 10, 5)).toBe(10 + 2 * edgePaddingFor(10));
  });
});

// ── fracFromPointerX ──────────────────────────────────────────────────────────

describe('fracFromPointerX — fit regime (mock parity, inset finger mapping)', () => {
  const count = 22;
  const layout = computeTrackLayout(PHONE_W, count);
  const trackLeft = 0;
  const trackWidth = PHONE_W;
  // The fit regime insets the finger by POINTER_INSET_PX (>= padding) so the
  // first/last dot is selected ~40px before the bezel (#851 kept behavior).
  const inset = Math.max(layout.padding, TRACK_PHYSICS.POINTER_INSET_PX);

  it('insets the finger mapping by POINTER_INSET_PX (>= edge padding)', () => {
    expect(inset).toBe(TRACK_PHYSICS.POINTER_INSET_PX);
    expect(inset).toBeGreaterThanOrEqual(layout.padding);
  });

  it('left inset edge maps to item 0', () => {
    const f = fracFromPointerX({
      clientX: inset,
      trackLeft,
      trackWidth,
      count,
      layout,
    });
    expect(f).toBeCloseTo(0, 5);
  });

  it('the last dot is already selected ~40px before the right bezel', () => {
    const f = fracFromPointerX({
      clientX: trackWidth - inset,
      trackLeft,
      trackWidth,
      count,
      layout,
    });
    expect(f).toBeCloseTo(count - 1, 5);
  });

  it('midpoint maps to the middle item', () => {
    const f = fracFromPointerX({
      clientX: trackWidth / 2,
      trackLeft,
      trackWidth,
      count,
      layout,
    });
    expect(f).toBeCloseTo((count - 1) / 2, 1);
  });

  it('clamps a pointer past either edge', () => {
    expect(fracFromPointerX({ clientX: -100, trackLeft, trackWidth, count, layout })).toBe(0);
    expect(
      fracFromPointerX({ clientX: trackWidth + 100, trackLeft, trackWidth, count, layout }),
    ).toBe(count - 1);
  });

  it('respects a non-zero track left offset', () => {
    const off = 30;
    const f = fracFromPointerX({
      clientX: off + inset,
      trackLeft: off,
      trackWidth,
      count,
      layout,
    });
    expect(f).toBeCloseTo(0, 5);
  });

  it('single item always resolves to 0', () => {
    const one = computeTrackLayout(PHONE_W, 1);
    expect(fracFromPointerX({ clientX: 200, trackLeft, trackWidth, count: 1, layout: one })).toBe(
      0,
    );
  });
});

describe('fracFromPointerX — scroll regime (content-space + auto-pan)', () => {
  const count = 60;
  const layout = computeTrackLayout(PHONE_W, count);
  const trackLeft = 0;
  const trackWidth = PHONE_W;

  it('is the inverse of centerScrollLeft at the item under the finger', () => {
    // Centre item 30, then a finger at the viewport centre should read ~item 30.
    const scrollLeft = centerScrollLeft(30, trackWidth, layout, count);
    const f = fracFromPointerX({
      clientX: trackWidth / 2,
      trackLeft,
      trackWidth,
      count,
      layout,
      scrollLeft,
    });
    expect(f).toBeCloseTo(30, 0);
  });

  it('accounts for scrollLeft so panned dots map correctly', () => {
    const f0 = fracFromPointerX({
      clientX: layout.padding,
      trackLeft,
      trackWidth,
      count,
      layout,
      scrollLeft: 0,
    });
    expect(f0).toBeCloseTo(0, 5);

    // After scrolling one dot+gap step right, the same pointer reads a later item.
    const step = layout.dotSize + layout.gap;
    const fStep = fracFromPointerX({
      clientX: layout.padding,
      trackLeft,
      trackWidth,
      count,
      layout,
      scrollLeft: step,
    });
    expect(fStep).toBeGreaterThan(f0);
  });

  it('clamps within content bounds', () => {
    expect(
      fracFromPointerX({
        clientX: trackWidth + 500,
        trackLeft,
        trackWidth,
        count,
        layout,
        scrollLeft: 0,
      }),
    ).toBeLessThanOrEqual(count - 1);
  });
});

// ── centerScrollLeft ──────────────────────────────────────────────────────────

describe('centerScrollLeft — auto-centre in the scroll regime', () => {
  const count = 60;
  const layout = computeTrackLayout(PHONE_W, count);

  it('clamps to 0 at the start (no negative scroll)', () => {
    expect(centerScrollLeft(0, PHONE_W, layout, count)).toBe(0);
  });

  it('clamps to maxScroll at the end (never reveals past the strip)', () => {
    const maxScroll = layout.contentWidth - PHONE_W;
    expect(centerScrollLeft(count - 1, PHONE_W, layout, count)).toBeCloseTo(maxScroll, 0);
  });

  it('a middle item lands roughly centred', () => {
    const s = centerScrollLeft(30, PHONE_W, layout, count);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(layout.contentWidth - PHONE_W);
  });

  it('returns 0 for a single item', () => {
    expect(centerScrollLeft(0, PHONE_W, layout, 1)).toBe(0);
  });
});

// ── contentFracFromDrag — whole-screen scrub (v3 refinement #2) ───────────────

describe('contentFracFromDrag — frac = startFrac + (startX - x)/zoneWidth', () => {
  const zoneWidth = 360;
  const count = 22;

  it('no movement keeps the starting fraction', () => {
    expect(contentFracFromDrag({ startFrac: 5, startX: 200, x: 200, zoneWidth, count })).toBe(5);
  });

  it('dragging the content LEFT advances forward (frac increases)', () => {
    // x < startX → (startX - x) positive → frac grows.
    const f = contentFracFromDrag({
      startFrac: 5,
      startX: 300,
      x: 300 - zoneWidth,
      zoneWidth,
      count,
    });
    expect(f).toBeCloseTo(6, 5); // exactly one zone-width = one item
  });

  it('dragging the content RIGHT goes backward (frac decreases)', () => {
    const f = contentFracFromDrag({
      startFrac: 5,
      startX: 100,
      x: 100 + zoneWidth,
      zoneWidth,
      count,
    });
    expect(f).toBeCloseTo(4, 5);
  });

  it('a half-zone drag moves half an item', () => {
    const f = contentFracFromDrag({
      startFrac: 10,
      startX: 300,
      x: 300 - zoneWidth / 2,
      zoneWidth,
      count,
    });
    expect(f).toBeCloseTo(10.5, 5);
  });

  it('clamps at both ends (never out of range)', () => {
    expect(
      contentFracFromDrag({ startFrac: 0, startX: 300, x: 300 + zoneWidth * 3, zoneWidth, count }),
    ).toBe(0);
    expect(
      contentFracFromDrag({
        startFrac: count - 1,
        startX: 300,
        x: 300 - zoneWidth * 3,
        zoneWidth,
        count,
      }),
    ).toBe(count - 1);
  });

  it('degenerate width resolves to the start fraction', () => {
    expect(
      contentFracFromDrag({ startFrac: 7, startX: 50, x: 80, zoneWidth: 0, count }),
    ).not.toBeNaN();
  });

  it('single item always resolves to 0', () => {
    expect(contentFracFromDrag({ startFrac: 0, startX: 0, x: 999, zoneWidth, count: 1 })).toBe(0);
  });
});

// ── projectFling — velocity carry on release (one stroke + flick = several) ────

describe('projectFling — frac -= vx * FLING_FACTOR, snapped + clamped', () => {
  const count = 22;

  it('zero velocity lands on the nearest item (no fling)', () => {
    expect(projectFling(7.4, 0, count)).toBe(7);
    expect(projectFling(7.6, 0, count)).toBe(8);
  });

  it('a leftward flick (negative vx) carries FORWARD several items', () => {
    // vx = -2 px/ms → -(-2)*0.9 = +1.8 items projected forward, then snapped.
    expect(projectFling(7, -2, count)).toBe(9); // 7 + 1.8 = 8.8 → 9
  });

  it('a rightward flick (positive vx) carries BACKWARD', () => {
    expect(projectFling(10, 2, count)).toBe(8); // 10 - 1.8 = 8.2 → 8
  });

  it('one comfortable stroke + flick traverses several checks', () => {
    // A real release velocity around 1.5–3 px/ms should move multiple items.
    const moved = Math.abs(projectFling(10, -3, count) - 10);
    expect(moved).toBeGreaterThanOrEqual(2);
  });

  it('clamps a hard flick at the END (no overshoot past the last item)', () => {
    expect(projectFling(count - 1, -50, count)).toBe(count - 1);
  });

  it('clamps a hard flick at the START (no overshoot below item 0)', () => {
    expect(projectFling(0, 50, count)).toBe(0);
  });

  it('uses the documented FLING_FACTOR', () => {
    // frac 5, vx -1 → 5 + 0.9 = 5.9 → 6.
    expect(projectFling(5, -1, count)).toBe(6);
    expect(TRACK_PHYSICS.FLING_FACTOR).toBe(0.9);
  });

  it('returns 0 for an empty list', () => {
    expect(projectFling(3, -5, 0)).toBe(0);
  });
});

// ── settleRelease — fling + directional commit (the release rule) ─────────────

describe('settleRelease — release rule with directional commit', () => {
  const count = 22;

  it('a tiny wiggle with no velocity returns home (no accidental advance)', () => {
    expect(settleRelease(10, 10.1, 0, count)).toBe(10);
    expect(settleRelease(10, 9.9, 0, count)).toBe(10);
  });

  it('a deliberate quarter-item drag with a STOPPED finger commits forward', () => {
    // The owner-reported failure: hold, drag ~0.3 item, pause, lift → must
    // advance, never snap back.
    expect(settleRelease(10, 10.3, 0, count)).toBe(11);
    expect(settleRelease(10, 10.49, 0, count)).toBe(11);
  });

  it('a deliberate quarter-item drag backward commits backward', () => {
    expect(settleRelease(10, 9.7, 0, count)).toBe(9);
  });

  it('below the commit fraction it snaps back', () => {
    expect(settleRelease(10, 10.2, 0, count)).toBe(10); // 0.2 < 0.25
    expect(TRACK_PHYSICS.COMMIT_FRACTION).toBe(0.25);
  });

  it('past the halfway point it lands on the neighbour by plain rounding', () => {
    expect(settleRelease(10, 10.6, 0, count)).toBe(11);
  });

  it('velocity projects further (fling carries several items)', () => {
    // frac 10.4 with a leftward flick (vx −2 px/ms) → 10.4 + 1.8 = 12.2 → 12.
    expect(settleRelease(10, 10.4, -2, count)).toBe(12);
  });

  it('fling clamps at the END (no overshoot past the last item)', () => {
    expect(settleRelease(20, 20.8, -50, count)).toBe(count - 1);
  });

  it('fling clamps at the START', () => {
    expect(settleRelease(1, 0.4, 50, count)).toBe(0);
  });

  it('directional commit also clamps at the ends', () => {
    expect(settleRelease(count - 1, count - 1, 0, count)).toBe(count - 1);
    expect(settleRelease(0, 0, 0, count)).toBe(0);
  });

  it('reduced motion (vx = 0) keeps the directional commit', () => {
    expect(settleRelease(5, 5.3, 0, count)).toBe(6);
  });

  it('returns 0 for an empty list', () => {
    expect(settleRelease(3, 3.4, -5, 0)).toBe(0);
  });
});

// ── smoothVelocity / releaseVelocity — robust release velocity ────────────────

describe('smoothVelocity — exponential blend of move samples', () => {
  it('blends the sample toward the running value with α = VELOCITY_SMOOTHING', () => {
    const a = TRACK_PHYSICS.VELOCITY_SMOOTHING;
    expect(smoothVelocity(0, 2)).toBeCloseTo(a * 2, 6);
    expect(smoothVelocity(2, 0)).toBeCloseTo((1 - a) * 2, 6);
  });

  it('converges to a sustained velocity', () => {
    let v = 0;
    for (let i = 0; i < 20; i++) v = smoothVelocity(v, -3);
    expect(v).toBeCloseTo(-3, 2);
  });

  it('a single jitter spike does not dominate', () => {
    // Steady slow drag (−0.2) with one wild spike (−5) — the smoothed value
    // stays far below the spike.
    let v = 0;
    for (let i = 0; i < 10; i++) v = smoothVelocity(v, -0.2);
    v = smoothVelocity(v, -5);
    expect(Math.abs(v)).toBeLessThan(3.2);
  });
});

describe('releaseVelocity — stale guard (the finger STOPPED)', () => {
  it('keeps fresh velocity', () => {
    expect(releaseVelocity(-2, 16)).toBe(-2);
    expect(releaseVelocity(-2, TRACK_PHYSICS.VELOCITY_STALE_MS)).toBe(-2);
  });

  it('zeroes velocity after a pre-lift pause', () => {
    expect(releaseVelocity(-2, TRACK_PHYSICS.VELOCITY_STALE_MS + 1)).toBe(0);
    expect(releaseVelocity(3, 500)).toBe(0);
  });
});

// ── resolveDragAxis — direction lock (SwipeableCard idiom) ─────────────────────

describe('resolveDragAxis — engage horizontal only after horizontal intent', () => {
  it('is undecided below the engage threshold in both axes', () => {
    expect(resolveDragAxis(5, 4)).toBe('undecided');
    expect(resolveDragAxis(-9, 9)).toBe('undecided'); // both < 10
  });

  it('locks horizontal when the dominant move is sideways past threshold', () => {
    expect(resolveDragAxis(20, 5)).toBe('horizontal');
    expect(resolveDragAxis(-30, 10)).toBe('horizontal');
  });

  it('locks vertical when the dominant move is up/down past threshold', () => {
    expect(resolveDragAxis(5, 20)).toBe('vertical');
    expect(resolveDragAxis(10, -30)).toBe('vertical');
  });

  it('crosses the threshold on EITHER axis to leave undecided', () => {
    // dx under threshold but dy over → vertical (dominant axis wins).
    expect(resolveDragAxis(3, 15)).toBe('vertical');
    // dx over threshold, dy under → horizontal.
    expect(resolveDragAxis(15, 3)).toBe('horizontal');
  });

  it('ties resolve to vertical (yield to scrolling — ax must strictly exceed ay)', () => {
    expect(resolveDragAxis(20, 20)).toBe('vertical');
  });

  it('honours a custom threshold', () => {
    expect(resolveDragAxis(8, 0, 10)).toBe('undecided');
    expect(resolveDragAxis(8, 0, 5)).toBe('horizontal');
  });

  it('default threshold matches DRAG_ENGAGE_PX', () => {
    expect(TRACK_PHYSICS.DRAG_ENGAGE_PX).toBe(10);
    expect(resolveDragAxis(TRACK_PHYSICS.DRAG_ENGAGE_PX, 0)).toBe('horizontal');
    expect(resolveDragAxis(TRACK_PHYSICS.DRAG_ENGAGE_PX - 1, 0)).toBe('undecided');
  });
});

// ── trackShiftPx — edge-meet shift (#851 kept, extracted pure) ────────────────

describe('trackShiftPx — slide the track toward centre at the extremes', () => {
  const count = 22;

  it('is 0 at the centre', () => {
    expect(trackShiftPx((count - 1) / 2, count, true)).toBeCloseTo(0, 5);
  });

  it('is +MAX_TRACK_SHIFT at the start (slides right so item 0 meets the finger)', () => {
    expect(trackShiftPx(0, count, true)).toBeCloseTo(TRACK_PHYSICS.MAX_TRACK_SHIFT_PX, 5);
  });

  it('is -MAX_TRACK_SHIFT at the end', () => {
    expect(trackShiftPx(count - 1, count, true)).toBeCloseTo(-TRACK_PHYSICS.MAX_TRACK_SHIFT_PX, 5);
  });

  it('is 0 when not scrubbing (no resting shift)', () => {
    expect(trackShiftPx(0, count, false)).toBe(0);
    expect(trackShiftPx(count - 1, count, false)).toBe(0);
  });

  it('is 0 for a single item', () => {
    expect(trackShiftPx(0, 1, true)).toBe(0);
  });

  it('uses MAX_TRACK_SHIFT_PX of 30 (the mock value)', () => {
    expect(TRACK_PHYSICS.MAX_TRACK_SHIFT_PX).toBe(30);
  });
});

// ── dotStateFor / dotStateLabel ───────────────────────────────────────────────

describe('dotStateFor — per-dot state from EXISTING run data', () => {
  it('pending standard item → open', () => {
    expect(dotStateFor(makeItem(), undefined)).toBe('open');
  });

  it('completed → done', () => {
    expect(dotStateFor(makeItem(), makeCompletion({ isCompleted: true }))).toBe('done');
  });

  it('failed → failed', () => {
    expect(dotStateFor(makeItem(), makeCompletion({ isFailed: true }))).toBe('failed');
  });

  it('not applicable → na', () => {
    expect(dotStateFor(makeItem(), makeCompletion({ isNotApplicable: true }))).toBe('na');
  });

  it('pending verification → review, not done', () => {
    expect(
      dotStateFor(
        makeItem(),
        makeCompletion({ isCompleted: true, verificationStatus: 'pending_verification' }),
      ),
    ).toBe('review');
  });

  it('rejected → rejected, not done', () => {
    expect(
      dotStateFor(
        makeItem(),
        makeCompletion({ isCompleted: true, verificationStatus: 'rejected' }),
      ),
    ).toBe('rejected');
  });

  it('un-released hold-point sign-off item → hold (locked)', () => {
    const hp = makeItem({ pointType: 'hold_point', isHoldPoint: true });
    expect(dotStateFor(hp, undefined)).toBe('hold');
  });

  it('released hold-point (still pending) → open (completable)', () => {
    const hp = makeItem({ pointType: 'hold_point', isHoldPoint: true });
    const released = makeCompletion({
      holdPointRelease: {
        releasedByName: 'Super',
        releasedByOrg: 'Council',
        releaseMethod: 'email',
        releasedAt: '2026-06-11',
      },
    });
    expect(dotStateFor(hp, released)).toBe('open');
  });

  it('a completed hold point reads as done, not hold', () => {
    const hp = makeItem({ pointType: 'hold_point', isHoldPoint: true });
    expect(dotStateFor(hp, makeCompletion({ isCompleted: true }))).toBe('done');
  });
});

describe('dotStateLabel — uppercase tooltip labels', () => {
  const cases: [ItpDotState, string][] = [
    ['done', 'DONE'],
    ['failed', 'FAILED'],
    ['na', 'N/A'],
    ['hold', 'HOLD'],
    ['review', 'REVIEW'],
    ['rejected', 'REJECTED'],
    ['open', 'OPEN'],
  ];
  it.each(cases)('%s → %s', (state, label) => {
    expect(dotStateLabel(state)).toBe(label);
  });
});

// ── trackAriaValueText ────────────────────────────────────────────────────────

describe('trackAriaValueText — accessible value text', () => {
  it('builds "Check n of m, description — state"', () => {
    expect(trackAriaValueText(14, 22, 'Classify fill material', 'open')).toBe(
      'Check 15 of 22, Classify fill material — open',
    );
  });

  it('spells out N/A as "not applicable"', () => {
    expect(trackAriaValueText(2, 5, 'Dewatering', 'na')).toBe(
      'Check 3 of 5, Dewatering — not applicable',
    );
  });

  it('omits the description dash when blank', () => {
    expect(trackAriaValueText(0, 3, '   ', 'done')).toBe('Check 1 of 3 — done');
  });

  it('clamps the position into range', () => {
    expect(trackAriaValueText(99, 5, 'X', 'open')).toContain('Check 5 of 5');
  });
});

// ── advanceToNextIncomplete re-export (single source) ─────────────────────────

describe('advanceToNextIncomplete re-export', () => {
  it('is the same function the run screen uses (no duplicate advance logic)', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' }), makeItem({ id: 'c' })];
    const completions = [makeCompletion({ checklistItemId: 'b', isCompleted: true })];
    // From a (idx 0): b is done, so next pending is c (idx 2).
    expect(advanceToNextIncomplete(items, completions, 0)).toBe(2);
    expect(typeof advanceToNextIncomplete).toBe('function');
  });
});
