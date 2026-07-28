// M8 (deep review 2026-07-28) — see the sibling NCR test for the defect. A lot
// conforming clears its unreleased-hold-point rows from the attention feed, so
// the conform path must invalidate the same cache entry.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

import { useLotConformanceActions } from './useLotConformanceActions';
import { queryKeys } from '@/lib/queryKeys';

const DASHBOARD_KEY = queryKeys.dashboardStats('2026-07-01', '2026-07-28');

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('useLotConformanceActions dashboard freshness', () => {
  it('invalidates the dashboard/Needs Attention feed after conforming a lot', async () => {
    apiFetchMock.mockResolvedValue({});
    // v4.36 — `cacheTime`, not `gcTime`.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(DASHBOARD_KEY, {
      actionAssignments: {
        items: [{ subjectType: 'hold_point', subjectId: 'hp-1' }],
        totalCount: 1,
      },
    });
    expect(queryClient.getQueryState(DASHBOARD_KEY)?.isInvalidated).toBe(false);

    const { result } = renderHook(
      () =>
        useLotConformanceActions({
          lotId: 'lot-1',
          projectId: 'p1',
          currentTab: 'itp',
          setLot: vi.fn(),
          refetchReadiness: vi.fn().mockResolvedValue(undefined),
          refreshActivityHistory: vi.fn().mockResolvedValue(undefined),
        }),
      { wrapper: wrapper(queryClient) },
    );

    await result.current.handleConformLot();

    await waitFor(() => {
      expect(queryClient.getQueryState(DASHBOARD_KEY)?.isInvalidated).toBe(true);
    });
  });
});
