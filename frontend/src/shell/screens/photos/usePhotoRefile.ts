/**
 * usePhotoRefile — file an unfiled photo to a lot from the shell.
 *
 * REUSES EXISTING LOGIC VERBATIM: the same `PATCH /api/documents/:documentId`
 * endpoint the desktop Documents page already calls (there for the favourite
 * toggle), with the body `{ lotId }`. The backend's classification PATCH route
 * accepts lotId and gates it server-side via requireDocumentMutationAccess;
 * foreman has DOCUMENT_WRITE_ROLES, so this is the gap-closing action research
 * doc 14 identified — the backend always supported it, there was just no UI.
 *
 * On success we invalidate the documents cache (refreshing BOTH this surface and
 * the desktop Documents page) and the lots register (so the lot hub's photo
 * count picks up the newly filed photo). Online-only: a PATCH needs signal.
 *
 * Scope (this PR): only re-file of UNFILED photos. Re-filing an already-filed
 * photo to a different lot is a deliberate follow-up — keep the surface tight.
 */
import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { handleApiError } from '@/lib/errorHandling';
import { queryKeys } from '@/lib/queryKeys';
import { lotsRegisterQueryKey } from '@/pages/lots/hooks/useLotsData';

export function usePhotoRefile(projectId: string | null) {
  const queryClient = useQueryClient();
  const [filing, setFiling] = useState(false);
  const inFlightRef = useRef(false);

  const fileToLot = useCallback(
    async (documentId: string, lotId: string): Promise<boolean> => {
      if (!documentId || !lotId || inFlightRef.current) return false;
      inFlightRef.current = true;
      setFiling(true);
      try {
        await apiFetch(`/api/documents/${encodeURIComponent(documentId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ lotId }),
        });

        toast({ variant: 'success', description: 'Photo filed to lot' });

        await Promise.all([
          // Refreshes the shell photo grid AND the desktop Documents page —
          // both read queryKeys.documents(projectId).
          queryClient.invalidateQueries({
            queryKey: projectId ? queryKeys.documents(projectId) : queryKeys.documents('none'),
          }),
          // The lot hub's photo count derives from the lot register — invalidate
          // it so the count picks up the newly filed photo.
          queryClient.invalidateQueries({
            queryKey: lotsRegisterQueryKey(projectId ?? 'none'),
          }),
        ]);
        return true;
      } catch (err) {
        handleApiError(err, 'Couldn’t file the photo. Try again.');
        return false;
      } finally {
        inFlightRef.current = false;
        setFiling(false);
      }
    },
    [projectId, queryClient],
  );

  return { filing, fileToLot };
}
