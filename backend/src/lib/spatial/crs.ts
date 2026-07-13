import proj4 from 'proj4';

import { AppError } from '../AppError.js';

/**
 * Coordinate reference transforms for the spatial lot map.
 *
 * Canonical storage for control lines is the local grid coordinates as entered
 * (easting/northing in an MGA zone); WGS84 GeoJSON is derived from those and
 * cached. AU civil drawings are on the Map Grid of Australia (MGA), so we ship
 * presets for GDA2020 and GDA94 MGA zones 49–56 plus WGS84.
 *
 * Both GDA2020 and GDA94 use the GRS80 ellipsoid, so a single UTM proj string
 * serves each zone. We treat both as WGS84-aligned (towgs84=0,0,0): GDA2020 is
 * within a few centimetres of WGS84, GDA94 within ~1.8 m (tectonic drift since
 * 1994). That is well inside map-display / lot-geometry needs.
 *
 * ponytail: no explicit GDA94→GDA2020 datum shift (7-parameter transform). Add
 * one only if a customer needs sub-metre GDA94 accuracy — GDA2020 data, which is
 * what modern setout PDFs carry, needs nothing.
 */

export const WGS84 = 'EPSG:4326';

// MGA/UTM zones covering mainland Australia (central meridian = 6*zone - 183).
const MGA_ZONES = [49, 50, 51, 52, 53, 54, 55, 56] as const;

function mgaProj4(zone: number): string {
  return `+proj=utm +zone=${zone} +south +ellps=GRS80 +towgs84=0,0,0 +units=m +no_defs`;
}

// EPSG presets. GDA2020 MGA zones are EPSG:7849–7856, GDA94 MGA zones are
// EPSG:28349–28356; both map to the same GRS80 UTM projection per zone.
const EPSG_DEFS: Record<string, string> = {
  [WGS84]: '+proj=longlat +datum=WGS84 +no_defs',
};
for (const zone of MGA_ZONES) {
  const def = mgaProj4(zone);
  EPSG_DEFS[`EPSG:${7800 + zone}`] = def; // GDA2020 MGA
  EPSG_DEFS[`EPSG:${28300 + zone}`] = def; // GDA94 MGA
}

export interface LocalPoint {
  easting: number;
  northing: number;
}

export interface Wgs84Point {
  lng: number;
  lat: number;
}

export function isSupportedEpsg(epsg: string): boolean {
  return Object.prototype.hasOwnProperty.call(EPSG_DEFS, epsg);
}

export function listSupportedEpsg(): string[] {
  return Object.keys(EPSG_DEFS);
}

function requireDef(epsg: string): string {
  if (!isSupportedEpsg(epsg)) {
    throw AppError.badRequest(`Unsupported coordinate system: ${epsg}`, {
      code: 'UNSUPPORTED_COORDINATE_SYSTEM',
      supported: listSupportedEpsg(),
    });
  }
  return EPSG_DEFS[epsg];
}

function requireFinite(value: number, field: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw AppError.badRequest(`${field} must be a finite number`);
  }
}

/** Project a local grid (MGA) easting/northing to WGS84 lng/lat. */
export function localToWgs84(epsg: string, point: LocalPoint): Wgs84Point {
  const def = requireDef(epsg);
  requireFinite(point.easting, 'easting');
  requireFinite(point.northing, 'northing');
  const [lng, lat] = proj4(def, EPSG_DEFS[WGS84], [point.easting, point.northing]);
  return { lng, lat };
}

/** Project a WGS84 lng/lat back to a local grid (MGA) easting/northing. */
export function wgs84ToLocal(epsg: string, point: Wgs84Point): LocalPoint {
  const def = requireDef(epsg);
  requireFinite(point.lng, 'lng');
  requireFinite(point.lat, 'lat');
  const [easting, northing] = proj4(EPSG_DEFS[WGS84], def, [point.lng, point.lat]);
  return { easting, northing };
}
