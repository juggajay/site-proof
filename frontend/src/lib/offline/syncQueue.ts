// Generic offline sync queue and maintenance helpers, moved from ../offlineDb.ts
// so the public facade can stay thin while '@/lib/offlineDb' remains the import
// path for callers.

import { offlineDb, type SyncQueueItem } from './core';

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return offlineDb.syncQueue.toArray();
}

export async function getPendingSyncCount(): Promise<number> {
  return offlineDb.syncQueue.count();
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  await offlineDb.syncQueue.delete(id);
}

export async function markSyncItemError(id: number, error: string): Promise<void> {
  const item = await offlineDb.syncQueue.get(id);
  if (item) {
    await offlineDb.syncQueue.update(id, {
      attempts: item.attempts + 1,
      lastError: error,
    });
  }
}

export async function clearAllOfflineData(): Promise<void> {
  await offlineDb.itpChecklists.clear();
  await offlineDb.itpCompletions.clear();
  await offlineDb.syncQueue.clear();
  await offlineDb.photos.clear();
  await offlineDb.diaries.clear();
  await offlineDb.dockets.clear();
  await offlineDb.lots.clear();
  await offlineDb.diaryDeliveries.clear();
  await offlineDb.diaryEvents.clear();
}
