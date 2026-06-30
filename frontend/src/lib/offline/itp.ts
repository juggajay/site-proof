// Offline ITP checklist/completion helpers, moved from ../offlineDb.ts so this
// slice lives beside the database core. The public import path is unchanged:
// '@/lib/offlineDb' re-exports everything exported here.

import {
  offlineDb,
  type OfflineChecklistItem,
  type OfflineITPChecklist,
  type OfflineITPCompletion,
  type ItpCompletionServerBase,
  type SyncQueueItem,
} from './core';

type ItpCompletionQueueItem = Extract<SyncQueueItem, { type: 'itp_completion' }>;

export interface ItpServerCompletionSnapshot {
  id?: string | null;
  checklistItemId?: string;
  status?: string | null;
  isCompleted?: boolean | null;
  isNotApplicable?: boolean | null;
  isFailed?: boolean | null;
  notes?: string | null;
  completedAt?: string | null;
  completedBy?: { fullName?: string | null } | null;
}

function isItpCompletionQueueItem(item: SyncQueueItem): item is ItpCompletionQueueItem {
  return item.type === 'itp_completion';
}

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

function buildCompletionRecord(
  lotId: string,
  checklistItemId: string,
  status: OfflineITPCompletion['status'],
  syncStatus: OfflineITPCompletion['syncStatus'],
  notes?: string,
  completedBy?: string,
  completedAt?: string | null,
  serverCompletionBase?: ItpCompletionServerBase,
): OfflineITPCompletion {
  return {
    id: `${lotId}-${checklistItemId}`,
    lotId,
    checklistItemId,
    status,
    notes,
    completedAt:
      completedAt !== undefined
        ? (completedAt ?? undefined)
        : status === 'completed'
          ? new Date().toISOString()
          : undefined,
    completedBy,
    syncStatus,
    localUpdatedAt: new Date().toISOString(),
    ...(serverCompletionBase !== undefined ? { serverCompletionBase } : {}),
  };
}

function serverStatusFromOfflineStatus(
  status: OfflineITPCompletion['status'],
): ItpCompletionServerBase['status'] {
  return status === 'na' ? 'not_applicable' : status;
}

function buildServerCompletionBase(
  serverCompletion?: ItpServerCompletionSnapshot,
): ItpCompletionServerBase {
  if (!serverCompletion) {
    return { exists: false };
  }

  return {
    exists: true,
    ...(serverCompletion.id ? { id: serverCompletion.id } : {}),
    status: serverStatusFromOfflineStatus(serverCompletionStatus(serverCompletion)),
    notes: serverCompletion.notes ?? null,
    completedAt: serverCompletion.completedAt ?? null,
  };
}

// Patch the item inside the cached checklist so a later offline load shows the
// latest local state.
async function patchCachedChecklistItem(
  lotId: string,
  checklistItemId: string,
  status: OfflineITPCompletion['status'],
  notes?: string,
  completedBy?: string,
  completedAt?: string | null,
  serverCompletionBase?: ItpCompletionServerBase,
): Promise<void> {
  const cachedChecklist = await getCachedITPChecklist(lotId);
  if (!cachedChecklist) {
    return;
  }

  const updatedItems = cachedChecklist.items.map((item) => {
    if (item.id === checklistItemId) {
      return {
        ...item,
        status,
        notes,
        completedAt:
          completedAt !== undefined
            ? (completedAt ?? undefined)
            : status === 'completed'
              ? new Date().toISOString()
              : undefined,
        completedBy,
        ...(serverCompletionBase !== undefined ? { serverCompletionBase } : {}),
      };
    }
    return item;
  });

  await offlineDb.itpChecklists.update(cachedChecklist.id, {
    items: updatedItems,
    cachedAt: new Date().toISOString(),
  });
}

// Queue the completion for sync, last-write-wins per lot+item: a still-queued
// entry for the same completion key is replaced (data swapped, attempts reset
// so a previously erroring entry retries the new state fresh) instead of
// appended, so rapid re-ticks of one item leave exactly one queue entry.
async function enqueueItpCompletionSync(completion: OfflineITPCompletion): Promise<void> {
  const existing = await offlineDb.syncQueue
    .where('type')
    .equals('itp_completion')
    .filter((item) => isItpCompletionQueueItem(item) && item.data.id === completion.id)
    .first();

  if (existing && typeof existing.id === 'number') {
    const existingCompletion = existing.data as OfflineITPCompletion;
    const queuedCompletion =
      completion.serverCompletionBase || !existingCompletion.serverCompletionBase
        ? completion
        : { ...completion, serverCompletionBase: existingCompletion.serverCompletionBase };
    await offlineDb.syncQueue.update(existing.id, {
      data: queuedCompletion,
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: undefined,
    });
    return;
  }

  await offlineDb.syncQueue.add({
    type: 'itp_completion',
    action: 'update',
    data: completion,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}

export async function updateChecklistItemOffline(
  lotId: string,
  checklistItemId: string,
  status: 'pending' | 'completed' | 'na' | 'failed',
  notes?: string,
  completedBy?: string,
): Promise<void> {
  const cachedChecklist = await getCachedITPChecklist(lotId);
  const cachedItem = cachedChecklist?.items.find((item) => item.id === checklistItemId);
  const completion = buildCompletionRecord(
    lotId,
    checklistItemId,
    status,
    'pending',
    notes,
    completedBy,
    undefined,
    cachedItem?.serverCompletionBase,
  );

  // Store the completion
  await offlineDb.itpCompletions.put(completion);

  // Add to sync queue (replacing any still-queued entry for the same item)
  await enqueueItpCompletionSync(completion);

  // Update the cached checklist item
  await patchCachedChecklistItem(lotId, checklistItemId, status, notes, completedBy);
}

// Server-confirmed write-through: record the item's latest state in the local
// cache WITHOUT queueing anything for sync — the server already has it.
export async function recordSyncedChecklistItem(
  lotId: string,
  checklistItemId: string,
  status: 'pending' | 'completed' | 'na' | 'failed',
  notes?: string,
  completedBy?: string,
  serverCompletion?: ItpServerCompletionSnapshot,
): Promise<void> {
  const serverCompletionBase = serverCompletion
    ? buildServerCompletionBase(serverCompletion)
    : undefined;
  const completion = buildCompletionRecord(
    lotId,
    checklistItemId,
    status,
    'synced',
    notes,
    completedBy,
    serverCompletion?.completedAt,
    serverCompletionBase,
  );

  await offlineDb.itpCompletions.put(completion);
  await patchCachedChecklistItem(
    lotId,
    checklistItemId,
    status,
    notes,
    completedBy,
    serverCompletion?.completedAt,
    serverCompletionBase,
  );
}

function serverCompletionStatus(
  serverCompletion?: ItpServerCompletionSnapshot,
): OfflineITPCompletion['status'] {
  if (!serverCompletion) {
    return 'pending';
  }
  if (serverCompletion.status === 'completed') {
    return 'completed';
  }
  if (serverCompletion.status === 'not_applicable') {
    return 'na';
  }
  if (serverCompletion.status === 'failed') {
    return 'failed';
  }
  if (serverCompletion.isFailed) {
    return 'failed';
  }
  if (serverCompletion.isNotApplicable) {
    return 'na';
  }
  if (serverCompletion.isCompleted) {
    return 'completed';
  }
  return 'pending';
}

export async function reconcileItpCompletionFromServer(
  lotId: string,
  checklistItemId: string,
  serverCompletion?: ItpServerCompletionSnapshot,
): Promise<void> {
  const status = serverCompletionStatus(serverCompletion);
  const notes = serverCompletion?.notes ?? undefined;
  const completedAt = serverCompletion ? (serverCompletion.completedAt ?? null) : null;
  const completedBy = serverCompletion?.completedBy?.fullName ?? undefined;
  const serverCompletionBase = buildServerCompletionBase(serverCompletion);
  const completion = buildCompletionRecord(
    lotId,
    checklistItemId,
    status,
    'synced',
    notes,
    completedBy,
    completedAt,
    serverCompletionBase,
  );

  await offlineDb.itpCompletions.put(completion);
  await patchCachedChecklistItem(
    lotId,
    checklistItemId,
    status,
    notes,
    completedBy,
    completedAt,
    serverCompletionBase,
  );
}

export async function markCompletionSynced(lotId: string, checklistItemId: string): Promise<void> {
  const id = `${lotId}-${checklistItemId}`;
  await offlineDb.itpCompletions.update(id, { syncStatus: 'synced' });
}
