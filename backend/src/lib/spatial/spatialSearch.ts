/**
 * Pure bbox / intersection filters for find-by-area spatial search.
 *
 * No Prisma, no turf state — DB-free so the route's filtering logic is unit
 * testable. Geometry intersection uses turf (same "load then filter in app"
 * approach as the lot-geometries read route; no PostGIS in this codebase).
 */

import { bboxPolygon, booleanIntersects } from '@turf/turf';
import type { Feature, Geometry } from 'geojson';

export interface SearchBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

// GeoJSON is [lng, lat]. Inclusive on all four edges.
export function pointInBounds(lng: number, lat: number, b: SearchBounds): boolean {
  return lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north;
}

// True when a stored LotGeometry Feature (Polygon / LineString / Point) touches
// or overlaps the search box. Tolerant of malformed geometry — returns false
// rather than throwing so one bad row can't fail the whole search.
export function featureIntersectsBounds(feature: unknown, b: SearchBounds): boolean {
  const geometry = (feature as Feature | null | undefined)?.geometry as Geometry | undefined;
  if (!geometry) return false;
  try {
    const box = bboxPolygon([b.west, b.south, b.east, b.north]);
    return booleanIntersects(box, geometry);
  } catch {
    return false;
  }
}
