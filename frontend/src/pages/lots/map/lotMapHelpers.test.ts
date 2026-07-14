import { describe, expect, it } from 'vitest';

import type { GeoJsonFeature, ProjectLotGeometry } from './lotMapData';
import {
  boundsHasArea,
  boundsToLatLngRect,
  collectLatLngs,
  computeBounds,
  cornersToBounds,
  cornersToLatLngBounds,
  featureToShape,
  filterGeometriesByLotIds,
  polygonAreaM2,
  buildMapLinkPaths,
  pointInPolygon,
  lotAtPoint,
} from './lotMapHelpers';

function feature(geometry: GeoJsonFeature['geometry']): GeoJsonFeature {
  return { type: 'Feature', geometry };
}

const polygon = feature({
  type: 'Polygon',
  coordinates: [
    [
      [151.0, -33.8],
      [151.001, -33.8],
      [151.001, -33.801],
      [151.0, -33.801],
      [151.0, -33.8],
    ],
  ],
});

describe('featureToShape', () => {
  it('converts a Polygon to leaflet [lat, lng] rings', () => {
    const shape = featureToShape(polygon);
    expect(shape).toEqual({
      kind: 'polygon',
      positions: [
        [
          [-33.8, 151.0],
          [-33.8, 151.001],
          [-33.801, 151.001],
          [-33.801, 151.0],
          [-33.8, 151.0],
        ],
      ],
    });
  });

  it('converts a LineString, flipping lng/lat order', () => {
    const shape = featureToShape(
      feature({
        type: 'LineString',
        coordinates: [
          [151.0, -33.8],
          [151.5, -33.9],
        ],
      }),
    );
    expect(shape).toEqual({
      kind: 'line',
      positions: [
        [-33.8, 151.0],
        [-33.9, 151.5],
      ],
    });
  });

  it('converts a Point', () => {
    const shape = featureToShape(feature({ type: 'Point', coordinates: [151.2, -33.87] }));
    expect(shape).toEqual({ kind: 'point', position: [-33.87, 151.2] });
  });

  it('returns null for missing, empty, or unsupported geometry', () => {
    expect(featureToShape(null)).toBeNull();
    expect(featureToShape(feature({ type: 'Polygon', coordinates: [] }))).toBeNull();
    expect(featureToShape(feature({ type: 'Point', coordinates: [] }))).toBeNull();
  });
});

describe('computeBounds', () => {
  it('returns the bounding box across features', () => {
    const line = feature({
      type: 'LineString',
      coordinates: [
        [150.9, -33.7],
        [151.2, -33.85],
      ],
    });
    expect(computeBounds([polygon, line, null])).toEqual([
      [-33.85, 150.9],
      [-33.7, 151.2],
    ]);
  });

  it('returns null when nothing can be fitted', () => {
    expect(computeBounds([])).toBeNull();
    expect(computeBounds([null, feature({ type: 'Polygon', coordinates: [] })])).toBeNull();
  });
});

describe('collectLatLngs', () => {
  it('flattens polygon rings', () => {
    expect(collectLatLngs(polygon)).toHaveLength(5);
  });
});

describe('filterGeometriesByLotIds', () => {
  it('keeps only geometries whose lot is in the set', () => {
    const geometries = [
      { id: 'g1', lotId: 'a' },
      { id: 'g2', lotId: 'b' },
      { id: 'g3', lotId: 'c' },
    ] as ProjectLotGeometry[];
    const result = filterGeometriesByLotIds(geometries, new Set(['a', 'c']));
    expect(result.map((g) => g.id)).toEqual(['g1', 'g3']);
  });
});

describe('cornersToBounds', () => {
  it('normalizes two drag corners regardless of direction', () => {
    // Drag from bottom-right to top-left still yields a normalized box.
    const bounds = cornersToBounds({ lat: -33.81, lng: 151.01 }, { lat: -33.8, lng: 151.0 });
    expect(bounds).toEqual({ west: 151.0, east: 151.01, south: -33.81, north: -33.8 });
  });

  it('is order-independent (top-left → bottom-right gives the same box)', () => {
    const a = cornersToBounds({ lat: -33.8, lng: 151.0 }, { lat: -33.81, lng: 151.01 });
    const b = cornersToBounds({ lat: -33.81, lng: 151.01 }, { lat: -33.8, lng: 151.0 });
    expect(a).toEqual(b);
  });
});

describe('boundsHasArea', () => {
  it('is true for a box with meaningful extent', () => {
    expect(boundsHasArea({ west: 151.0, east: 151.01, south: -33.81, north: -33.8 })).toBe(true);
  });

  it('is false for a zero-area box (a bare tap/click)', () => {
    expect(boundsHasArea({ west: 151.0, east: 151.0, south: -33.8, north: -33.8 })).toBe(false);
  });

  it('is false when only one axis has extent', () => {
    expect(boundsHasArea({ west: 151.0, east: 151.01, south: -33.8, north: -33.8 })).toBe(false);
  });
});

describe('boundsToLatLngRect', () => {
  it('maps bounds to a leaflet [[south,west],[north,east]] rectangle', () => {
    expect(boundsToLatLngRect({ west: 151.0, east: 151.01, south: -33.81, north: -33.8 })).toEqual([
      [-33.81, 151.0],
      [-33.8, 151.01],
    ]);
  });
});

describe('polygonAreaM2', () => {
  it('is ~0 for a degenerate ring', () => {
    expect(polygonAreaM2([[151, -33]])).toBe(0);
  });

  it('computes ~1 ha for a ~100 m square near Sydney', () => {
    // 100 m ≈ 0.0009 deg lat; lng scaled by cos(33.87°) ≈ 0.831 → 0.001083 deg.
    const lat0 = -33.87;
    const dLat = 0.0009; // ~100.1 m
    const dLng = 0.0009 / Math.cos((lat0 * Math.PI) / 180); // ~100 m east
    const ring: [number, number][] = [
      [151.2, lat0],
      [151.2 + dLng, lat0],
      [151.2 + dLng, lat0 + dLat],
      [151.2, lat0 + dLat],
      [151.2, lat0],
    ];
    const area = polygonAreaM2(ring);
    // ~10,000 m² within 3%.
    expect(area).toBeGreaterThan(9700);
    expect(area).toBeLessThan(10300);
  });
});

describe('cornersToLatLngBounds', () => {
  it('spans four [lng,lat] corners as [[minLat,minLng],[maxLat,maxLng]]', () => {
    expect(
      cornersToLatLngBounds([
        [151.0, -33.8],
        [151.01, -33.8],
        [151.01, -33.81],
        [151.0, -33.81],
      ]),
    ).toEqual([
      [-33.81, 151.0],
      [-33.8, 151.01],
    ]);
  });

  it('returns null with no corners', () => {
    expect(cornersToLatLngBounds([])).toBeNull();
  });
});

describe('pointInPolygon', () => {
  // A unit square from (0,0) to (1,1) in [lng, lat].
  const square: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ];

  it('is true for a point inside', () => {
    expect(pointInPolygon(0.5, 0.5, square)).toBe(true);
  });

  it('is false for a point outside', () => {
    expect(pointInPolygon(2, 0.5, square)).toBe(false);
    expect(pointInPolygon(0.5, -1, square)).toBe(false);
  });

  it('respects [lng, lat] order — swapping args lands outside', () => {
    // A tall skinny box near Sydney: lng ~151, lat ~-33. Passing (lat, lng)
    // instead of (lng, lat) must NOT read as inside.
    const box: [number, number][] = [
      [151.0, -33.81],
      [151.001, -33.81],
      [151.001, -33.8],
      [151.0, -33.8],
      [151.0, -33.81],
    ];
    expect(pointInPolygon(151.0005, -33.805, box)).toBe(true);
    expect(pointInPolygon(-33.805, 151.0005, box)).toBe(false);
  });

  it('returns false for a degenerate ring', () => {
    expect(pointInPolygon(0.5, 0.5, [[0, 0]] as [number, number][])).toBe(false);
  });
});

describe('lotAtPoint', () => {
  function polyLot(id: string, num: string, ring: number[][]): ProjectLotGeometry {
    return {
      lotId: id,
      lotNumber: num,
      geometryWgs84: feature({ type: 'Polygon', coordinates: [ring] }),
    } as ProjectLotGeometry;
  }

  const lotA = polyLot('a', 'A-1', [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ]);
  const lotB = polyLot('b', 'B-2', [
    [10, 10],
    [11, 10],
    [11, 11],
    [10, 11],
    [10, 10],
  ]);

  it('returns the containing lot', () => {
    expect(lotAtPoint([lotA, lotB], 10.5, 10.5)).toEqual({ lotId: 'b', lotNumber: 'B-2' });
  });

  it('returns null when the point is in no lot', () => {
    expect(lotAtPoint([lotA, lotB], 5, 5)).toBeNull();
  });

  it('skips non-polygon geometries (points / linestrings)', () => {
    const pointLot = {
      lotId: 'p',
      lotNumber: 'P-3',
      geometryWgs84: feature({ type: 'Point', coordinates: [0.5, 0.5] }),
    } as ProjectLotGeometry;
    const lineLot = {
      lotId: 'l',
      lotNumber: 'L-4',
      geometryWgs84: feature({
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      }),
    } as ProjectLotGeometry;
    // The point falls "at" the point/line lots but only the polygon can contain it.
    expect(lotAtPoint([pointLot, lineLot, lotA], 0.5, 0.5)).toEqual({
      lotId: 'a',
      lotNumber: 'A-1',
    });
  });

  it('handles a MultiPolygon lot', () => {
    const multi = {
      lotId: 'm',
      lotNumber: 'M-5',
      geometryWgs84: {
        type: 'Feature',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [20, 20],
                [21, 20],
                [21, 21],
                [20, 21],
                [20, 20],
              ],
            ],
          ],
        },
      },
    } as unknown as ProjectLotGeometry;
    expect(lotAtPoint([multi], 20.5, 20.5)).toEqual({ lotId: 'm', lotNumber: 'M-5' });
    expect(lotAtPoint([multi], 0.5, 0.5)).toBeNull();
  });
});

describe('buildMapLinkPaths', () => {
  it('builds classic desktop routes when no linkTargets given', () => {
    const paths = buildMapLinkPaths('p 1', undefined);
    expect(paths.lot('l/1')).toBe('/projects/p%201/lots/l%2F1');
    expect(paths.photo({ lotId: 'l1' })).toBe('/projects/p%201/documents?lotId=l1');
    expect(paths.photo({ lotId: null })).toBe('/projects/p%201/documents');
    expect(paths.test({ id: 't1', lotId: null })).toBe('/projects/p%201/tests?test=t1');
    expect(paths.settings).toBe('/projects/p%201/settings');
  });

  it('routes everything through the shell lot builder and drops settings links', () => {
    const paths = buildMapLinkPaths('p1', { lot: (id) => `/m/lots/${id}?projectId=p1` });
    expect(paths.lot('l1')).toBe('/m/lots/l1?projectId=p1');
    expect(paths.photo({ lotId: 'l1' })).toBe('/m/lots/l1?projectId=p1');
    expect(paths.photo({ lotId: null })).toBeNull();
    expect(paths.test({ id: 't1', lotId: 'l2' })).toBe('/m/lots/l2?projectId=p1');
    expect(paths.test({ id: 't1', lotId: null })).toBeNull();
    expect(paths.settings).toBeNull();
  });
});
