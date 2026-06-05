import { createLocalId } from './localIds';
import {
  offlineDb,
  type OfflineChecklistItem,
  type OfflineDocket,
  type OfflineITPChecklist,
  type OfflineITPCompletion,
  type OfflineLotEditTable,
  type SyncQueueItem,
} from './offline/core';

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
  markPhotoSynced,
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

type LotEditSyncQueueItem = Extract<SyncQueueItem, { type: 'lot_edit' }>;

// Utility functions for offline ITP management
export async function cacheITPChecklist(
  lotId: string,
  templateId: string,
  templateName: string,
  items: OfflineChecklistItem[],
): Promise<void> {
  const checklist: OfflineITPChecklist = {
    id: `${lotId}-${templateId}`,
    lotId,
    templateId,
    templateName,
    items,
    cachedAt: new Date().toISOString(),
  };

  await offlineDb.itpChecklists.put(checklist);
}

export async function getCachedITPChecklist(
  lotId: string,
): Promise<OfflineITPChecklist | undefined> {
  return offlineDb.itpChecklists.where('lotId').equals(lotId).first();
}

export async function updateChecklistItemOffline(
  lotId: string,
  checklistItemId: string,
  status: 'pending' | 'completed' | 'na' | 'failed',
  notes?: string,
  completedBy?: string,
): Promise<void> {
  const completion: OfflineITPCompletion = {
    id: `${lotId}-${checklistItemId}`,
    lotId,
    checklistItemId,
    status,
    notes,
    completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    completedBy,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
  };

  // Store the completion
  await offlineDb.itpCompletions.put(completion);

  // Add to sync queue
  await offlineDb.syncQueue.add({
    type: 'itp_completion',
    action: 'update',
    data: completion,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });

  // Update the cached checklist item
  const cachedChecklist = await getCachedITPChecklist(lotId);
  if (cachedChecklist) {
    const updatedItems = cachedChecklist.items.map((item) => {
      if (item.id === checklistItemId) {
        return {
          ...item,
          status,
          notes,
          completedAt: status === 'completed' ? new Date().toISOString() : undefined,
          completedBy,
        };
      }
      return item;
    });

    await offlineDb.itpChecklists.update(cachedChecklist.id, {
      items: updatedItems,
      cachedAt: new Date().toISOString(),
    });
  }
}

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

export async function markCompletionSynced(lotId: string, checklistItemId: string): Promise<void> {
  const id = `${lotId}-${checklistItemId}`;
  await offlineDb.itpCompletions.update(id, { syncStatus: 'synced' });
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

// ============================================================================
// Feature #313: Offline Docket Creation Functions
// ============================================================================

// Generate docket ID
function generateDocketId(): string {
  return createLocalId('docket');
}

// Create docket offline
export async function createDocketOffline(
  projectId: string,
  subcontractorCompanyId: string,
  date: string,
  data: {
    labourEntries: OfflineDocket['labourEntries'];
    plantEntries: OfflineDocket['plantEntries'];
    notes?: string;
  },
  userId: string,
): Promise<OfflineDocket> {
  const id = generateDocketId();

  const docket: OfflineDocket = {
    id,
    projectId,
    subcontractorCompanyId,
    date,
    status: 'draft',
    labourEntries: data.labourEntries,
    plantEntries: data.plantEntries,
    notes: data.notes,
    createdBy: userId,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
  };

  // Store the docket
  await offlineDb.dockets.put(docket);

  // Add to sync queue
  await offlineDb.syncQueue.add({
    type: 'docket_create',
    action: 'create',
    data: { docketId: id },
    createdAt: new Date().toISOString(),
    attempts: 0,
  });

  return docket;
}

// Submit docket offline
export async function submitDocketOffline(docketId: string): Promise<void> {
  // Update status to pending_approval
  await offlineDb.dockets.update(docketId, {
    status: 'pending_approval',
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
  });

  // Add submission to sync queue
  await offlineDb.syncQueue.add({
    type: 'docket_submit',
    action: 'update',
    data: { docketId },
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}

// Update docket offline
export async function updateDocketOffline(
  docketId: string,
  updates: Partial<Pick<OfflineDocket, 'labourEntries' | 'plantEntries' | 'notes'>>,
): Promise<void> {
  await offlineDb.dockets.update(docketId, {
    ...updates,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
  });

  // Add update to sync queue
  await offlineDb.syncQueue.add({
    type: 'docket_create', // Reuse create for updates
    action: 'update',
    data: { docketId },
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}

// Get docket by ID
export async function getOfflineDocket(docketId: string): Promise<OfflineDocket | undefined> {
  return offlineDb.dockets.get(docketId);
}

// Get all offline dockets for a project
export async function getOfflineDocketsForProject(projectId: string): Promise<OfflineDocket[]> {
  return offlineDb.dockets.where('projectId').equals(projectId).toArray();
}

// Get offline dockets for a subcontractor
export async function getOfflineDocketsForSubcontractor(
  subcontractorCompanyId: string,
): Promise<OfflineDocket[]> {
  return offlineDb.dockets.where('subcontractorCompanyId').equals(subcontractorCompanyId).toArray();
}

// Get all pending docket syncs
export async function getPendingDockets(): Promise<OfflineDocket[]> {
  return offlineDb.dockets.where('syncStatus').equals('pending').toArray();
}

// Mark docket as synced
export async function markDocketServerId(docketId: string, serverId?: string): Promise<void> {
  if (!serverId) {
    return;
  }

  await offlineDb.dockets.update(docketId, {
    serverId,
  });
}

export async function markDocketSynced(docketId: string, serverId?: string): Promise<void> {
  await offlineDb.dockets.update(docketId, {
    ...(serverId ? { serverId } : {}),
    syncStatus: 'synced',
    localUpdatedAt: new Date().toISOString(),
  });
}

// Mark docket sync error
export async function markDocketSyncError(docketId: string): Promise<void> {
  await offlineDb.dockets.update(docketId, {
    syncStatus: 'error',
    localUpdatedAt: new Date().toISOString(),
  });
}

// Delete offline docket
export async function deleteOfflineDocket(docketId: string): Promise<void> {
  await offlineDb.dockets.delete(docketId);
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
