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
  totalLabourApprovedCost?: number | null;
  totalPlantApprovedCost?: number | null;
  adjustmentReason?: string | null;
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
    adjustmentReason?: string | null;
    labourEntries?: LabourEntry[];
    plantEntries?: PlantEntry[];
  };
}

export interface ProjectResponse {
  project?: {
    name?: string | null;
    projectNumber?: string | null;
    currentUserRole?: string | null;
  };
}

const DOCKET_APPROVER_ROLES = ['owner', 'admin', 'project_manager', 'site_manager', 'foreman'];

export function canApproveDocketsForProjectRole(role: string | null | undefined): boolean {
  return Boolean(role && DOCKET_APPROVER_ROLES.includes(role));
}

export const normalizeDockets = (data: DocketsResponse): Docket[] =>
  Array.isArray(data) ? data : data.dockets || [];

function moneyValue(value: number | null | undefined): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function hasMoneyValue(value: number | null | undefined): boolean {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function centsDiffer(left: number, right: number): boolean {
  return Math.abs(left - right) >= 0.005;
}

export function formatDocketCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(value);
}

export function getDocketSubmittedLabourCost(docket: Docket): number {
  return moneyValue(docket.totalLabourSubmitted);
}

export function getDocketSubmittedPlantCost(docket: Docket): number {
  return moneyValue(docket.totalPlantSubmitted);
}

export function getDocketSubmittedTotalCost(docket: Docket): number {
  return getDocketSubmittedLabourCost(docket) + getDocketSubmittedPlantCost(docket);
}

export function hasDocketApprovedLabourCost(docket: Docket): boolean {
  return docket.status === 'approved' && hasMoneyValue(docket.totalLabourApprovedCost);
}

export function hasDocketApprovedPlantCost(docket: Docket): boolean {
  return docket.status === 'approved' && hasMoneyValue(docket.totalPlantApprovedCost);
}

export function hasDocketApprovedCost(docket: Docket): boolean {
  return hasDocketApprovedLabourCost(docket) || hasDocketApprovedPlantCost(docket);
}

export function getDocketDisplayLabourCost(docket: Docket): number {
  if (hasDocketApprovedLabourCost(docket)) {
    return moneyValue(docket.totalLabourApprovedCost);
  }
  return getDocketSubmittedLabourCost(docket);
}

export function getDocketDisplayPlantCost(docket: Docket): number {
  if (hasDocketApprovedPlantCost(docket)) {
    return moneyValue(docket.totalPlantApprovedCost);
  }
  return getDocketSubmittedPlantCost(docket);
}

export function getDocketApprovedTotalCost(docket: Docket): number | null {
  if (!hasDocketApprovedCost(docket)) return null;
  return getDocketDisplayLabourCost(docket) + getDocketDisplayPlantCost(docket);
}

export function getDocketDisplayTotalCost(docket: Docket): number {
  return getDocketApprovedTotalCost(docket) ?? getDocketSubmittedTotalCost(docket);
}

export function hasDocketCostAdjustment(docket: Docket): boolean {
  const approvedTotal = getDocketApprovedTotalCost(docket);
  return approvedTotal !== null && centsDiffer(approvedTotal, getDocketSubmittedTotalCost(docket));
}

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

export function useDocketApprovalsQuery(
  projectId: string | undefined,
  statusFilter: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.dockets(projectId ?? 'all-projects', statusFilter),
    queryFn: () => fetchDocketApprovals(projectId, statusFilter),
    enabled: options.enabled ?? true,
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
