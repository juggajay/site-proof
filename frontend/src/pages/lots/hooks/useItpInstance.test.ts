import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The hook makes no use of TanStack Query or react-router, so renderHook needs
// no provider wrapper. We mock the network/storage/IO boundaries only, keeping
// the REAL ApiError (so `err instanceof ApiError && err.status === 404` works)
// and the REAL itpOfflineMapping helpers (so cache write-through is exercised).
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn(), authFetch: vi.fn() };
});
vi.mock('@/lib/offlineDb', () => ({
  cacheITPChecklist: vi.fn(),
  getCachedITPChecklist: vi.fn(),
  getPendingSyncCount: vi.fn(),
  recordSyncedChecklistItem: vi.fn(),
  updateChecklistItemOffline: vi.fn(),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/logger', () => ({ devLog: vi.fn(), devWarn: vi.fn(), logError: vi.fn() }));

import { apiFetch, ApiError } from '@/lib/api';
import { RequestTimeoutError } from '@/lib/fetchWithTimeout';
import {
  cacheITPChecklist,
  getCachedITPChecklist,
  getPendingSyncCount,
  recordSyncedChecklistItem,
  updateChecklistItemOffline,
} from '@/lib/offlineDb';
import { toast } from '@/components/ui/toaster';
import { useItpInstance } from './useItpInstance';
import type { ITPCompletion, ITPInstance, ITPTemplate, LotTab } from '../types';
import type { OfflineITPChecklist } from '@/lib/offlineDb';

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
  completions: [
    {
      id: 'completion-1',
      checklistItemId: 'item-1',
      isCompleted: true,
      isNotApplicable: false,
      isFailed: false,
      notes: null,
      completedAt: '2026-05-30T10:00:00.000Z',
      completedBy: { id: 'u1', fullName: 'Jane Foreman', email: 'jane@example.com' },
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      attachments: [],
    },
  ],
};

const templatesFixture: ITPTemplate[] = [
  { id: 'template-1', name: 'Earthworks ITP', activityType: 'Earthworks', checklistItems: [] },
];

const cachedFixture: OfflineITPChecklist = {
  id: 'cache-1',
  lotId: 'lot-1',
  templateId: 'template-1',
  templateName: 'Earthworks ITP',
  items: [
    {
      id: 'item-1',
      name: 'Compaction',
      responsibleParty: 'contractor',
      isHoldPoint: false,
      status: 'completed',
      notes: 'ok',
      completedAt: '2026-05-30T10:00:00.000Z',
      completedBy: 'Jane Foreman',
    },
  ],
  cachedAt: '2026-05-31T00:00:00.000Z',
};

const baseParams = {
  projectId: 'project-1',
  lotId: 'lot-1',
  currentTab: 'itp' as LotTab,
  isOnline: true,
  refetchReadiness: vi.fn(),
  refetchConformStatus: vi.fn(),
  onRequestWitness: vi.fn(),
  onRequestEvidenceWarning: vi.fn(),
  onToggleSettled: vi.fn(),
  refreshLotAfterFailure: vi.fn(async () => {}),
  refreshNcrsAfterFailure: vi.fn(async () => {}),
};

// Route apiFetch by URL + method so a single render can satisfy the mount fetch
// and any follow-on call (templates / POST instance).
interface ApiHandlers {
  getInstance?: () => unknown;
  getTemplates?: () => unknown;
  postInstance?: () => unknown;
  deleteInstance?: () => unknown;
  postCompletion?: (body: Record<string, unknown>) => unknown;
}
function routeApiFetch(handlers: ApiHandlers) {
  vi.mocked(apiFetch).mockImplementation(
    async (url: string, options?: RequestInit): Promise<unknown> => {
      const method = options?.method ?? 'GET';
      if (url.includes('/api/itp/completions') && method === 'POST') {
        const body = options?.body
          ? (JSON.parse(options.body as string) as Record<string, unknown>)
          : {};
        return handlers.postCompletion ? handlers.postCompletion(body) : { completion: null };
      }
      if (url.includes('/api/itp/instances/lot/')) {
        return handlers.getInstance ? handlers.getInstance() : { instance: null };
      }
      if (url.includes('/api/itp/templates')) {
        return handlers.getTemplates ? handlers.getTemplates() : { templates: [] };
      }
      if (url.includes('/api/itp/instances') && method === 'POST') {
        return handlers.postInstance ? handlers.postInstance() : { instance: null };
      }
      if (url.includes('/api/itp/instances/') && method === 'DELETE') {
        return handlers.deleteInstance
          ? handlers.deleteInstance()
          : { success: true, message: 'ITP unassigned from lot' };
      }
      throw new Error(`Unexpected apiFetch URL: ${url}`);
    },
  );
}

// A richer instance for the mutation tests: a standard item (item-1), a witness
// point (item-w), and a photo-evidence item (item-e, no attachments yet).
const mutationInstanceFixture: ITPInstance = {
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
      {
        id: 'item-w',
        description: 'Subgrade witness point',
        category: 'General',
        responsibleParty: 'contractor',
        isHoldPoint: true,
        pointType: 'witness',
        evidenceRequired: 'none',
        order: 1,
        testType: null,
        acceptanceCriteria: null,
      },
      {
        id: 'item-e',
        description: 'Surface level',
        category: 'General',
        responsibleParty: 'contractor',
        isHoldPoint: false,
        pointType: 'standard',
        evidenceRequired: 'photo',
        order: 2,
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

function completionResponse(overrides: Partial<ITPCompletion> = {}): ITPCompletion {
  return {
    id: 'completion-new',
    checklistItemId: 'item-1',
    isCompleted: true,
    isNotApplicable: false,
    isFailed: false,
    notes: null,
    completedAt: '2026-05-31T10:00:00.000Z',
    completedBy: { id: 'u1', fullName: 'Jane Foreman', email: 'jane@example.com' },
    isVerified: false,
    verifiedAt: null,
    verifiedBy: null,
    attachments: [],
    ...overrides,
  };
}

// Mounts the hook on the mutation fixture and waits until the instance is loaded.
async function mountMutationHook(
  handlers: ApiHandlers,
  overrides: Partial<typeof baseParams> = {},
) {
  routeApiFetch({ getInstance: () => ({ instance: mutationInstanceFixture }), ...handlers });
  const utils = renderHook(() => useItpInstance({ ...baseParams, ...overrides }));
  await waitFor(() => expect(utils.result.current.itpInstance?.id).toBe('instance-1'));
  return utils;
}

// Count only the completion POSTs (the mount GET is separate).
function completionPostCount() {
  return vi
    .mocked(apiFetch)
    .mock.calls.filter(
      ([url, options]) =>
        typeof url === 'string' &&
        url.includes('/api/itp/completions') &&
        (options as { method?: string })?.method === 'POST',
    ).length;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPendingSyncCount).mockResolvedValue(0);
  vi.mocked(getCachedITPChecklist).mockResolvedValue(undefined);
  vi.mocked(cacheITPChecklist).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useItpInstance — fetch + offline', () => {
  it('loads the server instance, clears offline mode, and writes through to the cache', async () => {
    routeApiFetch({ getInstance: () => ({ instance: instanceFixture }) });
    vi.mocked(getPendingSyncCount).mockResolvedValue(3);

    const { result } = renderHook(() => useItpInstance(baseParams));

    await waitFor(() => expect(result.current.itpInstance).toEqual(instanceFixture));
    expect(result.current.isOfflineData).toBe(false);
    expect(result.current.offlinePendingCount).toBe(3);
    expect(cacheITPChecklist).toHaveBeenCalledTimes(1);
    expect(cacheITPChecklist).toHaveBeenCalledWith('lot-1', 'template-1', 'Earthworks ITP', [
      expect.objectContaining({ id: 'item-1', status: 'completed', completedBy: 'Jane Foreman' }),
    ]);
  });

  it('loads available templates when no ITP is assigned (null instance)', async () => {
    routeApiFetch({
      getInstance: () => ({ instance: null }),
      getTemplates: () => ({ templates: templatesFixture }),
    });

    const { result } = renderHook(() => useItpInstance(baseParams));

    await waitFor(() => expect(result.current.templates).toEqual(templatesFixture));
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(expect.stringContaining('activeOnly=true'));
    expect(result.current.itpInstance).toBeNull();
    expect(result.current.itpLoadError).toBeNull();
    expect(cacheITPChecklist).not.toHaveBeenCalled();
  });

  it('drops inactive templates from lot assignment choices defensively', async () => {
    routeApiFetch({
      getInstance: () => ({ instance: null }),
      getTemplates: () => ({
        templates: [
          ...templatesFixture,
          {
            id: 'template-archived',
            name: 'Archived ITP',
            activityType: 'Earthworks',
            isActive: false,
            checklistItems: [],
          },
        ],
      }),
    });

    const { result } = renderHook(() => useItpInstance(baseParams));

    await waitFor(() => expect(result.current.templates).toEqual(templatesFixture));
  });

  it('sets an error when templates cannot be loaded for an unassigned lot', async () => {
    routeApiFetch({
      getInstance: () => ({ instance: null }),
      getTemplates: () => {
        throw new Error('templates boom');
      },
    });

    const { result } = renderHook(() => useItpInstance(baseParams));

    await waitFor(() => expect(result.current.itpLoadError).toBeTruthy());
    expect(result.current.templates).toEqual([]);
    expect(result.current.itpInstance).toBeNull();
  });

  it('falls back to cached data and flags offline mode on a non-404 failure', async () => {
    routeApiFetch({
      getInstance: () => {
        throw new Error('network down');
      },
    });
    vi.mocked(getCachedITPChecklist).mockResolvedValue(cachedFixture);

    const { result } = renderHook(() => useItpInstance(baseParams));

    await waitFor(() => expect(result.current.isOfflineData).toBe(true));
    expect(result.current.itpInstance?.id).toBe('offline-cache-1');
    expect(getCachedITPChecklist).toHaveBeenCalledWith('lot-1');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Offline Mode' }));
  });

  it('treats a 404 as "no ITP" and loads templates without reading the offline cache', async () => {
    routeApiFetch({
      getInstance: () => {
        throw new ApiError(404, 'not found');
      },
      getTemplates: () => ({ templates: templatesFixture }),
    });

    const { result } = renderHook(() => useItpInstance(baseParams));

    await waitFor(() => expect(result.current.templates).toEqual(templatesFixture));
    expect(getCachedITPChecklist).not.toHaveBeenCalled();
    expect(result.current.itpInstance).toBeNull();
    expect(result.current.itpLoadError).toBeNull();
  });

  it('does not fetch when the ITP tab is not active', async () => {
    routeApiFetch({ getInstance: () => ({ instance: instanceFixture }) });

    const { result } = renderHook(() =>
      useItpInstance({ ...baseParams, currentTab: 'tests' as LotTab }),
    );

    // Give any (incorrectly scheduled) async work a chance to run.
    await Promise.resolve();
    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.current.itpInstance).toBeNull();
  });
});

describe('useItpInstance — assignTemplate', () => {
  it('posts the template, sets the instance, and refreshes readiness + conform status', async () => {
    const refetchReadiness = vi.fn();
    const refetchConformStatus = vi.fn();
    routeApiFetch({
      getInstance: () => ({ instance: null }),
      getTemplates: () => ({ templates: templatesFixture }),
      postInstance: () => ({ instance: instanceFixture }),
    });

    const { result } = renderHook(() =>
      useItpInstance({ ...baseParams, refetchReadiness, refetchConformStatus }),
    );
    await waitFor(() => expect(result.current.templates).toEqual(templatesFixture));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.assignTemplate('template-1');
    });

    expect(returned).toBe(true);
    expect(result.current.itpInstance).toEqual(instanceFixture);
    expect(refetchReadiness).toHaveBeenCalledTimes(1);
    expect(refetchConformStatus).toHaveBeenCalledTimes(1);
  });

  it('returns false and toasts an error when the assignment request fails', async () => {
    routeApiFetch({
      getInstance: () => ({ instance: null }),
      getTemplates: () => ({ templates: [] }),
      postInstance: () => {
        throw new Error('assign boom');
      },
    });

    const { result } = renderHook(() => useItpInstance(baseParams));
    await waitFor(() => expect(result.current.loadingItp).toBe(false));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.assignTemplate('template-1');
    });

    expect(returned).toBe(false);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to assign ITP template' }),
    );
  });

  it('deletes the instance, clears local state, and refreshes readiness + conform status', async () => {
    const refetchReadiness = vi.fn();
    const refetchConformStatus = vi.fn();
    routeApiFetch({
      getInstance: () => ({ instance: instanceFixture }),
      deleteInstance: () => ({ success: true, message: 'ITP unassigned from lot' }),
    });

    const { result } = renderHook(() =>
      useItpInstance({ ...baseParams, refetchReadiness, refetchConformStatus }),
    );
    await waitFor(() => expect(result.current.itpInstance).toEqual(instanceFixture));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.unassignTemplate('instance-1');
    });

    expect(returned).toBe(true);
    expect(apiFetch).toHaveBeenCalledWith('/api/itp/instances/instance-1', { method: 'DELETE' });
    expect(result.current.itpInstance).toBeNull();
    expect(refetchReadiness).toHaveBeenCalledTimes(1);
    expect(refetchConformStatus).toHaveBeenCalledTimes(1);
  });

  it('returns false, keeps local state, and surfaces the backend 409 message', async () => {
    const conflictMessage =
      "This ITP has recorded work on this lot and can't be unassigned. Remove the recorded completions, hold points, or test results before unassigning it.";
    routeApiFetch({
      getInstance: () => ({ instance: instanceFixture }),
      deleteInstance: () => {
        throw new ApiError(
          409,
          JSON.stringify({
            error: {
              message: conflictMessage,
              code: 'CONFLICT',
              details: {
                code: 'ITP_INSTANCE_HAS_RECORDED_WORK',
                completionCount: 1,
                holdPointCount: 0,
                testResultCount: 0,
              },
            },
          }),
        );
      },
    });

    const { result } = renderHook(() => useItpInstance(baseParams));
    await waitFor(() => expect(result.current.itpInstance).toEqual(instanceFixture));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.unassignTemplate('instance-1');
    });

    expect(returned).toBe(false);
    expect(result.current.itpInstance).toEqual(instanceFixture);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to unassign ITP template',
        description: conflictMessage,
        variant: 'error',
      }),
    );
  });
});

describe('useItpInstance — completion mutations', () => {
  it('toggleCompletion posts, merges, refreshes closeout state, and writes through to the offline cache without queueing', async () => {
    const refetchReadiness = vi.fn();
    const refetchConformStatus = vi.fn();
    let body: Record<string, unknown> | undefined;
    const merged = completionResponse({ id: 'completion-1', checklistItemId: 'item-1' });
    const { result } = await mountMutationHook(
      {
        postCompletion: (b) => {
          body = b;
          return { completion: merged };
        },
      },
      { refetchReadiness, refetchConformStatus },
    );

    await act(async () => {
      await result.current.toggleCompletion('item-1', false, null);
    });

    expect(completionPostCount()).toBe(1);
    expect(body).toMatchObject({
      itpInstanceId: 'instance-1',
      checklistItemId: 'item-1',
      isCompleted: true,
      notes: null,
    });
    expect(result.current.itpInstance?.completions[0]).toEqual(merged);
    expect(refetchReadiness).toHaveBeenCalledTimes(1);
    expect(refetchConformStatus).toHaveBeenCalledTimes(1);
    expect(recordSyncedChecklistItem).toHaveBeenCalledWith(
      'lot-1',
      'item-1',
      'completed',
      undefined,
      'Current User',
      merged,
    );
    // A server-confirmed write must add exactly zero sync-queue entries.
    expect(updateChecklistItemOffline).not.toHaveBeenCalled();
    expect(result.current.updatingCompletion).toBeNull();
  });

  it('toggleCompletion falls back to an offline write + "Saved Offline" toast when the POST fails offline', async () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    // Mount reads 0 pending; the offline write re-reads and sees 5.
    vi.mocked(getPendingSyncCount).mockResolvedValueOnce(0).mockResolvedValue(5);
    try {
      const { result } = await mountMutationHook({
        postCompletion: () => {
          throw new Error('network down');
        },
      });

      await act(async () => {
        await result.current.toggleCompletion('item-1', false, null);
      });

      expect(updateChecklistItemOffline).toHaveBeenCalledWith(
        'lot-1',
        'item-1',
        'completed',
        undefined,
        'Current User (Offline)',
      );
      const offline = result.current.itpInstance?.completions.find(
        (c) => c.checklistItemId === 'item-1',
      );
      expect(offline?.id).toMatch(/^offline-item-1-/);
      expect(offline?.isCompleted).toBe(true);
      expect(result.current.offlinePendingCount).toBe(5);
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Saved Offline' }));
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    }
  });

  it('toggleCompletion queues offline + updates local state when the POST times out while the browser reports online', async () => {
    // Mount reads 0 pending; the offline write re-reads and sees 1.
    vi.mocked(getPendingSyncCount).mockResolvedValueOnce(0).mockResolvedValue(1);
    const { result } = await mountMutationHook({
      postCompletion: () => {
        throw new RequestTimeoutError(30000);
      },
    });

    await act(async () => {
      await result.current.toggleCompletion('item-1', false, null);
    });

    expect(updateChecklistItemOffline).toHaveBeenCalledWith(
      'lot-1',
      'item-1',
      'completed',
      undefined,
      'Current User (Offline)',
    );
    const offline = result.current.itpInstance?.completions.find(
      (c) => c.checklistItemId === 'item-1',
    );
    expect(offline?.isCompleted).toBe(true);
    expect(result.current.offlinePendingCount).toBe(1);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Saved Offline' }));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Error' }));
  });

  it('toggleCompletion queues offline when the server answers 5xx', async () => {
    const { result } = await mountMutationHook({
      postCompletion: () => {
        throw new ApiError(503, 'upstream unavailable');
      },
    });

    await act(async () => {
      await result.current.toggleCompletion('item-1', false, null);
    });

    expect(updateChecklistItemOffline).toHaveBeenCalledWith(
      'lot-1',
      'item-1',
      'completed',
      undefined,
      'Current User (Offline)',
    );
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Saved Offline' }));
  });

  it('toggleCompletion surfaces a 4xx as a real error and queues nothing', async () => {
    const { result } = await mountMutationHook({
      postCompletion: () => {
        throw new ApiError(400, 'completion rejected');
      },
    });

    await act(async () => {
      await result.current.toggleCompletion('item-1', false, null);
    });

    expect(updateChecklistItemOffline).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'Failed to update checklist item. Please try again.',
      }),
    );
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Saved Offline' }));
    // The 4xx must not flip the item on locally either.
    const completion = result.current.itpInstance?.completions.find(
      (c) => c.checklistItemId === 'item-1',
    );
    expect(completion?.isCompleted).toBe(false);
  });

  it('toggleCompletion on a witness point requests the witness modal and does not POST', async () => {
    const onRequestWitness = vi.fn();
    const { result } = await mountMutationHook(
      { postCompletion: () => ({ completion: completionResponse() }) },
      { onRequestWitness },
    );

    await act(async () => {
      await result.current.toggleCompletion('item-w', false, 'prior notes');
    });

    expect(onRequestWitness).toHaveBeenCalledWith({
      checklistItemId: 'item-w',
      itemDescription: 'Subgrade witness point',
      existingNotes: 'prior notes',
    });
    expect(completionPostCount()).toBe(0);
  });

  it('toggleCompletion on an evidence-required item requests the evidence warning and does not POST', async () => {
    const onRequestEvidenceWarning = vi.fn();
    const { result } = await mountMutationHook(
      { postCompletion: () => ({ completion: completionResponse() }) },
      { onRequestEvidenceWarning },
    );

    await act(async () => {
      await result.current.toggleCompletion('item-e', false, null);
    });

    expect(onRequestEvidenceWarning).toHaveBeenCalledWith({
      checklistItemId: 'item-e',
      itemDescription: 'Surface level',
      evidenceType: 'Photo',
      currentNotes: null,
    });
    expect(completionPostCount()).toBe(0);
  });

  it('toggleCompletion ignores a second call for the same item while one is in flight (double-submit guard)', async () => {
    let resolvePost: (value: unknown) => void = () => {};
    const { result } = await mountMutationHook({
      postCompletion: () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    });

    await act(async () => {
      void result.current.toggleCompletion('item-1', false, null);
      void result.current.toggleCompletion('item-1', false, null);
      await Promise.resolve();
    });

    expect(completionPostCount()).toBe(1);

    // Settle the in-flight POST so no pending state leaks into the next test.
    await act(async () => {
      resolvePost({ completion: completionResponse({ id: 'completion-1' }) });
      await Promise.resolve();
    });
  });

  it('toggleCompletion always notifies onToggleSettled so the page can dismiss the evidence prompt', async () => {
    const onToggleSettled = vi.fn();
    const { result } = await mountMutationHook(
      { postCompletion: () => ({ completion: completionResponse({ id: 'completion-1' }) }) },
      { onToggleSettled },
    );

    await act(async () => {
      await result.current.toggleCompletion('item-1', false, null);
    });

    expect(onToggleSettled).toHaveBeenCalledTimes(1);
  });

  describe('toggleCompletion return value (M57 — mobile PASS closes only on success)', () => {
    it('resolves true on a server-confirmed save', async () => {
      const { result } = await mountMutationHook({
        postCompletion: () => ({ completion: completionResponse({ id: 'completion-1' }) }),
      });
      let returned: boolean | undefined;
      await act(async () => {
        returned = await result.current.toggleCompletion('item-1', false, null);
      });
      expect(returned).toBe(true);
    });

    it('resolves true when a retriable failure queues the write offline', async () => {
      const { result } = await mountMutationHook({
        postCompletion: () => {
          throw new ApiError(503, 'upstream unavailable');
        },
      });
      let returned: boolean | undefined;
      await act(async () => {
        returned = await result.current.toggleCompletion('item-1', false, null);
      });
      expect(returned).toBe(true);
    });

    it('resolves false on a definitive 4xx rejection', async () => {
      const { result } = await mountMutationHook({
        postCompletion: () => {
          throw new ApiError(400, 'completion rejected');
        },
      });
      let returned: boolean | undefined;
      await act(async () => {
        returned = await result.current.toggleCompletion('item-1', false, null);
      });
      expect(returned).toBe(false);
    });

    it('resolves true when a witness gate opens (the gate modal continues the save)', async () => {
      const { result } = await mountMutationHook(
        { postCompletion: () => ({ completion: completionResponse() }) },
        { onRequestWitness: vi.fn() },
      );
      let returned: boolean | undefined;
      await act(async () => {
        returned = await result.current.toggleCompletion('item-w', false, 'prior notes');
      });
      expect(returned).toBe(true);
    });

    it('resolves true when an evidence gate opens', async () => {
      const { result } = await mountMutationHook(
        { postCompletion: () => ({ completion: completionResponse() }) },
        { onRequestEvidenceWarning: vi.fn() },
      );
      let returned: boolean | undefined;
      await act(async () => {
        returned = await result.current.toggleCompletion('item-e', false, null);
      });
      expect(returned).toBe(true);
    });
  });

  it('updateNotes posts the note against the current completion state and merges the result', async () => {
    let body: Record<string, unknown> | undefined;
    const updated = completionResponse({
      id: 'completion-1',
      checklistItemId: 'item-1',
      isCompleted: false,
      notes: 'rechecked',
    });
    const { result } = await mountMutationHook({
      postCompletion: (b) => {
        body = b;
        return { completion: updated };
      },
    });

    await act(async () => {
      await result.current.updateNotes('item-1', 'rechecked');
    });

    expect(body).toMatchObject({
      itpInstanceId: 'instance-1',
      checklistItemId: 'item-1',
      isCompleted: false,
      notes: 'rechecked',
    });
    expect(result.current.itpInstance?.completions[0]).toEqual(updated);
  });

  it('markAsNA trims the reason, posts not_applicable, refreshes closeout state, toasts, and returns true', async () => {
    const refetchReadiness = vi.fn();
    const refetchConformStatus = vi.fn();
    let body: Record<string, unknown> | undefined;
    const na = completionResponse({
      id: 'completion-1',
      checklistItemId: 'item-1',
      isNotApplicable: true,
      isCompleted: false,
    });
    const { result } = await mountMutationHook(
      {
        postCompletion: (b) => {
          body = b;
          return { completion: na };
        },
      },
      { refetchReadiness, refetchConformStatus },
    );

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.markAsNA('item-1', '  not in scope  ');
    });

    expect(returned).toBe(true);
    expect(body).toMatchObject({
      itpInstanceId: 'instance-1',
      checklistItemId: 'item-1',
      status: 'not_applicable',
      notes: 'not in scope',
    });
    expect(result.current.itpInstance?.completions[0]).toEqual(na);
    expect(refetchReadiness).toHaveBeenCalledTimes(1);
    expect(refetchConformStatus).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Item marked as N/A' }));
  });

  it('markAsNA rejects a blank reason without posting', async () => {
    const { result } = await mountMutationHook({
      postCompletion: () => ({ completion: completionResponse() }),
    });

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.markAsNA('item-1', '   ');
    });

    expect(returned).toBe(false);
    expect(completionPostCount()).toBe(0);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reason required' }));
  });

  it('markAsFailed posts failed, refreshes lot + NCRs, toasts the NCR number, and returns true', async () => {
    const refreshLotAfterFailure = vi.fn(async () => {});
    const refreshNcrsAfterFailure = vi.fn(async () => {});
    let body: Record<string, unknown> | undefined;
    const failed = completionResponse({
      id: 'completion-1',
      checklistItemId: 'item-1',
      isFailed: true,
      isCompleted: false,
    });
    const { result } = await mountMutationHook(
      {
        postCompletion: (b) => {
          body = b;
          return { completion: failed, ncr: { ncrNumber: 'NCR-042' } };
        },
      },
      { refreshLotAfterFailure, refreshNcrsAfterFailure },
    );

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.markAsFailed({
        checklistItemId: 'item-1',
        description: 'cracking',
        category: 'workmanship',
        severity: 'major',
      });
    });

    expect(returned).toBe(true);
    expect(body).toMatchObject({
      itpInstanceId: 'instance-1',
      checklistItemId: 'item-1',
      status: 'failed',
      notes: 'Failed: cracking',
      ncrDescription: 'cracking',
      ncrCategory: 'workmanship',
      ncrSeverity: 'major',
    });
    expect(refreshLotAfterFailure).toHaveBeenCalledTimes(1);
    expect(refreshNcrsAfterFailure).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Item marked as Failed - NCR created',
        description: 'NCR NCR-042 has been raised for this item.',
      }),
    );
  });

  it('mobileMarkNA posts not_applicable with the default note, refreshes closeout state, toasts, and resolves true', async () => {
    const refetchReadiness = vi.fn();
    const refetchConformStatus = vi.fn();
    let body: Record<string, unknown> | undefined;
    const na = completionResponse({
      id: 'completion-1',
      checklistItemId: 'item-1',
      isNotApplicable: true,
    });
    const { result } = await mountMutationHook(
      {
        postCompletion: (b) => {
          body = b;
          return { completion: na };
        },
      },
      { refetchReadiness, refetchConformStatus },
    );

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.mobileMarkNA('item-1', '');
    });

    expect(returned).toBe(true);
    expect(body).toMatchObject({ status: 'not_applicable', notes: 'Marked as N/A' });
    expect(refetchReadiness).toHaveBeenCalledTimes(1);
    expect(refetchConformStatus).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Item marked as N/A' }));
  });

  it('mobileMarkNA resolves false when the write fails, so the sheet can stay open', async () => {
    const refetchReadiness = vi.fn();
    const refetchConformStatus = vi.fn();
    const { result } = await mountMutationHook(
      {
        postCompletion: () => {
          throw new Error('network down');
        },
      },
      { refetchReadiness, refetchConformStatus },
    );

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.mobileMarkNA('item-1', 'not on this lot');
    });

    expect(returned).toBe(false);
    expect(refetchReadiness).not.toHaveBeenCalled();
    expect(refetchConformStatus).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error' }));
  });

  it('mobileMarkFailed posts failed, refreshes closeout state and NCRs, and toasts without the NCR-created title', async () => {
    const refetchReadiness = vi.fn();
    const refetchConformStatus = vi.fn();
    const refreshLotAfterFailure = vi.fn(async () => {});
    const refreshNcrsAfterFailure = vi.fn(async () => {});
    let body: Record<string, unknown> | undefined;
    const failed = completionResponse({
      id: 'completion-1',
      checklistItemId: 'item-1',
      isFailed: true,
    });
    const { result } = await mountMutationHook(
      {
        postCompletion: (b) => {
          body = b;
          return { completion: failed, ncr: { ncrNumber: 'NCR-9' } };
        },
      },
      { refetchReadiness, refetchConformStatus, refreshLotAfterFailure, refreshNcrsAfterFailure },
    );

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.mobileMarkFailed('item-1', 'bad joint');
    });

    expect(returned).toBe(true);
    expect(body).toMatchObject({
      status: 'failed',
      notes: 'Failed: bad joint',
      ncrDescription: 'bad joint',
      ncrCategory: 'workmanship',
      ncrSeverity: 'minor',
    });
    expect(refetchReadiness).toHaveBeenCalledTimes(1);
    expect(refetchConformStatus).toHaveBeenCalledTimes(1);
    expect(refreshNcrsAfterFailure).toHaveBeenCalledTimes(1);
    expect(refreshLotAfterFailure).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Item marked as Failed' }));
  });

  it('mobileMarkFailed resolves false when the write fails, so the typed reason is not lost', async () => {
    const { result } = await mountMutationHook({
      postCompletion: () => {
        throw new Error('network down');
      },
    });

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.mobileMarkFailed('item-1', 'cracked culvert base');
    });

    expect(returned).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error' }));
  });

  it('completeWitnessPoint force-completes the toggle and toasts the recorded witness details', async () => {
    let body: Record<string, unknown> | undefined;
    const done = completionResponse({ id: 'completion-w', checklistItemId: 'item-w' });
    const { result } = await mountMutationHook({
      postCompletion: (b) => {
        body = b;
        return { completion: done };
      },
    });

    await act(async () => {
      await result.current.completeWitnessPoint({
        checklistItemId: 'item-w',
        existingNotes: null,
        witnessPresent: true,
        witnessName: 'Bob',
        witnessCompany: 'ClientCo',
      });
    });

    expect(body).toMatchObject({
      checklistItemId: 'item-w',
      isCompleted: true,
      witnessPresent: true,
      witnessName: 'Bob',
      witnessCompany: 'ClientCo',
    });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Witness point completed',
        description: 'Witness details recorded: Bob (ClientCo)',
      }),
    );
  });
});
