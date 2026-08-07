import { describe, expect, it } from 'vitest';

import type { SheetCornersWgs84 } from '@/pages/projects/settings/planSheetsData';

import { buildSheetSpace, featureToSheet } from './sheetTransform';

const W = 1000;
const H = 500;

// An axis-aligned sheet: top edge along +lng, left edge along -lat.
const square: SheetCornersWgs84 = {
  topLeft: [151.0, -33.8],
  topRight: [151.01, -33.8],
  bottomRight: [151.01, -33.81],
  bottomLeft: [151.0, -33.81],
};

describe('buildSheetSpace', () => {
  it('maps the defining corners to the image corners (y up)', () => {
    const space = buildSheetSpace(square, W, H)!;
    expect(space.toSheet([151.0, -33.8])).toEqual([0, H]); // topLeft
    expect(space.toSheet([151.01, -33.8])).toEqual([W, H]); // topRight
    expect(space.toSheet([151.0, -33.81])).toEqual([0, 0]); // bottomLeft
    expect(space.toSheet([151.01, -33.81])).toEqual([W, 0]); // bottomRight (implied)
  });

  it('maps the sheet centre to the image centre', () => {
    const space = buildSheetSpace(square, W, H)!;
    const [x, y] = space.toSheet([151.005, -33.805]);
    expect(x).toBeCloseTo(W / 2, 6);
    expect(y).toBeCloseTo(H / 2, 6);
  });

  it('handles a rotated sheet (corners not axis-aligned)', () => {
    // Sheet rotated 90°: the top edge runs along +lat.
    const rotated: SheetCornersWgs84 = {
      topLeft: [151.0, -33.81],
      topRight: [151.0, -33.8],
      bottomRight: [151.01, -33.8],
      bottomLeft: [151.01, -33.81],
    };
    const space = buildSheetSpace(rotated, W, H)!;
    expect(space.toSheet([151.0, -33.81])).toEqual([0, H]);
    expect(space.toSheet([151.0, -33.8])).toEqual([W, H]);
    expect(space.toSheet([151.01, -33.81])).toEqual([0, 0]);
    // A point halfway along the rotated top edge lands halfway across the image.
    const [x, y] = space.toSheet([151.0, -33.805]);
    expect(x).toBeCloseTo(W / 2, 6);
    expect(y).toBeCloseTo(H, 6);
  });

  it('returns null for degenerate corners', () => {
    const degenerate: SheetCornersWgs84 = {
      topLeft: [151.0, -33.8],
      topRight: [151.0, -33.8],
      bottomRight: [151.0, -33.8],
      bottomLeft: [151.0, -33.8],
    };
    expect(buildSheetSpace(degenerate, W, H)).toBeNull();
  });
});

describe('featureToSheet', () => {
  it('transforms polygon, line and point coordinates into sheet space', () => {
    const space = buildSheetSpace(square, W, H)!;
    const polygon = featureToSheet(
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [151.0, -33.8],
              [151.01, -33.8],
              [151.005, -33.805],
            ],
          ],
        },
      },
      space,
    );
    expect(polygon.geometry.type).toBe('Polygon');
    const ring = (polygon.geometry as { coordinates: number[][][] }).coordinates[0];
    expect(ring[0]).toEqual([0, H]);
    expect(ring[1]).toEqual([W, H]);
    expect(ring[2][0]).toBeCloseTo(W / 2, 6);
    expect(ring[2][1]).toBeCloseTo(H / 2, 6);

    const point = featureToSheet(
      { type: 'Feature', geometry: { type: 'Point', coordinates: [151.005, -33.805] } },
      space,
    );
    const [px, py] = point.geometry.coordinates as [number, number];
    expect(px).toBeCloseTo(W / 2, 6);
    expect(py).toBeCloseTo(H / 2, 6);
  });
});
