import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

import type { GeoJsonFeature } from './lotMapData';

// The aggregate group's activityType — also the panel's default select value.
export const ALL_WORK_TYPES = 'All work types';

export interface CoverageGap {
  start: number;
  end: number;
  lengthM: number;
  polygonWgs84: GeoJsonFeature;
}

export interface CoverageGroup {
  activityType: string;
  lotCount: number;
  percentLotted: number;
  percentConformed: number;
  coveredLengthM: number;
  conformedLengthM: number;
  gaps: CoverageGap[];
}

// A control line either computed successfully (groups) or degraded (error).
export interface CoverageLine {
  id: string;
  name: string;
  extentStart?: number;
  extentEnd?: number;
  groups?: CoverageGroup[];
  error?: string;
}

export interface CoverageResponse {
  controlLines: CoverageLine[];
  // Project-wide count of lots with no geometry (excluded from all lines).
  unmappedLotCount?: number;
}

export function useProjectCoverage(projectId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.projectCoverage(projectId ?? ''),
    queryFn: () => {
      if (!projectId) throw new Error('Project not found');
      return apiFetch<CoverageResponse>(`/api/projects/${encodeURIComponent(projectId)}/coverage`);
    },
    enabled: enabled && !!projectId,
  });
}

// The group matching `activityType`, falling back to the "All work types"
// aggregate (then the first group). Pure so the panel's selection is testable.
export function selectCoverageGroup(
  line: CoverageLine,
  activityType: string,
): CoverageGroup | null {
  const groups = line.groups;
  if (!groups || groups.length === 0) return null;
  return (
    groups.find((g) => g.activityType === activityType) ??
    groups.find((g) => g.activityType === ALL_WORK_TYPES) ??
    groups[0]
  );
}
