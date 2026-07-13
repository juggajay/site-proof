import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

// GeoJSON we render — only the shapes the generators produce (Feature wrapping a
// Polygon / LineString / Point). Coordinates are [lng, lat] per the GeoJSON spec.
export type GeoJsonGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'LineString'; coordinates: number[][] }
  | { type: 'Point'; coordinates: number[] };

export interface GeoJsonFeature {
  type: 'Feature';
  properties?: Record<string, unknown> | null;
  geometry: GeoJsonGeometry;
}

export interface ProjectLotGeometry {
  id: string;
  lotId: string;
  lotNumber: string;
  status: string;
  activityType: string | null;
  kind: string;
  controlLineId: string | null;
  geometryWgs84: GeoJsonFeature;
  areaM2: number | null;
  lengthM: number | null;
  chainageStart: number | null;
  chainageEnd: number | null;
}

export interface ProjectControlLine {
  id: string;
  projectId: string;
  name: string;
  coordinateSystem: string;
  geometryWgs84: GeoJsonFeature | null;
}

export function useProjectLotGeometries(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projectLotGeometries(projectId ?? ''),
    queryFn: () => {
      if (!projectId) throw new Error('Project not found');
      return apiFetch<{ geometries: ProjectLotGeometry[] }>(
        `/api/projects/${encodeURIComponent(projectId)}/lot-geometries`,
      );
    },
    enabled: !!projectId,
  });
}

export function useProjectControlLines(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.controlLines(projectId ?? ''),
    // Settings' useControlLines shares this query key, so both queryFns must
    // cache the SAME shape — the unwrapped array. Caching the raw envelope here
    // poisoned the settings cache (and vice versa), leaving the map stuck on
    // its "no control lines" empty state until a hard reload.
    queryFn: async () => {
      if (!projectId) throw new Error('Project not found');
      const data = await apiFetch<{ controlLines: ProjectControlLine[] }>(
        `/api/projects/${encodeURIComponent(projectId)}/control-lines`,
      );
      return data.controlLines ?? [];
    },
    enabled: !!projectId,
  });
}

export interface BackfillResult {
  created: number;
  skipped: { lotId: string; lotNumber: string; reason: string }[];
}

// Generate chainage_offset geometries for every chainaged lot lacking one, using
// a control line. Idempotent server-side; the map refetches on success.
export function backfillLotGeometries(
  projectId: string,
  controlLineId: string,
  offsets: { offsetLeft: number; offsetRight: number },
): Promise<BackfillResult> {
  return apiFetch<BackfillResult>(
    `/api/projects/${encodeURIComponent(projectId)}/control-lines/${encodeURIComponent(
      controlLineId,
    )}/backfill-lot-geometries`,
    { method: 'POST', body: JSON.stringify(offsets) },
  );
}
