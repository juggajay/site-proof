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
const EMPTY_NCR_REGISTER: NCR[] = [];

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

export function useNCRData({ projectId, token }: UseNCRDataOptions): UseNCRDataReturn {
  const queryClient = useQueryClient();
  // Single error banner slot shared with useNCRActions: register load failures
  // land here via onError, and mutation handlers write through setError.
  const [error, setError] = useState<string | null>(null);

  const ncrsQuery = useQuery({
    queryKey: queryKeys.ncrs(projectId),
    queryFn: async () => {
      const path = projectId ? `/api/ncrs?projectId=${encodeURIComponent(projectId)}` : `/api/ncrs`;
      const data = await apiFetch<{ ncrs: NCR[] }>(path);
      return data.ncrs ?? [];
    },
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
