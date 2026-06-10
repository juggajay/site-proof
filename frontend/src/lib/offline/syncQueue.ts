// Generic offline sync queue and maintenance helpers, moved from ../offlineDb.ts
// so the public facade can stay thin while '@/lib/offlineDb' remains the import
// path for callers.

import { offlineDb, type SyncQueueItem } from './core';

// A queue item that has failed this many times is "dead-lettered": the sync
// worker stops retrying it (so it can't trigger an endless retry storm) but it
// is NEVER deleted. The user keeps their data and can manually retry. Using the
// existing `attempts` count as the dead-letter predicate avoids a Dexie schema
// change (no new field, no version bump).
export const MAX_SYNC_ATTEMPTS = 5;

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return offlineDb.syncQueue.toArray();
}

// Count of every queued item, including dead-lettered ones. This is the
// "do I have any unsynced work?" signal used by the lot/ITP/foreman screens,
// so it must include items that have stopped retrying — they are still data
// that has not reached the server.
export async function getPendingSyncCount(): Promise<number> {
  return offlineDb.syncQueue.count();
}

// Count of items the worker will still try to sync (attempts below the
// dead-letter threshold). Drives the "N pending changes" badge.
export async function getLiveSyncCount(): Promise<number> {
  const items = await offlineDb.syncQueue.toArray();
  return items.filter((item) => item.attempts < MAX_SYNC_ATTEMPTS).length;
}

// Count of dead-lettered items (the server rejected them too many times).
// Drives the distinct "N items failed to sync" indicator.
export async function getFailedSyncCount(): Promise<number> {
  const items = await offlineDb.syncQueue.toArray();
  return items.filter((item) => item.attempts >= MAX_SYNC_ATTEMPTS).length;
}

// Reset dead-lettered items so the worker will attempt them again. Used by the
// "Retry" action on the failed indicator. Returns how many items were revived.
export async function resetFailedSyncItems(): Promise<number> {
  const items = await offlineDb.syncQueue.toArray();
  const failed = items.filter(
    (item): item is SyncQueueItem & { id: number } =>
      typeof item.id === 'number' && item.attempts >= MAX_SYNC_ATTEMPTS,
  );

  for (const item of failed) {
    await offlineDb.syncQueue.update(item.id, { attempts: 0 });
  }

  return failed.length;
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

// Age in milliseconds of the oldest item still pending in the sync queue.
// Returns null when the queue is empty (no age to report).
// Uses the ISO `createdAt` string already present on every SyncQueueBase row.
export async function getOldestPendingItemAge(): Promise<number | null> {
  const items = await offlineDb.syncQueue.toArray();
  if (items.length === 0) {
    return null;
  }

  const oldestMs = Math.min(...items.map((item) => new Date(item.createdAt).getTime()));
  return Date.now() - oldestMs;
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
