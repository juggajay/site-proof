/**
 * useIssuesShellData — shared data layer for the /m/issues sub-tree.
 *
 * NEW PRESENTATION over EXISTING LOGIC: this wraps the canonical NCR register
 * hook `useNCRData` verbatim (same `queryKeys.ncrs(projectId)` cache, same
 * `/api/ncrs?projectId=…` fetch, same `fetchNcrs` invalidation entry point the
 * desktop register and every NCR mutation already use). The shell fetches the
 * full set once and the list/detail screens filter + sort client-side via the
 * pure helpers in issuesShellState — mirroring the dockets/lots shell pattern.
 *
 * No new endpoints; no new packages.
 */
import { useCallback, useMemo } from 'react';
import { useNCRData } from '@/pages/ncr/hooks/useNCRData';
import { getAuthToken } from '@/lib/auth';
import type { NCR } from '@/pages/ncr/types';
import { openIssueCount } from './issuesShellState';

export interface IssuesShellData {
  projectId: string | null;
  /** Every NCR on the project, newest-issue ordering applied downstream. */
  ncrs: NCR[];
  loading: boolean;
  /** Honest load-error message (null while a cached list is still showing). */
  loadError: string | null;
  /** Count of still-open NCRs — drives the header sub-line + Open chip badge. */
  openCount: number;
  refetch: () => Promise<void>;
}

export function useIssuesShellData(projectId: string | null): IssuesShellData {
  const token = getAuthToken();
  const { ncrs, loading, error, fetchNcrs } = useNCRData({
    projectId: projectId ?? undefined,
    token,
  });

  const list = ncrs as NCR[];
  const openCount = useMemo(() => openIssueCount(list), [list]);

  const refetch = useCallback(async () => {
    await fetchNcrs();
  }, [fetchNcrs]);

  return {
    projectId,
    ncrs: list,
    loading,
    // `useNCRData` keeps cached data visible while a refetch fails; only surface
    // the error banner when there is genuinely nothing to show yet.
    loadError: error && list.length === 0 ? error : null,
    openCount,
    refetch,
  };
}
