import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { fetchAllLotPages } from '@/lib/lots';
import { queryKeys } from '@/lib/queryKeys';
import {
  buildPortalCompanyQuery,
  portalCompanyQueryKeyParts,
  type PortalCompanyOption,
  type PortalCompanyScope,
} from './portalCompanyScope';

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
  approvedHours?: number | null;
  approvedCost?: number | null;
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
  approvedCost?: number | null;
  lotAllocations?: Array<{
    lotId: string;
    lotNumber: string;
    hours: number;
  }>;
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
  totalLabourApprovedCost?: number | null;
  totalPlantApprovedCost?: number | null;
  adjustmentReason?: string | null;
  labourEntries: LabourEntry[];
  plantEntries: PlantEntry[];
}

export interface DocketCostSummary {
  status: string;
  totalLabourSubmitted?: number | null;
  totalPlantSubmitted?: number | null;
  totalLabourApprovedCost?: number | null;
  totalPlantApprovedCost?: number | null;
}

export interface Company {
  id: string;
  projectId: string;
  projectName: string;
  companyName?: string;
  availableProjects?: PortalCompanyOption[];
  employees: Employee[];
  plant: Plant[];
}

// ===== Path builders =====
// Query values are always encoded before interpolation. Project ids are server
// controlled in normal use, but deep links can still carry arbitrary values.

export function buildMyCompanyPath(
  requestedProjectId: string | null,
  requestedSubcontractorCompanyId?: string | null,
): string {
  return `/api/subcontractors/my-company${buildPortalCompanyQuery({
    projectId: requestedProjectId,
    subcontractorCompanyId: requestedSubcontractorCompanyId,
  })}`;
}

export function buildAssignedLotsPath(
  projectId: string,
  subcontractorCompanyId?: string | null,
): string {
  return `/api/lots${buildPortalCompanyQuery({ projectId, subcontractorCompanyId })}`;
}

export function buildDocketDetailPath(docketId: string): string {
  return `/api/dockets/${encodeURIComponent(docketId)}`;
}

export function buildDocketLabourPath(docketId: string): string {
  return `${buildDocketDetailPath(docketId)}/labour`;
}

export function buildDocketPlantPath(docketId: string): string {
  return `${buildDocketDetailPath(docketId)}/plant`;
}

export function buildDocketLabourEntryPath(docketId: string, entryId: string): string {
  return `${buildDocketLabourPath(docketId)}/${encodeURIComponent(entryId)}`;
}

export function buildDocketPlantEntryPath(docketId: string, entryId: string): string {
  return `${buildDocketPlantPath(docketId)}/${encodeURIComponent(entryId)}`;
}

export function buildExistingDocketsPath(
  projectId: string,
  subcontractorCompanyId?: string | null,
): string {
  return `/api/dockets${buildPortalCompanyQuery({ projectId, subcontractorCompanyId })}`;
}

export function buildDocketEditRoute(
  docketId: string,
  projectId?: string | null,
  subcontractorCompanyId?: string | null,
): string {
  return `/subcontractor-portal/docket/${encodeURIComponent(docketId)}${buildPortalCompanyQuery({
    projectId,
    subcontractorCompanyId,
  })}`;
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

function moneyValue(value: number | null | undefined): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function hasApprovedCost(value: number | null | undefined): boolean {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function amountsDiffer(left: number | null | undefined, right: number | null | undefined): boolean {
  return Math.abs(moneyValue(left) - moneyValue(right)) >= 0.005;
}

export function getDocketDisplayLabourCost(docket: DocketCostSummary): number {
  if (docket.status === 'approved' && hasApprovedCost(docket.totalLabourApprovedCost)) {
    return moneyValue(docket.totalLabourApprovedCost);
  }
  return moneyValue(docket.totalLabourSubmitted);
}

export function getDocketDisplayPlantCost(docket: DocketCostSummary): number {
  if (docket.status === 'approved' && hasApprovedCost(docket.totalPlantApprovedCost)) {
    return moneyValue(docket.totalPlantApprovedCost);
  }
  return moneyValue(docket.totalPlantSubmitted);
}

export function getDocketDisplayTotalCost(docket: DocketCostSummary): number {
  return getDocketDisplayLabourCost(docket) + getDocketDisplayPlantCost(docket);
}

export function getDocketDisplayLabourEntryHours(
  docket: DocketCostSummary,
  entry: LabourEntry,
): number {
  if (docket.status === 'approved' && hasApprovedCost(entry.approvedHours)) {
    return moneyValue(entry.approvedHours);
  }
  return moneyValue(entry.submittedHours);
}

export function getDocketDisplayLabourEntryCost(
  docket: DocketCostSummary,
  entry: LabourEntry,
): number {
  if (docket.status === 'approved' && hasApprovedCost(entry.approvedCost)) {
    return moneyValue(entry.approvedCost);
  }
  return moneyValue(entry.submittedCost);
}

export function getDocketDisplayPlantEntryCost(
  docket: DocketCostSummary,
  entry: PlantEntry,
): number {
  if (docket.status === 'approved' && hasApprovedCost(entry.approvedCost)) {
    return moneyValue(entry.approvedCost);
  }
  return moneyValue(entry.submittedCost);
}

export function hasDocketLabourEntryAdjustment(
  docket: DocketCostSummary,
  entry: LabourEntry,
): boolean {
  if (docket.status !== 'approved') return false;
  return (
    amountsDiffer(getDocketDisplayLabourEntryHours(docket, entry), entry.submittedHours) ||
    amountsDiffer(getDocketDisplayLabourEntryCost(docket, entry), entry.submittedCost)
  );
}

export function hasDocketPlantEntryCostAdjustment(
  docket: DocketCostSummary,
  entry: PlantEntry,
): boolean {
  if (docket.status !== 'approved') return false;
  return amountsDiffer(getDocketDisplayPlantEntryCost(docket, entry), entry.submittedCost);
}

// ===== Fetchers =====

async function fetchMyCompany(
  requestedProjectId: string | null,
  requestedSubcontractorCompanyId?: string | null,
): Promise<Company> {
  const data = await apiFetch<{ company: Company }>(
    buildMyCompanyPath(requestedProjectId, requestedSubcontractorCompanyId),
  );
  return data.company;
}

async function fetchAssignedLots(
  projectId: string,
  subcontractorCompanyId?: string | null,
): Promise<Lot[]> {
  // The docket lot selector needs the COMPLETE assigned-lot set, so follow every
  // page rather than stopping at the first 20.
  return fetchAllLotPages<Lot>(buildAssignedLotsPath(projectId, subcontractorCompanyId));
}

async function fetchDocketDetail(docketId: string): Promise<Docket> {
  const data = await apiFetch<{ docket: Docket }>(buildDocketDetailPath(docketId));
  return data.docket;
}

async function fetchExistingDockets(
  projectId: string,
  subcontractorCompanyId?: string | null,
): Promise<Docket[]> {
  const data = await apiFetch<{ dockets: Docket[] }>(
    buildExistingDocketsPath(projectId, subcontractorCompanyId),
  );
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
  requestedSubcontractorCompanyId?: string | null,
) {
  const scope: PortalCompanyScope = {
    projectId: requestedProjectId,
    subcontractorCompanyId: requestedSubcontractorCompanyId,
  };
  return useQuery({
    queryKey: [...queryKeys.portalCompanies(userId), ...portalCompanyQueryKeyParts(scope)],
    queryFn: () => fetchMyCompany(requestedProjectId, requestedSubcontractorCompanyId),
    enabled: Boolean(userId),
    retry: false,
  });
}

export function useAssignedLotsQuery(
  userId: string | null | undefined,
  projectId: string | null | undefined,
  subcontractorCompanyId?: string | null,
) {
  return useQuery({
    queryKey: queryKeys.portalDocketEditLots(userId, projectId, subcontractorCompanyId),
    queryFn: () => fetchAssignedLots(projectId!, subcontractorCompanyId),
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
  subcontractorCompanyId: string | null | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.portalDockets(userId, projectId, subcontractorCompanyId),
    queryFn: () => fetchExistingDockets(projectId!, subcontractorCompanyId),
    enabled: Boolean(userId) && Boolean(projectId) && enabled,
    retry: false,
  });
}
