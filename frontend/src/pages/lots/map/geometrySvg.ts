import type { GeoJsonFeature } from './lotMapData';

// Static SVG projection of a lot's WGS84 geometry — no Leaflet, no tiles. Used
// for the small spatial-context thumbnail on the test-result sheet.
//
// Projection: simple equirectangular around the geometry centroid with a
// cos(lat) longitude correction, then a uniform scale + centre into a square
// viewBox. At lot scale (tens–hundreds of metres) the error from ignoring the
// ellipsoid is far below one thumbnail pixel — good enough for "where on the
// job is this", which is all the thumbnail claims. (Anything survey-grade uses
// the real proj4 transforms, not this.)

export interface GeometrySvg {
  viewBox: string;
  /** SVG path data (M/L, plus Z for closed rings). Empty for a bare point. */
  d: string;
  kind: 'polygon' | 'line' | 'point';
  /** Centre of a Point geometry, for rendering a marker circle. */
  point?: { x: number; y: number };
}

interface Options {
  /** Square viewBox side length in SVG user units. */
  size?: number;
  /** Padding inside the box, same units. */
  padding?: number;
}

const DEG2RAD = Math.PI / 180;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// [lng, lat] → planar [x, y] around (lng0, lat0). y is negated so north is up.
function project(lng: number, lat: number, lng0: number, lat0: number): [number, number] {
  const x = (lng - lng0) * Math.cos(lat0 * DEG2RAD);
  const y = -(lat - lat0);
  return [x, y];
}

// Every [lng, lat] coordinate in a feature, plus the ring structure we need to
// re-emit as SVG subpaths.
function extractRings(
  feature: GeoJsonFeature,
): { rings: number[][][]; kind: GeometrySvg['kind'] } | null {
  const geometry = feature?.geometry;
  if (!geometry) return null;
  switch (geometry.type) {
    case 'Polygon': {
      const rings = geometry.coordinates.filter((ring) => ring.length > 0);
      return rings.length > 0 ? { rings, kind: 'polygon' } : null;
    }
    case 'LineString':
      return geometry.coordinates.length > 0
        ? { rings: [geometry.coordinates], kind: 'line' }
        : null;
    case 'Point':
      return geometry.coordinates.length >= 2
        ? { rings: [[geometry.coordinates]], kind: 'point' }
        : null;
    default:
      return null;
  }
}

/**
 * Project a lot geometry into a square SVG viewBox. Returns null for empty or
 * unsupported geometry so callers render nothing (no empty box).
 */
export function geometryToSvgPath(
  feature: GeoJsonFeature | null | undefined,
  options: Options = {},
): GeometrySvg | null {
  if (!feature) return null;
  const extracted = extractRings(feature);
  if (!extracted) return null;

  const size = options.size ?? 100;
  const padding = options.padding ?? 8;

  const allPoints = extracted.rings.flat();
  const lng0 = allPoints.reduce((sum, c) => sum + c[0], 0) / allPoints.length;
  const lat0 = allPoints.reduce((sum, c) => sum + c[1], 0) / allPoints.length;

  const projectedRings = extracted.rings.map((ring) =>
    ring.map(([lng, lat]) => project(lng, lat, lng0, lat0)),
  );
  const projected = projectedRings.flat();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of projected) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const inner = size - padding * 2;
  // Degenerate (single point, or a perfectly axis-aligned line) → no divide by
  // zero; a zero span just centres on that axis.
  const scale = Math.max(spanX, spanY) > 0 ? inner / Math.max(spanX, spanY) : 0;
  const offsetX = padding + (inner - spanX * scale) / 2;
  const offsetY = padding + (inner - spanY * scale) / 2;

  const toSvg = ([x, y]: [number, number]): [number, number] => [
    round(offsetX + (x - minX) * scale),
    round(offsetY + (y - minY) * scale),
  ];

  if (extracted.kind === 'point') {
    const [px, py] = toSvg(projected[0]);
    return { viewBox: `0 0 ${size} ${size}`, d: '', kind: 'point', point: { x: px, y: py } };
  }

  const d = projectedRings
    .map((ring) => {
      const commands = ring.map((p, i) => {
        const [x, y] = toSvg(p);
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      });
      return commands.join(' ') + (extracted.kind === 'polygon' ? ' Z' : '');
    })
    .join(' ');

  return { viewBox: `0 0 ${size} ${size}`, d, kind: extracted.kind };
}
