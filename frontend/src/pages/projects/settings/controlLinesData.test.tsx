import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useControlLines,
  useControlLinesAccess,
  useCreateControlLine,
  useDeleteControlLine,
  useUpdateControlLine,
} from './controlLinesData';

const apiFetchMock = vi.hoisted(() => vi.fn());
const fetchProjectMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({ apiFetch: apiFetchMock }));
vi.mock('./projectPageAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./projectPageAccess')>();
  return { ...actual, fetchProjectForAdminPage: fetchProjectMock };
});

const POINTS = [
  { chainage: 0, easting: 500000, northing: 6250000 },
  { chainage: 100, easting: 500010, northing: 6250100 },
];

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('controlLinesData hooks', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    fetchProjectMock.mockReset();
  });

  it('useControlLines fetches the list for a project', async () => {
    apiFetchMock.mockResolvedValue({ controlLines: [{ id: 'cl-1', name: 'MC00' }] });
    const { result } = renderHook(() => useControlLines('project-1'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/project-1/control-lines');
    expect(result.current.data).toEqual([{ id: 'cl-1', name: 'MC00' }]);
  });

  it('useCreateControlLine posts the payload', async () => {
    apiFetchMock.mockResolvedValue({ controlLine: { id: 'cl-1' } });
    const { result } = renderHook(() => useCreateControlLine('project-1'), { wrapper: wrapper() });

    await result.current.mutateAsync({
      name: 'MC00',
      coordinateSystem: 'EPSG:7856',
      points: POINTS,
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/project-1/control-lines', {
      method: 'POST',
      body: JSON.stringify({ name: 'MC00', coordinateSystem: 'EPSG:7856', points: POINTS }),
    });
  });

  it('useUpdateControlLine patches a specific line', async () => {
    apiFetchMock.mockResolvedValue({ controlLine: { id: 'cl-1' } });
    const { result } = renderHook(() => useUpdateControlLine('project-1'), { wrapper: wrapper() });

    await result.current.mutateAsync({
      id: 'cl-1',
      input: { name: 'MC00', coordinateSystem: 'EPSG:7856', points: POINTS },
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/projects/project-1/control-lines/cl-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('useDeleteControlLine deletes a specific line', async () => {
    apiFetchMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteControlLine('project-1'), { wrapper: wrapper() });

    await result.current.mutateAsync('cl-1');

    expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/project-1/control-lines/cl-1', {
      method: 'DELETE',
    });
  });

  it('useControlLinesAccess grants write for a project_manager', async () => {
    fetchProjectMock.mockResolvedValue({ status: 'active', currentUserRole: 'project_manager' });
    const { result } = renderHook(() => useControlLinesAccess('project-1'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.canManage).toBe(true));
    expect(result.current.readOnly).toBe(false);
  });

  it('useControlLinesAccess denies write for a viewer and flags archived read-only', async () => {
    fetchProjectMock.mockResolvedValue({ status: 'archived', currentUserRole: 'viewer' });
    const { result } = renderHook(() => useControlLinesAccess('project-1'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canManage).toBe(false);
    expect(result.current.readOnly).toBe(true);
  });
});
