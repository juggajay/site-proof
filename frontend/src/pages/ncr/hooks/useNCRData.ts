import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import type { NCR, UserRole } from '../types';

/**
 * Register data is considered fresh for 30s (the cadence of the old manual
 * poll). Returning to the tab refetches stale data via refetchOnWindowFocus,
 * and every NCR mutation invalidates the key explicitly, so the register stays
 * current without a background interval.
 */
const NCR_REGISTER_STALE_TIME_MS = 30_000;
const NCR_REGISTER_PAGE_LIMIT = 100;
const EMPTY_NCR_REGISTER: NCR[] = [];

interface NcrListResponse {
  ncrs?: NCR[];
  pagination?: {
    totalPages?: number;
  };
}

interface UseNCRDataOptions {
  projectId: string | undefined;
  token: string | null;
}

interface UseNCRDataReturn {
  ncrs: NCR[];
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  userRole: UserRole | null;
  fetchNcrs: () => Promise<void>;
}

function buildNcrRegisterPath(projectId: string | undefined, page: number) {
  const params = new URLSearchParams();
  if (projectId) params.set('projectId', projectId);
  params.set('page', String(page));
  params.set('limit', String(NCR_REGISTER_PAGE_LIMIT));
  return `/api/ncrs?${params.toString()}`;
}

async function fetchNcrRegister(projectId: string | undefined): Promise<NCR[]> {
  const firstPage = await apiFetch<NcrListResponse>(buildNcrRegisterPath(projectId, 1));
  const pages = [firstPage.ncrs ?? []];
  const rawTotalPages = firstPage.pagination?.totalPages ?? 1;
  const totalPages = Number.isFinite(rawTotalPages) ? Math.max(1, Math.floor(rawTotalPages)) : 1;

  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await apiFetch<NcrListResponse>(buildNcrRegisterPath(projectId, page));
    pages.push(nextPage.ncrs ?? []);
  }

  return pages.flat();
}

export function useNCRData({ projectId, token }: UseNCRDataOptions): UseNCRDataReturn {
  const queryClient = useQueryClient();
  // Single error banner slot shared with useNCRActions: register load failures
  // land here via onError, and mutation handlers write through setError.
  const [error, setError] = useState<string | null>(null);

  const ncrsQuery = useQuery({
    queryKey: queryKeys.ncrs(projectId),
    queryFn: () => fetchNcrRegister(projectId),
    enabled: Boolean(token),
    staleTime: NCR_REGISTER_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    onSuccess: () => setError(null),
    onError: (err) => setError(extractErrorMessage(err, 'Failed to load NCRs')),
  });

  const roleQuery = useQuery({
    queryKey: projectId ? queryKeys.ncrRole(projectId) : ['ncr-role', 'none'],
    queryFn: () => apiFetch<UserRole>(`/api/ncrs/check-role/${encodeURIComponent(projectId!)}`),
    enabled: Boolean(token && projectId),
    onError: (err) => logError('Failed to check user role:', err),
  });

  // Refresh entry point used by the mutations (create/assign/respond/close/…)
  // and pull-to-refresh: invalidating the register key refetches every mounted
  // register sharing it, and resolves once the refetch settles.
  const fetchNcrs = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.ncrs(projectId) });
  }, [queryClient, projectId]);

  return {
    ncrs: ncrsQuery.data ?? EMPTY_NCR_REGISTER,
    loading: ncrsQuery.isLoading,
    error,
    setError,
    userRole: roleQuery.data ?? null,
    fetchNcrs,
  };
}
