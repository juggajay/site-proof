import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAuthToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { logError } from '@/lib/logger';
import { extractErrorMessage, isForbidden } from '@/lib/errorHandling';
import type { Lot } from '../lotsPageTypes';

const INITIAL_DISPLAY_COUNT = 20;
const LOAD_MORE_COUNT = 15;
const LOTS_API_PAGE_LIMIT = 100;
const LOTS_API_MAX_PAGES = 100;

// How long a downloaded register stays fresh: revisits and tab switches inside
// this window render straight from cache with zero network requests.
const LOTS_REGISTER_STALE_TIME_MS = 30_000;

// Stable empty array so memoized consumers don't recompute on every render.
const EMPTY_LOTS: Lot[] = [];

/**
 * Cache key for the full lot register (all pages, `Lot[]` shape).
 *
 * Built on `queryKeys.lots(projectId)` so the existing mutation invalidations
 * keep hitting it via react-query prefix matching: AssignSubcontractorModal
 * invalidates `['lots']` and useLotConformanceActions invalidates
 * `queryKeys.lots(projectId)`. The trailing `'register'` segment keeps this
 * entry distinct from DocumentsPage, which caches a single-page response
 * object under the exact `queryKeys.lots(projectId)` key.
 */
export const lotsRegisterQueryKey = (projectId: string) =>
  [...queryKeys.lots(projectId), 'register'] as const;

interface UseLotsDataParams {
  projectId: string | undefined;
  isSubcontractor: boolean;
  statusFilters: string[];
  activityFilter: string;
  searchQuery: string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  chainageMinFilter: string;
  chainageMaxFilter: string;
  subcontractorFilter: string;
  areaZoneFilter: string;
}

interface LotsApiResponse {
  lots?: Lot[];
  data?: Lot[];
  pagination?: {
    hasNextPage?: boolean;
    totalPages?: number;
  };
}

async function fetchAllLotPages(projectId: string): Promise<Lot[]> {
  const allLots: Lot[] = [];
  let page = 1;

  while (page <= LOTS_API_MAX_PAGES) {
    const data = await apiFetch<LotsApiResponse>(
      `/api/lots?projectId=${encodeURIComponent(projectId)}&page=${page}&limit=${LOTS_API_PAGE_LIMIT}`,
    );

    allLots.push(...(data.lots ?? data.data ?? []));

    if (!data.pagination?.hasNextPage || page >= (data.pagination.totalPages ?? page)) {
      return allLots;
    }

    page += 1;
  }

  throw new Error('Lot register export exceeded the maximum page count');
}

export function useLotsData({
  projectId,
  isSubcontractor,
  statusFilters,
  activityFilter,
  searchQuery,
  sortField,
  sortDirection,
  chainageMinFilter,
  chainageMaxFilter,
  subcontractorFilter,
  areaZoneFilter,
}: UseLotsDataParams) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Manual error channel layered over the query's own error state so callers
  // (e.g. DeleteLotModal's onError) can surface failures in the same banner.
  const [manualError, setManualError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [subcontractors, setSubcontractors] = useState<{ id: string; companyName: string }[]>([]);
  const [projectAreas, setProjectAreas] = useState<
    {
      id: string;
      name: string;
      chainageStart: number | null;
      chainageEnd: number | null;
      colour: string | null;
    }[]
  >([]);

  // Infinite scroll state
  const [displayedCount, setDisplayedCount] = useState(INITIAL_DISPLAY_COUNT);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const statusFilterKey = useMemo(() => statusFilters.join(','), [statusFilters]);

  // =====================
  // Data fetching
  // =====================
  const hasAuthToken = Boolean(getAuthToken());
  useEffect(() => {
    if (projectId && !hasAuthToken) navigate('/login');
  }, [projectId, hasAuthToken, navigate]);

  const lotsQuery = useQuery({
    queryKey: lotsRegisterQueryKey(projectId ?? 'none'),
    queryFn: () => fetchAllLotPages(projectId!),
    enabled: Boolean(projectId) && hasAuthToken,
    // Replaces the hand-rolled fetch + 30s full-register poll + per-tab-switch
    // re-download (Feature #732): data is served from cache while fresh, then
    // refreshed in the background on the next window focus or when a mutation
    // invalidates the lots key — instead of re-downloading every 30 seconds.
    staleTime: LOTS_REGISTER_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    // The bespoke fetch surfaced failures immediately with a "Try again"
    // button (pinned in e2e/lots.spec.ts); the app-level default of retry: 1
    // would swallow the first failure, so keep retries off for this query.
    retry: false,
    onError: (err: unknown) => logError('Fetch lots error:', err),
  });

  // Mirror the previous behavior: a failed load clears the register and shows
  // the error banner instead of stale rows.
  const lots = lotsQuery.error ? EMPTY_LOTS : (lotsQuery.data ?? EMPTY_LOTS);
  // Only a cold cache shows the skeleton; warm revisits render instantly while
  // any background refetch runs silently. Keep the skeleton up during the
  // missing-token redirect to /login.
  const loading = lotsQuery.isInitialLoading || Boolean(projectId && !hasAuthToken);
  const accessDenied = isForbidden(lotsQuery.error);
  const error =
    manualError ??
    (lotsQuery.error ? extractErrorMessage(lotsQuery.error, 'Failed to load lots.') : null);

  // Local mutation helpers (delete/clone/create/bulk in useLotsActions) write
  // straight into the cached register, exactly like the old setState did.
  const setLots = useCallback<Dispatch<SetStateAction<Lot[]>>>(
    (action) => {
      if (!projectId) return;
      queryClient.setQueryData<Lot[]>(lotsRegisterQueryKey(projectId), (prev) =>
        typeof action === 'function' ? action(prev ?? EMPTY_LOTS) : action,
      );
    },
    [projectId, queryClient],
  );

  const { refetch } = lotsQuery;
  const fetchLots = useCallback(async () => {
    setManualError(null);
    await refetch();
  }, [refetch]);

  const fetchSubcontractors = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await apiFetch<{ subcontractors: typeof subcontractors }>(
        `/api/subcontractors/for-project/${encodeURIComponent(projectId)}`,
      );
      setSubcontractors(data.subcontractors || []);
    } catch (err) {
      logError('Fetch subcontractors error:', err);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId && !isSubcontractor) fetchSubcontractors();
  }, [projectId, isSubcontractor, fetchSubcontractors]);

  // Fetch project name
  useEffect(() => {
    const fetchProjectName = async () => {
      if (!projectId) return;
      try {
        const data = await apiFetch<{ project?: { name?: string }; name?: string }>(
          `/api/projects/${encodeURIComponent(projectId)}`,
        );
        setProjectName(data.project?.name || data.name || '');
      } catch (err) {
        logError('Error fetching project name:', err);
      }
    };
    fetchProjectName();
  }, [projectId]);

  // Feature #708 - Fetch project areas
  useEffect(() => {
    const fetchProjectAreas = async () => {
      if (!projectId) return;
      try {
        const data = await apiFetch<{ areas: typeof projectAreas }>(
          `/api/projects/${encodeURIComponent(projectId)}/areas`,
        );
        setProjectAreas(data.areas || []);
      } catch (err) {
        logError('Error fetching project areas:', err);
      }
    };
    fetchProjectAreas();
  }, [projectId]);

  // =====================
  // Derived data
  // =====================
  const activityTypes = useMemo(() => {
    const types = new Set(lots.map((l) => l.activityType).filter(Boolean));
    return Array.from(types).sort();
  }, [lots]);

  const areaZones = useMemo(() => {
    const zones = new Set(lots.map((l) => l.areaZone).filter(Boolean));
    return Array.from(zones).sort() as string[];
  }, [lots]);

  const filteredLots = useMemo(() => {
    const filtered = lots.filter((lot) => {
      if (statusFilters.length > 0 && !statusFilters.includes(lot.status)) return false;
      if (activityFilter && lot.activityType !== activityFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesLotNumber = lot.lotNumber.toLowerCase().includes(query);
        const matchesDescription = (lot.description || '').toLowerCase().includes(query);
        if (!matchesLotNumber && !matchesDescription) return false;
      }
      const minFilter = chainageMinFilter ? parseFloat(chainageMinFilter) : null;
      const maxFilter = chainageMaxFilter ? parseFloat(chainageMaxFilter) : null;
      if (minFilter !== null || maxFilter !== null) {
        if (lot.chainageStart === null && lot.chainageEnd === null) return false;
        const lotStart = lot.chainageStart ?? lot.chainageEnd ?? 0;
        const lotEnd = lot.chainageEnd ?? lot.chainageStart ?? 0;
        if (minFilter !== null && lotEnd < minFilter) return false;
        if (maxFilter !== null && lotStart > maxFilter) return false;
      }
      if (subcontractorFilter) {
        if (subcontractorFilter === 'unassigned') {
          if (lot.assignedSubcontractorId) return false;
        } else {
          if (lot.assignedSubcontractorId !== subcontractorFilter) return false;
        }
      }
      if (areaZoneFilter) {
        if (areaZoneFilter === 'unassigned') {
          if (lot.areaZone) return false;
        } else {
          if (lot.areaZone !== areaZoneFilter) return false;
        }
      }
      return true;
    });

    return filtered.sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;
      switch (sortField) {
        case 'lotNumber':
          aVal = a.lotNumber.toLowerCase();
          bVal = b.lotNumber.toLowerCase();
          break;
        case 'description':
          aVal = (a.description || '').toLowerCase();
          bVal = (b.description || '').toLowerCase();
          break;
        case 'chainage':
          aVal = a.chainageStart ?? Number.MAX_SAFE_INTEGER;
          bVal = b.chainageStart ?? Number.MAX_SAFE_INTEGER;
          break;
        case 'activityType':
          aVal = (a.activityType || '').toLowerCase();
          bVal = (b.activityType || '').toLowerCase();
          break;
        case 'status':
          aVal = a.status.toLowerCase();
          bVal = b.status.toLowerCase();
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [
    lots,
    statusFilters,
    activityFilter,
    searchQuery,
    sortField,
    sortDirection,
    chainageMinFilter,
    chainageMaxFilter,
    subcontractorFilter,
    areaZoneFilter,
  ]);

  const displayedLots = useMemo(
    () => filteredLots.slice(0, displayedCount),
    [filteredLots, displayedCount],
  );
  const hasMore = displayedCount < filteredLots.length;

  // =====================
  // Infinite scroll
  // =====================
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount((prev) => Math.min(prev + LOAD_MORE_COUNT, filteredLots.length));
      setLoadingMore(false);
    }, 200);
  }, [loadingMore, hasMore, filteredLots.length]);

  useEffect(() => {
    setDisplayedCount(INITIAL_DISPLAY_COUNT);
  }, [
    statusFilterKey,
    activityFilter,
    searchQuery,
    sortField,
    sortDirection,
    chainageMinFilter,
    chainageMaxFilter,
    subcontractorFilter,
    areaZoneFilter,
  ]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) loadMore();
      },
      { threshold: 0.1 },
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  return {
    lots,
    setLots,
    loading,
    error,
    accessDenied,
    setError: setManualError,
    projectName,
    subcontractors,
    projectAreas,
    activityTypes,
    areaZones,
    filteredLots,
    displayedLots,
    hasMore,
    loadMoreRef,
    loadingMore,
    fetchLots,
    fetchSubcontractors,
  };
}
