import type { Feature } from 'geojson';
import { describe, expect, it } from 'vitest';

import { featureIntersectsBounds, pointInBounds, type SearchBounds } from './spatialSearch.js';

// A 1km-ish box near Sydney.
const BOX: SearchBounds = { west: 151.0, south: -33.81, east: 151.01, north: -33.8 };

function polygon(coords: number[][]): Feature {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

describe('pointInBounds', () => {
  it('accepts a point inside the box (inclusive edges)', () => {
    expect(pointInBounds(151.005, -33.805, BOX)).toBe(true);
    expect(pointInBounds(151.0, -33.8, BOX)).toBe(true); // corner
  });

  it('rejects a point outside the box', () => {
    expect(pointInBounds(151.02, -33.805, BOX)).toBe(false); // east of
    expect(pointInBounds(151.005, -33.9, BOX)).toBe(false); // south of
  });
});

describe('featureIntersectsBounds', () => {
  it('detects a polygon fully inside the box', () => {
    const inside = polygon([
      [151.002, -33.808],
      [151.004, -33.808],
      [151.004, -33.802],
      [151.002, -33.802],
      [151.002, -33.808],
    ]);
    expect(featureIntersectsBounds(inside, BOX)).toBe(true);
  });

  it('detects a polygon straddling the box edge', () => {
    const straddling = polygon([
      [150.995, -33.806],
      [151.005, -33.806],
      [151.005, -33.804],
      [150.995, -33.804],
      [150.995, -33.806],
    ]);
    expect(featureIntersectsBounds(straddling, BOX)).toBe(true);
  });

  it('rejects a polygon entirely outside the box', () => {
    const outside = polygon([
      [152.0, -34.0],
      [152.01, -34.0],
      [152.01, -34.01],
      [152.0, -34.01],
      [152.0, -34.0],
    ]);
    expect(featureIntersectsBounds(outside, BOX)).toBe(false);
  });

  it('handles LineString and Point features', () => {
    const lineIn: Feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [150.99, -33.805],
          [151.005, -33.805],
        ],
      },
    };
    const pointOut: Feature = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [155.0, -30.0] },
    };
    expect(featureIntersectsBounds(lineIn, BOX)).toBe(true);
    expect(featureIntersectsBounds(pointOut, BOX)).toBe(false);
  });

  it('returns false for malformed / missing geometry instead of throwing', () => {
    expect(featureIntersectsBounds(null, BOX)).toBe(false);
    expect(featureIntersectsBounds({}, BOX)).toBe(false);
    expect(featureIntersectsBounds({ geometry: { type: 'Polygon' } }, BOX)).toBe(false);
  });
});
