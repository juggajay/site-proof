import type { Feature, LineString } from 'geojson';

import { AppError } from '../AppError.js';
import { localToWgs84 } from './crs.js';

/** One surveyed point on a control line: chainage (m) + local grid coords (m). */
export interface ControlPoint {
  chainage: number;
  easting: number;
  northing: number;
}

/** Control points sorted by ascending chainage, validated as usable. */
export function normaliseControlPoints(points: ControlPoint[]): ControlPoint[] {
  if (!Array.isArray(points) || points.length < 2) {
    throw AppError.badRequest('A control line needs at least 2 points');
  }
  for (const p of points) {
    for (const [field, value] of [
      ['chainage', p.chainage],
      ['easting', p.easting],
      ['northing', p.northing],
    ] as const) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw AppError.badRequest(`Control point ${field} must be a finite number`);
      }
    }
  }

  const sorted = [...points].sort((a, b) => a.chainage - b.chainage);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].chainage === sorted[i - 1].chainage) {
      throw AppError.badRequest(
        `Control line has duplicate chainage ${sorted[i].chainage}; each point needs a distinct chainage`,
      );
    }
  }
  return sorted;
}

/** Control points → WGS84 GeoJSON LineString (cache stored on the ControlLine). */
export function controlLineToWgs84(epsg: string, points: ControlPoint[]): Feature<LineString> {
  const sorted = normaliseControlPoints(points);
  const coordinates = sorted.map((p) => {
    const { lng, lat } = localToWgs84(epsg, { easting: p.easting, northing: p.northing });
    return [lng, lat];
  });
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates },
  };
}
