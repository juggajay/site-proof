import { offlineDb, type OfflineLotEditTable, type SyncQueueItem } from './offline/core';
import { getPendingSyncCount } from './offline/syncQueue';

export { compressImage, fileToDataUrl } from './offlinePhotoCompression';

// The database core (offline record/queue types, the Dexie schema versions,
// and the shared offlineDb singleton) lives in ./offline/core. Re-export it
// so the public '@/lib/offlineDb' import path is unchanged for callers.
export { offlineDb } from './offline/core';
export type {
  OfflineChecklistItem,
  OfflineDailyDiary,
  OfflineDiaryDelivery,
  OfflineDiaryEvent,
  OfflineDocket,
  OfflineITPChecklist,
  OfflineITPCompletion,
  OfflinePhoto,
  ItpCompletionServerBase,
  SyncQueueItem,
} from './offline/core';

// The offline photo behavior (capture, queries, sync-status markers) lives in
// ./offline/photos. Re-exported for the same reason: callers keep importing
// from '@/lib/offlineDb'.
export {
  capturePhotoOffline,
  deleteOfflinePhoto,
  getOfflinePhoto,
  getOfflinePhotosForEntity,
  getOfflinePhotosForLot,
  getPendingPhotos,
  getPendingPhotosCount,
  getUnsyncedPhotos,
  markPhotoSynced,
  markPhotoUploadedAwaitingAttach,
  markPhotoSyncError,
  updateOfflinePhotoMeta,
} from './offline/photos';

// The offline daily diary persistence (save/submit drafts, queries,
// sync-status markers, server cache) lives in ./offline/diaries. Re-exported
// for the same reason: callers keep importing from '@/lib/offlineDb'.
export {
  cacheDiaryFromServer,
  deleteOfflineDiary,
  getOfflineDiariesForProject,
  getOfflineDiary,
  getPendingDiaries,
  markDiarySynced,
  markDiarySyncError,
  saveDiaryOffline,
  submitDiaryOffline,
} from './offline/diaries';

// The mobile diary quick-add offline path (queue an activity/delay/plant/
// weather/delivery/event entry when its save fails on a network failure, plus
// the delivery/event sync-status markers) lives in ./offline/diaryQuickAdd.
// Re-exported for the same reason: callers keep importing from '@/lib/offlineDb'.
export {
  markDeliverySynced,
  markDeliverySyncError,
  markEventSynced,
  markEventSyncError,
  queueDiaryActivityOffline,
  queueDiaryDelayOffline,
  queueDiaryDeliveryOffline,
  queueDiaryEventOffline,
  queueDiaryPlantOffline,
  queueDiaryWeatherOffline,
  type OfflineDiaryRef,
} from './offline/diaryQuickAdd';

// The offline ITP checklist/completion helpers live in ./offline/itp.
// Re-exported so callers keep importing from '@/lib/offlineDb'.
export {
  cacheITPChecklist,
  getCachedITPChecklist,
  markCompletionSynced,
  recordSyncedChecklistItem,
  reconcileItpCompletionFromServer,
  updateChecklistItemOffline,
  type ItpServerCompletionSnapshot,
} from './offline/itp';

// The offline docket persistence (create/submit/update/query and sync-status
// markers) lives in ./offline/dockets. Re-exported for the same reason:
// callers keep importing from '@/lib/offlineDb'.
export {
  createDocketOffline,
  deleteOfflineDocket,
  getOfflineDocket,
  getOfflineDocketsForProject,
  getOfflineDocketsForSubcontractor,
  getPendingDockets,
  markDocketServerId,
  markDocketSynced,
  markDocketSyncError,
  submitDocketOffline,
  updateDocketOffline,
} from './offline/dockets';

// Generic sync queue and maintenance helpers live in ./offline/syncQueue.
// Re-exported so callers keep importing from '@/lib/offlineDb'.
export {
  MAX_SYNC_ATTEMPTS,
  clearAllOfflineData,
  getFailedSyncCount,
  getLiveSyncCount,
  getOldestPendingItemAge,
  getPendingSyncCount,
  getPendingSyncItems,
  markSyncItemTerminalError,
  markSyncItemError,
  removeSyncQueueItem,
  resetFailedSyncItems,
} from './offline/syncQueue';

type LotEditSyncQueueItem = Extract<SyncQueueItem, { type: 'lot_edit' }>;

function isLotEditSyncQueueItem(item: SyncQueueItem): item is LotEditSyncQueueItem {
  return item.type === 'lot_edit';
}

async function getQueuedLotEditSyncs(
  lotId: string,
  options?: { forceOverwrite?: boolean },
): Promise<LotEditSyncQueueItem[]> {
  return offlineDb.syncQueue
    .filter((item) => {
      if (!isLotEditSyncQueueItem(item) || item.data.lotId !== lotId) {
        return false;
      }

      if (options?.forceOverwrite === undefined) {
        return true;
      }

      return Boolean(item.data.forceOverwrite) === options.forceOverwrite;
    })
    .toArray() as Promise<LotEditSyncQueueItem[]>;
}

async function removeQueuedLotEditSyncs(
  lotId: string,
  options?: { forceOverwrite?: boolean },
): Promise<void> {
  const queuedItems = await getQueuedLotEditSyncs(lotId, options);
  const queuedIds = queuedItems
    .map((item) => item.id)
    .filter((id): id is number => typeof id === 'number');

  if (queuedIds.length > 0) {
    await offlineDb.syncQueue.bulkDelete(queuedIds);
  }
}

async function queueLatestLotEditSync(
  lotId: string,
  options?: { forceOverwrite?: boolean },
): Promise<void> {
  if (options?.forceOverwrite) {
    await removeQueuedLotEditSyncs(lotId);
  } else {
    const forcedSyncs = await getQueuedLotEditSyncs(lotId, { forceOverwrite: true });
    await removeQueuedLotEditSyncs(lotId, { forceOverwrite: false });

    if (forcedSyncs.length > 0) {
      return;
    }
  }

  await offlineDb.syncQueue.add({
    type: 'lot_edit',
    action: 'update',
    data: options?.forceOverwrite ? { lotId, forceOverwrite: true } : { lotId },
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}

// ============================================================================
// Feature #314: Offline Lot Editing & Sync Conflict Handling
// ============================================================================

// Type for offline lot edit
export interface OfflineLotEdit {
  id: string; // lotId
  projectId: string;
  lotNumber: string;
  description?: string;
  chainage?: number;
  chainageStart?: number;
  chainageEnd?: number;
  offset?: number;
  offsetLeft?: number;
  offsetRight?: number;
  layer?: string;
  areaZone?: string;
  activityType?: string;
  status?: string;
  budget?: number;
  notes?: string;
  // Sync tracking
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error';
  localUpdatedAt: string;
  serverUpdatedAt?: string; // Last known server timestamp
  conflictData?: {
    serverVersion: OfflineLotEdit;
    localVersion: OfflineLotEdit;
    detectedAt: string;
    resolved: boolean;
    resolution?: 'local' | 'server' | 'merged';
  };
  editedBy: string;
}

// Type for sync conflict notification
export interface SyncConflictNotification {
  id: string;
  entityType: 'lot' | 'diary' | 'docket';
  entityId: string;
  entityName: string;
  message: string;
  createdAt: string;
  read: boolean;
  resolved: boolean;
}

// Add lots table to database schema - we need to update the Dexie class
// This is handled by version upgrade below

// Cache lot data from server for offline editing
export async function cacheLotForOfflineEdit(
  lotData: Partial<OfflineLotEdit> & { id: string; projectId: string; lotNumber: string },
  serverUpdatedAt: string,
  userId: string,
): Promise<OfflineLotEdit> {
  const lot: OfflineLotEdit = {
    id: lotData.id,
    projectId: lotData.projectId,
    lotNumber: lotData.lotNumber,
    description: lotData.description,
    chainage: lotData.chainage,
    chainageStart: lotData.chainageStart,
    chainageEnd: lotData.chainageEnd,
    offset: lotData.offset,
    offsetLeft: lotData.offsetLeft,
    offsetRight: lotData.offsetRight,
    layer: lotData.layer,
    areaZone: lotData.areaZone,
    activityType: lotData.activityType,
    status: lotData.status,
    budget: lotData.budget,
    notes: lotData.notes,
    syncStatus: 'synced',
    localUpdatedAt: new Date().toISOString(),
    serverUpdatedAt,
    editedBy: userId,
  };

  await offlineDb.lots.put(lot);
  return lot;
}

// Save lot edit offline - accepts full lot object or lotId with updates
export async function saveLotEditOffline(
  lotDataOrId: OfflineLotEdit | string,
  updatesOrUserId?: Partial<OfflineLotEdit> | string,
  userId?: string,
): Promise<OfflineLotEdit> {
  let updatedLot: OfflineLotEdit;
  let lotId: string;

  // Handle overloaded function signature
  if (typeof lotDataOrId === 'string') {
    // Old signature: saveLotEditOffline(lotId, updates, userId)
    lotId = lotDataOrId;
    const updates = updatesOrUserId as Partial<OfflineLotEdit>;
    const editedBy = userId as string;

    const existing = await offlineDb.lots.get(lotId);
    if (!existing) {
      throw new Error('Lot not cached for offline editing');
    }

    updatedLot = {
      ...existing,
      ...updates,
      syncStatus: 'pending',
      localUpdatedAt: new Date().toISOString(),
      editedBy,
    } as OfflineLotEdit;
  } else {
    // New signature: saveLotEditOffline(lotData) - full lot object
    lotId = lotDataOrId.id;
    updatedLot = {
      ...lotDataOrId,
      syncStatus: 'pending',
      localUpdatedAt: new Date().toISOString(),
    };
  }

  // Store the updated lot
  await offlineDb.lots.put(updatedLot as OfflineLotEditTable);

  await queueLatestLotEditSync(lotId);

  return updatedLot;
}

// Get offline lot
export async function getOfflineLot(lotId: string): Promise<OfflineLotEdit | undefined> {
  return offlineDb.lots.get(lotId) as Promise<OfflineLotEdit | undefined>;
}

// Get all offline lots for a project
export async function getOfflineLotsForProject(projectId: string): Promise<OfflineLotEdit[]> {
  return offlineDb.lots.where('projectId').equals(projectId).toArray() as Promise<OfflineLotEdit[]>;
}

// Get pending lot edits
export async function getPendingLotEdits(): Promise<OfflineLotEdit[]> {
  return offlineDb.lots.where('syncStatus').equals('pending').toArray() as Promise<
    OfflineLotEdit[]
  >;
}

// Get lots with conflicts
export async function getConflictedLots(): Promise<OfflineLotEdit[]> {
  return offlineDb.lots.where('syncStatus').equals('conflict').toArray() as Promise<
    OfflineLotEdit[]
  >;
}

// Detect and handle sync conflict
export async function detectLotSyncConflict(
  lotId: string,
  serverData: {
    updatedAt: string;
    lotNumber: string;
    description?: string;
    chainage?: number;
    chainageStart?: number;
    chainageEnd?: number;
    offset?: number;
    offsetLeft?: number;
    offsetRight?: number;
    layer?: string;
    areaZone?: string;
    activityType?: string;
    status?: string;
    budget?: number;
    notes?: string;
  },
): Promise<{ hasConflict: boolean; conflictDetails?: OfflineLotEdit['conflictData'] }> {
  const localLot = (await offlineDb.lots.get(lotId)) as OfflineLotEdit | undefined;

  if (!localLot || (localLot.syncStatus !== 'pending' && localLot.syncStatus !== 'error')) {
    return { hasConflict: false };
  }

  // Compare server updatedAt with our last known server timestamp
  if (
    localLot.serverUpdatedAt &&
    new Date(serverData.updatedAt) > new Date(localLot.serverUpdatedAt)
  ) {
    // Server has been updated since we cached - CONFLICT!
    const conflictData: OfflineLotEdit['conflictData'] = {
      serverVersion: {
        id: lotId,
        projectId: localLot.projectId,
        lotNumber: serverData.lotNumber,
        description: serverData.description,
        chainage: serverData.chainage,
        chainageStart: serverData.chainageStart,
        chainageEnd: serverData.chainageEnd,
        offset: serverData.offset,
        offsetLeft: serverData.offsetLeft,
        offsetRight: serverData.offsetRight,
        layer: serverData.layer,
        areaZone: serverData.areaZone,
        activityType: serverData.activityType,
        status: serverData.status,
        budget: serverData.budget,
        notes: serverData.notes,
        syncStatus: 'synced',
        localUpdatedAt: serverData.updatedAt,
        serverUpdatedAt: serverData.updatedAt,
        editedBy: 'server',
      },
      localVersion: { ...localLot },
      detectedAt: new Date().toISOString(),
      resolved: false,
    };

    // Update the lot with conflict status
    await offlineDb.lots.update(lotId, {
      syncStatus: 'conflict',
      conflictData,
    });

    // Add conflict notification to sync queue
    await offlineDb.syncQueue.add({
      type: 'lot_conflict',
      action: 'create',
      data: {
        lotId,
        lotNumber: localLot.lotNumber,
        projectId: localLot.projectId,
        message: `Sync conflict detected for lot ${localLot.lotNumber}. Another user edited this lot while you were offline.`,
      },
      createdAt: new Date().toISOString(),
      attempts: 0,
    });

    return { hasConflict: true, conflictDetails: conflictData };
  }

  return { hasConflict: false };
}

// Resolve conflict - choose local version
export async function resolveConflictWithLocal(lotId: string): Promise<void> {
  const lot = (await offlineDb.lots.get(lotId)) as OfflineLotEdit | undefined;
  if (!lot || lot.syncStatus !== 'conflict') {
    throw new Error('No conflict to resolve');
  }

  // Mark conflict as resolved with local choice
  await offlineDb.lots.update(lotId, {
    syncStatus: 'pending', // Will be synced
    conflictData: {
      ...lot.conflictData!,
      resolved: true,
      resolution: 'local',
    },
  } as Partial<OfflineLotEditTable>);

  await queueLatestLotEditSync(lotId, { forceOverwrite: true });
}

// Resolve conflict - choose server version
export async function resolveConflictWithServer(lotId: string): Promise<void> {
  const lot = (await offlineDb.lots.get(lotId)) as OfflineLotEdit | undefined;
  if (!lot || lot.syncStatus !== 'conflict' || !lot.conflictData) {
    throw new Error('No conflict to resolve');
  }

  // Replace local with server version
  const serverVersion = lot.conflictData.serverVersion;
  await removeQueuedLotEditSyncs(lotId);
  await offlineDb.lots.update(lotId, {
    ...serverVersion,
    syncStatus: 'synced',
    conflictData: {
      ...lot.conflictData,
      resolved: true,
      resolution: 'server',
    },
  });
}

// Resolve conflict - merge versions
export async function resolveConflictWithMerge(
  lotId: string,
  mergedData: Partial<OfflineLotEdit>,
): Promise<void> {
  const lot = (await offlineDb.lots.get(lotId)) as OfflineLotEdit | undefined;
  if (!lot || lot.syncStatus !== 'conflict') {
    throw new Error('No conflict to resolve');
  }

  // Apply merged data
  await offlineDb.lots.update(lotId, {
    ...mergedData,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
    conflictData: {
      ...lot.conflictData!,
      resolved: true,
      resolution: 'merged',
    },
  } as Partial<OfflineLotEditTable>);

  await queueLatestLotEditSync(lotId, { forceOverwrite: true });
}

// Mark lot as synced
export async function markLotSynced(lotId: string, serverUpdatedAt: string): Promise<void> {
  await offlineDb.lots.update(lotId, {
    syncStatus: 'synced',
    serverUpdatedAt,
    localUpdatedAt: new Date().toISOString(),
    conflictData: undefined,
  });
}

// Mark lot sync error
export async function markLotSyncError(lotId: string): Promise<void> {
  await offlineDb.lots.update(lotId, {
    syncStatus: 'error',
    localUpdatedAt: new Date().toISOString(),
  });
}

// Delete offline lot
export async function deleteOfflineLot(lotId: string): Promise<void> {
  await offlineDb.lots.delete(lotId);
}

// Get count of lots with conflicts
export async function getConflictedLotsCount(): Promise<number> {
  return offlineDb.lots.where('syncStatus').equals('conflict').count();
}

// Total amount of work that has not reached the server yet: everything still in
// the sync queue (including items that have stopped retrying) plus unresolved
// lot conflicts. Used to warn the user before a manual sign-out wipes offline
// data, so the count must reflect everything that would be permanently lost.
export async function getUnsyncedWorkCount(): Promise<number> {
  const [queued, conflicts] = await Promise.all([getPendingSyncCount(), getConflictedLotsCount()]);
  return queued + conflicts;
}
