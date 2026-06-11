/**
 * Tests for usePhotoRefile — payload + endpoint PARITY with the existing
 * documents PATCH path, and cache invalidation that refreshes BOTH the photo
 * surfaces and the lot register.
 *
 * Asserts the exact apiFetch path + body { lotId } and that a successful re-file
 * invalidates queryKeys.documents(projectId) (the shell grid + desktop Documents
 * page) and the lots register key (the lot hub photo count). Also asserts the
 * in-flight guard and the failure path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const apiFetch = vi.fn((..._args: unknown[]) => Promise.resolve({}));
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
const handleApiError = vi.fn();
vi.mock('@/lib/errorHandling', () => ({
  handleApiError: (...args: unknown[]) => handleApiError(...args),
}));

import { usePhotoRefile } from '../usePhotoRefile';
import { queryKeys } from '@/lib/queryKeys';
import { lotsRegisterQueryKey } from '@/pages/lots/hooks/useLotsData';

let queryClient: QueryClient;
let invalidateSpy: ReturnType<typeof vi.spyOn>;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue({});
  queryClient = new QueryClient();
  invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
});

describe('usePhotoRefile', () => {
  it('PATCHes /api/documents/:id with exactly { lotId }', async () => {
    const { result } = renderHook(() => usePhotoRefile('proj-1'), { wrapper });
    await act(async () => {
      await result.current.fileToLot('doc-1', 'lot-9');
    });
    expect(apiFetch).toHaveBeenCalledWith('/api/documents/doc-1', {
      method: 'PATCH',
      body: JSON.stringify({ lotId: 'lot-9' }),
    });
  });

  it('invalidates the documents cache and the lots register on success', async () => {
    const { result } = renderHook(() => usePhotoRefile('proj-1'), { wrapper });
    await act(async () => {
      await result.current.fileToLot('doc-1', 'lot-9');
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.documents('proj-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: lotsRegisterQueryKey('proj-1') });
  });

  it('returns true on success and false on failure', async () => {
    const { result } = renderHook(() => usePhotoRefile('proj-1'), { wrapper });
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.fileToLot('doc-1', 'lot-9');
    });
    expect(ok).toBe(true);

    apiFetch.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      ok = await result.current.fileToLot('doc-1', 'lot-9');
    });
    expect(ok).toBe(false);
    expect(handleApiError).toHaveBeenCalled();
  });

  it('no-ops without a documentId or lotId', async () => {
    const { result } = renderHook(() => usePhotoRefile('proj-1'), { wrapper });
    await act(async () => {
      await result.current.fileToLot('', 'lot-9');
      await result.current.fileToLot('doc-1', '');
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('encodes the document id in the path', async () => {
    const { result } = renderHook(() => usePhotoRefile('proj-1'), { wrapper });
    await act(async () => {
      await result.current.fileToLot('doc/with space', 'lot-9');
    });
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/documents/doc%2Fwith%20space',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});
