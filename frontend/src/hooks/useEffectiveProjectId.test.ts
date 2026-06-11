import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// The hook reads the URL param, the auth user, and (only as a fallback) the
// foreman dashboard endpoint. Mock those three boundaries; keep the rest of each
// module real. A QueryClientProvider wrapper backs the useQuery call.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useParams: vi.fn(() => ({})) };
});
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

import { useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useEffectiveProjectId } from './useEffectiveProjectId';

const useParamsMock = vi.mocked(useParams);
const useAuthMock = vi.mocked(useAuth);
const apiFetchMock = vi.mocked(apiFetch);

type MockUser =
  | string
  | {
      role?: string;
      roleInCompany?: string;
      dashboardRole?: 'project_manager' | 'quality_manager' | 'foreman' | null;
    }
  | null;

function setUser(user: MockUser) {
  useAuthMock.mockReturnValue({
    user: typeof user === 'string' ? { role: user } : user,
  } as unknown as ReturnType<typeof useAuth>);
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

async function expectForemanFallbackProject(expectedProjectId = 'api-project') {
  apiFetchMock.mockResolvedValue({ project: { id: expectedProjectId } });

  const { result } = renderHook(() => useEffectiveProjectId(), { wrapper: createWrapper() });

  await waitFor(() => expect(result.current.projectId).toBe(expectedProjectId));
  expect(apiFetchMock).toHaveBeenCalledWith('/api/dashboard/foreman');
  return result;
}

beforeEach(() => {
  useParamsMock.mockReturnValue({});
  setUser('foreman');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useEffectiveProjectId', () => {
  it('prefers the URL project id and does not fetch a fallback', () => {
    useParamsMock.mockReturnValue({ projectId: 'url-project' });

    const { result } = renderHook(() => useEffectiveProjectId(), { wrapper: createWrapper() });

    expect(result.current).toEqual({
      projectId: 'url-project',
      isResolving: false,
      hasNoProject: false,
    });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the foreman's active project when the URL has none", async () => {
    const result = await expectForemanFallbackProject();
    expect(result.current).toEqual({
      projectId: 'api-project',
      isResolving: false,
      hasNoProject: false,
    });
  });

  it('falls back to the active project for project-role foremen whose company role is member', async () => {
    setUser({ role: 'member', roleInCompany: 'member', dashboardRole: 'foreman' });

    await expectForemanFallbackProject();
  });

  it('reports hasNoProject once a foreman with no active project resolves', async () => {
    apiFetchMock.mockResolvedValue({ project: null });

    const { result } = renderHook(() => useEffectiveProjectId(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.hasNoProject).toBe(true));
    expect(result.current).toEqual({ projectId: null, isResolving: false, hasNoProject: true });
  });

  it('reports isResolving while the fallback is still loading', () => {
    apiFetchMock.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useEffectiveProjectId(), { wrapper: createWrapper() });

    expect(result.current).toEqual({ projectId: null, isResolving: true, hasNoProject: false });
  });

  it('does not fetch a fallback for non-foreman roles', () => {
    setUser('admin');

    const { result } = renderHook(() => useEffectiveProjectId(), { wrapper: createWrapper() });

    expect(result.current).toEqual({ projectId: null, isResolving: false, hasNoProject: false });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('does not fetch a fallback when there is no signed-in user', () => {
    setUser(null);

    const { result } = renderHook(() => useEffectiveProjectId(), { wrapper: createWrapper() });

    expect(result.current).toEqual({ projectId: null, isResolving: false, hasNoProject: false });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('prefers the URL project id even for non-foreman roles', () => {
    setUser('admin');
    useParamsMock.mockReturnValue({ projectId: 'url-project' });

    const { result } = renderHook(() => useEffectiveProjectId(), { wrapper: createWrapper() });

    expect(result.current.projectId).toBe('url-project');
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
