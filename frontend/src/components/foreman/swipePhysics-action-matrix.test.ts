/**
 * swipePhysics-action-matrix.test.ts
 *
 * Pins the decideSwipe ↔ callback contract for every real call-site
 * configuration (NCR, Lots, Dockets).
 *
 * The semantics matrix (iOS / call-site convention):
 *
 *   prop          | physical side | swipe direction | decideSwipe result | callback
 *   rightAction   | RIGHT side    | LEFT (neg-x)    | 'left'             | onSwipeRight
 *   leftAction    | LEFT  side    | RIGHT (pos-x)   | 'right'            | onSwipeLeft
 *
 * The SwipeableCard passes to decideSwipe:
 *   leftActionConfigured  = !!onSwipeRight  (leftward drag → right-side action)
 *   rightActionConfigured = !!onSwipeLeft   (rightward drag → left-side action)
 *
 * Coverage gap that was exploited in PR #801: the single-action Lots card
 * (onSwipeRight only, no onSwipeLeft) never exercised the two-action code path.
 * These tests target the two-action NCR/Dockets configurations specifically.
 */

import { describe, it, expect } from 'vitest';
import { decideSwipe } from './swipePhysics';

// ---------------------------------------------------------------------------
// Helper — builds decideSwipe args as SwipeableCard would when given
// the specific call-site's onSwipeRight/onSwipeLeft presence flags.
// ---------------------------------------------------------------------------

function argsForCallSite(opts: {
  hasOnSwipeRight: boolean;
  hasOnSwipeLeft: boolean;
  offsetX: number;
  velocityX?: number;
  threshold?: number;
}) {
  return {
    offsetX: opts.offsetX,
    velocityX: opts.velocityX ?? 0,
    distanceThreshold: opts.threshold ?? 100,
    // iOS convention mapping used by SwipeableCard:
    leftActionConfigured: opts.hasOnSwipeRight, // left drag → rightAction → onSwipeRight
    rightActionConfigured: opts.hasOnSwipeLeft, // right drag → leftAction → onSwipeLeft
  };
}

// ---------------------------------------------------------------------------
// NCR two-action card
//   rightAction = View (onSwipeRight = selectNcr)
//   leftAction  = Copy Link (onSwipeLeft = copyLink)
// ---------------------------------------------------------------------------

describe('NCRMobileList — two-action card (the regression case)', () => {
  it('left swipe past threshold → "left" → maps to onSwipeRight (View/select)', () => {
    const result = decideSwipe(
      argsForCallSite({ hasOnSwipeRight: true, hasOnSwipeLeft: true, offsetX: -120 }),
    );
    // 'left' decision means SwipeableCard fires onSwipeRight (View)
    expect(result).toBe('left');
  });

  it('right swipe past threshold → "right" → maps to onSwipeLeft (Copy Link)', () => {
    const result = decideSwipe(
      argsForCallSite({ hasOnSwipeRight: true, hasOnSwipeLeft: true, offsetX: 120 }),
    );
    // 'right' decision means SwipeableCard fires onSwipeLeft (Copy Link)
    expect(result).toBe('right');
  });

  it('left swipe below threshold → null → springs back (no action)', () => {
    const result = decideSwipe(
      argsForCallSite({ hasOnSwipeRight: true, hasOnSwipeLeft: true, offsetX: -50 }),
    );
    expect(result).toBeNull();
  });

  it('right swipe below threshold → null → springs back (no action)', () => {
    const result = decideSwipe(
      argsForCallSite({ hasOnSwipeRight: true, hasOnSwipeLeft: true, offsetX: 50 }),
    );
    expect(result).toBeNull();
  });

  it('fast left flick (velocity-triggered) → "left" → maps to onSwipeRight (View)', () => {
    // projected = -60 + (-500)/2 = -310 ≥ threshold → 'left'
    const result = decideSwipe(
      argsForCallSite({
        hasOnSwipeRight: true,
        hasOnSwipeLeft: true,
        offsetX: -60,
        velocityX: -500,
      }),
    );
    expect(result).toBe('left');
  });

  it('fast right flick (velocity-triggered) → "right" → maps to onSwipeLeft (Copy Link)', () => {
    // projected = 60 + 500/2 = 310 ≥ threshold → 'right'
    const result = decideSwipe(
      argsForCallSite({
        hasOnSwipeRight: true,
        hasOnSwipeLeft: true,
        offsetX: 60,
        velocityX: 500,
      }),
    );
    expect(result).toBe('right');
  });
});

// ---------------------------------------------------------------------------
// LotMobileList — single-action card (the case that stayed green)
//   rightAction = View (onSwipeRight = navigate)
//   NO leftAction / NO onSwipeLeft
// ---------------------------------------------------------------------------

describe('LotMobileList — single-action card (right-action only)', () => {
  it('left swipe past threshold → "left" → maps to onSwipeRight (View/navigate)', () => {
    // Only onSwipeRight configured: leftActionConfigured=true, rightActionConfigured=false
    const result = decideSwipe(
      argsForCallSite({ hasOnSwipeRight: true, hasOnSwipeLeft: false, offsetX: -120 }),
    );
    expect(result).toBe('left');
  });

  it('right swipe past threshold → null (rightward drag not configured — no onSwipeLeft)', () => {
    const result = decideSwipe(
      argsForCallSite({ hasOnSwipeRight: true, hasOnSwipeLeft: false, offsetX: 120 }),
    );
    // rightActionConfigured = !!onSwipeLeft = false → gated out
    expect(result).toBeNull();
  });

  it('left swipe below threshold → null → springs back', () => {
    const result = decideSwipe(
      argsForCallSite({ hasOnSwipeRight: true, hasOnSwipeLeft: false, offsetX: -50 }),
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DocketApprovalsMobileView — two-action card
//   rightAction = Approve (onSwipeRight = onApprove)
//   leftAction  = Reject  (onSwipeLeft  = onReject)
// ---------------------------------------------------------------------------

describe('DocketApprovalsMobileView — two-action card (approve/reject)', () => {
  it('left swipe past threshold → "left" → maps to onSwipeRight (Approve)', () => {
    const result = decideSwipe(
      argsForCallSite({ hasOnSwipeRight: true, hasOnSwipeLeft: true, offsetX: -120 }),
    );
    expect(result).toBe('left');
  });

  it('right swipe past threshold → "right" → maps to onSwipeLeft (Reject)', () => {
    const result = decideSwipe(
      argsForCallSite({ hasOnSwipeRight: true, hasOnSwipeLeft: true, offsetX: 120 }),
    );
    expect(result).toBe('right');
  });

  it('no swipe → null', () => {
    const result = decideSwipe(
      argsForCallSite({ hasOnSwipeRight: true, hasOnSwipeLeft: true, offsetX: 0 }),
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cross-call-site parity: the NCR and Dockets two-action configs are
// structurally identical (both have both actions). Verify that identical
// offset inputs produce the same decideSwipe output for both.
// ---------------------------------------------------------------------------

describe('two-action card parity: NCR and Dockets configs are equivalent', () => {
  const cases: Array<[string, number, 'left' | 'right' | null]> = [
    ['large negative offset', -150, 'left'],
    ['exactly at threshold', -100, 'left'],
    ['just under threshold', -99, null],
    ['exactly at threshold positive', 100, 'right'],
    ['just under threshold positive', 99, null],
    ['large positive offset', 150, 'right'],
    ['zero offset', 0, null],
  ];

  for (const [label, offsetX, expected] of cases) {
    it(`${label}: offsetX=${offsetX} → ${expected}`, () => {
      const ncr = decideSwipe(
        argsForCallSite({ hasOnSwipeRight: true, hasOnSwipeLeft: true, offsetX, threshold: 100 }),
      );
      const dockets = decideSwipe(
        argsForCallSite({ hasOnSwipeRight: true, hasOnSwipeLeft: true, offsetX, threshold: 100 }),
      );
      expect(ncr).toBe(expected);
      expect(dockets).toBe(expected);
    });
  }
});
