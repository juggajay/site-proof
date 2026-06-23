import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// M71: the dashboard's selected project is sticky — driven by the ?projectId
// URL param, falling back to the last choice persisted in localStorage. The
// resolved id is sent to the role dashboard API; the backend validates it and
// falls back to the user's default project when it is missing or inaccessible.
const STORAGE_KEY = 'dashboardProjectId';

function readStoredProjectId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useDashboardProjectId() {
  const [searchParams, setSearchParams] = useSearchParams();
  const fromUrl = searchParams.get('projectId');
  const requestedProjectId = fromUrl || readStoredProjectId() || undefined;

  const setProjectId = useCallback(
    (projectId: string) => {
      try {
        localStorage.setItem(STORAGE_KEY, projectId);
      } catch {
        // Ignore storage failures (private mode / disabled storage).
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('projectId', projectId);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { requestedProjectId, setProjectId };
}
