// DB-free behavior characterization for the offlineDb facade helpers that span
// multiple tables. The Dexie singleton (./offline/core) is replaced with a
// focused module mock so no IndexedDB is needed; the functions under test run
// their real bodies. The sync-queue helpers offlineDb.ts re-exports run against
// the same mock, so getUnsyncedWorkCount exercises the real composition.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { lotsCount } = vi.hoisted(() => ({ lotsCount: vi.fn() }));

vi.mock('./offline/core', () => ({
  offlineDb: {
    syncQueue: {
      count: vi.fn(),
      toArray: vi.fn(),
    },
    lots: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({ count: lotsCount, toArray: vi.fn() })),
      })),
    },
  },
}));

import { getUnsyncedWorkCount, offlineDb } from '@/lib/offlineDb';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getUnsyncedWorkCount', () => {
  it('sums queued items and unresolved lot conflicts', async () => {
    vi.mocked(offlineDb.syncQueue.count).mockResolvedValue(4);
    lotsCount.mockResolvedValue(2);

    await expect(getUnsyncedWorkCount()).resolves.toBe(6);
  });

  it('returns zero when nothing is queued and there are no conflicts', async () => {
    vi.mocked(offlineDb.syncQueue.count).mockResolvedValue(0);
    lotsCount.mockResolvedValue(0);

    await expect(getUnsyncedWorkCount()).resolves.toBe(0);
  });
});
