import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// We mock only the network/storage/IO boundaries and keep the REAL
// isRetriableNetworkFailure (the api mock spreads `...actual`), so the offline
// fallback is exercised through the same predicate the production code uses.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/lib/offlineDb', () => ({ updateChecklistItemOffline: vi.fn() }));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/errorHandling', () => ({ handleApiError: vi.fn() }));

import { apiFetch, ApiError } from '@/lib/api';
import { updateChecklistItemOffline } from '@/lib/offlineDb';
import { handleApiError } from '@/lib/errorHandling';
import { useItpMobileActions } from './useItpMobileActions';
import type { ITPCompletion, ITPInstance } from '../types';

const apiFetchMock = vi.mocked(apiFetch);
const updateChecklistItemOfflineMock = vi.mocked(updateChecklistItemOffline);
const handleApiErrorMock = vi.mocked(handleApiError);

const instanceFixture: ITPInstance = {
  id: 'instance-1',
  template: {
    id: 'template-1',
    name: 'Earthworks ITP',
    checklistItems: [
      {
        id: 'item-1',
        description: 'Compaction',
        category: 'General',
        responsibleParty: 'contractor',
        isHoldPoint: false,
        pointType: 'standard',
        evidenceRequired: 'none',
        order: 0,
        testType: null,
        acceptanceCriteria: '95% MDD',
      },
    ],
  },
  completions: [] as ITPCompletion[],
};

function setup(lotId: string | undefined = 'lot-1') {
  const setItpInstance = vi.fn();
  const updatingCompletionRef = { current: null as string | null };
  const setUpdatingCompletion = vi.fn();
  const refetchReadiness = vi.fn();
  const refetchConformStatus = vi.fn();
  const refreshNcrsAfterFailure = vi.fn().mockResolvedValue(undefined);

  const { result } = renderHook(() =>
    useItpMobileActions({
      lotId,
      itpInstance: instanceFixture,
      setItpInstance,
      updatingCompletionRef,
      setUpdatingCompletion,
      refetchReadiness,
      refetchConformStatus,
      refreshNcrsAfterFailure,
    }),
  );

  return { result, setItpInstance };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useItpMobileActions offline fallback', () => {
  it('queues an N/A mark offline (not lost) on a retriable network failure', async () => {
    apiFetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const { result, setItpInstance } = setup('lot-1');

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.mobileMarkNA('item-1', 'Out of scope');
    });

    // The mark must NOT be lost: the action succeeds (sheet closes) by queueing.
    expect(returned).toBe(true);
    expect(updateChecklistItemOfflineMock).toHaveBeenCalledWith(
      'lot-1',
      'item-1',
      'na',
      expect.any(String),
      expect.any(String),
      undefined,
    );
    // Optimistic local state is applied so the field shows the N/A immediately.
    expect(setItpInstance).toHaveBeenCalled();
    expect(handleApiErrorMock).not.toHaveBeenCalled();
  });

  it('queues a FAIL mark offline (not lost) on a retriable network failure', async () => {
    apiFetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const { result, setItpInstance } = setup('lot-1');

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.mobileMarkFailed('item-1', 'Crack found');
    });

    expect(returned).toBe(true);
    // The queued FAIL carries the NCR details so it raises its NCR on sync,
    // matching the online path (backend requires ncrDescription for a fail).
    expect(updateChecklistItemOfflineMock).toHaveBeenCalledWith(
      'lot-1',
      'item-1',
      'failed',
      expect.any(String),
      expect.any(String),
      { description: 'Crack found', category: 'workmanship', severity: 'minor' },
    );
    expect(setItpInstance).toHaveBeenCalled();
    expect(handleApiErrorMock).not.toHaveBeenCalled();
  });

  it('does not queue offline for a definitive 4xx rejection (preserves error UI)', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(400, 'bad request'));

    const { result } = setup('lot-1');

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.mobileMarkNA('item-1', 'Out of scope');
    });

    expect(returned).toBe(false);
    expect(updateChecklistItemOfflineMock).not.toHaveBeenCalled();
    expect(handleApiErrorMock).toHaveBeenCalled();
  });
});
