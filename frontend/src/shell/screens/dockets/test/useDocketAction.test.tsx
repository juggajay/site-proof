/**
 * Tests for useDocketAction — payload + endpoint PARITY with the existing
 * DocketActionModal flow, and cache invalidation that refreshes the Home tile.
 *
 * Asserts the exact apiFetch path + body for approve / reject / query, and that
 * a successful action invalidates the ['dockets', projectId] key prefix (which
 * covers the Home tile's status='pending_approval' query) plus the foreman badge.
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

import { toast } from '@/components/ui/toaster';
import { useDocketAction } from '../useDocketAction';

let queryClient: QueryClient;
let invalidateSpy: ReturnType<typeof vi.spyOn>;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient();
  invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
});

describe('useDocketAction — approve', () => {
  it('POSTs the modal-identical approve payload to /approve', async () => {
    const { result } = renderHook(() => useDocketAction('proj-1'), { wrapper });
    await act(async () => {
      await result.current.runAction({
        docketId: 'd1',
        actionType: 'approve',
        actionNotes: 'Looks good',
        adjustedLabourHours: 40,
        adjustedPlantHours: 12,
        adjustmentReason: 'Rounded down',
      });
    });

    expect(apiFetch).toHaveBeenCalledWith('/api/dockets/d1/approve', {
      method: 'POST',
      body: JSON.stringify({
        foremanNotes: 'Looks good',
        adjustedLabourHours: 40,
        adjustedPlantHours: 12,
        adjustmentReason: 'Rounded down',
      }),
    });
  });

  it('sends undefined adjusted hours + null notes for a plain one-tap approve', async () => {
    const { result } = renderHook(() => useDocketAction('proj-1'), { wrapper });
    await act(async () => {
      await result.current.runAction({ docketId: 'd1', actionType: 'approve' });
    });
    expect(apiFetch).toHaveBeenCalledWith('/api/dockets/d1/approve', {
      method: 'POST',
      body: JSON.stringify({
        foremanNotes: null,
        adjustedLabourHours: undefined,
        adjustedPlantHours: undefined,
        adjustmentReason: null,
      }),
    });
  });

  it('invalidates the dockets prefix + foreman badge so the Home tile refreshes', async () => {
    const { result } = renderHook(() => useDocketAction('proj-1'), { wrapper });
    await act(async () => {
      await result.current.runAction({ docketId: 'd1', actionType: 'approve' });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dockets', 'proj-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['foreman-badges', 'proj-1'] });
  });

  it('shows the backend diary-sync warning when approval cannot update the diary', async () => {
    apiFetch.mockResolvedValueOnce({
      diarySync: {
        status: 'skipped',
        code: 'DIARY_SUBMITTED',
        message:
          'Docket approved, but diary auto-population was skipped because the daily diary has already been submitted.',
      },
    });

    const { result } = renderHook(() => useDocketAction('proj-1'), { wrapper });
    await act(async () => {
      await result.current.runAction({ docketId: 'd1', actionType: 'approve' });
    });

    expect(toast).toHaveBeenCalledWith({
      variant: 'warning',
      description:
        'Docket approved, but diary auto-population was skipped because the daily diary has already been submitted.',
    });
  });
});

describe('useDocketAction — query / reject', () => {
  it('POSTs { questions } to /query', async () => {
    const { result } = renderHook(() => useDocketAction('proj-1'), { wrapper });
    await act(async () => {
      await result.current.runAction({
        docketId: 'd1',
        actionType: 'query',
        actionNotes: 'Which lot?',
      });
    });
    expect(apiFetch).toHaveBeenCalledWith('/api/dockets/d1/query', {
      method: 'POST',
      body: JSON.stringify({ questions: 'Which lot?' }),
    });
  });

  it('POSTs { reason } to /reject', async () => {
    const { result } = renderHook(() => useDocketAction('proj-1'), { wrapper });
    await act(async () => {
      await result.current.runAction({
        docketId: 'd1',
        actionType: 'reject',
        actionNotes: 'Hours wrong',
      });
    });
    expect(apiFetch).toHaveBeenCalledWith('/api/dockets/d1/reject', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Hours wrong' }),
    });
  });
});
