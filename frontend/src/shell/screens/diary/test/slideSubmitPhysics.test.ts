/**
 * Tests for slideSubmitPhysics — pure slide-to-submit decision function.
 * Tests the threshold/velocity/physics rules from the playbook §2.
 */

import { describe, it, expect } from 'vitest';
import { shouldCommitSlide, effectiveTrackWidth, SLIDE_PHYSICS } from '../slideSubmitPhysics';

// Typical track width for a 375px wide phone after padding/knob
const CONTAINER_WIDTH = 375 - 40; // 335px container (20px margins each side)
const TRACK_WIDTH = effectiveTrackWidth(CONTAINER_WIDTH);

describe('effectiveTrackWidth', () => {
  it('subtracts knob size and padding from container', () => {
    const result = effectiveTrackWidth(CONTAINER_WIDTH);
    expect(result).toBe(
      CONTAINER_WIDTH - SLIDE_PHYSICS.KNOB_SIZE_PX - 2 * SLIDE_PHYSICS.TRACK_PADDING_PX,
    );
  });
});

describe('shouldCommitSlide — slow drag past threshold', () => {
  it('commits when projected ≥ 85% of trackWidth (no velocity)', () => {
    // offset exactly at the threshold
    const threshold = TRACK_WIDTH * SLIDE_PHYSICS.COMMIT_THRESHOLD_RATIO;
    expect(shouldCommitSlide(threshold, 0, TRACK_WIDTH)).toBe(true);
  });

  it('does NOT commit when projected < 85% of trackWidth', () => {
    const justUnder = TRACK_WIDTH * 0.84;
    expect(shouldCommitSlide(justUnder, 0, TRACK_WIDTH)).toBe(false);
  });

  it('commits when offset + velocity/2 crosses threshold (velocity assist)', () => {
    // offset at 70%, velocity pushes it past 85%
    const offset = TRACK_WIDTH * 0.7;
    const remainingToThreshold = TRACK_WIDTH * SLIDE_PHYSICS.COMMIT_THRESHOLD_RATIO - offset;
    // velocity/2 must be >= remainingToThreshold → velocity = 2 * remaining + 1
    const velocity = 2 * remainingToThreshold + 1;
    expect(shouldCommitSlide(offset, velocity, TRACK_WIDTH)).toBe(true);
  });
});

describe('shouldCommitSlide — flick velocity commit', () => {
  it('commits on flick: velocity ≥ 400 px/s AND offset ≥ 24 px', () => {
    expect(
      shouldCommitSlide(
        SLIDE_PHYSICS.FLICK_MIN_OFFSET_PX,
        SLIDE_PHYSICS.FLICK_VELOCITY_PX_S,
        TRACK_WIDTH,
      ),
    ).toBe(true);
  });

  it('does NOT commit flick when velocity ≥ 400 but offset < 24', () => {
    expect(shouldCommitSlide(23, SLIDE_PHYSICS.FLICK_VELOCITY_PX_S, TRACK_WIDTH)).toBe(false);
  });

  it('does NOT commit flick when offset ≥ 24 but velocity < 400', () => {
    expect(shouldCommitSlide(SLIDE_PHYSICS.FLICK_MIN_OFFSET_PX, 399, TRACK_WIDTH)).toBe(false);
  });

  it('commits high-velocity flick well above threshold', () => {
    expect(shouldCommitSlide(60, 800, TRACK_WIDTH)).toBe(true);
  });
});

describe('shouldCommitSlide — edge cases', () => {
  it('does not commit when offset=0 and velocity=0', () => {
    expect(shouldCommitSlide(0, 0, TRACK_WIDTH)).toBe(false);
  });

  it('handles negative offset (drag backwards) correctly — no commit', () => {
    expect(shouldCommitSlide(-10, 200, TRACK_WIDTH)).toBe(false);
  });

  it('commits at exactly 100% track with zero velocity', () => {
    expect(shouldCommitSlide(TRACK_WIDTH, 0, TRACK_WIDTH)).toBe(true);
  });
});
