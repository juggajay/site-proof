import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient } from '@/test/renderWithProviders';

// Mock only the network boundary; query wiring (keys, caching, invalidation)
// stays real so the hook is exercised end to end.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '@/lib/api';
import type { NCR, UserRole } from '../types';
import { useNCRData } from './useNCRData';

const apiFetchMock = vi.mocked(apiFetch);

const ROLE: UserRole = { role: 'project_manager', isQualityManager: false, canApproveNCRs: false };

function buildNcr(id: string, overrides: Partial<NCR> = {}): NCR {
  return {
    id,
    ncrNumber: `NCR-${id}`,
    description: 'Test NCR',
    category: 'workmanship',
    severity: 'minor',
    status: 'open',
    qmApprovalRequired: false,
    qmApprovedAt: null,
    raisedBy: { fullName: 'Inspector', email: 'inspector@example.com' },
    createdAt: '2026-05-01T00:00:00.000Z',
    project: { name: 'Project', projectNumber: 'P-1' },
    ncrLots: [],
    ...overrides,
  };
}

function mockApi({ ncrs = [buildNcr('ncr-1')] }: { ncrs?: NCR[] } = {}) {
  apiFetchMock.mockImplementation(async (path: string): Promise<unknown> => {
    if (path.startsWith('/api/ncrs/check-role/')) return ROLE;
    if (path.startsWith('/api/ncrs')) return { ncrs };
    throw new Error(`Unexpected apiFetch path in test: ${path}`);
  });
}

const registerCalls = () =>
  apiFetchMock.mock.calls.filter(([path]) => String(path).startsWith('/api/ncrs?'));

function renderNCRData(projectId: string | undefined) {
  const queryClient = createTestQueryClient();
  return renderHook(() => useNCRData({ projectId, token: 'token-123' }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe('useNCRData', () => {
  beforeEach(() => {
    mockApi();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the register and user role through TanStack Query', async () => {
    const { result } = renderNCRData('project-1');

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.ncrs.map((ncr) => ncr.id)).toEqual(['ncr-1']);
    await waitFor(() => expect(result.current.userRole).toEqual(ROLE));
    expect(result.current.error).toBeNull();
    expect(apiFetchMock).toHaveBeenCalledWith('/api/ncrs?projectId=project-1');
    expect(apiFetchMock).toHaveBeenCalledWith('/api/ncrs/check-role/project-1');
  });

  it('does not start the old 30-second register poll', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    const { result } = renderNCRData('project-1');
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(setIntervalSpy.mock.calls.filter(([, delay]) => delay === 30000)).toHaveLength(0);
    expect(registerCalls()).toHaveLength(1);
  });

  it('fetchNcrs invalidates the register key and refetches fresh data', async () => {
    const { result } = renderNCRData('project-1');
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ncrs).toHaveLength(1);

    mockApi({ ncrs: [buildNcr('ncr-1'), buildNcr('ncr-2', { status: 'investigating' })] });
    await act(async () => {
      await result.current.fetchNcrs();
    });

    await waitFor(() =>
      expect(result.current.ncrs.map((ncr) => ncr.id)).toEqual(['ncr-1', 'ncr-2']),
    );
    expect(registerCalls()).toHaveLength(2);
  });

  it('surfaces register load failures and clears the message on a successful refetch', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/ncrs/check-role/')) return ROLE;
      throw new Error('NCR register unavailable');
    });

    const { result } = renderNCRData('project-1');
    await waitFor(() => expect(result.current.error).toBe('NCR register unavailable'));
    expect(result.current.loading).toBe(false);
    expect(result.current.ncrs).toEqual([]);

    mockApi();
    await act(async () => {
      await result.current.fetchNcrs();
    });

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.ncrs).toHaveLength(1);
  });

  it('keeps the empty register reference stable while a load failure is shown', async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/ncrs/check-role/')) return ROLE;
      throw new Error('NCR register unavailable');
    });

    const { result } = renderNCRData('project-1');
    await waitFor(() => expect(result.current.error).toBe('NCR register unavailable'));
    const failedRegister = result.current.ncrs;

    act(() => {
      result.current.setError('Manual banner update');
    });

    expect(result.current.ncrs).toBe(failedRegister);
  });

  it('skips the role check when no project is selected', async () => {
    const { result } = renderNCRData(undefined);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.userRole).toBeNull();
    expect(apiFetchMock).toHaveBeenCalledWith('/api/ncrs');
    expect(
      apiFetchMock.mock.calls.filter(([path]) => String(path).includes('check-role')),
    ).toHaveLength(0);
  });
});
