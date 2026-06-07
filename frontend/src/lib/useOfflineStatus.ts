import { useState, useEffect, useCallback } from 'react';
import {
  MAX_SYNC_ATTEMPTS,
  getFailedSyncCount,
  getLiveSyncCount,
  getPendingSyncItems,
  removeSyncQueueItem,
  markSyncItemError,
  getOfflinePhoto,
  markPhotoSynced,
  markPhotoSyncError,
  getOfflineLot,
  detectLotSyncConflict,
  markLotSynced,
  markLotSyncError,
  getConflictedLotsCount,
  resetFailedSyncItems,
} from './offlineDb';
import { apiUrl, authFetch } from './api';
import { devLog, devWarn } from './logger';
import { runExclusiveOfflineSync } from './offline/syncClient';
import { buildOfflineLotEditPayload } from './offline/syncPayloads';
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

          // Dispatch to the per-type executors that the worker now owns
          // (itp_completion, diary_*, docket_*, lot_conflict, unknown-type GC).
          // A 'synced' result feeds the tally; 'handled' means the worker fully
          // processed the item; 'deferred' means the item's branch still runs
          // inline below (photo_upload and, until Slice 3, lot_edit).
          const dispatch = await syncSingleItem(item);
          if (dispatch.status === 'synced') {
            syncedCount++;
          }
          if (dispatch.status !== 'deferred') {
            continue;
          }

          // Feature #311: Sync offline photos
          if (item.type === 'photo_upload' && item.id) {
            try {
              const { photoId } = item.data;
              const photo = await getOfflinePhoto(photoId);

              if (!photo) {
                // Photo was deleted, remove from queue
                await removeSyncQueueItem(item.id);
                continue;
              }

              // Convert base64 to blob for upload
              const response = await fetch(photo.dataUrl);
              const blob = await response.blob();

              // Create FormData for multipart upload
              const formData = new FormData();
              formData.append('file', blob, photo.fileName);
              formData.append('projectId', photo.projectId);
              if (photo.lotId) formData.append('lotId', photo.lotId);
              formData.append('documentType', photo.documentType);
              if (photo.category) formData.append('category', photo.category);
              formData.append('entityType', photo.entityType);
              if (photo.entityId) formData.append('entityId', photo.entityId);
              if (photo.caption) formData.append('caption', photo.caption);
              if (photo.tags) formData.append('tags', JSON.stringify(photo.tags));
              if (photo.gpsLatitude !== undefined) {
                formData.append('gpsLatitude', String(photo.gpsLatitude));
              }
              if (photo.gpsLongitude !== undefined) {
                formData.append('gpsLongitude', String(photo.gpsLongitude));
              }
              formData.append('capturedAt', photo.capturedAt);

              // Upload to server
              const uploadResponse = await authFetch(apiUrl('/api/documents/upload'), {
                method: 'POST',
                body: formData,
              });

              if (uploadResponse.ok) {
                const result = await uploadResponse.json();
                // Remove from sync queue
                await removeSyncQueueItem(item.id);
                // Mark photo as synced
                await markPhotoSynced(photoId, result.document?.id);
                syncedCount++;
              } else {
                const errorText = await uploadResponse.text();
                await markSyncItemError(item.id, errorText);
                await markPhotoSyncError(photoId);
              }
            } catch (error) {
              if (item.id) {
                await markSyncItemError(
                  item.id,
                  error instanceof Error ? error.message : 'Unknown error',
                );
              }
              if (item.data?.photoId) {
                await markPhotoSyncError(item.data.photoId);
              }
            }
          }

          // Feature #314: Sync offline lot edits with conflict detection
          if (item.type === 'lot_edit' && item.id) {
            try {
              const { lotId, forceOverwrite } = item.data;
              const lot = await getOfflineLot(lotId);

              if (!lot) {
                // Lot was deleted, remove from queue
                await removeSyncQueueItem(item.id);
                continue;
              }

              if (!forceOverwrite && lot.syncStatus === 'conflict') {
                devWarn('[Sync] Removing stale lot edit queue item for conflicted lot:', lotId);
                await removeSyncQueueItem(item.id);
                continue;
              }

              if (!forceOverwrite && lot.syncStatus === 'synced') {
                devLog('[Sync] Removing stale lot edit queue item for synced lot:', lotId);
                await removeSyncQueueItem(item.id);
                continue;
              }

              // First, fetch current server state to check for conflicts
              const serverCheckResponse = await authFetch(apiUrl(`/api/lots/${lotId}`), {
                method: 'GET',
              });

              if (!serverCheckResponse.ok) {
                const errorText = await serverCheckResponse.text();
                await markSyncItemError(item.id, errorText);
                await markLotSyncError(lotId);
                continue;
              }

              const serverLot = await serverCheckResponse.json();

              // Check for conflict (unless force overwrite is set)
              if (!forceOverwrite) {
                const conflictResult = await detectLotSyncConflict(lotId, {
                  updatedAt: serverLot.lot?.updatedAt || serverLot.updatedAt,
                  lotNumber: serverLot.lot?.lotNumber || serverLot.lotNumber,
                  description: serverLot.lot?.description || serverLot.description,
                  chainage: serverLot.lot?.chainage || serverLot.chainage,
                  chainageStart: serverLot.lot?.chainageStart || serverLot.chainageStart,
                  chainageEnd: serverLot.lot?.chainageEnd || serverLot.chainageEnd,
                  offset: serverLot.lot?.offset || serverLot.offset,
                  offsetLeft: serverLot.lot?.offsetLeft || serverLot.offsetLeft,
                  offsetRight: serverLot.lot?.offsetRight || serverLot.offsetRight,
                  layer: serverLot.lot?.layer || serverLot.layer,
                  areaZone: serverLot.lot?.areaZone || serverLot.areaZone,
                  activityType: serverLot.lot?.activityType || serverLot.activityType,
                  status: serverLot.lot?.status || serverLot.status,
                  // Server returns the budget under `budgetAmount`; map it to the
                  // internal `budget` field detectLotSyncConflict expects so the
                  // conflict snapshot shows the correct server-side budget.
                  budget: serverLot.lot?.budgetAmount ?? serverLot.budgetAmount,
                });

                if (conflictResult.hasConflict) {
                  // Conflict detected - notify and skip this sync item
                  devLog('[Sync] Conflict detected for lot:', lotId, lot.lotNumber);

                  // Call the conflict callback if provided
                  if (callbacks?.onConflictDetected) {
                    callbacks.onConflictDetected(
                      lotId,
                      lot.lotNumber,
                      `Sync conflict detected for lot ${lot.lotNumber}. Another user edited this lot while you were offline.`,
                    );
                  }

                  // Remove from sync queue - conflict is tracked separately
                  await removeSyncQueueItem(item.id);
                  continue;
                }
              }

              // No conflict (or force overwrite) - proceed with sync
              const syncResponse = await authFetch(apiUrl(`/api/lots/${lotId}`), {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(buildOfflineLotEditPayload(lot)),
              });

              if (syncResponse.ok) {
                const result = await syncResponse.json();
                // Remove from sync queue
                await removeSyncQueueItem(item.id);
                // Mark lot as synced with new server timestamp
                await markLotSynced(lotId, result.lot?.updatedAt || new Date().toISOString());
                devLog('[Sync] Lot synced successfully:', lotId);
                syncedCount++;
              } else {
                const errorText = await syncResponse.text();
                await markSyncItemError(item.id, errorText);
                await markLotSyncError(lotId);
              }
            } catch (error) {
              if (item.id) {
                await markSyncItemError(
                  item.id,
                  error instanceof Error ? error.message : 'Unknown error',
                );
              }
              if (item.data?.lotId) {
                await markLotSyncError(item.data.lotId);
              }
            }
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
