import type { Point, Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';

import { AppError } from '../AppError.js';
import { controlLineToWgs84, type ControlPoint } from './controlLineGeometry.js';
import { generateChainageOffsetPolygon, generateChainagePoint } from './lotGeometry.js';
import { wgs84ToLocal } from './crs.js';

const EPSG = 'EPSG:7855'; // GDA2020 MGA zone 55

// A straight control line heading due east on the zone-55 central meridian.
// Chainage 0 at E=500000, chainage 100 at E=500100; both at N=6000000.
const N0 = 6_000_000;
const STRAIGHT: ControlPoint[] = [
  { chainage: 0, easting: 500_000, northing: N0 },
  { chainage: 100, easting: 500_100, northing: N0 },
];

function ringLocal(coords: number[][]): { easting: number; northing: number }[] {
  return coords.map(([lng, lat]) => wgs84ToLocal(EPSG, { lng, lat }));
}

describe('controlLineToWgs84', () => {
  it('sorts by chainage and round-trips each point to its local grid coord', () => {
    const shuffled = [STRAIGHT[1], STRAIGHT[0]];
    const line = controlLineToWgs84(EPSG, shuffled);
    expect(line.geometry.type).toBe('LineString');
    expect(line.geometry.coordinates).toHaveLength(2);

    const local = ringLocal(line.geometry.coordinates);
    expect(local[0].easting).toBeCloseTo(500_000, 2);
    expect(local[1].easting).toBeCloseTo(500_100, 2);
  });

  it('rejects lines with fewer than 2 points', () => {
    expect(() => controlLineToWgs84(EPSG, [STRAIGHT[0]])).toThrowError(AppError);
  });

  it('rejects duplicate chainage', () => {
    expect(() =>
      controlLineToWgs84(EPSG, [
        { chainage: 10, easting: 500_000, northing: N0 },
        { chainage: 10, easting: 500_050, northing: N0 },
      ]),
    ).toThrowError(/duplicate chainage/i);
  });
});

describe('generateChainageOffsetPolygon (golden — straight line)', () => {
  const result = generateChainageOffsetPolygon({
    points: STRAIGHT,
    epsg: EPSG,
    chainageStart: 20,
    chainageEnd: 80,
    offsetLeft: 6,
    offsetRight: 4,
  });

  it('reports the chainage window as lengthM', () => {
    expect(result.lengthM).toBe(60);
  });

  it('computes area ≈ length × total width', () => {
    // 60 m long × (6 + 4) m wide = 600 m².
    expect(result.areaM2).not.toBeNull();
    expect(result.areaM2!).toBeGreaterThan(599);
    expect(result.areaM2!).toBeLessThan(601);
  });

  it('places the four corners at the expected local grid offsets', () => {
    const polygon = result.feature.geometry as Polygon;
    const ring = polygon.coordinates[0];
    expect(ring).toHaveLength(5); // 4 corners + closure
    expect(ring[0]).toEqual(ring[4]); // closed

    // Tangent is +easting, so left (+90°) is +northing, right is −northing.
    // Ring order: leftStart, leftEnd, rightEnd, rightStart.
    const [leftStart, leftEnd, rightEnd, rightStart] = ringLocal(ring.slice(0, 4));
    expect(leftStart.easting).toBeCloseTo(500_020, 1);
    expect(leftStart.northing).toBeCloseTo(N0 + 6, 1);
    expect(leftEnd.easting).toBeCloseTo(500_080, 1);
    expect(leftEnd.northing).toBeCloseTo(N0 + 6, 1);
    expect(rightEnd.easting).toBeCloseTo(500_080, 1);
    expect(rightEnd.northing).toBeCloseTo(N0 - 4, 1);
    expect(rightStart.easting).toBeCloseTo(500_020, 1);
    expect(rightStart.northing).toBeCloseTo(N0 - 4, 1);
  });
});

describe('generateChainagePoint', () => {
  it('places a point at the interpolated chainage', () => {
    const result = generateChainagePoint({ points: STRAIGHT, epsg: EPSG, chainage: 50 });
    expect(result.lengthM).toBe(0);
    expect(result.areaM2).toBeNull();
    const point = result.feature.geometry as Point;
    expect(point.type).toBe('Point');
    const local = wgs84ToLocal(EPSG, { lng: point.coordinates[0], lat: point.coordinates[1] });
    expect(local.easting).toBeCloseTo(500_050, 1);
    expect(local.northing).toBeCloseTo(N0, 1);
  });
});

describe('generateChainageOffsetPolygon (error cases)', () => {
  it('rejects a chainage window outside the control line range', () => {
    expect(() =>
      generateChainageOffsetPolygon({
        points: STRAIGHT,
        epsg: EPSG,
        chainageStart: 20,
        chainageEnd: 250,
        offsetLeft: 5,
        offsetRight: 5,
      }),
    ).toThrowError(/outside the control line range/i);
  });

  it('rejects chainageEnd ≤ chainageStart', () => {
    expect(() =>
      generateChainageOffsetPolygon({
        points: STRAIGHT,
        epsg: EPSG,
        chainageStart: 80,
        chainageEnd: 20,
        offsetLeft: 5,
        offsetRight: 5,
      }),
    ).toThrowError(/chainageEnd must be greater/i);
  });

  it('rejects zero total width', () => {
    expect(() =>
      generateChainageOffsetPolygon({
        points: STRAIGHT,
        epsg: EPSG,
        chainageStart: 20,
        chainageEnd: 80,
        offsetLeft: 0,
        offsetRight: 0,
      }),
    ).toThrowError(/non-zero offset/i);
  });

  it('rejects fewer than 2 control points', () => {
    expect(() =>
      generateChainageOffsetPolygon({
        points: [STRAIGHT[0]],
        epsg: EPSG,
        chainageStart: 0,
        chainageEnd: 10,
        offsetLeft: 5,
        offsetRight: 5,
      }),
    ).toThrowError(/at least 2 points/i);
  });

  it('rejects an unsupported EPSG code', () => {
    expect(() =>
      generateChainageOffsetPolygon({
        points: STRAIGHT,
        epsg: 'EPSG:0000',
        chainageStart: 20,
        chainageEnd: 80,
        offsetLeft: 5,
        offsetRight: 5,
      }),
    ).toThrowError(/unsupported coordinate system/i);
  });
});
