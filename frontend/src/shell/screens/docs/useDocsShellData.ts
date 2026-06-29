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
 * The foreman view is current-revision-focused, so the hook walks backend
 * pagination and returns one complete in-memory list for the field surface.
 * Client-side search narrows within the loaded set. No new packages.
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
  pagination?: PaginationMeta | null;
}

interface PaginationMeta {
  page: number;
  totalPages: number;
  hasNextPage: boolean;
}

const DOCS_STALE_TIME_MS = 60_000;
const DOCS_PAGE_LIMIT = 100;

async function fetchAllDrawingRows(projectId: string): Promise<DrawingsListResponse> {
  const allRows: DrawingRegisterRow[] = [];
  let page = 1;

  for (;;) {
    const response = await apiFetch<DrawingsListResponse>(
      `/api/drawings/${encodeURIComponent(projectId)}?page=${page}&limit=${DOCS_PAGE_LIMIT}`,
    );
    allRows.push(...(response.drawings ?? []));

    const pagination = response.pagination;
    if (!pagination?.hasNextPage || page >= pagination.totalPages) {
      return { drawings: allRows };
    }

    page = pagination.page + 1;
  }
}

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
    queryKey: [...queryKeys.drawings(projectId ?? 'none'), 'shell', 'all-pages'] as const,
    queryFn: () => fetchAllDrawingRows(projectId!),
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
