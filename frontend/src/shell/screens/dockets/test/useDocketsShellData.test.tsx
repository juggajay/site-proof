import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/dockets/docketApprovalsData', () => ({
  useDocketApprovalsQuery: vi.fn(),
  useDocketProjectQuery: vi.fn(),
}));

import {
  useDocketApprovalsQuery,
  useDocketProjectQuery,
} from '@/pages/dockets/docketApprovalsData';
import { useDocketsShellData } from '../useDocketsShellData';

const useDocketApprovalsQueryMock = vi.mocked(useDocketApprovalsQuery);
const useDocketProjectQueryMock = vi.mocked(useDocketProjectQuery);

beforeEach(() => {
  vi.clearAllMocks();
  useDocketApprovalsQueryMock.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useDocketApprovalsQuery>);
  useDocketProjectQueryMock.mockReturnValue({
    data: null,
  } as unknown as ReturnType<typeof useDocketProjectQuery>);
});

describe('useDocketsShellData', () => {
  it('does not fetch dockets until the foreman project id has resolved', () => {
    const { result } = renderHook(() => useDocketsShellData(null, { isResolvingProject: true }));

    expect(useDocketApprovalsQueryMock).toHaveBeenCalledWith(undefined, 'all', {
      enabled: false,
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.loadError).toBeNull();
  });

  it('fetches dockets once a project id is available', () => {
    renderHook(() => useDocketsShellData('project-1'));

    expect(useDocketApprovalsQueryMock).toHaveBeenCalledWith('project-1', 'all', {
      enabled: true,
    });
    expect(useDocketProjectQueryMock).toHaveBeenCalledWith('project-1');
  });

  it('shows a clear empty-project message after fallback resolution fails', () => {
    const { result } = renderHook(() => useDocketsShellData(null, { hasNoProject: true }));

    expect(useDocketApprovalsQueryMock).toHaveBeenCalledWith(undefined, 'all', {
      enabled: false,
    });
    expect(result.current.loadError).toBe('No active project is assigned to this account.');
  });
});
