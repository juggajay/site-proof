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
export function useSpatialSearch(projectId: string) {
  return useMutation({
    mutationKey: queryKeys.spatialSearch(projectId),
    mutationFn: (bounds: SearchBounds) =>
      apiFetch<SpatialSearchResult>(
        `/api/projects/${encodeURIComponent(projectId)}/spatial-search`,
        { method: 'POST', body: JSON.stringify({ bounds }) },
      ),
  });
}
