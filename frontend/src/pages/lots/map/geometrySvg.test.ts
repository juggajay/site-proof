import { describe, expect, it } from 'vitest';

import { geometryToSvgPath } from './geometrySvg';
import type { GeoJsonFeature } from './lotMapData';

function polygon(coords: number[][]): GeoJsonFeature {
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } };
}

describe('geometryToSvgPath', () => {
  it('returns null for empty/unsupported geometry', () => {
    expect(geometryToSvgPath(null)).toBeNull();
    expect(geometryToSvgPath(undefined)).toBeNull();
    expect(
      geometryToSvgPath({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [] } }),
    ).toBeNull();
  });

  it('projects a square polygon into a closed, padded path', () => {
    // A tiny geographic square near the equator (cos(lat) ~ 1 so it stays square).
    const svg = geometryToSvgPath(
      polygon([
        [0, 0],
        [0.001, 0],
        [0.001, 0.001],
        [0, 0.001],
        [0, 0],
      ]),
      { size: 100, padding: 10 },
    );
    expect(svg).not.toBeNull();
    expect(svg!.kind).toBe('polygon');
    expect(svg!.viewBox).toBe('0 0 100 100');
    // Closed path with the ring's 5 vertices (first == last).
    expect(svg!.d.endsWith('Z')).toBe(true);
    expect(svg!.d.startsWith('M')).toBe(true);
    expect((svg!.d.match(/[ML]/g) ?? []).length).toBe(5);

    // Every coordinate sits inside the padded box [10, 90].
    const nums = svg!.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    for (const n of nums) {
      expect(n).toBeGreaterThanOrEqual(10);
      expect(n).toBeLessThanOrEqual(90);
    }
    // A square fills the box on both axes: extents ~ equal and ~ full inner width.
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    expect(Math.abs(spanX - spanY)).toBeLessThan(1);
    expect(spanX).toBeGreaterThan(75);
  });

  it('applies longitude correction: a degree-square narrows in x at high latitude', () => {
    // Equal degree deltas in lng and lat, but at lat ~ -33.87 cos(lat) ~ 0.83,
    // so the projected shape is narrower in x than in y.
    const svg = geometryToSvgPath(
      polygon([
        [151.0, -33.87],
        [151.001, -33.87],
        [151.001, -33.869],
        [151.0, -33.869],
        [151.0, -33.87],
      ]),
      { size: 100, padding: 10 },
    );
    const nums = svg!.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    expect(spanX).toBeLessThan(spanY);
    // cos(-33.87 deg) ~ 0.83 — allow slack for rounding/centring.
    expect(spanX / spanY).toBeGreaterThan(0.7);
    expect(spanX / spanY).toBeLessThan(0.95);
  });

  it('emits an open path for a line and a marker point for a point', () => {
    const line = geometryToSvgPath({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [0.001, 0.001],
        ],
      },
    });
    expect(line!.kind).toBe('line');
    expect(line!.d.includes('Z')).toBe(false);

    const point = geometryToSvgPath({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [151, -33.87] },
    });
    expect(point!.kind).toBe('point');
    expect(point!.d).toBe('');
    expect(point!.point).toEqual({ x: 50, y: 50 });
  });
});
