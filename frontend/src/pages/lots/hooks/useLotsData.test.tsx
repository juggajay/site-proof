import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/lib/auth', () => ({ getAuthToken: () => 'test-token' }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn(), devLog: vi.fn(), devWarn: vi.fn() }));

import { apiFetch, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useLotsData, lotsRegisterQueryKey } from './useLotsData';
import type { Lot } from '../lotsPageTypes';

const apiFetchMock = vi.mocked(apiFetch);

// jsdom does not implement IntersectionObserver (used for infinite scroll).
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function makeLot(id: string, overrides: Partial<Lot> = {}): Lot {
  return {
    id,
    lotNumber: `LOT-${id}`,
    description: `Lot ${id}`,
    status: 'in_progress',
    activityType: 'Earthworks',
    chainageStart: null,
    chainageEnd: null,
    offset: null,
    layer: null,
    areaZone: null,
    ...overrides,
  };
}

/** Routes apiFetch calls; `lotPages` is mutable so tests can change server data. */
function mockEndpoints(lotPages: Lot[][]) {
  apiFetchMock.mockImplementation(async (path) => {
    const url = new URL(String(path), 'http://localhost');
    if (url.pathname === '/api/lots') {
      const page = Number(url.searchParams.get('page') || '1');
      return {
        lots: lotPages[page - 1] ?? [],
        pagination: { hasNextPage: page < lotPages.length, totalPages: lotPages.length },
      };
    }
    if (url.pathname === '/api/projects/project-1') {
      return { project: { name: 'Test Project' } };
    }
    if (url.pathname === '/api/projects/project-1/areas') {
      return { areas: [] };
    }
    if (url.pathname === '/api/subcontractors/for-project/project-1') {
      return { subcontractors: [] };
    }
    throw new Error(`Unexpected apiFetch path: ${String(path)}`);
  });
}

function lotRegisterCalls() {
  return apiFetchMock.mock.calls.filter(([path]) => String(path).startsWith('/api/lots?'));
}

const baseParams = {
  projectId: 'project-1',
  isSubcontractor: false,
  statusFilters: [] as string[],
  activityFilter: '',
  searchQuery: '',
  sortField: 'lotNumber',
  sortDirection: 'asc' as const,
  chainageMinFilter: '',
  chainageMaxFilter: '',
  subcontractorFilter: '',
  areaZoneFilter: '',
};

type Params = typeof baseParams;

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderLotsData(queryClient: QueryClient, params: Partial<Params> = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return renderHook((props: Params) => useLotsData(props), {
    wrapper,
    initialProps: { ...baseParams, ...params },
  });
}

describe('useLotsData', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('downloads every register page once into the cache', async () => {
    mockEndpoints([[makeLot('1')], [makeLot('2')]]);
    const queryClient = createClient();

    const { result } = renderLotsData(queryClient);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lots.map((l) => l.id)).toEqual(['1', '2']);
    expect(lotRegisterCalls().map(([path]) => path)).toEqual([
      '/api/lots?projectId=project-1&page=1&limit=100',
      '/api/lots?projectId=project-1&page=2&limit=100',
    ]);
    expect(queryClient.getQueryData(lotsRegisterQueryKey('project-1'))).toHaveLength(2);
  });

  it('serves a warm cache instantly on revisit without refetching or a spinner', async () => {
    mockEndpoints([[makeLot('1')]]);
    const queryClient = createClient();

    const first = renderLotsData(queryClient);
    await waitFor(() => expect(first.result.current.lots).toHaveLength(1));
    first.unmount();

    const callsAfterFirstVisit = lotRegisterCalls().length;
    const second = renderLotsData(queryClient);

    // Cached data is available on the very first render — no loading skeleton.
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.lots).toHaveLength(1);

    await waitFor(() => expect(second.result.current.projectName).toBe('Test Project'));
    expect(lotRegisterCalls().length).toBe(callsAfterFirstVisit);
  });

  it('refetches when mutation sites invalidate the lots query keys', async () => {
    const lotPages = [[makeLot('1')]];
    mockEndpoints(lotPages);
    const queryClient = createClient();

    const { result } = renderLotsData(queryClient);
    await waitFor(() => expect(result.current.lots).toHaveLength(1));

    // useLotConformanceActions invalidates queryKeys.lots(projectId).
    lotPages[0] = [makeLot('1'), makeLot('2')];
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.lots('project-1') });
    });
    await waitFor(() => expect(result.current.lots).toHaveLength(2));

    // AssignSubcontractorModal invalidates the bare ['lots'] prefix.
    lotPages[0] = [makeLot('1'), makeLot('2'), makeLot('3')];
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['lots'] });
    });
    await waitFor(() => expect(result.current.lots).toHaveLength(3));
  });

  it('keeps client-side status and search filters working over the cached register', async () => {
    mockEndpoints([
      [
        makeLot('1', { status: 'conformed' }),
        makeLot('2', { status: 'in_progress', description: 'Bridge abutment' }),
      ],
    ]);

    const { result, rerender } = renderLotsData(createClient());
    await waitFor(() => expect(result.current.lots).toHaveLength(2));
    expect(result.current.filteredLots).toHaveLength(2);

    rerender({ ...baseParams, statusFilters: ['conformed'] });
    expect(result.current.filteredLots.map((l) => l.id)).toEqual(['1']);

    rerender({ ...baseParams, searchQuery: 'bridge' });
    expect(result.current.filteredLots.map((l) => l.id)).toEqual(['2']);
  });

  it('surfaces load failures with no retry storm and recovers via fetchLots', async () => {
    let failures = 1;
    mockEndpoints([[makeLot('1')]]);
    const baseImplementation = apiFetchMock.getMockImplementation()!;
    apiFetchMock.mockImplementation(async (path, options) => {
      if (String(path).startsWith('/api/lots?') && failures > 0) {
        failures -= 1;
        throw new ApiError(
          500,
          JSON.stringify({ error: { message: 'Lots temporarily unavailable' } }),
        );
      }
      return baseImplementation(path, options);
    });

    const { result } = renderLotsData(createClient());

    await waitFor(() => expect(result.current.error).toBe('Lots temporarily unavailable'));
    expect(result.current.lots).toEqual([]);
    expect(result.current.accessDenied).toBe(false);
    expect(result.current.loading).toBe(false);

    await act(async () => {
      await result.current.fetchLots();
    });
    await waitFor(() => expect(result.current.lots).toHaveLength(1));
    expect(result.current.error).toBeNull();
  });

  it('flags 403 responses as access denied', async () => {
    mockEndpoints([[]]);
    apiFetchMock.mockImplementation(async (path) => {
      if (String(path).startsWith('/api/lots?')) {
        throw new ApiError(
          403,
          JSON.stringify({ error: { message: 'You do not have access to this project' } }),
        );
      }
      return {};
    });

    const { result } = renderLotsData(createClient());

    await waitFor(() => expect(result.current.accessDenied).toBe(true));
    expect(result.current.error).toBe('You do not have access to this project');
    expect(result.current.lots).toEqual([]);
  });

  it('lets mutation helpers update the cached register through setLots', async () => {
    mockEndpoints([[makeLot('1'), makeLot('2')]]);
    const queryClient = createClient();

    const { result } = renderLotsData(queryClient);
    await waitFor(() => expect(result.current.lots).toHaveLength(2));

    act(() => {
      result.current.setLots((prev) => prev.filter((lot) => lot.id !== '1'));
    });

    // setQueryData writes synchronously; the observer re-render is async.
    expect(queryClient.getQueryData<Lot[]>(lotsRegisterQueryKey('project-1'))).toHaveLength(1);
    await waitFor(() => expect(result.current.lots.map((l) => l.id)).toEqual(['2']));
  });

  it('does not fetch lots when project id is missing', async () => {
    mockEndpoints([[makeLot('1')]]);

    const { result } = renderLotsData(createClient(), { projectId: undefined });

    expect(result.current.loading).toBe(false);
    expect(result.current.lots).toEqual([]);
    expect(lotRegisterCalls()).toHaveLength(0);
  });
});
