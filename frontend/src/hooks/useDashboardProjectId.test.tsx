import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));

import { useAuth } from '@/lib/auth';
import { useDashboardProjectId } from './useDashboardProjectId';

const useAuthMock = vi.mocked(useAuth);

function setUser(userId: string | null) {
  useAuthMock.mockReturnValue({
    user: userId ? { id: userId } : null,
  } as unknown as ReturnType<typeof useAuth>);
}

function createWrapper(initialEntry = '/dashboard') {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  setUser('user-a');
});

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('useDashboardProjectId', () => {
  it('reads the remembered dashboard project from user-scoped storage', () => {
    window.localStorage.setItem('dashboardProjectId:user-a', 'project-a');
    window.localStorage.setItem('dashboardProjectId:user-b', 'project-b');
    window.localStorage.setItem('dashboardProjectId', 'legacy-global-project');

    const { result } = renderHook(() => useDashboardProjectId(), {
      wrapper: createWrapper(),
    });

    expect(result.current.requestedProjectId).toBe('project-a');
  });

  it('ignores another user’s remembered project in the same browser', () => {
    window.localStorage.setItem('dashboardProjectId:user-a', 'project-a');
    setUser('user-b');

    const { result } = renderHook(() => useDashboardProjectId(), {
      wrapper: createWrapper(),
    });

    expect(result.current.requestedProjectId).toBeUndefined();
  });

  it('prefers the URL project id over remembered storage', () => {
    window.localStorage.setItem('dashboardProjectId:user-a', 'project-a');

    const { result } = renderHook(() => useDashboardProjectId(), {
      wrapper: createWrapper('/dashboard?projectId=url-project'),
    });

    expect(result.current.requestedProjectId).toBe('url-project');
  });

  it('stores new dashboard project selections under the current user key', () => {
    const { result } = renderHook(() => useDashboardProjectId(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setProjectId('project-next');
    });

    expect(window.localStorage.getItem('dashboardProjectId:user-a')).toBe('project-next');
    expect(window.localStorage.getItem('dashboardProjectId')).toBeNull();
  });

  it('can sync a backend-resolved project over a stale remembered request', () => {
    window.localStorage.setItem('dashboardProjectId:user-a', 'stale-project');

    const { result } = renderHook(() => useDashboardProjectId(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.syncResolvedProjectId('canonical-project');
    });

    expect(window.localStorage.getItem('dashboardProjectId:user-a')).toBe('canonical-project');
  });
});
