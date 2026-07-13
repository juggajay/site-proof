import { useEffect, useState } from 'react';

import { authFetch } from '@/lib/api';
import { logError } from '@/lib/logger';

/**
 * Loads the authenticated plan-sheet image (`GET .../plan-sheets/:id/image`) as
 * a blob and exposes it as an object URL, revoked on unmount / id change — the
 * same authenticated-fetch-then-object-URL approach SecureDocumentImage uses,
 * but against the plan-sheet stream route rather than the signed-document route.
 */
export function usePlanSheetImage(
  projectId: string | undefined,
  sheetId: string | undefined,
): { url: string | null; loading: boolean; error: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!projectId || !sheetId) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(false);

    void (async () => {
      try {
        const response = await authFetch(
          `/api/projects/${encodeURIComponent(projectId)}/plan-sheets/${encodeURIComponent(
            sheetId,
          )}/image`,
        );
        if (!response.ok) throw new Error(`Image request failed (${response.status})`);
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (err) {
        logError('Failed to load plan sheet image:', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, sheetId]);

  return { url, loading, error };
}
