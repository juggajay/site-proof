// DB-free characterization for offline NCR creation. The Dexie singleton is
// mocked; the function is imported through '@/lib/offlineDb' to pin the public
// re-export surface.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./core', () => ({
  offlineDb: {
    syncQueue: { add: vi.fn() },
  },
}));

import { offlineDb, queueOfflineNcrCreate } from '@/lib/offlineDb';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('queueOfflineNcrCreate', () => {
  it('enqueues an ncr_create item carrying the full body and returns its local id', async () => {
    const { ncrId } = await queueOfflineNcrCreate({
      projectId: 'proj-1',
      description: 'Cracked kerb',
      category: 'general',
      lotIds: ['lot-1'],
    });

    expect(ncrId).toMatch(/^offline-ncr-/);
    expect(offlineDb.syncQueue.add).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ncr_create',
        action: 'create',
        attempts: 0,
        data: {
          ncrId,
          projectId: 'proj-1',
          description: 'Cracked kerb',
          category: 'general',
          lotIds: ['lot-1'],
        },
      }),
    );
  });

  it('omits lotIds when no lot is linked', async () => {
    await queueOfflineNcrCreate({
      projectId: 'proj-1',
      description: 'Defect captured on site - details pending',
      category: 'general',
    });

    const queued = vi.mocked(offlineDb.syncQueue.add).mock.calls[0][0];
    expect((queued.data as { lotIds?: string[] }).lotIds).toBeUndefined();
  });
});
