/**
 * swipePhysics.ts
 *
 * Pure physics helpers for SwipeableCard gesture decisions.
 *
 * Algorithm (WWDC18 "Fluid Interfaces"):
 *   projected = offsetX + velocityX / 2
 *
 * Trigger when:
 *   (a) |projected| >= distanceThreshold  — slow deliberate drag past threshold, OR
 *   (b) |velocityX| >= velocityThreshold
 *       AND |offsetX| >= minOffsetForFlick
 *       AND sign(velocityX) === sign(offsetX)  — fast confident flick
 *
 * Always returns null when the resolved direction has no configured action.
 */

export interface DecideSwipeArgs {
  /** Drag offset from framer-motion onDragEnd info.offset.x */
  offsetX: number;
  /** Drag velocity from framer-motion onDragEnd info.velocity.x (px/s) */
  velocityX: number;
  /** Distance (px) at which a slow drag triggers — mirrors the legacy `threshold` prop. */
  distanceThreshold: number;
  /**
   * Velocity (px/s) at which a fast flick triggers regardless of distance
   * (subject to minOffsetForFlick). Default: 400.
   */
  velocityThreshold?: number;
  /**
   * Minimum |offsetX| required when triggering via velocity alone —
   * prevents a stationary tap-twitch at high velocity from firing.
   * Default: 24.
   */
  minOffsetForFlick?: number;
  /** Whether a left-direction action is configured at all. */
  leftActionConfigured?: boolean;
  /** Whether a right-direction action is configured at all. */
  rightActionConfigured?: boolean;
}

export type SwipeDecision = 'left' | 'right' | null;

export function decideSwipe({
  offsetX,
  velocityX,
  distanceThreshold,
  velocityThreshold = 400,
  minOffsetForFlick = 24,
  leftActionConfigured = true,
  rightActionConfigured = true,
}: DecideSwipeArgs): SwipeDecision {
  // Projected endpoint using the WWDC18 fluid-interfaces formula
  const projected = offsetX + velocityX / 2;

  // Determine candidate direction from projected endpoint
  let direction: 'left' | 'right' | null = null;

  if (projected > 0) {
    direction = 'right';
  } else if (projected < 0) {
    direction = 'left';
  }

  if (direction === null) return null;

  // Condition (a): projected distance exceeds the threshold
  const projectedTrigger = Math.abs(projected) >= distanceThreshold;

  // Condition (b): fast confident flick — velocity high, enough offset, same direction
  const flickTrigger =
    Math.abs(velocityX) >= velocityThreshold &&
    Math.abs(offsetX) >= minOffsetForFlick &&
    Math.sign(velocityX) === Math.sign(offsetX);

  if (!projectedTrigger && !flickTrigger) return null;

  // Gate: only fire if an action is configured for that direction
  if (direction === 'left' && !leftActionConfigured) return null;
  if (direction === 'right' && !rightActionConfigured) return null;

  return direction;
}
