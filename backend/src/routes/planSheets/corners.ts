import { localToWgs84 } from '../../lib/spatial/crs.js';

/** A WGS84 corner as [lng, lat] (GeoJSON axis order). */
export type CornerWgs84 = [number, number];

export interface SheetCornersWgs84 {
  topLeft: CornerWgs84;
  topRight: CornerWgs84;
  bottomRight: CornerWgs84;
  bottomLeft: CornerWgs84;
}

interface RegistrationLike {
  // [a, b, c, d, e, f]: easting = a*px + b*py + c; northing = d*px + e*py + f.
  transform: number[];
}

// Apply the stored affine to a pixel (y-DOWN), then project grid → WGS84 [lng,lat].
function pixelToWgs84(transform: number[], epsg: string, px: number, py: number): CornerWgs84 {
  const [a, b, c, d, e, f] = transform;
  const easting = a * px + b * py + c;
  const northing = d * px + e * py + f;
  const { lng, lat } = localToWgs84(epsg, { easting, northing });
  return [lng, lat];
}

/**
 * The four image corners as WGS84 [lng, lat], for georeferenced map overlay.
 * Corners walk the pixel rectangle (0,0)→(W,0)→(W,H)→(0,H). Returns null when the
 * sheet has no (valid 6-parameter) registration.
 */
export function computeCornersWgs84(
  registration: RegistrationLike | null | undefined,
  imageWidth: number,
  imageHeight: number,
  coordinateSystem: string,
): SheetCornersWgs84 | null {
  if (
    !registration ||
    !Array.isArray(registration.transform) ||
    registration.transform.length !== 6
  ) {
    return null;
  }
  const t = registration.transform;
  return {
    topLeft: pixelToWgs84(t, coordinateSystem, 0, 0),
    topRight: pixelToWgs84(t, coordinateSystem, imageWidth, 0),
    bottomRight: pixelToWgs84(t, coordinateSystem, imageWidth, imageHeight),
    bottomLeft: pixelToWgs84(t, coordinateSystem, 0, imageHeight),
  };
}
