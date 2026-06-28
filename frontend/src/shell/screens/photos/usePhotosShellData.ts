/**
 * usePhotosShellData — shared data layer for the /m/photos sub-tree.
 *
 * NEW PRESENTATION over EXISTING LOGIC. This is the one genuinely new shell
 * surface, but it ships ZERO new endpoints:
 *
 *   SERVER PHOTOS — `GET /api/documents/:projectId?documentType=photo&limit=100` (the exact
 *   list endpoint + photo filter the desktop Documents page uses), under the same
 *   `queryKeys.documents(projectId)` cache so a re-file invalidation refreshes
 *   both surfaces. Each row already carries lotId/lot, caption, gps and fileUrl.
 *
 *   OFFLINE-UNSYNCED PHOTOS — `getUnsyncedPhotos()` from the offline store
 *   (lib/offlineDb), so a just-captured photo or failed upload remains visible
 *   at the top marked "uploading/waiting" or "error". Read through a short
 *   interval TanStack query (no new package; Dexie has no react binding here)
 *   so it refreshes as the sync worker drains the queue.
 *
 * The screens merge + order + filter client-side via the pure helpers in
 * photosShellState — mirroring the dockets/lots/issues shell pattern.
 */
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { queryKeys } from '@/lib/queryKeys';
import { getUnsyncedPhotos } from '@/lib/offlineDb';
import {
  mergePhotoItems,
  unfiledPhotoCount,
  type OfflinePendingPhoto,
  type PhotoItem,
  type ServerPhotoDoc,
} from './photosShellState';

interface DocumentsResponse {
  documents?: ServerPhotoDoc[];
}

const PHOTOS_STALE_TIME_MS = 30_000;
const PHOTOS_DOCUMENTS_PAGE_LIMIT = 100;
// Pending captures live in IndexedDB; poll briefly so the grid reflects the sync
// worker draining the queue without a manual reload. Cheap (local read only).
const PENDING_REFETCH_INTERVAL_MS = 4_000;

export interface PhotosShellData {
  projectId: string | null;
  /** Merged, recent-first: offline-pending on top, then server photos. */
  items: PhotoItem[];
  loading: boolean;
  /** Honest load-error message (null while a cached list is still showing). */
  loadError: string | null;
  /** Count of unfiled photos — drives the header sub-line + Unfiled chip badge. */
  unfiledCount: number;
  refetch: () => Promise<void>;
}

export function usePhotosShellData(projectId: string | null): PhotosShellData {
  const enabled = Boolean(projectId) && Boolean(getAuthToken());

  const serverQuery = useQuery({
    queryKey: [...queryKeys.documents(projectId ?? 'none'), 'photo', 'shell'] as const,
    queryFn: () =>
      apiFetch<DocumentsResponse>(
        `/api/documents/${encodeURIComponent(projectId!)}?documentType=photo&limit=${PHOTOS_DOCUMENTS_PAGE_LIMIT}`,
      ),
    enabled,
    staleTime: PHOTOS_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });

  const pendingQuery = useQuery({
    queryKey: ['shell-pending-photos', projectId ?? 'none'] as const,
    queryFn: async (): Promise<OfflinePendingPhoto[]> => {
      const all = await getUnsyncedPhotos();
      // Scope to the active project; a pending capture always carries projectId.
      return all.filter((p) => !projectId || p.projectId === projectId);
    },
    enabled,
    refetchInterval: PENDING_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  const serverData = serverQuery.data;
  const pendingData = pendingQuery.data;

  const items = useMemo(
    () => mergePhotoItems(serverData?.documents ?? [], pendingData ?? []),
    [serverData, pendingData],
  );
  const unfiledCount = useMemo(() => unfiledPhotoCount(items), [items]);
  const hasServerDocs = (serverData?.documents?.length ?? 0) > 0;

  const { refetch: refetchServer } = serverQuery;
  const { refetch: refetchPending } = pendingQuery;
  const refetch = useCallback(async () => {
    await Promise.all([refetchServer(), refetchPending()]);
  }, [refetchServer, refetchPending]);

  return {
    projectId,
    items,
    loading: serverQuery.isLoading && !serverQuery.data,
    loadError:
      serverQuery.error && !hasServerDocs ? 'Couldn’t load photos. Pull back and try again.' : null,
    unfiledCount,
    refetch,
  };
}
