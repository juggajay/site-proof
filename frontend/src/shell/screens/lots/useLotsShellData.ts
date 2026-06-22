/**
 * useLotsShellData — shared data layer for the /m/lots sub-tree.
 *
 * NEW PRESENTATION over EXISTING LOGIC: reuses the same lot-register cache key as
 * `useLotsData` (so the shell and the desktop register share one download) and
 * the same foreman/today worklist key as HomeScreen / ForemanBottomNavV2. No new
 * endpoints; no new packages.
 *
 *   - Lots: `lotsRegisterQueryKey(projectId)` → all pages of `/api/lots`.
 *   - Per-lot checks-due: derived from `/api/dashboard/.../foreman/today`, by
 *     grouping the blocking + due_today worklist items on `metadata.lotId`.
 *
 * The lot register carries no per-lot ITP completion progress or photo count, so
 * the shell shows ITP totals + the honest worklist-derived "due" count, and never
 * fabricates a completion ratio. Per-lot detail (instance, photos) is fetched on
 * the lot hub / run screens, not here.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { queryKeys } from '@/lib/queryKeys';
import { lotsRegisterQueryKey } from '@/pages/lots/hooks/useLotsData';
import type { Lot } from '@/pages/lots/lotsPageTypes';

interface LotsApiResponse {
  lots?: Lot[];
  data?: Lot[];
  pagination?: { hasNextPage?: boolean; totalPages?: number };
}

interface ForemanWorkItem {
  metadata?: { lotId?: string };
}

interface ForemanTodayPayload {
  blocking?: ForemanWorkItem[];
  dueToday?: ForemanWorkItem[];
}

const LOTS_API_PAGE_LIMIT = 100;
const LOTS_API_MAX_PAGES = 100;
const LOTS_REGISTER_STALE_TIME_MS = 30_000;

async function fetchAllLotPages(projectId: string): Promise<Lot[]> {
  const all: Lot[] = [];
  let page = 1;
  while (page <= LOTS_API_MAX_PAGES) {
    const data = await apiFetch<LotsApiResponse>(
      `/api/lots?projectId=${encodeURIComponent(projectId)}&page=${page}&limit=${LOTS_API_PAGE_LIMIT}`,
    );
    all.push(...(data.lots ?? data.data ?? []));
    if (!data.pagination?.hasNextPage || page >= (data.pagination.totalPages ?? page)) {
      return all;
    }
    page += 1;
  }
  throw new Error('Lot register exceeded the maximum page count');
}

/** Group the foreman worklist into a per-lot "checks due" count map. */
export function checksDueByLot(today: ForemanTodayPayload | undefined): Record<string, number> {
  const map: Record<string, number> = {};
  const items = [...(today?.blocking ?? []), ...(today?.dueToday ?? [])];
  for (const item of items) {
    const lotId = item.metadata?.lotId;
    if (!lotId) continue;
    map[lotId] = (map[lotId] ?? 0) + 1;
  }
  return map;
}

export interface LotsShellData {
  projectId: string | null;
  lots: Lot[];
  loading: boolean;
  error: boolean;
  checksDue: Record<string, number>;
  refetch: () => Promise<void>;
}

export function useLotsShellData(projectId: string | null): LotsShellData {
  const hasAuthToken = Boolean(getAuthToken());
  const enabled = Boolean(projectId) && hasAuthToken;

  const lotsQuery = useQuery({
    queryKey: lotsRegisterQueryKey(projectId ?? 'none'),
    queryFn: () => fetchAllLotPages(projectId!),
    enabled,
    staleTime: LOTS_REGISTER_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const todayQuery = useQuery<ForemanTodayPayload>({
    queryKey: queryKeys.foremanBadges(projectId ?? 'default'),
    queryFn: () =>
      apiFetch<ForemanTodayPayload>(
        `/api/dashboard/projects/${encodeURIComponent(projectId!)}/foreman/today`,
      ),
    enabled,
    staleTime: 5 * 60_000,
  });

  const checksDue = useMemo(() => checksDueByLot(todayQuery.data), [todayQuery.data]);

  const { refetch } = lotsQuery;
  const refetchAll = async () => {
    await refetch();
  };

  return {
    projectId,
    lots: lotsQuery.error ? [] : (lotsQuery.data ?? []),
    loading: lotsQuery.isLoading && !lotsQuery.data,
    error: Boolean(lotsQuery.error),
    checksDue,
    refetch: refetchAll,
  };
}
