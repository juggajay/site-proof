import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { logError } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

export interface Docket {
  id: string;
  docketNumber: string;
  subcontractor: string;
  subcontractorId: string;
  date: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'queried';
  notes: string | null;
  labourHours: number;
  plantHours: number;
  totalLabourSubmitted: number;
  totalLabourApproved: number;
  totalPlantSubmitted: number;
  totalPlantApproved: number;
  submittedAt: string | null;
  approvedAt: string | null;
  foremanNotes: string | null;
}

export interface LabourEntry {
  id: string;
  employee: { name: string; role: string };
  startTime: string | null;
  finishTime: string | null;
  submittedHours: number;
  approvedHours: number;
  hourlyRate: number;
  submittedCost: number;
  approvedCost: number;
}

export interface PlantEntry {
  id: string;
  plant: { type: string; description: string; idRego?: string };
  hoursOperated: number;
  wetOrDry: string;
  hourlyRate: number;
  submittedCost: number;
  approvedCost: number;
}

export type DocketsResponse = Docket[] | { dockets?: Docket[] };

export interface DocketDetailResponse {
  docket?: {
    labourEntries?: LabourEntry[];
    plantEntries?: PlantEntry[];
  };
}

export interface ProjectResponse {
  project?: {
    name?: string | null;
    projectNumber?: string | null;
  };
}

export const normalizeDockets = (data: DocketsResponse): Docket[] =>
  Array.isArray(data) ? data : data.dockets || [];

export function buildDocketApprovalsPath(projectId: string | undefined, statusFilter: string) {
  const queryParams = new URLSearchParams();
  if (projectId) queryParams.append('projectId', projectId);
  if (statusFilter !== 'all') queryParams.append('status', statusFilter);

  const queryString = queryParams.toString();
  return queryString ? `/api/dockets?${queryString}` : '/api/dockets';
}

async function fetchDocketApprovals(
  projectId: string | undefined,
  statusFilter: string,
): Promise<Docket[]> {
  try {
    const data = await apiFetch<DocketsResponse>(buildDocketApprovalsPath(projectId, statusFilter));
    return normalizeDockets(data);
  } catch (error) {
    logError('Error fetching dockets:', error);
    throw error;
  }
}

async function fetchDocketProjectInfo(
  projectId: string,
): Promise<ProjectResponse['project'] | null> {
  try {
    const projectResponse = await apiFetch<ProjectResponse>(
      `/api/projects/${encodeURIComponent(projectId)}`,
    );
    return projectResponse.project ?? null;
  } catch (error) {
    logError('Error fetching docket project info:', error);
    throw error;
  }
}

export function useDocketApprovalsQuery(projectId: string | undefined, statusFilter: string) {
  return useQuery({
    queryKey: queryKeys.dockets(projectId ?? 'all-projects', statusFilter),
    queryFn: () => fetchDocketApprovals(projectId, statusFilter),
    refetchInterval: projectId ? 30000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useDocketProjectQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? queryKeys.docketProject(projectId) : ['docket-project', 'none'],
    queryFn: () => fetchDocketProjectInfo(projectId!),
    enabled: Boolean(projectId),
  });
}
