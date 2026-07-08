import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { queryKeys } from '@/lib/queryKeys';
import type { Variation, VariationLot } from '../types';

const VARIATION_REGISTER_STALE_TIME_MS = 30_000;
const EMPTY_VARIATIONS: Variation[] = [];
const EMPTY_LOTS: VariationLot[] = [];

interface VariationsResponse {
  variations?: Variation[];
}

interface LotsResponse {
  lots?: VariationLot[];
}

interface UseVariationsDataOptions {
  projectId: string | undefined;
  token: string | null;
}

export function useVariationsData({ projectId, token }: UseVariationsDataOptions) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const variationsQuery = useQuery({
    queryKey: projectId ? queryKeys.variations(projectId) : queryKeys.variations('none'),
    queryFn: async () => {
      const data = await apiFetch<VariationsResponse>(
        `/api/projects/${encodeURIComponent(projectId!)}/variations`,
      );
      return data.variations ?? EMPTY_VARIATIONS;
    },
    enabled: Boolean(token && projectId),
    staleTime: VARIATION_REGISTER_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    onSuccess: () => setError(null),
    onError: (err) => setError(extractErrorMessage(err, 'Failed to load variations')),
  });

  const lotsQuery = useQuery({
    queryKey: projectId ? queryKeys.lots(projectId) : queryKeys.lots('none'),
    queryFn: async () => {
      const data = await apiFetch<LotsResponse>(
        `/api/lots?projectId=${encodeURIComponent(projectId!)}`,
      );
      return data.lots ?? EMPTY_LOTS;
    },
    enabled: Boolean(token && projectId),
    staleTime: VARIATION_REGISTER_STALE_TIME_MS,
  });

  const fetchVariations = useCallback(async () => {
    if (!projectId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.variations(projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.lots(projectId) }),
    ]);
  }, [projectId, queryClient]);

  return {
    variations: variationsQuery.data ?? EMPTY_VARIATIONS,
    lots: lotsQuery.data ?? EMPTY_LOTS,
    loading: variationsQuery.isLoading || lotsQuery.isLoading,
    error,
    setError,
    fetchVariations,
  };
}
