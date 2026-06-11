/**
 * useDocsShellData — shared data layer for the /m/docs sub-tree.
 *
 * NEW PRESENTATION over EXISTING LOGIC. Ships ZERO new endpoints:
 *
 *   DRAWING REGISTER — `GET /api/drawings/:projectId` (the exact list endpoint the
 *   desktop Drawing Register page uses), under the same `queryKeys.drawings`
 *   cache. Each row carries drawingNumber, title, revision, status, the linked
 *   document (id + fileUrl for opening), and supersededBy (current-revision
 *   semantics). Specs live in this same register, so they appear here too — we do
 *   NOT merge in the separate project Documents table (scope: the register only).
 *
 * The screen projects + orders + filters the rows client-side via the pure
 * helpers in docsShellState — mirroring the photos/issues/dockets shell pattern.
 *
 * The foreman view is current-revision-focused, so we pull a generous single page
 * (the backend caps limit at 100) rather than threading pagination through a
 * field surface; client-side search narrows within the loaded set. No new
 * packages.
 */
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { queryKeys } from '@/lib/queryKeys';
import {
  toDocItems,
  currentDocCount,
  type DocItem,
  type DrawingRegisterRow,
} from './docsShellState';

interface DrawingsListResponse {
  drawings?: DrawingRegisterRow[];
}

const DOCS_STALE_TIME_MS = 60_000;
// The drawing register list endpoint caps `limit` at 100; the foreman surface is
// current-revision-focused, so one generous page covers field use.
const DOCS_PAGE_LIMIT = 100;

export interface DocsShellData {
  projectId: string | null;
  /** Projected, current-first: current revisions then superseded (muted) below. */
  items: DocItem[];
  loading: boolean;
  /** Honest load-error message (null while a cached list is still showing). */
  loadError: string | null;
  /** Count of current (non-superseded) revisions — drives the header sub-line. */
  currentCount: number;
  refetch: () => Promise<void>;
}

export function useDocsShellData(projectId: string | null): DocsShellData {
  const enabled = Boolean(projectId) && Boolean(getAuthToken());

  const query = useQuery({
    queryKey: [...queryKeys.drawings(projectId ?? 'none'), 'shell', DOCS_PAGE_LIMIT] as const,
    queryFn: () =>
      apiFetch<DrawingsListResponse>(
        `/api/drawings/${encodeURIComponent(projectId!)}?page=1&limit=${DOCS_PAGE_LIMIT}`,
      ),
    enabled,
    staleTime: DOCS_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });

  const rows = query.data?.drawings;
  const items = useMemo(() => toDocItems(rows ?? []), [rows]);
  const currentCount = useMemo(() => currentDocCount(items), [items]);
  const hasRows = (rows?.length ?? 0) > 0;

  const { refetch: refetchQuery } = query;
  const refetch = useCallback(async () => {
    await refetchQuery();
  }, [refetchQuery]);

  return {
    projectId,
    items,
    loading: query.isLoading && !query.data,
    loadError: query.error && !hasRows ? 'Couldn’t load drawings. Pull back and try again.' : null,
    currentCount,
    refetch,
  };
}
