/**
 * useDocsShellData — shared data layer for the /m/docs sub-tree.
 *
 * NEW PRESENTATION over EXISTING LOGIC. Ships ZERO new endpoints, and reads the
 * TWO tables a drawing can actually live in:
 *
 *   DRAWING REGISTER — `GET /api/drawings/:projectId` (the exact list endpoint the
 *   desktop Drawing Register page uses), under the same `queryKeys.drawings`
 *   cache. Each row carries drawingNumber, title, revision, status, the linked
 *   document (id + fileUrl for opening), and supersededBy (current-revision
 *   semantics). Specs live in this same register, so they appear here too. The
 *   register is project-scoped — the `Drawing` model has no lot link.
 *
 *   LOT-FILED DRAWINGS — `GET /api/documents/:projectId?documentType=drawing`
 *   (the exact list endpoint + type filter the desktop Documents page uses),
 *   under the same `queryKeys.documents` cache so a re-file invalidation
 *   refreshes both surfaces. This is where a lot-specific drawing actually
 *   lands: a Document row with a `lotId`. Reading only the register made the lot
 *   hub's Drawings tile say "No drawings for this lot yet" on lots that had them.
 *
 * The two are merged + deduped (on the document id) by `toDocItems`; the screen
 * orders + filters client-side via the pure helpers in docsShellState —
 * mirroring the photos/issues/dockets shell pattern.
 *
 * The foreman view is current-revision-focused, so the hook walks backend
 * pagination on both endpoints and returns one complete in-memory list for the
 * field surface. Client-side search narrows within the loaded set. No new
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
  type DrawingDocumentRow,
  type DrawingRegisterRow,
} from './docsShellState';

interface PaginationMeta {
  page: number;
  totalPages: number;
  hasNextPage: boolean;
}

interface PagedResponse {
  pagination?: PaginationMeta | null;
}

interface DrawingsListResponse extends PagedResponse {
  drawings?: DrawingRegisterRow[];
}

interface DocumentsListResponse extends PagedResponse {
  documents?: DrawingDocumentRow[];
}

const DOCS_STALE_TIME_MS = 60_000;
const DOCS_PAGE_LIMIT = 100;

/** Walk backend pagination and return every row from every page. */
async function fetchAllPages<R extends PagedResponse, T>(
  buildPath: (page: number) => string,
  readRows: (response: R) => T[] | undefined,
): Promise<T[]> {
  const allRows: T[] = [];
  let page = 1;

  for (;;) {
    const response = await apiFetch<R>(buildPath(page));
    allRows.push(...(readRows(response) ?? []));

    const pagination = response.pagination;
    if (!pagination?.hasNextPage || page >= pagination.totalPages) {
      return allRows;
    }

    page = pagination.page + 1;
  }
}

function fetchAllDrawingRows(projectId: string): Promise<DrawingRegisterRow[]> {
  return fetchAllPages<DrawingsListResponse, DrawingRegisterRow>(
    (page) =>
      `/api/drawings/${encodeURIComponent(projectId)}?page=${page}&limit=${DOCS_PAGE_LIMIT}`,
    (response) => response.drawings,
  );
}

function fetchAllDrawingDocuments(projectId: string): Promise<DrawingDocumentRow[]> {
  return fetchAllPages<DocumentsListResponse, DrawingDocumentRow>(
    (page) =>
      `/api/documents/${encodeURIComponent(
        projectId,
      )}?documentType=drawing&page=${page}&limit=${DOCS_PAGE_LIMIT}`,
    (response) => response.documents,
  );
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

  const registerQuery = useQuery({
    queryKey: [...queryKeys.drawings(projectId ?? 'none'), 'shell', 'all-pages'] as const,
    queryFn: () => fetchAllDrawingRows(projectId!),
    enabled,
    staleTime: DOCS_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });

  // Separate query (not one combined fetch) so each list stays under the cache
  // key its own writers already invalidate — drawings for the register, and
  // documents for a re-file/upload on the Documents page.
  const documentsQuery = useQuery({
    queryKey: [
      ...queryKeys.documents(projectId ?? 'none'),
      'drawing',
      'shell',
      'all-pages',
    ] as const,
    queryFn: () => fetchAllDrawingDocuments(projectId!),
    enabled,
    staleTime: DOCS_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });

  const rows = registerQuery.data;
  const documentRows = documentsQuery.data;
  const items = useMemo(() => toDocItems(rows ?? [], documentRows ?? []), [rows, documentRows]);
  const currentCount = useMemo(() => currentDocCount(items), [items]);
  const hasRows = (rows?.length ?? 0) + (documentRows?.length ?? 0) > 0;

  const { refetch: refetchRegister } = registerQuery;
  const { refetch: refetchDocuments } = documentsQuery;
  const refetch = useCallback(async () => {
    await Promise.all([refetchRegister(), refetchDocuments()]);
  }, [refetchRegister, refetchDocuments]);

  return {
    projectId,
    items,
    loading:
      (registerQuery.isLoading && !registerQuery.data) ||
      (documentsQuery.isLoading && !documentsQuery.data),
    loadError:
      (registerQuery.error || documentsQuery.error) && !hasRows
        ? 'Couldn’t load drawings. Pull back and try again.'
        : null,
    currentCount,
    refetch,
  };
}
