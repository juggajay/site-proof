import {
  isRecord,
  parseJsonPreference,
  readLocalStorageItem,
  writeLocalStorageItem,
} from '@/lib/storagePreferences';

import type { GeoJsonFeature, ProjectLotGeometry } from './lotMapData';
import { computeBounds, type LatLng } from './lotMapHelpers';

/**
 * Camera policy for the spatial workspace (plan consensus #3).
 *
 * "Fit everything on open" was part of the problem: on a 10km corridor it lands
 * the user at a zoom where every lot is a sliver. Instead, in priority order:
 *
 *   1. restore the last viewport this device used for this project
 *   2. fit the register-filtered lots (the user asked for that subset)
 *   3. focus the active work fronts (in progress / awaiting test / hold point /
 *      NCR) — where today's work actually is
 *   4. project extent (all lots + control lines + registered sheets)
 *
 * plus an explicit Fit control that always fits the visible lot set.
 */

export interface SavedViewport {
  lat: number;
  lng: number;
  zoom: number;
}

const viewportKey = (projectId: string) => `siteproof.mapViewport.${projectId}`;

function validateViewport(value: unknown): SavedViewport | null {
  if (!isRecord(value)) return null;
  const { lat, lng, zoom } = value;
  if (typeof lat !== 'number' || typeof lng !== 'number' || typeof zoom !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) return null;
  return { lat, lng, zoom };
}

export function readSavedViewport(projectId: string): SavedViewport | null {
  return parseJsonPreference<SavedViewport | null>(
    readLocalStorageItem(viewportKey(projectId)),
    null,
    validateViewport,
  );
}

export function writeSavedViewport(projectId: string, viewport: SavedViewport): void {
  writeLocalStorageItem(viewportKey(projectId), JSON.stringify(viewport));
}

/** Statuses that mark a lot as an active work front. */
export const ACTIVE_WORK_STATUSES: ReadonlySet<string> = new Set([
  'in_progress',
  'awaiting_test',
  'hold_point',
  'ncr_raised',
]);

export type CameraTarget =
  | { kind: 'viewport'; center: LatLng; zoom: number }
  | { kind: 'bounds'; bounds: [LatLng, LatLng] }
  | null;

export interface CameraInputs {
  saved: SavedViewport | null;
  /** The register filter is narrowing the lot set (filtered ⊂ all). */
  isFiltered: boolean;
  filteredGeometries: ProjectLotGeometry[];
  allGeometries: ProjectLotGeometry[];
  /** Extra extent features: control lines, registered sheet corners as features. */
  extentFeatures: (GeoJsonFeature | null | undefined)[];
}

export function chooseCamera({
  saved,
  isFiltered,
  filteredGeometries,
  allGeometries,
  extentFeatures,
}: CameraInputs): CameraTarget {
  if (saved) return { kind: 'viewport', center: [saved.lat, saved.lng], zoom: saved.zoom };

  if (isFiltered) {
    const filteredBounds = computeBounds(filteredGeometries.map((g) => g.geometryWgs84));
    if (filteredBounds) return { kind: 'bounds', bounds: filteredBounds };
  }

  const activeBounds = computeBounds(
    allGeometries.filter((g) => ACTIVE_WORK_STATUSES.has(g.status)).map((g) => g.geometryWgs84),
  );
  if (activeBounds) return { kind: 'bounds', bounds: activeBounds };

  const projectBounds = computeBounds([
    ...allGeometries.map((g) => g.geometryWgs84),
    ...extentFeatures,
  ]);
  if (projectBounds) return { kind: 'bounds', bounds: projectBounds };

  return null;
}
