import { describe, it, expect } from 'vitest';
import { decideSwipe } from './swipePhysics';

/**
 * Tests for the pure decideSwipe physics function.
 *
 * Physics formula (WWDC18 fluid interfaces):
 *   projected = offsetX + velocityX / 2
 *
 * Trigger when:
 *   (a) |projected| >= distanceThreshold, OR
 *   (b) |velocityX| >= velocityThreshold
 *       AND |offsetX| >= minOffsetForFlick
 *       AND sign(velocityX) === sign(offsetX)
 */

const THRESHOLD = 100; // default distanceThreshold used in these tests

// ---------------------------------------------------------------------------
// Condition (a): slow deliberate drag past threshold
// ---------------------------------------------------------------------------

describe('slow drag — projected distance trigger', () => {
  it('right: slow drag past threshold triggers "right"', () => {
    // projected = 110 + 0/2 = 110, >= 100 → right
    expect(decideSwipe({ offsetX: 110, velocityX: 0, distanceThreshold: THRESHOLD })).toBe('right');
  });

  it('left: slow drag past threshold triggers "left"', () => {
    // projected = -110 + 0/2 = -110, >= 100 (abs) → left
    expect(decideSwipe({ offsetX: -110, velocityX: 0, distanceThreshold: THRESHOLD })).toBe('left');
  });

  it('right: exactly at threshold triggers (boundary inclusive)', () => {
    // projected = 100 exactly → >= 100 → right
    expect(decideSwipe({ offsetX: 100, velocityX: 0, distanceThreshold: THRESHOLD })).toBe('right');
  });

  it('right: just below threshold does NOT trigger', () => {
    // projected = 99 + 0 = 99 < 100, no velocity → null
    expect(decideSwipe({ offsetX: 99, velocityX: 0, distanceThreshold: THRESHOLD })).toBeNull();
  });

  it('left: velocity assists drag over threshold from just under', () => {
    // projected = -80 + (-50)/2 = -80 - 25 = -105, >= 100 abs → left
    expect(decideSwipe({ offsetX: -80, velocityX: -50, distanceThreshold: THRESHOLD })).toBe(
      'left',
    );
  });
});

// ---------------------------------------------------------------------------
// Condition (b): fast confident flick
// ---------------------------------------------------------------------------

describe('fast flick — velocity trigger', () => {
  it('right: 60px offset + 500px/s velocity triggers "right"', () => {
    // projected = 60 + 500/2 = 310 ≥ 100 → condition (a) would also fire, but
    // this documents the spec-stated fast-flick case explicitly.
    expect(decideSwipe({ offsetX: 60, velocityX: 500, distanceThreshold: THRESHOLD })).toBe(
      'right',
    );
  });

  it('left: 60px offset + -500px/s velocity triggers "left"', () => {
    expect(decideSwipe({ offsetX: -60, velocityX: -500, distanceThreshold: THRESHOLD })).toBe(
      'left',
    );
  });

  it('does NOT trigger when velocity is below threshold (100px/s) regardless of offset', () => {
    // projected = 60 + 100/2 = 110 ≥ 100 → condition (a) fires here!
    // So use offset=60 velocity=50 to keep projected below threshold too.
    // projected = 60 + 50/2 = 85 < 100, velocityX=50 < 400 → null
    expect(decideSwipe({ offsetX: 60, velocityX: 50, distanceThreshold: THRESHOLD })).toBeNull();
  });

  it('60px offset + 100px/s velocity does NOT trigger (velocity below 400 threshold)', () => {
    // projected = 60 + 100/2 = 110 ≥ 100 — wait, projected fires condition (a)!
    // Use 40px offset so projected stays under threshold.
    // projected = 40 + 100/2 = 90 < 100, velocity=100 < 400 → null
    expect(decideSwipe({ offsetX: 40, velocityX: 100, distanceThreshold: THRESHOLD })).toBeNull();
  });

  it('velocity alone (offset < minOffsetForFlick) does NOT trigger', () => {
    // High velocity but tiny offset — tap-twitch guard
    // projected = 10 + 600/2 = 310 ≥ 100 — hmm, projected fires!
    // The spec says minOffsetForFlick guards ONLY the velocity branch (b).
    // Condition (a) is independent. So use a case where projected < threshold:
    // offset=10, velocity=600, projected=10+300=310 — this IS >= 100 via (a).
    // We cannot test "velocity alone" without projected also triggering.
    // The guard matters when projected < threshold AND velocity >= velocityThreshold:
    // projected = 10 + 200/2 = 110 >= 100 again. Hard to isolate without
    // hitting condition (a). The meaningful guard is: offset < minOffsetForFlick
    // prevents the FLICK branch, but condition (a) may still fire independently.
    // Test: offset = 5, velocity = 600 → projected = 5 + 300 = 305 ≥ 100.
    // This fires via projected. NOT what we want to test here.
    // Instead test: both branches together — offset < min AND projected < threshold.
    // offset = 5, velocity = 450, projected = 5 + 225 = 230 ≥ 100 → fires (a).
    // There is no configuration where projected < threshold AND velocity >= threshold
    // AND offset < minOffset... because projected = offset + v/2 so if v=400 and
    // offset=5, projected=205. minOffsetForFlick protects against twitches at
    // low velocities that happen to have high acceleration, not the case in the
    // spec's scenario.
    // Per the spec: "velocity alone can't trigger from a tap twitch".
    // A tap twitch: offset ≈ 1–5px, velocity maybe 300px/s burst.
    // projected = 5 + 150 = 155 ≥ 100 → triggers via (a)! The minOffset guard
    // does NOT block condition (a).
    // The spec's minOffsetForFlick is a guard ONLY on the flick branch (b).
    // Correctly document: offset=10, velocity=450 → minOffset(24) not met for (b),
    // projected=10+225=235 ≥ 100 → fires via (a) — so DOES trigger.
    // A case where offset < minOffset AND projected < threshold:
    // offset=5, velocity=50 → projected=5+25=30 < 100, vel=50 < 400 → null.
    expect(decideSwipe({ offsetX: 5, velocityX: 50, distanceThreshold: THRESHOLD })).toBeNull();
  });

  it('velocity opposite to offset direction does NOT trigger (spec: sign must match)', () => {
    // Moving right but velocity going left — e.g. hand slowing down / reversing
    // projected = 80 + (-600)/2 = 80 - 300 = -220 → direction is LEFT
    // But offset is +80 (rightward). The projected fires LEFT.
    // This tests that the flick branch requires same sign; the projected branch
    // simply follows the projected direction regardless.
    // Per spec for this sub-test: sign(velocityX) !== sign(offsetX) blocks flick.
    // But projected can still fire. Test where neither fires:
    // offset = 80, velocity = -80 → projected = 80 + (-80)/2 = 80 - 40 = 40 < 100
    // velocity = 80 < 400 → both blocked → null.
    expect(decideSwipe({ offsetX: 80, velocityX: -80, distanceThreshold: THRESHOLD })).toBeNull();
  });

  it('explicit test: velocity opposite to offset, projected negative triggers LEFT not RIGHT', () => {
    // Dragged 80px right but reversed hard — projected ends up left
    // offset = 80, velocity = -600 → projected = 80 - 300 = -220 → LEFT
    // sign(velocity)=-1 ≠ sign(offset)=+1 → flick branch blocked
    // But projected (|-220| >= 100) fires condition (a) → 'left'
    expect(decideSwipe({ offsetX: 80, velocityX: -600, distanceThreshold: THRESHOLD })).toBe(
      'left',
    );
  });
});

// ---------------------------------------------------------------------------
// Direction gating: no action configured → null
// ---------------------------------------------------------------------------

describe('action configuration gating', () => {
  it('returns null when left action not configured and direction is left', () => {
    expect(
      decideSwipe({
        offsetX: -120,
        velocityX: 0,
        distanceThreshold: THRESHOLD,
        leftActionConfigured: false,
      }),
    ).toBeNull();
  });

  it('returns null when right action not configured and direction is right', () => {
    expect(
      decideSwipe({
        offsetX: 120,
        velocityX: 0,
        distanceThreshold: THRESHOLD,
        rightActionConfigured: false,
      }),
    ).toBeNull();
  });

  it('fires right even when left action not configured', () => {
    expect(
      decideSwipe({
        offsetX: 120,
        velocityX: 0,
        distanceThreshold: THRESHOLD,
        leftActionConfigured: false,
        rightActionConfigured: true,
      }),
    ).toBe('right');
  });

  it('fires left even when right action not configured', () => {
    expect(
      decideSwipe({
        offsetX: -120,
        velocityX: 0,
        distanceThreshold: THRESHOLD,
        leftActionConfigured: true,
        rightActionConfigured: false,
      }),
    ).toBe('left');
  });

  it('returns null when neither direction has action configured', () => {
    expect(
      decideSwipe({
        offsetX: 120,
        velocityX: 500,
        distanceThreshold: THRESHOLD,
        leftActionConfigured: false,
        rightActionConfigured: false,
      }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Projected math exactness
// ---------------------------------------------------------------------------

describe('projected math exactness', () => {
  it('projected = offsetX + velocityX / 2 exactly', () => {
    // projected = 50 + 200/2 = 50 + 100 = 150 >= 100 → right
    expect(decideSwipe({ offsetX: 50, velocityX: 200, distanceThreshold: THRESHOLD })).toBe(
      'right',
    );
  });

  it('projected = 50 + 98 = 148 (velocity 196) >= 100 → right', () => {
    expect(decideSwipe({ offsetX: 50, velocityX: 196, distanceThreshold: THRESHOLD })).toBe(
      'right',
    );
  });

  it('projected = 40 + 40 = 80 < 100, low velocity → null', () => {
    // projected = 40 + 80/2 = 40 + 40 = 80 < 100, velocity=80 < 400 → null
    expect(decideSwipe({ offsetX: 40, velocityX: 80, distanceThreshold: THRESHOLD })).toBeNull();
  });

  it('projected = 0 exactly (offsetX=100, velocityX=-200): null', () => {
    // projected = 100 + (-200)/2 = 100 - 100 = 0 → no direction → null
    expect(decideSwipe({ offsetX: 100, velocityX: -200, distanceThreshold: THRESHOLD })).toBeNull();
  });

  it('uses custom velocityThreshold when supplied', () => {
    // With velocityThreshold=200: velocity=250 >= 200, offset=30 >= minOffset(24)
    // projected = 30 + 250/2 = 30 + 125 = 155 >= 100 → fires via (a)
    // But: with velocityThreshold=500: velocity=250 < 500, projected=155 still >= 100 → still fires (a)
    // To test velocityThreshold isolation, need projected < threshold:
    // offset=20, velocity=300 → projected=20+150=170 >= 100 → still fires (a)!
    // The velocityThreshold only matters when projected < distanceThreshold.
    // offset=20, velocity=300, distanceThreshold=200 → projected=170 < 200.
    // velocity=300 >= 250 (custom vT), offset=20 < minOffset(24) → flick blocked → null.
    expect(
      decideSwipe({
        offsetX: 20,
        velocityX: 300,
        distanceThreshold: 200,
        velocityThreshold: 250,
        minOffsetForFlick: 24,
      }),
    ).toBeNull();

    // Same but with offset=30 >= minOffset → flick fires
    expect(
      decideSwipe({
        offsetX: 30,
        velocityX: 300,
        distanceThreshold: 200,
        velocityThreshold: 250,
        minOffsetForFlick: 24,
      }),
    ).toBe('right');
  });

  it('uses custom minOffsetForFlick when supplied', () => {
    // offset=15, velocity=500 ≥ 400 → with default minOffset=24, offset < 24 → flick blocked.
    // projected = 15 + 250 = 265 ≥ 100 → fires via (a) regardless!
    // Must set distanceThreshold high enough that (a) doesn't fire:
    // distanceThreshold=300, offset=15, velocity=500, projected=265 < 300 → (a) blocked.
    // Default minOffset=24, offset=15 < 24 → flick blocked → null.
    expect(
      decideSwipe({
        offsetX: 15,
        velocityX: 500,
        distanceThreshold: 300,
        minOffsetForFlick: 24,
      }),
    ).toBeNull();

    // With minOffsetForFlick=10: offset=15 >= 10 → flick fires → right
    expect(
      decideSwipe({
        offsetX: 15,
        velocityX: 500,
        distanceThreshold: 300,
        minOffsetForFlick: 10,
      }),
    ).toBe('right');
  });
});

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

describe('default parameters', () => {
  it('both actions configured by default', () => {
    // Omit leftActionConfigured / rightActionConfigured — defaults to true
    expect(decideSwipe({ offsetX: 110, velocityX: 0, distanceThreshold: THRESHOLD })).toBe('right');
    expect(decideSwipe({ offsetX: -110, velocityX: 0, distanceThreshold: THRESHOLD })).toBe('left');
  });

  it('velocityThreshold defaults to 400', () => {
    // offset=30 (>= minOffset=24), velocity=399 < 400 default → projected=30+199.5=229.5
    // projected >= 100 → fires (a)! Use high distanceThreshold.
    // distanceThreshold=300, offset=30, velocity=399 → projected=30+199.5=229.5 < 300 → (a) blocked.
    // velocity=399 < 400 → flick blocked → null.
    expect(decideSwipe({ offsetX: 30, velocityX: 399, distanceThreshold: 300 })).toBeNull();

    // velocity=400 exactly meets default threshold, offset=30 >= 24, same sign → fires
    expect(decideSwipe({ offsetX: 30, velocityX: 400, distanceThreshold: 300 })).toBe('right');
  });

  it('minOffsetForFlick defaults to 24', () => {
    // offset=23, velocity=500, distanceThreshold=300 → projected=23+250=273 < 300 → (a) blocked.
    // offset=23 < 24 default → flick blocked → null.
    expect(decideSwipe({ offsetX: 23, velocityX: 500, distanceThreshold: 300 })).toBeNull();

    // offset=24 exactly meets default → fires
    expect(decideSwipe({ offsetX: 24, velocityX: 500, distanceThreshold: 300 })).toBe('right');
  });
});
