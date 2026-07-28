// Generic offline sync queue and maintenance helpers, moved from ../offlineDb.ts
// so the public facade can stay thin while '@/lib/offlineDb' remains the import
// path for callers.

import { offlineDb, type SyncQueueItem } from './core';
import { MAX_SYNC_ATTEMPTS, summariseSyncQueueItems, type SyncQueueSummary } from './syncKinds';

// The dead-letter threshold lives in ./syncKinds (pure, Dexie-free) and is
// re-exported here so '@/lib/offlineDb' stays its import path for callers.
export { MAX_SYNC_ATTEMPTS };

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

// Everything the sync UI needs about the queue, from ONE table read: the live
// count ("N pending changes"), the dead-lettered count ("N failed to sync"),
// the oldest item's age (the "stuck" signal) and the per-kind breakdown. This
// replaces three separate full scans that used to run in parallel every 5 s in
// every mounted consumer of useOfflineStatus.
export async function summariseSyncQueue(): Promise<SyncQueueSummary> {
  const items = await offlineDb.syncQueue.toArray();
  return summariseSyncQueueItems(items, Date.now());
}

// Reset dead-lettered items so the worker will attempt them again. Used by the
// "Retry" action on the failed indicator. Returns how many items were revived.
//
// Review L9: a row the server TERMINALLY rejected is skipped. #1686 gave every
// queue kind one 4xx classifier (`syncWorker.isTerminalSyncRejection` — a 4xx
// other than 408/429 will never succeed on replay: bad body, deleted anchor, no
// permission, stale base) and `markSyncItemTerminalError` records its verdict on
// the row. Reviving those meant the always-visible Retry button re-POSTed writes
// the server has permanently refused, each one re-failing and re-dead-lettering,
// with the foreman given no way to tell the two cases apart. Only rows that ran
// out of attempts against a network/5xx failure are genuinely retryable.
export async function resetFailedSyncItems(): Promise<number> {
  const items = await offlineDb.syncQueue.toArray();
  const failed = items.filter(
    (item): item is SyncQueueItem & { id: number } =>
      typeof item.id === 'number' && item.attempts >= MAX_SYNC_ATTEMPTS && !item.terminal,
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

export async function markSyncItemTerminalError(id: number, error: string): Promise<void> {
  const item = await offlineDb.syncQueue.get(id);
  if (item) {
    await offlineDb.syncQueue.update(id, {
      attempts: MAX_SYNC_ATTEMPTS,
      lastError: error,
      // L9: `attempts` alone cannot distinguish "the server said no" from "the
      // network was down five times", and Retry needs to. Set HERE rather than
      // recomputed at retry time so the classification is #1686's, made once,
      // with the status in hand.
      terminal: true,
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
