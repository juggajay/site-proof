import type { SheetCornersWgs84 } from '@/pages/projects/settings/planSheetsData';

import type { GeoJsonFeature } from './lotMapData';

/**
 * Plan mode's coordinate bridge: WGS84 → sheet space.
 *
 * The registration already pins the sheet's three defining corners in WGS84
 * (the same data RotatedImageOverlay uses). Inverting that affine puts LOT
 * geometry onto the sheet instead of the sheet onto the map — which is the
 * whole plan-mode trick: the sheet is axis-aligned by construction in a
 * CRS.Simple map, so no map rotation (and none of leaflet-rotate's GPL/bugs)
 * is ever needed.
 *
 * Sheet space is CRS.Simple with the image spanning [[0,0],[H,W]] (Leaflet
 * [y,x]); GeoJSON coordinates in sheet space are [x, yUp] with yUp = H - pixelY
 * so the image reads right side up.
 */
export interface SheetSpace {
  /** WGS84 [lng, lat] → sheet-space [x, yUp]. */
  toSheet(lngLat: [number, number]): [number, number];
}

export function buildSheetSpace(
  corners: SheetCornersWgs84,
  imageWidth: number,
  imageHeight: number,
): SheetSpace | null {
  const [tlx, tly] = corners.topLeft;
  const [trx, try_] = corners.topRight;
  const [blx, bly] = corners.bottomLeft;

  // Basis: u spans the top edge (→ image x), v the left edge (→ image y down).
  const ux = trx - tlx;
  const uy = try_ - tly;
  const vx = blx - tlx;
  const vy = bly - tly;
  const det = ux * vy - uy * vx;
  if (!Number.isFinite(det) || det === 0) return null;

  return {
    toSheet([lng, lat]) {
      const dx = lng - tlx;
      const dy = lat - tly;
      const a = (dx * vy - dy * vx) / det; // fraction along the top edge
      const b = (ux * dy - uy * dx) / det; // fraction down the left edge
      // `+ 0` normalises IEEE -0 so sheet coordinates compare cleanly.
      return [a * imageWidth + 0, imageHeight - b * imageHeight + 0];
    },
  };
}

type Ring = number[][];

/** A feature's coordinates re-expressed in sheet space ([x, yUp] order). */
export function featureToSheet(feature: GeoJsonFeature, space: SheetSpace): GeoJsonFeature {
  const { geometry } = feature;
  switch (geometry.type) {
    case 'Polygon':
      return {
        ...feature,
        geometry: {
          type: 'Polygon',
          coordinates: geometry.coordinates.map((ring: Ring) =>
            ring.map((c) => space.toSheet(c as [number, number])),
          ),
        },
      };
    case 'LineString':
      return {
        ...feature,
        geometry: {
          type: 'LineString',
          coordinates: geometry.coordinates.map((c) => space.toSheet(c as [number, number])),
        },
      };
    case 'Point':
      return {
        ...feature,
        geometry: {
          type: 'Point',
          coordinates: space.toSheet(geometry.coordinates as [number, number]),
        },
      };
    default:
      return feature;
  }
}
