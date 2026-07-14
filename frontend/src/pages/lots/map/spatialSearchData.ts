import { useMutation } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

import type { ProjectLotGeometry } from './lotMapData';
import type { SearchBounds } from './lotMapHelpers';

// Lots reuse the lot-geometries shaping (backend shares mapGeometry).
export type SpatialLot = ProjectLotGeometry;

export interface SpatialPhoto {
  id: string;
  filename: string;
  caption: string | null;
  captureTimestamp: string | null;
  lotId: string | null;
  // Prisma Decimal serialises as a string over JSON; normalised to number|null
  // by normaliseSpatialPhotoCoords before the map layer reads them.
  gpsLatitude: number | null;
  gpsLongitude: number | null;
}

// Coerce one coordinate: Prisma Decimal arrives as a string, a number in tests,
// or null/undefined when absent. Non-finite parses (e.g. '') become null.
function toCoord(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  // Number('') is 0, not NaN — a blank coord must not become (0, 0).
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normaliseSpatialPhotoCoords(
  photo: Omit<SpatialPhoto, 'gpsLatitude' | 'gpsLongitude'> & {
    gpsLatitude?: string | number | null;
    gpsLongitude?: string | number | null;
  },
): SpatialPhoto {
  return {
    ...photo,
    gpsLatitude: toCoord(photo.gpsLatitude),
    gpsLongitude: toCoord(photo.gpsLongitude),
  };
}

export interface SpatialTestResult {
  id: string;
  status: string;
  lotId: string | null;
  lotNumber: string | null;
  testType: string;
  testRequestNumber: string | null;
}

export interface SpatialSearchResult {
  lots: SpatialLot[];
  lotsTruncated: boolean;
  photos: SpatialPhoto[];
  photosTruncated: boolean;
  testResults: SpatialTestResult[];
  testResultsTruncated: boolean;
}

// Draw-a-box search. A mutation (user-triggered, not cache-keyed by bounds).
// `photosOnly` powers the map's Photos layer, which refetches on every pan and
// reads only `.photos`; it tells the backend to skip the geometry + test-result
// work (other collections come back empty).
export function useSpatialSearch(projectId: string, options?: { photosOnly?: boolean }) {
  const photosOnly = options?.photosOnly ?? false;
  return useMutation({
    mutationKey: queryKeys.spatialSearch(projectId),
    mutationFn: async (bounds: SearchBounds) => {
      const result = await apiFetch<SpatialSearchResult>(
        `/api/projects/${encodeURIComponent(projectId)}/spatial-search`,
        {
          method: 'POST',
          body: JSON.stringify(photosOnly ? { bounds, only: 'photos' } : { bounds }),
        },
      );
      // Normalise photo coords (Prisma Decimal → number|null) once, here, so both
      // the find-by-area panel and the map photo layer read plain numbers.
      return { ...result, photos: result.photos.map(normaliseSpatialPhotoCoords) };
    },
  });
}
