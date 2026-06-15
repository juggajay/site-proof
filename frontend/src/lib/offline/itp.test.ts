// DB-free behavior characterization for offline ITP checklist/completion
// helpers. The Dexie singleton is mocked, while functions are imported through
// '@/lib/offlineDb' to pin the public re-export surface.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./core', () => ({
  offlineDb: {
    itpChecklists: {
      put: vi.fn(),
      update: vi.fn(),
      where: vi.fn(),
    },
    itpCompletions: {
      put: vi.fn(),
      update: vi.fn(),
    },
    syncQueue: {
      add: vi.fn(),
      update: vi.fn(),
      where: vi.fn(),
    },
  },
}));

import {
  cacheITPChecklist,
  getCachedITPChecklist,
  markCompletionSynced,
  offlineDb,
  recordSyncedChecklistItem,
  reconcileItpCompletionFromServer,
  updateChecklistItemOffline,
  type OfflineChecklistItem,
  type OfflineITPChecklist,
  type SyncQueueItem,
} from '@/lib/offlineDb';

const checklistItems: OfflineChecklistItem[] = [
  {
    id: 'item-1',
    name: 'Compaction',
    description: 'Check compaction',
    responsibleParty: 'contractor',
    isHoldPoint: false,
    status: 'pending',
    serverCompletionBase: { exists: false },
  },
  {
    id: 'item-2',
    name: 'Level',
    description: 'Verify level',
    responsibleParty: 'superintendent',
    isHoldPoint: true,
    status: 'pending',
    serverCompletionBase: { exists: false },
  },
];

function mockChecklistLookup(checklist?: OfflineITPChecklist) {
  const first = vi.fn().mockResolvedValue(checklist);
  const equals = vi.fn().mockReturnValue({ first });
  vi.mocked(offlineDb.itpChecklists.where).mockReturnValue({
    equals,
  } as unknown as ReturnType<typeof offlineDb.itpChecklists.where>);
  return { equals, first };
}

// Simulates the syncQueue where('type').equals(type).filter(fn).first() chain
// against an in-memory queue, so the dedupe predicate is genuinely exercised.
function mockSyncQueueLookup(queued: SyncQueueItem[]) {
  const equals = vi.fn((type: string) => ({
    filter: (predicate: (item: SyncQueueItem) => boolean) => ({
      first: async () => queued.filter((item) => item.type === type).find(predicate),
    }),
  }));
  vi.mocked(offlineDb.syncQueue.where).mockReturnValue({
    equals,
  } as unknown as ReturnType<typeof offlineDb.syncQueue.where>);
  return { equals };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSyncQueueLookup([]);
});

describe('cacheITPChecklist', () => {
  it('stores a checklist under the lot-template id', async () => {
    await cacheITPChecklist('lot-1', 'template-1', 'Earthworks ITP', checklistItems);

    expect(offlineDb.itpChecklists.put).toHaveBeenCalledWith({
      id: 'lot-1-template-1',
      lotId: 'lot-1',
      templateId: 'template-1',
      templateName: 'Earthworks ITP',
      items: checklistItems,
      cachedAt: expect.any(String),
    });
  });
});

describe('getCachedITPChecklist', () => {
  it('queries the lotId index and returns the first cached checklist', async () => {
    const checklist = {
      id: 'lot-1-template-1',
      lotId: 'lot-1',
      templateId: 'template-1',
      templateName: 'Earthworks ITP',
      items: checklistItems,
      cachedAt: '2026-06-06T00:00:00.000Z',
    } satisfies OfflineITPChecklist;
    const { equals } = mockChecklistLookup(checklist);

    await expect(getCachedITPChecklist('lot-1')).resolves.toBe(checklist);
    expect(offlineDb.itpChecklists.where).toHaveBeenCalledWith('lotId');
    expect(equals).toHaveBeenCalledWith('lot-1');
  });
});

describe('updateChecklistItemOffline', () => {
  it('stores a pending completion, queues sync, and patches the cached checklist item', async () => {
    mockChecklistLookup({
      id: 'lot-1-template-1',
      lotId: 'lot-1',
      templateId: 'template-1',
      templateName: 'Earthworks ITP',
      items: checklistItems,
      cachedAt: '2026-06-06T00:00:00.000Z',
    });

    await updateChecklistItemOffline(
      'lot-1',
      'item-1',
      'completed',
      'Passed in field',
      'Foreman QA',
    );

    expect(offlineDb.itpCompletions.put).toHaveBeenCalledWith({
      id: 'lot-1-item-1',
      lotId: 'lot-1',
      checklistItemId: 'item-1',
      status: 'completed',
      notes: 'Passed in field',
      completedAt: expect.any(String),
      completedBy: 'Foreman QA',
      syncStatus: 'pending',
      localUpdatedAt: expect.any(String),
      serverCompletionBase: { exists: false },
    });
    expect(offlineDb.syncQueue.add).toHaveBeenCalledWith({
      type: 'itp_completion',
      action: 'update',
      data: expect.objectContaining({
        id: 'lot-1-item-1',
        status: 'completed',
      }),
      createdAt: expect.any(String),
      attempts: 0,
    });
    expect(offlineDb.itpChecklists.update).toHaveBeenCalledWith('lot-1-template-1', {
      items: [
        expect.objectContaining({
          id: 'item-1',
          status: 'completed',
          notes: 'Passed in field',
          completedAt: expect.any(String),
          completedBy: 'Foreman QA',
        }),
        checklistItems[1],
      ],
      cachedAt: expect.any(String),
    });
  });

  it('queues the server completion base from the cached item so stale offline sync can be rejected', async () => {
    const serverCompletionBase = {
      exists: true,
      id: 'completion-1',
      status: 'pending' as const,
      notes: 'Server baseline note',
      completedAt: null,
    };
    mockChecklistLookup({
      id: 'lot-1-template-1',
      lotId: 'lot-1',
      templateId: 'template-1',
      templateName: 'Earthworks ITP',
      items: [
        {
          ...checklistItems[0],
          notes: 'Server baseline note',
          serverCompletionBase,
        },
        checklistItems[1],
      ],
      cachedAt: '2026-06-06T00:00:00.000Z',
    });

    await updateChecklistItemOffline('lot-1', 'item-1', 'completed', 'Offline pass');

    expect(offlineDb.syncQueue.add).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'completed',
          notes: 'Offline pass',
          serverCompletionBase,
        }),
      }),
    );
  });

  it('does not patch a cached checklist when no cache exists', async () => {
    mockChecklistLookup(undefined);

    await updateChecklistItemOffline('lot-1', 'item-1', 'failed');

    expect(offlineDb.itpCompletions.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'lot-1-item-1',
        status: 'failed',
        completedAt: undefined,
      }),
    );
    expect(offlineDb.itpChecklists.update).not.toHaveBeenCalled();
  });

  it('replaces a still-queued entry for the same item instead of appending (last-write-wins)', async () => {
    mockChecklistLookup(undefined);
    mockSyncQueueLookup([
      {
        id: 7,
        type: 'itp_completion',
        action: 'update',
        data: {
          id: 'lot-1-item-1',
          lotId: 'lot-1',
          checklistItemId: 'item-1',
          status: 'completed',
          syncStatus: 'pending',
          localUpdatedAt: '2026-06-09T00:00:00.000Z',
          serverCompletionBase: {
            exists: true,
            id: 'completion-1',
            status: 'pending',
            notes: null,
            completedAt: null,
          },
        },
        createdAt: '2026-06-09T00:00:00.000Z',
        attempts: 3,
        lastError: 'Request timed out after 30000ms',
      },
    ]);

    await updateChecklistItemOffline('lot-1', 'item-1', 'pending', 'unticked again');

    expect(offlineDb.syncQueue.add).not.toHaveBeenCalled();
    expect(offlineDb.syncQueue.update).toHaveBeenCalledWith(7, {
      data: expect.objectContaining({
        id: 'lot-1-item-1',
        status: 'pending',
        notes: 'unticked again',
        serverCompletionBase: {
          exists: true,
          id: 'completion-1',
          status: 'pending',
          notes: null,
          completedAt: null,
        },
      }),
      createdAt: expect.any(String),
      attempts: 0,
      lastError: undefined,
    });
  });

  it('still appends when the only queued entries are for other items', async () => {
    mockChecklistLookup(undefined);
    mockSyncQueueLookup([
      {
        id: 8,
        type: 'itp_completion',
        action: 'update',
        data: {
          id: 'lot-1-item-2',
          lotId: 'lot-1',
          checklistItemId: 'item-2',
          status: 'completed',
          syncStatus: 'pending',
          localUpdatedAt: '2026-06-09T00:00:00.000Z',
        },
        createdAt: '2026-06-09T00:00:00.000Z',
        attempts: 0,
      },
    ]);

    await updateChecklistItemOffline('lot-1', 'item-1', 'completed');

    expect(offlineDb.syncQueue.update).not.toHaveBeenCalled();
    expect(offlineDb.syncQueue.add).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'itp_completion',
        data: expect.objectContaining({ id: 'lot-1-item-1' }),
      }),
    );
  });
});

describe('recordSyncedChecklistItem', () => {
  it('stores a synced completion and patches the cache without touching the sync queue', async () => {
    mockChecklistLookup({
      id: 'lot-1-template-1',
      lotId: 'lot-1',
      templateId: 'template-1',
      templateName: 'Earthworks ITP',
      items: checklistItems,
      cachedAt: '2026-06-06T00:00:00.000Z',
    });

    await recordSyncedChecklistItem('lot-1', 'item-1', 'completed', 'Passed', 'Current User');

    expect(offlineDb.itpCompletions.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'lot-1-item-1',
        status: 'completed',
        syncStatus: 'synced',
      }),
    );
    expect(offlineDb.syncQueue.add).not.toHaveBeenCalled();
    expect(offlineDb.syncQueue.update).not.toHaveBeenCalled();
    expect(offlineDb.syncQueue.where).not.toHaveBeenCalled();
    expect(offlineDb.itpChecklists.update).toHaveBeenCalledWith('lot-1-template-1', {
      items: [
        expect.objectContaining({
          id: 'item-1',
          status: 'completed',
          notes: 'Passed',
          completedBy: 'Current User',
        }),
        checklistItems[1],
      ],
      cachedAt: expect.any(String),
    });
  });
});

describe('reconcileItpCompletionFromServer', () => {
  it('stores the server failed state and patches the cached checklist after a rejected optimistic sync', async () => {
    mockChecklistLookup({
      id: 'lot-1-template-1',
      lotId: 'lot-1',
      templateId: 'template-1',
      templateName: 'Earthworks ITP',
      items: [
        {
          ...checklistItems[0],
          status: 'completed',
          notes: 'Local optimistic pass',
          completedAt: '2026-06-12T00:00:00.000Z',
          completedBy: 'Offline Foreman',
        },
        checklistItems[1],
      ],
      cachedAt: '2026-06-06T00:00:00.000Z',
    });

    await reconcileItpCompletionFromServer('lot-1', 'item-1', {
      checklistItemId: 'item-1',
      isFailed: true,
      notes: 'Server rejected after QA review',
      completedAt: '2026-06-13T01:02:03.000Z',
      completedBy: { fullName: 'QA Manager' },
    });

    expect(offlineDb.itpCompletions.put).toHaveBeenCalledWith({
      id: 'lot-1-item-1',
      lotId: 'lot-1',
      checklistItemId: 'item-1',
      status: 'failed',
      notes: 'Server rejected after QA review',
      completedAt: '2026-06-13T01:02:03.000Z',
      completedBy: 'QA Manager',
      syncStatus: 'synced',
      localUpdatedAt: expect.any(String),
      serverCompletionBase: {
        exists: true,
        status: 'failed',
        notes: 'Server rejected after QA review',
        completedAt: '2026-06-13T01:02:03.000Z',
      },
    });
    expect(offlineDb.itpChecklists.update).toHaveBeenCalledWith('lot-1-template-1', {
      items: [
        expect.objectContaining({
          id: 'item-1',
          status: 'failed',
          notes: 'Server rejected after QA review',
          completedAt: '2026-06-13T01:02:03.000Z',
          completedBy: 'QA Manager',
        }),
        checklistItems[1],
      ],
      cachedAt: expect.any(String),
    });
  });

  it('clears an optimistic local completion when the server has no completion row', async () => {
    mockChecklistLookup({
      id: 'lot-1-template-1',
      lotId: 'lot-1',
      templateId: 'template-1',
      templateName: 'Earthworks ITP',
      items: [
        {
          ...checklistItems[0],
          status: 'completed',
          notes: 'Local optimistic pass',
          completedAt: '2026-06-12T00:00:00.000Z',
          completedBy: 'Offline Foreman',
        },
        checklistItems[1],
      ],
      cachedAt: '2026-06-06T00:00:00.000Z',
    });

    await reconcileItpCompletionFromServer('lot-1', 'item-1');

    expect(offlineDb.itpCompletions.put).toHaveBeenCalledWith({
      id: 'lot-1-item-1',
      lotId: 'lot-1',
      checklistItemId: 'item-1',
      status: 'pending',
      notes: undefined,
      completedAt: undefined,
      completedBy: undefined,
      syncStatus: 'synced',
      localUpdatedAt: expect.any(String),
      serverCompletionBase: { exists: false },
    });
    expect(offlineDb.itpChecklists.update).toHaveBeenCalledWith('lot-1-template-1', {
      items: [
        expect.objectContaining({
          id: 'item-1',
          status: 'pending',
          notes: undefined,
          completedAt: undefined,
          completedBy: undefined,
        }),
        checklistItems[1],
      ],
      cachedAt: expect.any(String),
    });
  });

  it('falls back to raw server status when derived flags are absent', async () => {
    mockChecklistLookup(undefined);

    await reconcileItpCompletionFromServer('lot-1', 'item-1', {
      checklistItemId: 'item-1',
      status: 'not_applicable',
      notes: 'Server raw status',
    });

    expect(offlineDb.itpCompletions.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'lot-1-item-1',
        status: 'na',
        notes: 'Server raw status',
        syncStatus: 'synced',
      }),
    );
  });
});

describe('markCompletionSynced', () => {
  it('marks the lot-item completion row synced', async () => {
    await markCompletionSynced('lot-1', 'item-1');

    expect(offlineDb.itpCompletions.update).toHaveBeenCalledWith('lot-1-item-1', {
      syncStatus: 'synced',
    });
  });
});
