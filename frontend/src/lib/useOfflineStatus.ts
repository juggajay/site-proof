import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MAX_SYNC_ATTEMPTS,
  getPendingSyncItems,
  getConflictedLotsCount,
  resetFailedSyncItems,
  summariseSyncQueue,
} from './offlineDb';
import {
  LAST_SYNCED_AT_STORAGE_KEY,
  SYNC_KINDS,
  emptySyncKindCounts,
  type SyncKind,
} from './offline/syncKinds';
import { readLocalStorageItem, writeLocalStorageItem } from './storagePreferences';
import { devWarn } from './logger';
import { runExclusiveOfflineSync } from './offline/syncClient';
import { syncSingleItem } from './offline/syncWorker';

// Items older than this threshold are flagged as "stuck" in the indicator.
export const STUCK_SYNC_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
// Foreground flush interval: re-attempt sync every 60 s while pending items remain.
const FOREGROUND_FLUSH_INTERVAL_MS = 60_000;

// Type for sync notification callbacks
export interface SyncCompleteResult {
  syncedCount: number;
  failedCount: number;
}

export interface SyncCallbacks {
  onConflictDetected?: (lotId: string, lotNumber: string, message: string) => void;
  onSyncComplete?: (result: SyncCompleteResult) => void;
  enableSyncWorker?: boolean;
}

export function useOfflineStatus(callbacks?: SyncCallbacks) {
  const { enableSyncWorker = false } = callbacks ?? {};
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [failedSyncCount, setFailedSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [conflictCount, setConflictCount] = useState(0);
  const [oldestPendingItemAge, setOldestPendingItemAge] = useState<number | null>(null);
  const [pendingByKind, setPendingByKind] = useState<Record<SyncKind, number>>(emptySyncKindCounts);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() =>
    readLocalStorageItem(LAST_SYNCED_AT_STORAGE_KEY),
  );
  // Keep the previous object identity when the counts are unchanged, so the
  // 5 s poll does not force a re-render in all fifteen consumers every tick.
  const applyPendingByKind = useCallback((next: Record<SyncKind, number>) => {
    setPendingByKind((prev) =>
      SYNC_KINDS.every((kind) => prev[kind] === next[kind]) ? prev : next,
    );
  }, []);
  // Stable ref so foreground-flush effects can read latest isSyncing without
  // being listed as deps (which would restart the interval on every sync tick).
  const isSyncingRef = useRef(isSyncing);
  isSyncingRef.current = isSyncing;

  // Update online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update pending sync count and conflict count periodically. The badge counts
  // only items the worker will still attempt (live); items that have stopped
  // retrying are surfaced separately as "failed" so they are never hidden.
  useEffect(() => {
    const updateCounts = async () => {
      const [summary, conflicts] = await Promise.all([
        summariseSyncQueue(),
        getConflictedLotsCount(),
      ]);
      setPendingSyncCount(summary.live);
      setFailedSyncCount(summary.failed);
      setConflictCount(conflicts);
      setOldestPendingItemAge(summary.oldestPendingAgeMs);
      applyPendingByKind(summary.byKind);
      // Re-read the timestamp every tick, not just at mount: it is written by
      // whichever instance owns the sync worker, and this hook is per-instance
      // state, so localStorage plus this existing poll is the only channel
      // between instances. Worst-case staleness is one tick.
      setLastSyncedAt(readLocalStorageItem(LAST_SYNCED_AT_STORAGE_KEY));
    };

    updateCounts();
    const interval = setInterval(updateCounts, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [applyPendingByKind]);

  // Sync function
  const syncPendingChanges = useCallback(async () => {
    if (!enableSyncWorker || !isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      await runExclusiveOfflineSync(async () => {
        let syncedCount = 0;

        const items = await getPendingSyncItems();

        for (const item of items) {
          // Dead-letter: items that have failed too many times are KEPT (never
          // silently deleted) but skipped so they can't trigger an endless retry
          // loop. The user sees them as "failed" and can choose to retry.
          if (item.attempts >= MAX_SYNC_ATTEMPTS) {
            devWarn('[Sync] Skipping item after max attempts:', item.type, item.id);
            continue;
          }

          // Dispatch to the per-type executors that the worker owns. A 'synced'
          // result feeds the tally; 'handled' means the worker fully processed
          // the item (error-marked / removed / GC'd / deliberately not-synced).
          // The conflict callback is threaded through so the lot_edit executor
          // can surface a sync conflict to the UI.
          const dispatch = await syncSingleItem(item, callbacks);
          if (dispatch.status === 'synced') {
            syncedCount++;
          }
        }

        // Update counts after sync
        const [summary, conflicts] = await Promise.all([
          summariseSyncQueue(),
          getConflictedLotsCount(),
        ]);
        setPendingSyncCount(summary.live);
        setFailedSyncCount(summary.failed);
        setConflictCount(conflicts);
        setOldestPendingItemAge(summary.oldestPendingAgeMs);
        applyPendingByKind(summary.byKind);

        // Record the successful flush, then notify. The timestamp is guarded on
        // syncedCount ALONE — hanging it off the callback check would mean it
        // was only ever recorded when a caller happened to pass a handler, and
        // fourteen of the fifteen call sites pass none.
        if (syncedCount > 0) {
          writeLocalStorageItem(LAST_SYNCED_AT_STORAGE_KEY, new Date().toISOString());
          // The handler also receives the number of items that ended up
          // dead-lettered so the UI can suppress an "all synced" message while
          // failures remain.
          callbacks?.onSyncComplete?.({ syncedCount, failedCount: summary.failed });
        }
        return { syncedCount };
      });
    } finally {
      setIsSyncing(false);
    }
  }, [enableSyncWorker, isOnline, isSyncing, callbacks, applyPendingByKind]);

  // Retry items that previously stopped syncing. Resetting their attempt count
  // makes the worker pick them up again; we refresh the badges immediately and
  // kick off a sync pass.
  const retryFailedSyncs = useCallback(async () => {
    const revived = await resetFailedSyncItems();
    if (revived > 0) {
      // One summary read, so the kind rows move with the totals instead of
      // staying stale until the next poll tick.
      const summary = await summariseSyncQueue();
      setPendingSyncCount(summary.live);
      setFailedSyncCount(summary.failed);
      applyPendingByKind(summary.byKind);
    }
    await syncPendingChanges();
  }, [syncPendingChanges, applyPendingByKind]);

  // Auto-sync when coming back online (with debounce to prevent rapid re-triggering).
  // pendingSyncCount excludes dead-lettered items, so failed items never retrigger
  // this effect in a loop.
  useEffect(() => {
    if (enableSyncWorker && isOnline && pendingSyncCount > 0 && !isSyncing) {
      const timeout = setTimeout(() => {
        syncPendingChanges();
      }, 1000); // Wait 1 second before auto-syncing
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableSyncWorker, isOnline, pendingSyncCount, isSyncing]); // Don't include syncPendingChanges to prevent loops

  // Flush on app start (once, when the worker is enabled and we are online).
  // This catches items that were queued during a previous session.
  useEffect(() => {
    if (enableSyncWorker && navigator.onLine) {
      syncPendingChanges();
    }
    // Run only once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableSyncWorker]);

  // Flush when the document becomes visible (tab/app foregrounded on mobile).
  // iOS never delivers a Background Sync event; visibilitychange is the only
  // reliable foreground signal.
  useEffect(() => {
    if (!enableSyncWorker) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && !isSyncingRef.current) {
        syncPendingChanges();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    // syncPendingChanges is intentionally omitted to avoid restarting the
    // listener on every render; isSyncingRef provides a stable read of its value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableSyncWorker]);

  // Foreground interval: flush every 60 s while there are pending items.
  // The interval is cleared as soon as the queue empties so it doesn't spin
  // indefinitely. It uses isSyncingRef to read the latest value without
  // restarting the interval on every sync tick.
  useEffect(() => {
    if (!enableSyncWorker || pendingSyncCount === 0) return;

    const id = setInterval(() => {
      if (navigator.onLine && !isSyncingRef.current) {
        syncPendingChanges();
      }
    }, FOREGROUND_FLUSH_INTERVAL_MS);

    return () => clearInterval(id);
    // syncPendingChanges omitted deliberately — see interval above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableSyncWorker, pendingSyncCount]);

  return {
    isOnline,
    pendingSyncCount,
    failedSyncCount,
    isSyncing,
    syncPendingChanges,
    retryFailedSyncs,
    conflictCount,
    oldestPendingItemAge,
    pendingByKind,
    lastSyncedAt,
  };
}
