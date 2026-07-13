import { area } from '@turf/turf';
import type { Feature, Point, Polygon, Position } from 'geojson';

import { AppError } from '../AppError.js';
import { normaliseControlPoints, type ControlPoint } from './controlLineGeometry.js';
import { localToWgs84 } from './crs.js';

/**
 * Lot geometry generator.
 *
 * Given a control line and a chainage window + left/right offsets, produce the
 * lot's footprint. We build the polygon in the LOCAL grid (metres), where
 * chainage-along and perpendicular offset are exact, then project each vertex to
 * WGS84 for storage. Area comes from turf on the projected polygon.
 *
 * ponytail: per-vertex mitred normals (centred difference). Exact for straight
 * lines and fine for the gentle curves of civil alignments; a very sharp bend
 * could self-intersect the offset edge. Swap to a turf buffer/lineOffset only if
 * a real alignment shows that failure.
 */

const CHAINAGE_EPSILON = 1e-6;

interface LocalXY {
  easting: number;
  northing: number;
}

export interface ChainageOffsetInput {
  points: ControlPoint[];
  epsg: string;
  chainageStart: number;
  chainageEnd: number;
  offsetLeft: number;
  offsetRight: number;
}

export interface ChainagePointInput {
  points: ControlPoint[];
  epsg: string;
  chainage: number;
}

export interface GeneratedLotGeometry {
  feature: Feature<Polygon | Point>;
  areaM2: number | null;
  lengthM: number;
}

function requireFinite(value: number, field: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw AppError.badRequest(`${field} must be a finite number`);
  }
}

function assertChainageInRange(points: ControlPoint[], chainage: number, field: string): void {
  const min = points[0].chainage;
  const max = points[points.length - 1].chainage;
  if (chainage < min - CHAINAGE_EPSILON || chainage > max + CHAINAGE_EPSILON) {
    throw AppError.badRequest(
      `${field} ${chainage} is outside the control line range ${min}–${max}`,
      { code: 'CHAINAGE_OUT_OF_RANGE', min, max },
    );
  }
}

/** Interpolate the local grid position at a chainage (assumed in range). */
function positionAtChainage(points: ControlPoint[], chainage: number): LocalXY {
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (chainage >= a.chainage - CHAINAGE_EPSILON && chainage <= b.chainage + CHAINAGE_EPSILON) {
      const span = b.chainage - a.chainage;
      const t = span === 0 ? 0 : (chainage - a.chainage) / span;
      return {
        easting: a.easting + t * (b.easting - a.easting),
        northing: a.northing + t * (b.northing - a.northing),
      };
    }
  }
  // Clamp to the nearest end; range is validated by the caller.
  const end = chainage <= points[0].chainage ? points[0] : points[points.length - 1];
  return { easting: end.easting, northing: end.northing };
}

function unit(dx: number, dy: number): [number, number] {
  const len = Math.hypot(dx, dy);
  return len === 0 ? [0, 0] : [dx / len, dy / len];
}

function toWgs84Position(p: LocalXY, epsg: string): Position {
  const { lng, lat } = localToWgs84(epsg, p);
  return [lng, lat];
}

/**
 * Chainage window + offsets → WGS84 Polygon straddling the control line.
 * offsetLeft/offsetRight are metres left/right of increasing chainage.
 */
export function generateChainageOffsetPolygon(input: ChainageOffsetInput): GeneratedLotGeometry {
  const points = normaliseControlPoints(input.points);
  requireFinite(input.chainageStart, 'chainageStart');
  requireFinite(input.chainageEnd, 'chainageEnd');
  requireFinite(input.offsetLeft, 'offsetLeft');
  requireFinite(input.offsetRight, 'offsetRight');

  if (input.chainageEnd <= input.chainageStart) {
    throw AppError.badRequest('chainageEnd must be greater than chainageStart');
  }
  if (input.offsetLeft < 0 || input.offsetRight < 0) {
    throw AppError.badRequest('offsetLeft and offsetRight must not be negative');
  }
  if (input.offsetLeft + input.offsetRight <= 0) {
    throw AppError.badRequest('A lot needs a non-zero offset on at least one side');
  }

  assertChainageInRange(points, input.chainageStart, 'chainageStart');
  assertChainageInRange(points, input.chainageEnd, 'chainageEnd');

  // Ordered centreline chainages: start, interior control vertices, end.
  const chainages = [
    input.chainageStart,
    ...points
      .map((p) => p.chainage)
      .filter(
        (c) =>
          c > input.chainageStart + CHAINAGE_EPSILON && c < input.chainageEnd - CHAINAGE_EPSILON,
      ),
    input.chainageEnd,
  ];
  const centre = chainages.map((c) => positionAtChainage(points, c));

  const left: Position[] = [];
  const right: Position[] = [];
  for (let i = 0; i < centre.length; i += 1) {
    const prev = centre[Math.max(0, i - 1)];
    const next = centre[Math.min(centre.length - 1, i + 1)];
    const [tx, ty] = unit(next.easting - prev.easting, next.northing - prev.northing);
    // Left of travel = rotate tangent +90°: (-ty, tx). Right = (ty, -tx).
    const c = centre[i];
    left.push(
      toWgs84Position(
        {
          easting: c.easting - ty * input.offsetLeft,
          northing: c.northing + tx * input.offsetLeft,
        },
        input.epsg,
      ),
    );
    right.push(
      toWgs84Position(
        {
          easting: c.easting + ty * input.offsetRight,
          northing: c.northing - tx * input.offsetRight,
        },
        input.epsg,
      ),
    );
  }

  // Ring: left edge start→end, right edge end→start, closed.
  const ring: Position[] = [...left, ...right.reverse(), left[0]];
  const feature: Feature<Polygon> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  };

  return {
    feature,
    areaM2: area(feature),
    lengthM: input.chainageEnd - input.chainageStart,
  };
}

/** Single chainage → WGS84 Point on the control line. */
export function generateChainagePoint(input: ChainagePointInput): GeneratedLotGeometry {
  const points = normaliseControlPoints(input.points);
  requireFinite(input.chainage, 'chainage');
  assertChainageInRange(points, input.chainage, 'chainage');

  const position = toWgs84Position(positionAtChainage(points, input.chainage), input.epsg);
  return {
    feature: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: position },
    },
    areaM2: null,
    lengthM: 0,
  };
}
