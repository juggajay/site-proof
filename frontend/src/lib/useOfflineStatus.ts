import { useState, useEffect, useCallback } from 'react';
import {
  MAX_SYNC_ATTEMPTS,
  getFailedSyncCount,
  getLiveSyncCount,
  getPendingSyncItems,
  getConflictedLotsCount,
  resetFailedSyncItems,
} from './offlineDb';
import { devWarn } from './logger';
import { runExclusiveOfflineSync } from './offline/syncClient';
import { syncSingleItem } from './offline/syncWorker';

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
      const [liveCount, failedCount, conflicts] = await Promise.all([
        getLiveSyncCount(),
        getFailedSyncCount(),
        getConflictedLotsCount(),
      ]);
      setPendingSyncCount(liveCount);
      setFailedSyncCount(failedCount);
      setConflictCount(conflicts);
    };

    updateCounts();
    const interval = setInterval(updateCounts, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

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
        const [liveCount, failedCount, conflicts] = await Promise.all([
          getLiveSyncCount(),
          getFailedSyncCount(),
          getConflictedLotsCount(),
        ]);
        setPendingSyncCount(liveCount);
        setFailedSyncCount(failedCount);
        setConflictCount(conflicts);

        // Notify of sync completion if any items were synced. The handler also
        // receives the number of items that ended up dead-lettered so the UI can
        // suppress an "all synced" message while failures remain.
        if (syncedCount > 0 && callbacks?.onSyncComplete) {
          callbacks.onSyncComplete({ syncedCount, failedCount });
        }
        return { syncedCount };
      });
    } finally {
      setIsSyncing(false);
    }
  }, [enableSyncWorker, isOnline, isSyncing, callbacks]);

  // Retry items that previously stopped syncing. Resetting their attempt count
  // makes the worker pick them up again; we refresh the badges immediately and
  // kick off a sync pass.
  const retryFailedSyncs = useCallback(async () => {
    const revived = await resetFailedSyncItems();
    if (revived > 0) {
      const [liveCount, failedCount] = await Promise.all([
        getLiveSyncCount(),
        getFailedSyncCount(),
      ]);
      setPendingSyncCount(liveCount);
      setFailedSyncCount(failedCount);
    }
    await syncPendingChanges();
  }, [syncPendingChanges]);

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

  return {
    isOnline,
    pendingSyncCount,
    failedSyncCount,
    isSyncing,
    syncPendingChanges,
    retryFailedSyncs,
    conflictCount,
  };
}
