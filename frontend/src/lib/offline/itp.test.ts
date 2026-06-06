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
    },
  },
}));

import {
  cacheITPChecklist,
  getCachedITPChecklist,
  markCompletionSynced,
  offlineDb,
  updateChecklistItemOffline,
  type OfflineChecklistItem,
  type OfflineITPChecklist,
} from '@/lib/offlineDb';

const checklistItems: OfflineChecklistItem[] = [
  {
    id: 'item-1',
    name: 'Compaction',
    description: 'Check compaction',
    responsibleParty: 'contractor',
    isHoldPoint: false,
    status: 'pending',
  },
  {
    id: 'item-2',
    name: 'Level',
    description: 'Verify level',
    responsibleParty: 'superintendent',
    isHoldPoint: true,
    status: 'pending',
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

beforeEach(() => {
  vi.clearAllMocks();
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
});

describe('markCompletionSynced', () => {
  it('marks the lot-item completion row synced', async () => {
    await markCompletionSynced('lot-1', 'item-1');

    expect(offlineDb.itpCompletions.update).toHaveBeenCalledWith('lot-1-item-1', {
      syncStatus: 'synced',
    });
  });
});
