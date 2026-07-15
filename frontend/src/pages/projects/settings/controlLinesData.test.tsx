import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useControlLines,
  useControlLinesAccess,
  useCreateControlLine,
  useDeleteControlLine,
  useExtractSetoutPoints,
  useUpdateControlLine,
} from './controlLinesData';

const apiFetchMock = vi.hoisted(() => vi.fn());
const authFetchMock = vi.hoisted(() => vi.fn());
const fetchProjectMock = vi.hoisted(() => vi.fn());

const TestApiError = vi.hoisted(
  () =>
    class TestApiError extends Error {
      constructor(
        public status: number,
        public body: string,
      ) {
        super(body);
      }
    },
);

vi.mock('@/lib/api', () => ({
  apiFetch: apiFetchMock,
  authFetch: authFetchMock,
  ApiError: TestApiError,
}));
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

// Wrapper that also exposes the client so a test can spy on invalidateQueries.
function wrapperWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, Wrapper };
}

function invalidatedKeys(spy: { mock: { calls: unknown[][] } }): unknown[] {
  return spy.mock.calls.map((call) => (call[0] as { queryKey: unknown }).queryKey);
}

describe('controlLinesData hooks', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    authFetchMock.mockReset();
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

  it('useExtractSetoutPoints posts the file as multipart and returns the candidate', async () => {
    const candidate = {
      alignments: [{ name: null, coordinateSystem: 'EPSG:7856', points: POINTS, warnings: [] }],
      warnings: [],
    };
    authFetchMock.mockResolvedValue({ ok: true, json: async () => ({ candidate }) });
    const { result } = renderHook(() => useExtractSetoutPoints('project-1'), {
      wrapper: wrapper(),
    });

    const file = new File(['%PDF-1.4'], 'setout.pdf', { type: 'application/pdf' });
    const returned = await result.current.mutateAsync(file);

    expect(returned).toEqual(candidate);
    const [url, init] = authFetchMock.mock.calls[0];
    expect(url).toBe('/api/projects/project-1/control-lines/extract-points');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
  });

  it('useExtractSetoutPoints throws the backend message on a non-ok response', async () => {
    authFetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'AI setout extraction is not configured on this server.',
    });
    const { result } = renderHook(() => useExtractSetoutPoints('project-1'), {
      wrapper: wrapper(),
    });

    const file = new File(['%PDF-1.4'], 'setout.pdf', { type: 'application/pdf' });
    await expect(result.current.mutateAsync(file)).rejects.toThrow('not configured');
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

  // A control-line write must refresh every consumer of that data: the settings
  // list AND the Lot Register map, which keys geometries under
  // project-lot-geometries. Missing the map key was the stale-empty-state bug.
  async function assertInvalidatesBothConsumers(keys: unknown[]): Promise<void> {
    expect(keys).toContainEqual(['control-lines', 'project-1']);
    expect(keys).toContainEqual(['project-lot-geometries', 'project-1']);
  }

  it('useCreateControlLine invalidates the list and the map geometries consumer', async () => {
    apiFetchMock.mockResolvedValue({ controlLine: { id: 'cl-1' } });
    const { client, Wrapper } = wrapperWithClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateControlLine('project-1'), { wrapper: Wrapper });

    await result.current.mutateAsync({
      name: 'MC00',
      coordinateSystem: 'EPSG:7856',
      points: POINTS,
    });

    await assertInvalidatesBothConsumers(invalidatedKeys(invalidateSpy));
  });

  it('useUpdateControlLine invalidates the list and the map geometries consumer', async () => {
    apiFetchMock.mockResolvedValue({ controlLine: { id: 'cl-1' } });
    const { client, Wrapper } = wrapperWithClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateControlLine('project-1'), { wrapper: Wrapper });

    await result.current.mutateAsync({
      id: 'cl-1',
      input: { name: 'MC00', coordinateSystem: 'EPSG:7856', points: POINTS },
    });

    await assertInvalidatesBothConsumers(invalidatedKeys(invalidateSpy));
  });

  it('useDeleteControlLine invalidates the list and the map geometries consumer', async () => {
    apiFetchMock.mockResolvedValue(undefined);
    const { client, Wrapper } = wrapperWithClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteControlLine('project-1'), { wrapper: Wrapper });

    await result.current.mutateAsync('cl-1');

    await assertInvalidatesBothConsumers(invalidatedKeys(invalidateSpy));
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
