import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createPlanSheet,
  downloadDocumentFile,
  useDeletePlanSheet,
  usePlanSheets,
  usePlanSheetsAccess,
  useUpdatePlanSheet,
} from './planSheetsData';

const apiFetchMock = vi.hoisted(() => vi.fn());
const authFetchMock = vi.hoisted(() => vi.fn());
const fetchProjectMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock, authFetch: authFetchMock };
});
vi.mock('./projectPageAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./projectPageAccess')>();
  return { ...actual, fetchProjectForAdminPage: fetchProjectMock };
});

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function wrapperWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, Wrapper };
}

describe('planSheetsData hooks', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    authFetchMock.mockReset();
    fetchProjectMock.mockReset();
  });

  it('usePlanSheets fetches the list for a project', async () => {
    apiFetchMock.mockResolvedValue({ planSheets: [{ id: 'ps-1', name: 'C-101' }] });
    const { result } = renderHook(() => usePlanSheets('project-1'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/project-1/plan-sheets');
    expect(result.current.data).toEqual([{ id: 'ps-1', name: 'C-101' }]);
  });

  it('useUpdatePlanSheet patches a specific sheet and invalidates the list', async () => {
    apiFetchMock.mockResolvedValue({ planSheet: { id: 'ps-1' } });
    const { client, Wrapper } = wrapperWithClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpdatePlanSheet('project-1'), { wrapper: Wrapper });

    await result.current.mutateAsync({ id: 'ps-1', input: { name: 'Renamed' } });

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/projects/project-1/plan-sheets/ps-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    const keys = invalidateSpy.mock.calls.map(
      (c) => (c[0] as unknown as { queryKey: unknown }).queryKey,
    );
    expect(keys).toContainEqual(['plan-sheets', 'project-1']);
  });

  it('useDeletePlanSheet deletes a specific sheet', async () => {
    apiFetchMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeletePlanSheet('project-1'), { wrapper: wrapper() });

    await result.current.mutateAsync('ps-1');

    expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/project-1/plan-sheets/ps-1', {
      method: 'DELETE',
    });
  });

  it('createPlanSheet posts multipart via authFetch (not JSON apiFetch)', async () => {
    authFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ planSheet: { id: 'ps-new' } }),
    } as Response);

    const blob = new Blob(['x'], { type: 'image/png' });
    const sheet = await createPlanSheet('project-1', {
      blob,
      name: 'C-101',
      pageNumber: 2,
      coordinateSystem: 'EPSG:7856',
    });

    expect(sheet).toEqual({ id: 'ps-new' });
    expect(authFetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = authFetchMock.mock.calls[0];
    expect(path).toBe('/api/projects/project-1/plan-sheets');
    expect(init.method).toBe('POST');
    const body = init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('name')).toBe('C-101');
    expect(body.get('pageNumber')).toBe('2');
    expect(body.get('coordinateSystem')).toBe('EPSG:7856');
    expect(body.get('image')).toBeInstanceOf(Blob);
  });

  it('createPlanSheet throws an ApiError on a non-OK response', async () => {
    authFetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'bad',
    } as Response);

    await expect(
      createPlanSheet('project-1', {
        blob: new Blob(['x']),
        name: 'x',
        pageNumber: 1,
        coordinateSystem: 'EPSG:7856',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('downloadDocumentFile fetches document bytes via the authenticated file route', async () => {
    const blob = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    authFetchMock.mockResolvedValue({ ok: true, blob: async () => blob } as Response);

    const documentFile = await downloadDocumentFile('doc-1', 'C-101 Rev D.pdf');

    expect(authFetchMock).toHaveBeenCalledWith('/api/documents/file/doc-1');
    expect(documentFile).toBeInstanceOf(File);
    expect(documentFile.name).toBe('C-101 Rev D.pdf');
    expect(documentFile.type).toBe('application/pdf');
  });

  it('downloadDocumentFile throws an ApiError on a non-OK response', async () => {
    authFetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'denied',
    } as Response);

    await expect(downloadDocumentFile('doc-1', 'x.pdf')).rejects.toMatchObject({ status: 403 });
  });

  it('usePlanSheetsAccess grants write for a project_manager and denies a viewer', async () => {
    fetchProjectMock.mockResolvedValue({ status: 'active', currentUserRole: 'project_manager' });
    const { result } = renderHook(() => usePlanSheetsAccess('project-1'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.canManage).toBe(true));
    expect(result.current.readOnly).toBe(false);

    fetchProjectMock.mockResolvedValue({ status: 'archived', currentUserRole: 'viewer' });
    const { result: viewer } = renderHook(() => usePlanSheetsAccess('project-2'), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(viewer.current.loading).toBe(false));
    expect(viewer.current.canManage).toBe(false);
    expect(viewer.current.readOnly).toBe(true);
  });
});
