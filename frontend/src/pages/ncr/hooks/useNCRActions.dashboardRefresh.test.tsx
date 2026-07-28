// M8 (deep review 2026-07-28) — "acting leaves items listed". `main.tsx` sets a
// 5-minute staleTime with no refetch-on-focus, and the ONLY invalidation of
// ['dashboard-stats'] in the whole app was `useCreateSampleProject`. A QM could
// close an NCR, go back to Needs Attention, and still see it with its overdue
// chip for up to five minutes.
//
// Needs Attention reads the same cache entry as the dashboard widget
// (`useDashboardStats`), so one key covers both surfaces.
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
vi.mock('@/hooks/useCsvBranding', () => ({ useCsvBranding: () => null }));

import { useNCRActions } from './useNCRActions';
import { queryKeys } from '@/lib/queryKeys';

const DASHBOARD_KEY = queryKeys.dashboardStats('2026-07-01', '2026-07-28');

function makeClient() {
  // (v4.36 — `cacheTime`, not `gcTime`.)
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('useNCRActions dashboard freshness', () => {
  it('invalidates the dashboard/Needs Attention feed after closing an NCR', async () => {
    apiFetchMock.mockResolvedValue({ message: 'NCR closed successfully' });
    const queryClient = makeClient();
    // Positive control: a real cached feed carrying the NCR about to be closed.
    queryClient.setQueryData(DASHBOARD_KEY, {
      actionAssignments: { items: [{ subjectType: 'ncr', subjectId: 'ncr-1' }], totalCount: 1 },
    });
    expect(queryClient.getQueryState(DASHBOARD_KEY)?.isInvalidated).toBe(false);

    const { result } = renderHook(
      () =>
        useNCRActions({
          projectId: 'p1',
          fetchNcrs: vi.fn().mockResolvedValue(undefined),
          setError: vi.fn(),
          closeModal: vi.fn(),
        }),
      { wrapper: wrapper(queryClient) },
    );

    await result.current.handleCloseNcr('ncr-1', {
      verificationNotes: 'Verified on site',
      lessonsLearned: 'Brief the crew earlier',
    });

    await waitFor(() => {
      expect(queryClient.getQueryState(DASHBOARD_KEY)?.isInvalidated).toBe(true);
    });
  });
});
