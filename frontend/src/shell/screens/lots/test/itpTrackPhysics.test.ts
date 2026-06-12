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
  contentWidthFor,
  dotStateFor,
  dotStateLabel,
  edgePaddingFor,
  falloffScale,
  fracFromPointerX,
  isNumberVisible,
  snapFrac,
  trackAriaValueText,
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

describe('fracFromPointerX — fit regime (mock parity)', () => {
  const count = 22;
  const layout = computeTrackLayout(PHONE_W, count);
  const trackLeft = 0;
  const trackWidth = PHONE_W;

  it('left padding edge maps to item 0', () => {
    const f = fracFromPointerX({
      clientX: layout.padding,
      trackLeft,
      trackWidth,
      count,
      layout,
    });
    expect(f).toBeCloseTo(0, 5);
  });

  it('right padding edge maps to the last item', () => {
    const f = fracFromPointerX({
      clientX: trackWidth - layout.padding,
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
      clientX: off + layout.padding,
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
