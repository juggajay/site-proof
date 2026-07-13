// Client-side perimeter clip for plan-sheet overlays. The sheet image is drawn
// to an offscreen canvas and clipped to the stored pixel-space perimeter ring so
// only the drawing area (not the whitespace / title block) overlays the map.

export type PixelRing = [number, number][];

// Minimal 2D-context surface the path tracer needs — lets the path math be
// unit-tested with a recording fake instead of a real canvas.
export interface RingPathTarget {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
}

/** Trace a pixel-space ring as a path: moveTo the first vertex, lineTo the rest, close. */
export function traceRingPath(ctx: RingPathTarget, ring: PixelRing): void {
  ring.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/**
 * Clip a decoded image to the perimeter ring, returning a same-size canvas that
 * is transparent outside the ring. Falls back to an unclipped draw when a 2D
 * context is unavailable.
 */
export function clipImageToPerimeter(
  source: CanvasImageSource,
  width: number,
  height: number,
  perimeter: PixelRing,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.save();
  ctx.beginPath();
  traceRingPath(ctx, perimeter);
  ctx.clip();
  ctx.drawImage(source, 0, 0, width, height);
  ctx.restore();
  return canvas;
}
