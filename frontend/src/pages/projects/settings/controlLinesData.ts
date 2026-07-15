import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { apiFetch, ApiError, authFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { ControlPoint } from './controlPointsParsing';
import {
  canManageProjectForRole,
  fetchProjectForAdminPage,
  isArchivedProject,
} from './projectPageAccess';

export interface ControlLine {
  id: string;
  projectId: string;
  name: string;
  coordinateSystem: string;
  points: ControlPoint[];
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ControlLineInput {
  name: string;
  coordinateSystem: string;
  points: ControlPoint[];
}

const CONTROL_LINES_STALE_TIME_MS = 30_000;
const EMPTY_CONTROL_LINES: ControlLine[] = [];

function controlLinesPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/control-lines`;
}

// A control-line write is visible in two places that key their own queries: the
// settings list (controlLines) and the Lot Register map (controlLines +
// projectLotGeometries — deleting a line SetNulls geometries, and a
// create+backfill produces them). Refresh every consumer so no view is stuck on
// a stale "no control lines" / empty-map state until a hard reload.
function invalidateControlLineConsumers(queryClient: QueryClient, projectId: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.controlLines(projectId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.projectLotGeometries(projectId) });
}

/** One importable alignment parsed from a LandXML/DXF file (points included). */
export interface ImportedAlignmentSummary {
  name: string;
  points: ControlPoint[];
  pointCount: number;
  chainageStart: number;
  chainageEnd: number;
  lengthM: number;
  bbox: { minE: number; minN: number; maxE: number; maxN: number };
}

export interface AlignmentImportPreview {
  format: 'landxml' | 'dxf';
  alignments: ImportedAlignmentSummary[];
  warnings: string[];
}

/**
 * Upload a LandXML/DXF file and get back a per-alignment preview. authFetch (not
 * apiFetch) so the browser sets the multipart boundary itself. No DB write — the
 * user reviews the preview, then creates selected alignments via
 * useCreateControlLine, which reuses the same server-side create validation.
 */
export function useImportAlignments(projectId: string | undefined) {
  return useMutation({
    mutationFn: async (file: File): Promise<AlignmentImportPreview> => {
      const form = new FormData();
      form.append('file', file, file.name);
      const response = await authFetch(`${controlLinesPath(projectId!)}/import`, {
        method: 'POST',
        body: form,
      });
      if (!response.ok) {
        throw new ApiError(response.status, await response.text());
      }
      return (await response.json()) as AlignmentImportPreview;
    },
  });
}

/** A reviewed control-line candidate extracted by AI from a setout sheet. */
export interface SetoutExtractionCandidate {
  /** Guessed EPSG (already mapped to a supported code) or null if undetermined. */
  coordinateSystem: string | null;
  points: ControlPoint[];
  warnings: string[];
}

/**
 * Upload a setout-sheet PDF/image and get back one AI-extracted candidate (points
 * + a guessed EPSG + warnings). authFetch (not apiFetch) so the browser sets the
 * multipart boundary itself. No DB write — the user reviews the candidate, then
 * saves it via useCreateControlLine (same server-side create validation).
 */
export function useExtractSetoutPoints(projectId: string | undefined) {
  return useMutation({
    mutationFn: async (file: File): Promise<SetoutExtractionCandidate> => {
      const form = new FormData();
      form.append('file', file, file.name);
      const response = await authFetch(`${controlLinesPath(projectId!)}/extract-points`, {
        method: 'POST',
        body: form,
      });
      if (!response.ok) {
        throw new ApiError(response.status, await response.text());
      }
      const data = (await response.json()) as { candidate: SetoutExtractionCandidate };
      return data.candidate;
    },
  });
}

export function useControlLines(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.controlLines(projectId ?? 'none'),
    queryFn: async () => {
      const data = await apiFetch<{ controlLines: ControlLine[] }>(controlLinesPath(projectId!));
      return data.controlLines ?? EMPTY_CONTROL_LINES;
    },
    enabled: Boolean(projectId),
    staleTime: CONTROL_LINES_STALE_TIME_MS,
  });
}

export function useCreateControlLine(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ControlLineInput) => {
      const data = await apiFetch<{ controlLine: ControlLine }>(controlLinesPath(projectId!), {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return data.controlLine;
    },
    onSuccess: () => {
      if (projectId) {
        invalidateControlLineConsumers(queryClient, projectId);
      }
    },
  });
}

export function useUpdateControlLine(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ControlLineInput }) => {
      const data = await apiFetch<{ controlLine: ControlLine }>(
        `${controlLinesPath(projectId!)}/${encodeURIComponent(id)}`,
        { method: 'PATCH', body: JSON.stringify(input) },
      );
      return data.controlLine;
    },
    onSuccess: () => {
      if (projectId) {
        invalidateControlLineConsumers(queryClient, projectId);
      }
    },
  });
}

export function useDeleteControlLine(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`${controlLinesPath(projectId!)}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return id;
    },
    onSuccess: () => {
      if (projectId) {
        invalidateControlLineConsumers(queryClient, projectId);
      }
    },
  });
}

/**
 * Resolves the current user's write/read capability for control lines from the
 * project's server-derived role. `currentUserRole` comes from the backend (not
 * the dev RoleSwitcher override), so write gating stays honest. The backend is
 * the real trust boundary — this only shapes the UI.
 */
export function useControlLinesAccess(projectId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.project(projectId ?? 'none'),
    queryFn: () => fetchProjectForAdminPage(projectId!),
    enabled: Boolean(projectId),
    staleTime: CONTROL_LINES_STALE_TIME_MS,
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
