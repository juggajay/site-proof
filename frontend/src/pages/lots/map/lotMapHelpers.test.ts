import { describe, expect, it } from 'vitest';

import type { GeoJsonFeature, ProjectLotGeometry } from './lotMapData';
import {
  collectLatLngs,
  computeBounds,
  featureToShape,
  filterGeometriesByLotIds,
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
