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

// Only geometries whose lot is in the register's current filtered set.
export function filterGeometriesByLotIds(
  geometries: ProjectLotGeometry[],
  lotIds: Set<string>,
): ProjectLotGeometry[] {
  return geometries.filter((g) => lotIds.has(g.lotId));
}
