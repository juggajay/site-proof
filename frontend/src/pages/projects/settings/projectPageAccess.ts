import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import type { Project } from './types';

export const PROJECT_ADMIN_ROLES = ['owner', 'admin', 'project_manager'] as const;

export const ARCHIVED_PROJECT_SETTINGS_MESSAGE =
  'Archived projects are read-only. Restore the project before editing.';

export function canManageProjectForRole(role: string | null | undefined): boolean {
  return PROJECT_ADMIN_ROLES.includes(role as (typeof PROJECT_ADMIN_ROLES)[number]);
}

export function canGrantProjectAdminRole(
  companyRole: string | null | undefined,
  projectScopedRole: string | null | undefined,
): boolean {
  return companyRole === 'owner' || companyRole === 'admin' || projectScopedRole === 'admin';
}

export function isArchivedProject(project: Pick<Project, 'status'> | null | undefined): boolean {
  return project?.status === 'archived';
}

export async function fetchProjectForAdminPage(projectId: string): Promise<Project> {
  const data = await apiFetch<{ project: Project }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
  );
  return data.project;
}

export function useProjectAdminResource<T>({
  projectId,
  resourceLabel,
  loadItems,
}: {
  projectId: string | undefined;
  resourceLabel: string;
  loadItems: (projectId: string) => Promise<T[]>;
}): {
  project: Project | null;
  items: T[];
  setItems: Dispatch<SetStateAction<T[]>>;
  loading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
  canManageProject: boolean;
  readOnly: boolean;
} {
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setItems([]);
      setLoading(false);
      setLoadError('Project not found');
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const routeProject = await fetchProjectForAdminPage(projectId);
      setProject(routeProject);

      if (!canManageProjectForRole(routeProject.currentUserRole)) {
        setItems([]);
        return;
      }

      setItems(await loadItems(projectId));
    } catch (err) {
      logError(`Failed to fetch ${resourceLabel}:`, err);
      setItems([]);
      setLoadError(extractErrorMessage(err, `Could not load ${resourceLabel}. Please try again.`));
    } finally {
      setLoading(false);
    }
  }, [loadItems, projectId, resourceLabel]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const canManageProject = project ? canManageProjectForRole(project.currentUserRole) : false;

  return {
    project,
    items,
    setItems,
    loading,
    loadError,
    reload,
    canManageProject,
    readOnly: isArchivedProject(project),
  };
}
