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
 * GIMP "color to alpha" against white, applied in place to RGBA pixel data.
 * Keys the paper white of a scanned drawing to transparent while preserving the
 * hue of coloured linework (red/blue pens), so only the drawing — not the sheet
 * border or title block whitespace — composites over the map imagery.
 *
 * Per pixel, with target white: alpha = 1 - min(r,g,b)/255 (0 at pure white, 1
 * at fully saturated/dark), then un-premultiply the colour so it stays true once
 * composited: c' = (c - 255·(1-alpha)) / alpha. Kept a pure whole-array pass so
 * it is unit-testable without a canvas and cheap over ~2968×4200 images.
 */
export function whiteToAlpha(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const min = r < g ? (r < b ? r : b) : g < b ? g : b;
    const alpha = 1 - min / 255;
    if (alpha <= 0) {
      data[i + 3] = 0;
      continue;
    }
    // Uint8ClampedArray rounds and clamps assignments to [0,255] for us.
    data[i] = (r - 255 * (1 - alpha)) / alpha;
    data[i + 1] = (g - 255 * (1 - alpha)) / alpha;
    data[i + 2] = (b - 255 * (1 - alpha)) / alpha;
    data[i + 3] = data[i + 3] * alpha;
  }
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
