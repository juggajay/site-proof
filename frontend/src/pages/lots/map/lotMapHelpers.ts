import type { GeoJsonFeature, ProjectLotGeometry } from './lotMapData';

// Leaflet positions are [lat, lng]; GeoJSON coordinates are [lng, lat].
export type LatLng = [number, number];

// Sydney CBD — a sensible AU fallback centre when there is nothing to fit.
export const AU_DEFAULT_CENTER: LatLng = [-33.8688, 151.2093];
export const AU_DEFAULT_ZOOM = 5;

export type MapShape =
  | { kind: 'polygon'; positions: LatLng[][] }
  | { kind: 'line'; positions: LatLng[] }
  | { kind: 'point'; position: LatLng }
  | null;

function toLatLng(coord: number[]): LatLng {
  return [coord[1], coord[0]];
}

// Convert one GeoJSON Feature into the Leaflet layer shape to render. Returns
// null for empty/unsupported geometry so callers can skip it.
export function featureToShape(feature: GeoJsonFeature | null | undefined): MapShape {
  const geometry = feature?.geometry;
  if (!geometry) return null;

  switch (geometry.type) {
    case 'Polygon': {
      const rings = geometry.coordinates
        .filter((ring) => ring.length > 0)
        .map((ring) => ring.map(toLatLng));
      return rings.length > 0 ? { kind: 'polygon', positions: rings } : null;
    }
    case 'LineString': {
      const positions = geometry.coordinates.map(toLatLng);
      return positions.length > 0 ? { kind: 'line', positions } : null;
    }
    case 'Point':
      return geometry.coordinates.length >= 2
        ? { kind: 'point', position: toLatLng(geometry.coordinates) }
        : null;
    default:
      return null;
  }
}

// Every [lat, lng] point in a Feature, for bounds computation.
export function collectLatLngs(feature: GeoJsonFeature | null | undefined): LatLng[] {
  const geometry = feature?.geometry;
  if (!geometry) return [];
  switch (geometry.type) {
    case 'Polygon':
      return geometry.coordinates.flat().map(toLatLng);
    case 'LineString':
      return geometry.coordinates.map(toLatLng);
    case 'Point':
      return geometry.coordinates.length >= 2 ? [toLatLng(geometry.coordinates)] : [];
    default:
      return [];
  }
}

// Bounding box [[minLat, minLng], [maxLat, maxLng]] over all features, or null
// when there is nothing to fit.
export function computeBounds(
  features: (GeoJsonFeature | null | undefined)[],
): [LatLng, LatLng] | null {
  const points = features.flatMap(collectLatLngs);
  if (points.length === 0) return null;

  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

// Find-by-area search box in WGS84 degrees. Matches the backend Zod schema.
export interface SearchBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

// Two drag corners (Leaflet {lat,lng}) → normalized bounds. Pure so the corner
// math is unit-testable without a map.
export function cornersToBounds(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): SearchBounds {
  return {
    west: Math.min(a.lng, b.lng),
    east: Math.max(a.lng, b.lng),
    south: Math.min(a.lat, b.lat),
    north: Math.max(a.lat, b.lat),
  };
}

// Leaflet bounds tuple [[south,west],[north,east]] for a <Rectangle>.
export function boundsToLatLngRect(b: SearchBounds): [LatLng, LatLng] {
  return [
    [b.south, b.west],
    [b.north, b.east],
  ];
}

// Geodesic area (m²) of a WGS84 ring of [lng, lat] positions, using the standard
// spherical-excess formula (same algorithm as @turf/area / geojson-area). Pure,
// so the map can display a drawn polygon's area before it is saved. The backend
// recomputes authoritatively on save; this is the live preview.
const EARTH_RADIUS_M = 6378137;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function polygonAreaM2(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % ring.length];
    total += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

// Leaflet bounds [[minLat,minLng],[maxLat,maxLng]] spanning four WGS84 [lng,lat]
// corners — used to zoom to a plan sheet overlay.
export function cornersToLatLngBounds(corners: [number, number][]): [LatLng, LatLng] | null {
  if (corners.length === 0) return null;
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const [lng, lat] of corners) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

// Ray-casting point-in-polygon on one ring of GeoJSON [lng, lat] positions.
// Boundary membership is undefined (a point exactly on an edge may read either
// way) — fine for lot auto-select, where a GPS fix is never exactly on a line.
// Holes are ignored: lots are simple polygons.
export function pointInPolygon(lng: number, lat: number, ring: [number, number][]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const straddles = yi > lat !== yj > lat;
    if (straddles && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Area-weighted centroid of a WGS84 ring of [lng, lat] positions (shoelace
// formula). Falls back to the vertex average for a degenerate (zero-area) ring
// so a sliver/collinear footprint still yields a sensible point. Returns
// [lng, lat], or null for an empty ring. Pure so "navigate to lot" can pick a
// destination without a map.
export function polygonCentroid(ring: [number, number][]): [number, number] | null {
  if (ring.length === 0) return null;
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xj, yj] = ring[j];
    const [xi, yi] = ring[i];
    const cross = xj * yi - xi * yj;
    twiceArea += cross;
    cx += (xj + xi) * cross;
    cy += (yj + yi) * cross;
  }
  if (twiceArea === 0) {
    let sx = 0;
    let sy = 0;
    for (const [x, y] of ring) {
      sx += x;
      sy += y;
    }
    return [sx / ring.length, sy / ring.length];
  }
  return [cx / (3 * twiceArea), cy / (3 * twiceArea)];
}

// A single [lat, lng] point to route "navigate to lot" to: a polygon's centroid,
// a line's midpoint vertex, or a point itself. null when there is no usable
// geometry. Reuses polygonCentroid for the polygon case.
export function featureCentroid(feature: GeoJsonFeature | null | undefined): LatLng | null {
  const geometry = feature?.geometry;
  if (!geometry) return null;
  switch (geometry.type) {
    case 'Polygon': {
      const ring = geometry.coordinates[0] as [number, number][] | undefined;
      if (!ring || ring.length === 0) return null;
      const c = polygonCentroid(ring);
      return c ? [c[1], c[0]] : null;
    }
    case 'LineString': {
      const pts = geometry.coordinates;
      if (pts.length === 0) return null;
      const mid = pts[Math.floor(pts.length / 2)];
      return [mid[1], mid[0]];
    }
    case 'Point':
      return geometry.coordinates.length >= 2
        ? [geometry.coordinates[1], geometry.coordinates[0]]
        : null;
    default:
      return null;
  }
}

// The outer ring(s) of a geometry: one for a Polygon, one per part for a
// MultiPolygon, none for point/linestring geometries (which can't contain a
// point). Read type as a bare string so a MultiPolygon in the data isn't a type
// error against the narrower GeoJsonGeometry union. Holes are ignored.
function outerRings(
  geom: { type: string; coordinates: number[][][] | number[][][][] } | undefined,
): [number, number][][] {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [(geom.coordinates as number[][][])[0] as [number, number][]];
  if (geom.type === 'MultiPolygon') {
    return (geom.coordinates as number[][][][]).map((poly) => poly[0] as [number, number][]);
  }
  return [];
}

// Which lot footprint contains a WGS84 point, or null. First match wins (lots
// don't overlap).
export function lotAtPoint(
  geometries: ProjectLotGeometry[],
  lng: number,
  lat: number,
): { lotId: string; lotNumber: string } | null {
  const match = geometries.find((g) =>
    outerRings(g.geometryWgs84?.geometry as never).some(
      (ring) => ring && pointInPolygon(lng, lat, ring),
    ),
  );
  return match ? { lotId: match.lotId, lotNumber: match.lotNumber } : null;
}

// Only geometries whose lot is in the register's current filtered set.
export function filterGeometriesByLotIds(
  geometries: ProjectLotGeometry[],
  lotIds: Set<string>,
): ProjectLotGeometry[] {
  return geometries.filter((g) => lotIds.has(g.lotId));
}

// True when a drawn box has a meaningful extent — used to ignore a bare tap/click
// (no drag) so find-by-area does not fire on a zero-area box. Kept pure so both
// the mouse and touch draw paths share one degeneracy test.
const MIN_DRAG_DEGREES = 1e-9;
export function boundsHasArea(b: SearchBounds): boolean {
  return b.east - b.west >= MIN_DRAG_DEGREES && b.north - b.south >= MIN_DRAG_DEGREES;
}

// Where map entities link. Classic surfaces link into the desktop app; the
// foreman shell passes a lot-path builder and everything stays under /m/* —
// photos and test results route to their LOT (the shell is lot-centric and has
// no documents/tests registers), and office-only settings links disappear.
export interface MapLinkTargets {
  lot: (lotId: string) => string;
}

export interface MapLinkPaths {
  lot: (lotId: string) => string;
  /** null → render the row unlinked (no shell destination exists). */
  photo: (photo: { lotId: string | null }) => string | null;
  test: (tr: { id: string; lotId: string | null }) => string | null;
  /** null → render settings mentions as plain text (no link out of the shell). */
  settings: string | null;
}

export function buildMapLinkPaths(
  projectId: string,
  linkTargets: MapLinkTargets | undefined,
): MapLinkPaths {
  const project = encodeURIComponent(projectId);
  if (linkTargets) {
    const { lot } = linkTargets;
    return {
      lot,
      photo: (photo) => (photo.lotId ? lot(photo.lotId) : null),
      test: (tr) => (tr.lotId ? lot(tr.lotId) : null),
      settings: null,
    };
  }
  return {
    lot: (lotId) => `/projects/${project}/lots/${encodeURIComponent(lotId)}`,
    photo: (photo) =>
      `/projects/${project}/documents${photo.lotId ? `?lotId=${encodeURIComponent(photo.lotId)}` : ''}`,
    test: (tr) => `/projects/${project}/tests?test=${encodeURIComponent(tr.id)}`,
    settings: `/projects/${project}/settings`,
  };
}
