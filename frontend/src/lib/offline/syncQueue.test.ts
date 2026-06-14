// DB-free behavior characterization for generic offline sync helpers. The
// Dexie singleton is replaced with a focused module mock; functions are
// imported through '@/lib/offlineDb' to pin the public re-export surface.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./core', () => ({
  offlineDb: {
    itpChecklists: { clear: vi.fn() },
    itpCompletions: { clear: vi.fn() },
    photos: { clear: vi.fn() },
    diaries: { clear: vi.fn() },
    dockets: { clear: vi.fn() },
    lots: { clear: vi.fn() },
    diaryDeliveries: { clear: vi.fn() },
    diaryEvents: { clear: vi.fn() },
    syncQueue: {
      toArray: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      clear: vi.fn(),
    },
  },
}));

import {
  MAX_SYNC_ATTEMPTS,
  clearAllOfflineData,
  getFailedSyncCount,
  getLiveSyncCount,
  getOldestPendingItemAge,
  getPendingSyncCount,
  getPendingSyncItems,
  markSyncItemTerminalError,
  markSyncItemError,
  offlineDb,
  removeSyncQueueItem,
  resetFailedSyncItems,
  type SyncQueueItem,
} from '@/lib/offlineDb';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sync queue queries', () => {
  it('returns queued sync items', async () => {
    const items = [{ id: 1, type: 'photo_upload', attempts: 0 } as SyncQueueItem];
    vi.mocked(offlineDb.syncQueue.toArray).mockResolvedValue(items);

    await expect(getPendingSyncItems()).resolves.toBe(items);
    expect(offlineDb.syncQueue.toArray).toHaveBeenCalledTimes(1);
  });

  it('returns the queue count (including dead-lettered items)', async () => {
    vi.mocked(offlineDb.syncQueue.count).mockResolvedValue(3);

    await expect(getPendingSyncCount()).resolves.toBe(3);
    expect(offlineDb.syncQueue.count).toHaveBeenCalledTimes(1);
  });
});

describe('live vs failed split', () => {
  const item = (id: number, attempts: number): SyncQueueItem =>
    ({ id, type: 'photo_upload', attempts }) as SyncQueueItem;

  it('counts only items below the dead-letter threshold as live', async () => {
    vi.mocked(offlineDb.syncQueue.toArray).mockResolvedValue([
      item(1, 0),
      item(2, MAX_SYNC_ATTEMPTS - 1),
      item(3, MAX_SYNC_ATTEMPTS),
      item(4, MAX_SYNC_ATTEMPTS + 2),
    ]);

    await expect(getLiveSyncCount()).resolves.toBe(2);
  });

  it('counts only items at or beyond the dead-letter threshold as failed', async () => {
    vi.mocked(offlineDb.syncQueue.toArray).mockResolvedValue([
      item(1, 0),
      item(2, MAX_SYNC_ATTEMPTS - 1),
      item(3, MAX_SYNC_ATTEMPTS),
      item(4, MAX_SYNC_ATTEMPTS + 2),
    ]);

    await expect(getFailedSyncCount()).resolves.toBe(2);
  });
});

describe('resetFailedSyncItems', () => {
  const item = (id: number | undefined, attempts: number): SyncQueueItem =>
    ({ id, type: 'photo_upload', attempts }) as SyncQueueItem;

  it('resets attempts to zero only for dead-lettered items and reports how many were revived', async () => {
    vi.mocked(offlineDb.syncQueue.toArray).mockResolvedValue([
      item(1, 0),
      item(2, MAX_SYNC_ATTEMPTS),
      item(3, MAX_SYNC_ATTEMPTS + 1),
    ]);

    await expect(resetFailedSyncItems()).resolves.toBe(2);

    expect(offlineDb.syncQueue.update).toHaveBeenCalledTimes(2);
    expect(offlineDb.syncQueue.update).toHaveBeenCalledWith(2, { attempts: 0 });
    expect(offlineDb.syncQueue.update).toHaveBeenCalledWith(3, { attempts: 0 });
    // The live item is left untouched.
    expect(offlineDb.syncQueue.update).not.toHaveBeenCalledWith(1, { attempts: 0 });
  });

  it('skips dead items without a persisted id and never deletes anything', async () => {
    vi.mocked(offlineDb.syncQueue.toArray).mockResolvedValue([item(undefined, MAX_SYNC_ATTEMPTS)]);

    await expect(resetFailedSyncItems()).resolves.toBe(0);

    expect(offlineDb.syncQueue.update).not.toHaveBeenCalled();
    expect(offlineDb.syncQueue.delete).not.toHaveBeenCalled();
  });
});

describe('sync queue mutations', () => {
  it('removes a queue item by id', async () => {
    await removeSyncQueueItem(9);
    expect(offlineDb.syncQueue.delete).toHaveBeenCalledWith(9);
  });

  it('increments attempts and stores the last error when the item exists', async () => {
    vi.mocked(offlineDb.syncQueue.get).mockResolvedValue({
      id: 2,
      type: 'photo_upload',
      attempts: 4,
    } as SyncQueueItem);

    await markSyncItemError(2, 'Upload failed');

    expect(offlineDb.syncQueue.update).toHaveBeenCalledWith(2, {
      attempts: 5,
      lastError: 'Upload failed',
    });
  });

  it('does not update when the queue item is already gone', async () => {
    vi.mocked(offlineDb.syncQueue.get).mockResolvedValue(undefined);

    await markSyncItemError(2, 'Upload failed');

    expect(offlineDb.syncQueue.update).not.toHaveBeenCalled();
  });

  it('dead-letters terminal server rejections immediately', async () => {
    vi.mocked(offlineDb.syncQueue.get).mockResolvedValue({
      id: 2,
      type: 'itp_completion',
      attempts: 0,
    } as SyncQueueItem);

    await markSyncItemTerminalError(2, 'Validation failed');

    expect(offlineDb.syncQueue.update).toHaveBeenCalledWith(2, {
      attempts: MAX_SYNC_ATTEMPTS,
      lastError: 'Validation failed',
    });
  });
});

describe('getOldestPendingItemAge', () => {
  const item = (id: number, createdAt: string): SyncQueueItem =>
    ({ id, type: 'photo_upload', attempts: 0, createdAt }) as SyncQueueItem;

  it('returns null when the queue is empty', async () => {
    vi.mocked(offlineDb.syncQueue.toArray).mockResolvedValue([]);
    await expect(getOldestPendingItemAge()).resolves.toBeNull();
  });

  it('returns the age of the single item when there is only one', async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    vi.mocked(offlineDb.syncQueue.toArray).mockResolvedValue([item(1, fiveMinutesAgo)]);
    const age = await getOldestPendingItemAge();
    expect(age).toBeGreaterThanOrEqual(5 * 60 * 1000 - 100);
    expect(age).toBeLessThanOrEqual(5 * 60 * 1000 + 1000);
  });

  it('returns the age of the oldest item when there are multiple', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    vi.mocked(offlineDb.syncQueue.toArray).mockResolvedValue([
      item(1, twoMinutesAgo),
      item(2, tenMinutesAgo),
    ]);
    const age = await getOldestPendingItemAge();
    // Should be ~10 min, not ~2 min
    expect(age).toBeGreaterThanOrEqual(10 * 60 * 1000 - 100);
    expect(age).toBeLessThanOrEqual(10 * 60 * 1000 + 1000);
  });
});

describe('clearAllOfflineData', () => {
  it('clears every offline table in the same order as the original helper', async () => {
    await clearAllOfflineData();

    expect(offlineDb.itpChecklists.clear).toHaveBeenCalledTimes(1);
    expect(offlineDb.itpCompletions.clear).toHaveBeenCalledTimes(1);
    expect(offlineDb.syncQueue.clear).toHaveBeenCalledTimes(1);
    expect(offlineDb.photos.clear).toHaveBeenCalledTimes(1);
    expect(offlineDb.diaries.clear).toHaveBeenCalledTimes(1);
    expect(offlineDb.dockets.clear).toHaveBeenCalledTimes(1);
    expect(offlineDb.lots.clear).toHaveBeenCalledTimes(1);
    expect(offlineDb.diaryDeliveries.clear).toHaveBeenCalledTimes(1);
    expect(offlineDb.diaryEvents.clear).toHaveBeenCalledTimes(1);
  });
});
