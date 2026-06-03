import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

// ===== Data contract =====
// Response shapes for the docket edit page bootstrap reads (my-company, assigned
// lots, the edited docket, and the new-docket "already exists for today" check).

export interface Employee {
  id: string;
  name: string;
  role: string;
  hourlyRate: number;
  status: string;
}

export interface Plant {
  id: string;
  type: string;
  description: string;
  idRego: string;
  dryRate: number;
  wetRate: number;
  status: string;
}

export interface Lot {
  id: string;
  lotNumber: string;
  activity?: string;
}

export interface LabourEntry {
  id: string;
  employee: {
    id: string;
    name: string;
    role: string;
    hourlyRate: number;
  };
  startTime: string;
  finishTime: string;
  submittedHours: number;
  hourlyRate: number;
  submittedCost: number;
  lotAllocations: Array<{
    lotId: string;
    lotNumber: string;
    hours: number;
  }>;
}

export interface PlantEntry {
  id: string;
  plant: {
    id: string;
    type: string;
    description: string;
    dryRate: number;
    wetRate: number;
  };
  hoursOperated: number;
  wetOrDry: 'dry' | 'wet';
  hourlyRate: number;
  submittedCost: number;
}

export interface Docket {
  id: string;
  docketNumber: string;
  date: string;
  status: string;
  notes?: string;
  foremanNotes?: string;
  totalLabourSubmitted: number;
  totalPlantSubmitted: number;
  labourEntries: LabourEntry[];
  plantEntries: PlantEntry[];
}

export interface Company {
  id: string;
  projectId: string;
  projectName: string;
  employees: Employee[];
  plant: Plant[];
}

// ===== Path builders =====
// Kept byte-identical to the original inline fetches: my-company encodes the
// requested project id, while the lots/dockets list endpoints interpolate the
// (cuid) project id directly, exactly as before.

export function buildMyCompanyPath(requestedProjectId: string | null): string {
  const companyQuery = requestedProjectId
    ? `?projectId=${encodeURIComponent(requestedProjectId)}`
    : '';
  return `/api/subcontractors/my-company${companyQuery}`;
}

export function buildAssignedLotsPath(projectId: string): string {
  return `/api/lots?projectId=${projectId}`;
}

export function buildDocketDetailPath(docketId: string): string {
  return `/api/dockets/${docketId}`;
}

export function buildExistingDocketsPath(projectId: string): string {
  return `/api/dockets?projectId=${projectId}`;
}

export function buildDocketEditRoute(docketId: string, projectId?: string | null): string {
  const projectQuery = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return `/subcontractor-portal/docket/${docketId}${projectQuery}`;
}

// ===== Response normalizers / selectors =====

export function normalizeAssignedLots(data: { lots?: Lot[] }): Lot[] {
  return data.lots || [];
}

export function normalizeExistingDockets(data: { dockets?: Docket[] }): Docket[] {
  return data.dockets || [];
}

export function findTodayDocket(dockets: Docket[], today: string): Docket | undefined {
  return dockets.find((docket) => docket.date === today);
}

// ===== Fetchers =====

async function fetchMyCompany(requestedProjectId: string | null): Promise<Company> {
  const data = await apiFetch<{ company: Company }>(buildMyCompanyPath(requestedProjectId));
  return data.company;
}

async function fetchAssignedLots(projectId: string): Promise<Lot[]> {
  const data = await apiFetch<{ lots: Lot[] }>(buildAssignedLotsPath(projectId));
  return normalizeAssignedLots(data);
}

async function fetchDocketDetail(docketId: string): Promise<Docket> {
  const data = await apiFetch<{ docket: Docket }>(buildDocketDetailPath(docketId));
  return data.docket;
}

async function fetchExistingDockets(projectId: string): Promise<Docket[]> {
  const data = await apiFetch<{ dockets: Docket[] }>(buildExistingDocketsPath(projectId));
  return normalizeExistingDockets(data);
}

// ===== Query hooks =====
// Portal reads are scoped by user id so one subbie's cache never leaks to
// another (see commit 9574ced). The my-company and existing-dockets reads reuse
// the keys already used by AssignedWorkPage / DocketsListPage so they share the
// same cache entries.

export function useMyCompanyQuery(
  userId: string | null | undefined,
  requestedProjectId: string | null,
) {
  return useQuery({
    queryKey: [...queryKeys.portalCompanies(userId), requestedProjectId ?? 'default'],
    queryFn: () => fetchMyCompany(requestedProjectId),
    enabled: Boolean(userId),
    retry: false,
  });
}

export function useAssignedLotsQuery(
  userId: string | null | undefined,
  projectId: string | null | undefined,
) {
  return useQuery({
    queryKey: queryKeys.portalDocketEditLots(userId, projectId),
    queryFn: () => fetchAssignedLots(projectId!),
    enabled: Boolean(userId) && Boolean(projectId),
    retry: false,
  });
}

export function useDocketEditQuery(
  userId: string | null | undefined,
  docketId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.portalDocket(userId, docketId),
    queryFn: () => fetchDocketDetail(docketId!),
    enabled: Boolean(userId) && Boolean(docketId) && enabled,
    retry: false,
  });
}

export function useExistingDocketsQuery(
  userId: string | null | undefined,
  projectId: string | null | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.portalDockets(userId, projectId),
    queryFn: () => fetchExistingDockets(projectId!),
    enabled: Boolean(userId) && Boolean(projectId) && enabled,
    retry: false,
  });
}
