import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));

import { useAuth } from '@/lib/auth';
import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from '@/lib/storagePreferences';
import { useDashboardProjectId } from './useDashboardProjectId';

const useAuthMock = vi.mocked(useAuth);
const USER_A_KEY = 'dashboardProjectId:user-a';
const USER_B_KEY = 'dashboardProjectId:user-b';
const LEGACY_GLOBAL_KEY = 'dashboardProjectId';

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

function clearDashboardProjectStorage() {
  removeLocalStorageItem(USER_A_KEY);
  removeLocalStorageItem(USER_B_KEY);
  removeLocalStorageItem(LEGACY_GLOBAL_KEY);
}

beforeEach(() => {
  clearDashboardProjectStorage();
  setUser('user-a');
});

afterEach(() => {
  vi.clearAllMocks();
  clearDashboardProjectStorage();
});

describe('useDashboardProjectId', () => {
  it('reads the remembered dashboard project from user-scoped storage', () => {
    writeLocalStorageItem(USER_A_KEY, 'project-a');
    writeLocalStorageItem(USER_B_KEY, 'project-b');
    writeLocalStorageItem(LEGACY_GLOBAL_KEY, 'legacy-global-project');

    const { result } = renderHook(() => useDashboardProjectId(), {
      wrapper: createWrapper(),
    });

    expect(result.current.requestedProjectId).toBe('project-a');
  });

  it('ignores another user’s remembered project in the same browser', () => {
    writeLocalStorageItem(USER_A_KEY, 'project-a');
    setUser('user-b');

    const { result } = renderHook(() => useDashboardProjectId(), {
      wrapper: createWrapper(),
    });

    expect(result.current.requestedProjectId).toBeUndefined();
  });

  it('prefers the URL project id over remembered storage', () => {
    writeLocalStorageItem(USER_A_KEY, 'project-a');

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

    expect(readLocalStorageItem(USER_A_KEY)).toBe('project-next');
    expect(readLocalStorageItem(LEGACY_GLOBAL_KEY)).toBeNull();
  });

  it('can sync a backend-resolved project over a stale remembered request', () => {
    writeLocalStorageItem(USER_A_KEY, 'stale-project');

    const { result } = renderHook(() => useDashboardProjectId(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.syncResolvedProjectId('canonical-project');
    });

    expect(readLocalStorageItem(USER_A_KEY)).toBe('canonical-project');
  });
});
