import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
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
        void queryClient.invalidateQueries({ queryKey: queryKeys.controlLines(projectId) });
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
        void queryClient.invalidateQueries({ queryKey: queryKeys.controlLines(projectId) });
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
        void queryClient.invalidateQueries({ queryKey: queryKeys.controlLines(projectId) });
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
