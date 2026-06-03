import { useQuery, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { logError } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

// ---------------------------------------------------------------------------
// Types — the ITP template data contract used by ITPPage and its modals.
// ---------------------------------------------------------------------------

export interface ChecklistItem {
  id?: string;
  description: string;
  category: string;
  responsibleParty: 'contractor' | 'subcontractor' | 'superintendent' | 'general';
  isHoldPoint: boolean;
  pointType: 'standard' | 'witness' | 'hold_point';
  evidenceRequired: 'none' | 'photo' | 'test' | 'document';
  verificationMethod?: string;
  acceptanceCriteria?: string;
  testType?: string;
  order: number;
}

export interface ITPTemplate {
  id: string;
  name: string;
  description: string | null;
  activityType: string;
  checklistItems: ChecklistItem[];
  createdAt: string;
  isGlobalTemplate?: boolean;
  stateSpec?: string | null;
  isActive?: boolean;
}

export interface CrossProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  activityType: string;
  checklistItemCount: number;
  holdPointCount: number;
}

export interface ProjectWithTemplates {
  id: string;
  name: string;
  code: string;
  templates: CrossProjectTemplate[];
}

/** Normalized shape served by the page bootstrap query. */
export interface ItpTemplatesData {
  templates: ITPTemplate[];
  projectSpecificationSet: string | null;
}

interface ItpTemplatesResponse {
  templates?: ITPTemplate[];
  projectSpecificationSet?: string;
}

interface CrossProjectTemplatesResponse {
  projects?: ProjectWithTemplates[];
}

// ---------------------------------------------------------------------------
// Path builders
// ---------------------------------------------------------------------------

export function buildItpTemplatesPath(projectId: string, includeGlobal: boolean): string {
  const params = new URLSearchParams();
  params.append('projectId', projectId);
  params.append('includeGlobal', includeGlobal ? 'true' : 'false');
  return `/api/itp/templates?${params.toString()}`;
}

export function buildCrossProjectTemplatesPath(currentProjectId: string): string {
  const params = new URLSearchParams();
  params.append('currentProjectId', currentProjectId);
  return `/api/itp/templates/cross-project?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Response normalization — preserves the page's `data.x || fallback` defaults.
// ---------------------------------------------------------------------------

export const normalizeItpTemplatesResponse = (data: ItpTemplatesResponse): ItpTemplatesData => ({
  templates: data.templates || [],
  projectSpecificationSet: data.projectSpecificationSet || null,
});

export const normalizeCrossProjectTemplates = (
  data: CrossProjectTemplatesResponse,
): ProjectWithTemplates[] => data.projects || [];

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

async function fetchItpTemplates(
  projectId: string,
  includeGlobal: boolean,
): Promise<ItpTemplatesData> {
  try {
    const data = await apiFetch<ItpTemplatesResponse>(
      buildItpTemplatesPath(projectId, includeGlobal),
    );
    return normalizeItpTemplatesResponse(data);
  } catch (error) {
    logError('Failed to fetch ITP templates:', error);
    throw error;
  }
}

async function fetchCrossProjectTemplates(
  currentProjectId: string,
): Promise<ProjectWithTemplates[]> {
  try {
    const data = await apiFetch<CrossProjectTemplatesResponse>(
      buildCrossProjectTemplatesPath(currentProjectId),
    );
    return normalizeCrossProjectTemplates(data);
  } catch (error) {
    logError('Failed to fetch cross-project templates:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Page bootstrap: the project's ITP templates plus its specification set.
 *
 * Behavior preserved from the previous hand-rolled fetch:
 *  - `enabled` only when both a projectId and an auth token are present (the
 *    original bailed early and rendered the empty state otherwise).
 *  - `retry: false` — the original made a single attempt. The global
 *    QueryClient default is `retry: 1`, which would silently swallow a
 *    first-load failure and bypass the error/"Try again" surface.
 */
export function useItpTemplatesQuery(projectId: string | undefined, includeGlobal: boolean) {
  const token = getAuthToken();
  return useQuery({
    queryKey: queryKeys.itpTemplates(projectId ?? 'no-project', includeGlobal),
    queryFn: () => fetchItpTemplates(projectId!, includeGlobal),
    enabled: Boolean(projectId && token),
    retry: false,
  });
}

/**
 * Import modal: ITP templates available to copy from the user's other projects.
 * `retry: false` mirrors the modal's original single-attempt fetch.
 */
export function useCrossProjectItpTemplatesQuery(currentProjectId: string) {
  return useQuery({
    queryKey: queryKeys.itpCrossProjectTemplates(currentProjectId),
    queryFn: () => fetchCrossProjectTemplates(currentProjectId),
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// Cache helper — keeps the page's optimistic, no-refetch list mutations.
// ---------------------------------------------------------------------------

/**
 * Apply an in-place update to the cached ITP templates list for the active
 * (projectId, includeGlobal) query. This replaces the page's previous
 * `setTemplates(updater)` calls one-for-one, so create/clone/import/toggle/edit
 * keep updating the visible list instantly without an extra round-trip.
 *
 * No-ops when the query has no cached data yet (returning the unchanged
 * previous value leaves the cache untouched), which matches the fact that these
 * mutations are only reachable once the list has loaded.
 */
export function applyItpTemplatesUpdate(
  queryClient: QueryClient,
  projectId: string | undefined,
  includeGlobal: boolean,
  updater: (templates: ITPTemplate[]) => ITPTemplate[],
): void {
  queryClient.setQueryData<ItpTemplatesData>(
    queryKeys.itpTemplates(projectId ?? 'no-project', includeGlobal),
    (current) => (current ? { ...current, templates: updater(current.templates) } : current),
  );
}
