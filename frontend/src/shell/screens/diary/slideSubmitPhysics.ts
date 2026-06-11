/**
 * slideSubmitPhysics.ts — Pure decision function for the slide-to-submit gesture.
 *
 * Physics from docs/research/12-mobile-overhaul-playbook-2026-06.md §2
 * (parameter table, SwipeableCard/SwipeableCard rows):
 *
 *   projected = offset + velocity / 2        (WWDC18 projection, decel 0.998)
 *   commit when projected ≥ ~85% of trackWidth
 *      OR   (velocity ≥ 400 px/s AND offset ≥ 24 px)
 *
 * Spring-back (settle):
 *   { type: 'spring', stiffness: 400, damping: 40, velocity: info.velocity.x }
 *
 * These values are exported so tests can exercise them directly without mounting
 * the framer-motion drag component.
 */

/** Physics constants lifted from the playbook §2 parameter table. */
export const SLIDE_PHYSICS = {
  /** Fraction of track width that the projected position must exceed to commit. */
  COMMIT_THRESHOLD_RATIO: 0.85,
  /** Minimum velocity (px/s) for a flick commit (regardless of position). */
  FLICK_VELOCITY_PX_S: 400,
  /** Minimum offset (px) for a velocity-based flick commit. */
  FLICK_MIN_OFFSET_PX: 24,
  /** Spring stiffness for the settle-back animation. */
  SPRING_STIFFNESS: 400,
  /** Spring damping for the settle-back animation. */
  SPRING_DAMPING: 40,
  /** Knob diameter in pixels (54px from the mock). */
  KNOB_SIZE_PX: 54,
  /** Padding on each side of the track (5px from the mock). */
  TRACK_PADDING_PX: 5,
} as const;

/**
 * Returns true when the gesture should commit and trigger submission.
 *
 * @param offset   Current drag offset in px (positive = rightward).
 * @param velocity Drag release velocity in px/s (positive = rightward).
 * @param trackWidth  Total available track width in px (container width).
 */
export function shouldCommitSlide(offset: number, velocity: number, trackWidth: number): boolean {
  // Projection: WWDC18 formula
  const projected = offset + velocity / 2;
  const threshold = trackWidth * SLIDE_PHYSICS.COMMIT_THRESHOLD_RATIO;

  // Slow drag past 85% of track
  if (projected >= threshold) return true;

  // Flick commit: high velocity with enough initial offset
  if (
    velocity >= SLIDE_PHYSICS.FLICK_VELOCITY_PX_S &&
    offset >= SLIDE_PHYSICS.FLICK_MIN_OFFSET_PX
  ) {
    return true;
  }

  return false;
}

/**
 * Returns the effective track width given the outer slider container width.
 * The knob occupies KNOB_SIZE_PX + 2×TRACK_PADDING_PX of the left side when at rest.
 */
export function effectiveTrackWidth(containerWidth: number): number {
  return containerWidth - SLIDE_PHYSICS.KNOB_SIZE_PX - 2 * SLIDE_PHYSICS.TRACK_PADDING_PX;
}
