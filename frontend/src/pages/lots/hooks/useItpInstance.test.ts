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
}));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/logger', () => ({ devLog: vi.fn(), devWarn: vi.fn(), logError: vi.fn() }));

import { apiFetch, ApiError } from '@/lib/api';
import { cacheITPChecklist, getCachedITPChecklist, getPendingSyncCount } from '@/lib/offlineDb';
import { toast } from '@/components/ui/toaster';
import { useItpInstance } from './useItpInstance';
import type { ITPInstance, ITPTemplate, LotTab } from '../types';
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
};

// Route apiFetch by URL + method so a single render can satisfy the mount fetch
// and any follow-on call (templates / POST instance).
interface ApiHandlers {
  getInstance?: () => unknown;
  getTemplates?: () => unknown;
  postInstance?: () => unknown;
}
function routeApiFetch(handlers: ApiHandlers) {
  vi.mocked(apiFetch).mockImplementation(
    async (url: string, options?: { method?: string }): Promise<unknown> => {
      const method = options?.method ?? 'GET';
      if (url.includes('/api/itp/instances/lot/')) {
        return handlers.getInstance ? handlers.getInstance() : { instance: null };
      }
      if (url.includes('/api/itp/templates')) {
        return handlers.getTemplates ? handlers.getTemplates() : { templates: [] };
      }
      if (url.includes('/api/itp/instances') && method === 'POST') {
        return handlers.postInstance ? handlers.postInstance() : { instance: null };
      }
      throw new Error(`Unexpected apiFetch URL: ${url}`);
    },
  );
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
    expect(result.current.itpInstance).toBeNull();
    expect(result.current.itpLoadError).toBeNull();
    expect(cacheITPChecklist).not.toHaveBeenCalled();
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
});
