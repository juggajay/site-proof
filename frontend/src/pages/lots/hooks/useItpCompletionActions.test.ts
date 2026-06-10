import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the network + toast boundaries only. We keep the real hook logic so the
// request method/URL/body and the gate/skeleton are exercised exactly as in app.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/logger', () => ({ devLog: vi.fn(), devWarn: vi.fn(), logError: vi.fn() }));

import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import {
  useItpCompletionActions,
  type UseItpCompletionActionsParams,
} from './useItpCompletionActions';
import type { ITPInstance } from '../types';

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
        acceptanceCriteria: null,
      },
    ],
  },
  completions: [
    {
      id: 'completion-1',
      checklistItemId: 'item-1',
      isCompleted: false,
      isNotApplicable: false,
      isFailed: false,
      notes: null,
      completedAt: null,
      completedBy: null,
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      attachments: [],
    },
  ],
};

// Capture the args of the LAST apiFetch call (url, method, parsed body).
function lastCall() {
  const calls = vi.mocked(apiFetch).mock.calls;
  const [url, options] = calls[calls.length - 1] as [string, RequestInit | undefined];
  return {
    url,
    method: options?.method,
    body: options?.body ? (JSON.parse(options.body as string) as Record<string, unknown>) : null,
  };
}

// --- The two injected param sets the hook must serve ---------------------------

// PORTAL: full refetch, naDefaultNote '' (sends trimmed reason as-is), notes via
// PATCH of an existing completion only, default toast copy.
function portalParams(overrides: Partial<UseItpCompletionActionsParams> = {}) {
  const onAfterMutate = vi.fn(async () => {});
  // Mirror the portal page's injected updateNotes, closing over THIS call's
  // instance (so an `itpInstance` override is reflected, as in the real page).
  const instance = overrides.itpInstance !== undefined ? overrides.itpInstance : instanceFixture;
  const params: UseItpCompletionActionsParams = {
    itpInstance: instanceFixture,
    requireAccess: () => true,
    setUpdatingItem: vi.fn(),
    onAfterMutate,
    naDefaultNote: '',
    updateNotes: async (checklistItemId, notes) => {
      const completion = instance?.completions.find((c) => c.checklistItemId === checklistItemId);
      if (completion) {
        await apiFetch(`/api/itp/completions/${completion.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ notes }),
        });
      }
    },
    ...overrides,
  };
  return { params, onAfterMutate };
}

// HC: optimistic-merge wrapper (here just a spy), naDefaultNote 'Marked as N/A',
// notes via POST upsert (mirrors useItpInstance.updateNotes), NCR refetch after
// a failure, and HC toast copy. Proves the same hook expresses the HC wire.
function hcParams(overrides: Partial<UseItpCompletionActionsParams> = {}) {
  const onAfterMutate = vi.fn(async () => {});
  const onAfterFailure = vi.fn(async () => {});
  const params: UseItpCompletionActionsParams = {
    itpInstance: instanceFixture,
    requireAccess: () => true,
    setUpdatingItem: vi.fn(),
    onAfterMutate,
    naDefaultNote: 'Marked as N/A',
    updateNotes: async (checklistItemId, notes) => {
      const existing = instanceFixture.completions.find(
        (c) => c.checklistItemId === checklistItemId,
      );
      await apiFetch('/api/itp/completions', {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: instanceFixture.id,
          checklistItemId,
          isCompleted: existing?.isCompleted || false,
          notes,
        }),
      });
    },
    onAfterFailure,
    toastCopy: {
      failedTitle: 'Item marked as Failed',
      failedDescriptionFallback: 'The item has been marked as failed.',
    },
    ...overrides,
  };
  return { params, onAfterMutate, onAfterFailure };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiFetch).mockResolvedValue({} as never);
});
afterEach(() => vi.clearAllMocks());

describe('useItpCompletionActions — PORTAL param set', () => {
  it('toggle posts the exact body and calls the page refresh', async () => {
    const { params, onAfterMutate } = portalParams();
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleToggleCompletion('item-1', true, 'note text');
    });

    expect(lastCall()).toEqual({
      url: '/api/itp/completions',
      method: 'POST',
      body: {
        itpInstanceId: 'instance-1',
        checklistItemId: 'item-1',
        isCompleted: true,
        notes: 'note text',
      },
    });
    expect(onAfterMutate).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success', description: 'Item updated' }),
    );
  });

  it('mark N/A sends the trimmed reason as-is (naDefaultNote "") when non-blank', async () => {
    const { params } = portalParams();
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleMarkNotApplicable('item-1', '  out of scope  ');
    });

    expect(lastCall()).toEqual({
      url: '/api/itp/completions',
      method: 'POST',
      body: {
        itpInstanceId: 'instance-1',
        checklistItemId: 'item-1',
        status: 'not_applicable',
        notes: 'out of scope',
      },
    });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success', description: 'Item marked as N/A' }),
    );
  });

  it('mark N/A with a blank reason sends "" (portal naDefaultNote), NOT "Marked as N/A"', async () => {
    const { params } = portalParams();
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleMarkNotApplicable('item-1', '   ');
    });

    expect(lastCall().body).toMatchObject({ status: 'not_applicable', notes: '' });
  });

  it('mark Failed sends the byte-identical Failed/NCR body', async () => {
    const { params } = portalParams();
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleMarkFailed('item-1', '  cracked slab  ');
    });

    // This body must match the historic portal + HC Failed body byte-for-byte.
    expect(lastCall()).toEqual({
      url: '/api/itp/completions',
      method: 'POST',
      body: {
        itpInstanceId: 'instance-1',
        checklistItemId: 'item-1',
        status: 'failed',
        notes: 'Failed: cracked slab',
        ncrDescription: 'cracked slab',
        ncrCategory: 'workmanship',
        ncrSeverity: 'minor',
      },
    });
  });

  it('mark Failed with a blank reason uses the historic default strings', async () => {
    const { params } = portalParams();
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleMarkFailed('item-1', '   ');
    });

    expect(lastCall().body).toMatchObject({
      notes: 'Failed: Item failed inspection',
      ncrDescription: 'Item failed ITP inspection',
      ncrCategory: 'workmanship',
      ncrSeverity: 'minor',
    });
  });

  it('mark Failed surfaces the NCR number in the toast when the API returns one (approved change)', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ncr: { ncrNumber: 'NCR-077' } } as never);
    const { params } = portalParams();
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleMarkFailed('item-1', 'bad weld');
    });

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Success',
        description: 'NCR NCR-077 has been raised for this item.',
      }),
    );
  });

  it('mark Failed falls back to the plain message when no NCR number is returned', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({} as never);
    const { params } = portalParams();
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleMarkFailed('item-1', 'bad weld');
    });

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success', description: 'Item marked as failed' }),
    );
  });

  it('update notes PATCHes the existing completion (portal wire) and refreshes', async () => {
    const { params, onAfterMutate } = portalParams();
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleUpdateNotes('item-1', 'revised note');
    });

    expect(lastCall()).toEqual({
      url: '/api/itp/completions/completion-1',
      method: 'PATCH',
      body: { notes: 'revised note' },
    });
    expect(onAfterMutate).toHaveBeenCalledTimes(1);
    // No success toast on the notes path (matches historic portal behavior).
    expect(toast).not.toHaveBeenCalled();
  });

  it('update notes refreshes even when there is no existing completion to PATCH', async () => {
    const noCompletionInstance: ITPInstance = { ...instanceFixture, completions: [] };
    const { params, onAfterMutate } = portalParams({ itpInstance: noCompletionInstance });
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleUpdateNotes('item-1', 'note');
    });

    expect(apiFetch).not.toHaveBeenCalled();
    expect(onAfterMutate).toHaveBeenCalledTimes(1);
  });
});

describe('useItpCompletionActions — HC param set (same hook, HC wire)', () => {
  it('toggle posts the same upsert body shape', async () => {
    const { params } = hcParams();
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleToggleCompletion('item-1', true, 'hc note');
    });

    expect(lastCall()).toEqual({
      url: '/api/itp/completions',
      method: 'POST',
      body: {
        itpInstanceId: 'instance-1',
        checklistItemId: 'item-1',
        isCompleted: true,
        notes: 'hc note',
      },
    });
  });

  it('mark N/A with a blank reason uses the HC default note "Marked as N/A"', async () => {
    const { params } = hcParams();
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleMarkNotApplicable('item-1', '');
    });

    expect(lastCall().body).toMatchObject({ status: 'not_applicable', notes: 'Marked as N/A' });
  });

  it('mark Failed sends the byte-identical Failed body and runs the NCR refresh', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ncr: { ncrNumber: 'NCR-9' } } as never);
    const { params, onAfterFailure } = hcParams();
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleMarkFailed('item-1', 'spalling');
    });

    expect(lastCall()).toEqual({
      url: '/api/itp/completions',
      method: 'POST',
      body: {
        itpInstanceId: 'instance-1',
        checklistItemId: 'item-1',
        status: 'failed',
        notes: 'Failed: spalling',
        ncrDescription: 'spalling',
        ncrCategory: 'workmanship',
        ncrSeverity: 'minor',
      },
    });
    expect(onAfterFailure).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Item marked as Failed',
        description: 'NCR NCR-9 has been raised for this item.',
      }),
    );
  });

  it('update notes POSTs an upsert (HC wire), not a PATCH', async () => {
    const { params } = hcParams();
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleUpdateNotes('item-1', 'hc revised');
    });

    expect(lastCall()).toEqual({
      url: '/api/itp/completions',
      method: 'POST',
      body: {
        itpInstanceId: 'instance-1',
        checklistItemId: 'item-1',
        isCompleted: false,
        notes: 'hc revised',
      },
    });
  });
});

describe('useItpCompletionActions — success flag for the mobile sheet', () => {
  it('mark N/A resolves true on success and false when the write fails', async () => {
    const { params } = portalParams();
    const { result } = renderHook(() => useItpCompletionActions(params));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleMarkNotApplicable('item-1', 'out of scope');
    });
    expect(returned).toBe(true);

    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('network down'));
    await act(async () => {
      returned = await result.current.handleMarkNotApplicable('item-1', 'out of scope');
    });
    expect(returned).toBe(false);
  });

  it('mark Failed resolves true on success and false when the write fails', async () => {
    const { params } = portalParams();
    const { result } = renderHook(() => useItpCompletionActions(params));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleMarkFailed('item-1', 'cracked slab');
    });
    expect(returned).toBe(true);

    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('network down'));
    await act(async () => {
      returned = await result.current.handleMarkFailed('item-1', 'cracked slab');
    });
    expect(returned).toBe(false);
  });

  it('gated and instance-less calls resolve false without sending anything', async () => {
    const gated = portalParams({ requireAccess: () => false });
    const gatedHook = renderHook(() => useItpCompletionActions(gated.params));
    const noInstance = portalParams({ itpInstance: null });
    const noInstanceHook = renderHook(() => useItpCompletionActions(noInstance.params));

    const returns: (boolean | undefined)[] = [];
    await act(async () => {
      returns.push(await gatedHook.result.current.handleMarkNotApplicable('item-1', 'x'));
      returns.push(await gatedHook.result.current.handleMarkFailed('item-1', 'x'));
      returns.push(await noInstanceHook.result.current.handleMarkNotApplicable('item-1', 'x'));
      returns.push(await noInstanceHook.result.current.handleMarkFailed('item-1', 'x'));
    });

    expect(returns).toEqual([false, false, false, false]);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe('useItpCompletionActions — trust boundary (injected gate)', () => {
  it('fires NO request and NO refresh for any action when requireAccess() is false', async () => {
    const onAfterMutate = vi.fn(async () => {});
    const { params } = portalParams({ requireAccess: () => false, onAfterMutate });
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleToggleCompletion('item-1', true, null);
      await result.current.handleMarkNotApplicable('item-1', 'x');
      await result.current.handleMarkFailed('item-1', 'x');
      await result.current.handleUpdateNotes('item-1', 'x');
    });

    expect(apiFetch).not.toHaveBeenCalled();
    expect(onAfterMutate).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('requireAccess() is evaluated BEFORE setUpdatingItem for every action', async () => {
    // Guards against a regression where the gate is checked after side effects.
    const setUpdatingItem = vi.fn();
    const { params } = portalParams({ requireAccess: () => false, setUpdatingItem });
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleMarkFailed('item-1', 'x');
    });

    expect(setUpdatingItem).not.toHaveBeenCalled();
  });

  it('does nothing when there is no ITP instance (null guard) even if access is granted', async () => {
    const { params } = portalParams({ itpInstance: null });
    const { result } = renderHook(() => useItpCompletionActions(params));

    await act(async () => {
      await result.current.handleToggleCompletion('item-1', true, null);
      await result.current.handleMarkFailed('item-1', 'x');
    });

    expect(apiFetch).not.toHaveBeenCalled();
  });
});
