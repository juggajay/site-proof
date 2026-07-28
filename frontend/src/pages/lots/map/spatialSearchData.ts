import { useMutation } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toFiniteNumber } from '@/lib/samplePoint';

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
// or null/undefined when absent. Non-finite parses (e.g. '') become null, so a
// blank coordinate never becomes (0, 0) in the Gulf of Guinea. Shared with the
// test-card / pin-popup formatters in `lib/samplePoint`.
const toCoord = toFiniteNumber;

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
  // Wave C3 Phase B2. Present in `only=tests` mode (the map's pin layer) and on
  // the default find-by-area query, where they distinguish a located test from an
  // unlocated one for the panel's count. `passFail` rides with them for the pin
  // popup. Normalised to number|null by `normaliseSpatialTestCoords`.
  passFail?: string | null;
  sampleLatitude?: number | null;
  sampleLongitude?: number | null;
  sampleLocationSource?: string | null;
  sampleLocationAccuracyM?: number | null;
}

export function normaliseSpatialTestCoords(
  test: SpatialTestResult & {
    sampleLatitude?: string | number | null;
    sampleLongitude?: string | number | null;
    sampleLocationAccuracyM?: string | number | null;
  },
): SpatialTestResult {
  return {
    ...test,
    sampleLatitude: toCoord(test.sampleLatitude),
    sampleLongitude: toCoord(test.sampleLongitude),
    sampleLocationAccuracyM: toCoord(test.sampleLocationAccuracyM),
  };
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
// `only` powers the map's single-layer modes, each of which refetches on every pan
// and reads only its own collection: 'photos' for the Photos layer, 'tests' (Wave
// C3) for the test-pin layer. It tells the backend to skip the work the other
// collections need (they come back empty; the response shape is unchanged).
export function useSpatialSearch(projectId: string, options?: { only?: 'photos' | 'tests' }) {
  const only = options?.only;
  return useMutation({
    mutationKey: queryKeys.spatialSearch(projectId),
    mutationFn: async (bounds: SearchBounds) => {
      const result = await apiFetch<SpatialSearchResult>(
        `/api/projects/${encodeURIComponent(projectId)}/spatial-search`,
        {
          method: 'POST',
          body: JSON.stringify(only ? { bounds, only } : { bounds }),
        },
      );
      // Normalise coords (Prisma Decimal → number|null) once, here, so the
      // find-by-area panel and both map layers read plain numbers.
      return {
        ...result,
        photos: result.photos.map(normaliseSpatialPhotoCoords),
        testResults: result.testResults.map(normaliseSpatialTestCoords),
      };
    },
  });
}
