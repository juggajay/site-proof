/**
 * useDocketsShellData — shared data layer for the /m/dockets sub-tree.
 *
 * NEW PRESENTATION over EXISTING LOGIC: reuses the same TanStack queries the
 * desktop/mobile approvals surface uses —
 *   - `useDocketApprovalsQuery(projectId, 'all')` (key `queryKeys.dockets`),
 *   - `useDocketProjectQuery(projectId)` (key `queryKeys.docketProject`).
 *
 * The shell fetches the full submitted set once (status='all') and the list/detail
 * screens filter client-side via the pure `filterSubmittedDockets`, exactly as
 * DocketApprovalsPage derives `filteredDockets` from `submittedDockets`. This keeps
 * one download shared across the list, detail, and reason screens and lets the
 * detail screen resolve a docket by id without a second fetch.
 *
 * No new endpoints; no new packages.
 */
import { useCallback, useMemo } from 'react';
import {
  type Docket,
  useDocketApprovalsQuery,
  useDocketProjectQuery,
} from '@/pages/dockets/docketApprovalsData';
import { extractErrorMessage } from '@/lib/errorHandling';
import { pendingDocketCount } from './docketsShellState';

const EMPTY_DOCKETS: Docket[] = [];

export interface DocketsShellData {
  projectId: string | null;
  /** All submitted dockets (drafts already excluded downstream by filters). */
  dockets: Docket[];
  projectName: string | null;
  loading: boolean;
  /** Honest load-error message (null while a cached list is still showing). */
  loadError: string | null;
  pendingCount: number;
  refetch: () => Promise<void>;
}

export function useDocketsShellData(projectId: string | null): DocketsShellData {
  // status='all' — fetch everything once; chips filter client-side (parity with
  // DocketApprovalsPage's submittedDockets → filteredDockets derivation).
  const docketsQuery = useDocketApprovalsQuery(projectId ?? undefined, 'all');
  const projectQuery = useDocketProjectQuery(projectId ?? undefined);

  const dockets = docketsQuery.data ?? EMPTY_DOCKETS;
  const loading = docketsQuery.isLoading && !docketsQuery.data;
  const loadError =
    docketsQuery.error && !docketsQuery.data
      ? extractErrorMessage(docketsQuery.error, 'Failed to fetch dockets')
      : null;

  const pendingCount = useMemo(() => pendingDocketCount(dockets), [dockets]);

  const { refetch } = docketsQuery;
  const refetchAll = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    projectId,
    dockets,
    projectName: projectQuery.data?.name ?? null,
    loading,
    loadError,
    pendingCount,
    refetch: refetchAll,
  };
}
