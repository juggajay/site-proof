// Offline ITP checklist/completion helpers, moved from ../offlineDb.ts so this
// slice lives beside the database core. The public import path is unchanged:
// '@/lib/offlineDb' re-exports everything exported here.

import {
  offlineDb,
  type OfflineChecklistItem,
  type OfflineITPChecklist,
  type OfflineITPCompletion,
} from './core';

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

export async function markCompletionSynced(lotId: string, checklistItemId: string): Promise<void> {
  const id = `${lotId}-${checklistItemId}`;
  await offlineDb.itpCompletions.update(id, { syncStatus: 'synced' });
}
