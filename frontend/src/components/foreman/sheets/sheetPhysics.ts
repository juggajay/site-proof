/**
 * sheetPhysics.ts — pure, side-effect-free decision functions for BottomSheet
 * drag-to-dismiss.
 *
 * Canonical projection formula (WWDC18):
 *   projected = offsetY + velocityY / 2
 *
 * The sheet closes when the projected endpoint passes the dismiss threshold
 * (distanceFraction × sheetHeight).  This means both a fast flick (high
 * velocityY, small offsetY) and a slow deliberate drag (large offsetY,
 * low velocityY) will close the sheet, matching platform-standard behaviour.
 *
 * Additionally, a raw-velocity shortcut closes the sheet immediately when
 * velocityY exceeds velocityThreshold — a quick flick may not produce much
 * offsetY yet, so the shortcut ensures it still dismisses.
 */

export interface DecideSheetCloseArgs {
  /** How far the sheet has been dragged downward (px, positive = down). */
  offsetY: number;
  /** Downward velocity at pointer release (px/s, positive = down). */
  velocityY: number;
  /** Measured height of the sheet panel in px. */
  sheetHeight: number;
  /**
   * Raw velocity shortcut: close immediately when velocityY exceeds this value
   * (px/s downward).
   * @default 450
   */
  velocityThreshold?: number;
  /**
   * Projected-distance threshold as a fraction of sheetHeight.
   * Close when (offsetY + velocityY/2) > distanceFraction × sheetHeight.
   * @default 0.25
   */
  distanceFraction?: number;
}

/**
 * Returns `true` when a drag-end event should trigger sheet dismissal.
 */
export function decideSheetClose({
  offsetY,
  velocityY,
  sheetHeight,
  velocityThreshold = 450,
  distanceFraction = 0.25,
}: DecideSheetCloseArgs): boolean {
  // Ignore upward motion entirely.
  if (offsetY <= 0 && velocityY <= 0) return false;

  // Raw-velocity shortcut: a fast downward flick always dismisses.
  if (velocityY > velocityThreshold) return true;

  // Projection: where will the sheet be if deceleration continues?
  const projected = offsetY + velocityY / 2;
  return projected > distanceFraction * sheetHeight;
}
