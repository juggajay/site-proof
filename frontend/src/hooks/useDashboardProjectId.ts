import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '@/lib/auth';
import { readLocalStorageItem, writeLocalStorageItem } from '@/lib/storagePreferences';

// M71: the dashboard's selected project is sticky — driven by the ?projectId
// URL param, falling back to the last choice persisted in browser storage. The
// resolved id is sent to the role dashboard API; the backend validates it and
// falls back to the user's default project when it is missing or inaccessible.
// Storage access goes through the safe storagePreferences helpers.
const STORAGE_KEY_PREFIX = 'dashboardProjectId';

export function useDashboardProjectId() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const storageKey = `${STORAGE_KEY_PREFIX}:${user?.id ?? 'anonymous'}`;
  const fromUrl = searchParams.get('projectId');
  const requestedProjectId = fromUrl || readLocalStorageItem(storageKey) || undefined;

  const setProjectId = useCallback(
    (projectId: string) => {
      writeLocalStorageItem(storageKey, projectId);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('projectId', projectId);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, storageKey],
  );

  const syncResolvedProjectId = useCallback(
    (projectId: string | null | undefined) => {
      if (!projectId || !requestedProjectId || projectId === requestedProjectId) {
        return;
      }
      setProjectId(projectId);
    },
    [requestedProjectId, setProjectId],
  );

  return { requestedProjectId, setProjectId, syncResolvedProjectId };
}
