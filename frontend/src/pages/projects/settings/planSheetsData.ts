import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch, ApiError, authFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  canManageProjectForRole,
  fetchProjectForAdminPage,
  isArchivedProject,
} from './projectPageAccess';
import type { AffineTransform, RegistrationPoint } from './planSheetRegistration';

/** A WGS84 corner as [lng, lat] (GeoJSON axis order). */
export type SheetCorner = [number, number];

/** The four image corners in WGS84, for a georeferenced map overlay. */
export interface SheetCornersWgs84 {
  topLeft: SheetCorner;
  topRight: SheetCorner;
  bottomRight: SheetCorner;
  bottomLeft: SheetCorner;
}

// List rows returned by GET .../plan-sheets. The raw registration payload is
// omitted, but cornersWgs84 (derived from it) and the perimeter ring are
// included so the map overlay can place + clip a sheet without a detail fetch.
export interface PlanSheetListItem {
  id: string;
  name: string;
  pageNumber: number;
  imageWidth: number;
  imageHeight: number;
  coordinateSystem: string;
  hasRegistration: boolean;
  cornersWgs84: SheetCornersWgs84 | null;
  perimeter: [number, number][] | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanSheetRegistration {
  points: RegistrationPoint[];
  transform: AffineTransform;
  rmsErrorM: number;
}

// Full sheet returned by GET .../plan-sheets/:id.
export interface PlanSheet extends PlanSheetListItem {
  projectId: string;
  documentId: string | null;
  imageRef: string;
  registration: PlanSheetRegistration | null;
  perimeter: [number, number][] | null;
  createdById: string | null;
}

export interface UpdatePlanSheetInput {
  name?: string;
  coordinateSystem?: string;
  // null clears the stored value; undefined leaves it untouched.
  registration?: PlanSheetRegistration | null;
  perimeter?: [number, number][] | null;
}

const PLAN_SHEETS_STALE_TIME_MS = 30_000;
const EMPTY_PLAN_SHEETS: PlanSheetListItem[] = [];

function planSheetsPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/plan-sheets`;
}

export function usePlanSheets(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.planSheets(projectId ?? 'none'),
    queryFn: async () => {
      const data = await apiFetch<{ planSheets: PlanSheetListItem[] }>(planSheetsPath(projectId!));
      return data.planSheets ?? EMPTY_PLAN_SHEETS;
    },
    enabled: Boolean(projectId),
    staleTime: PLAN_SHEETS_STALE_TIME_MS,
  });
}

/** Fetch one full plan sheet (with registration/perimeter) on demand. */
export async function fetchPlanSheet(projectId: string, id: string): Promise<PlanSheet> {
  const data = await apiFetch<{ planSheet: PlanSheet }>(
    `${planSheetsPath(projectId)}/${encodeURIComponent(id)}`,
  );
  return data.planSheet;
}

export function useUpdatePlanSheet(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePlanSheetInput }) => {
      const data = await apiFetch<{ planSheet: PlanSheet }>(
        `${planSheetsPath(projectId!)}/${encodeURIComponent(id)}`,
        { method: 'PATCH', body: JSON.stringify(input) },
      );
      return data.planSheet;
    },
    onSuccess: () => {
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.planSheets(projectId) });
      }
    },
  });
}

export function useDeletePlanSheet(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`${planSheetsPath(projectId!)}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return id;
    },
    onSuccess: () => {
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.planSheets(projectId) });
      }
    },
  });
}

/**
 * Upload one rendered page as a plan sheet (multipart). The PNG blob is the
 * `image` field; the rest are text fields the backend validates.
 */
export async function createPlanSheet(
  projectId: string,
  input: { blob: Blob; name: string; pageNumber: number; coordinateSystem: string },
): Promise<PlanSheetListItem> {
  const form = new FormData();
  form.append('image', input.blob, `${input.name}.png`);
  form.append('name', input.name);
  form.append('pageNumber', String(input.pageNumber));
  form.append('coordinateSystem', input.coordinateSystem);

  // authFetch (not apiFetch) so the browser sets the multipart boundary itself —
  // apiFetch would force a JSON Content-Type. Same pattern as comment uploads.
  const response = await authFetch(planSheetsPath(projectId), { method: 'POST', body: form });
  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }
  const data = (await response.json()) as { planSheet: PlanSheetListItem };
  return data.planSheet;
}

/**
 * Imperative PATCH for the upload flow (georeference auto-registration), which
 * runs outside React Query's hook lifecycle. Mirrors useUpdatePlanSheet's call.
 */
export async function updatePlanSheet(
  projectId: string,
  id: string,
  input: UpdatePlanSheetInput,
): Promise<PlanSheet> {
  const data = await apiFetch<{ planSheet: PlanSheet }>(
    `${planSheetsPath(projectId)}/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  return data.planSheet;
}

/**
 * Write/read capability from the project's server-derived role — identical
 * gating to control lines (owner/admin/project_manager write; any internal role
 * reads). The backend is the real trust boundary; this only shapes the UI.
 */
export function usePlanSheetsAccess(projectId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.project(projectId ?? 'none'),
    queryFn: () => fetchProjectForAdminPage(projectId!),
    enabled: Boolean(projectId),
    staleTime: PLAN_SHEETS_STALE_TIME_MS,
  });

  return useMemo(() => {
    const project = query.data ?? null;
    const canManage = project ? canManageProjectForRole(project.currentUserRole) : false;
    return {
      project,
      canManage,
      readOnly: isArchivedProject(project),
      loading: query.isLoading,
      error: query.error,
    };
  }, [query.data, query.error, query.isLoading]);
}
