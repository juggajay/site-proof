// Offline NCR creation. When a defect is captured in CaptureModal without a
// connection, the NCR itself (not just its photo) must survive so it lands in
// the register on reconnect. The full create body is queued here; the sync
// worker (syncWorker.ts) POSTs it and relinks any evidence photo to the real id.
//
// The public import path is unchanged: '@/lib/offlineDb' re-exports this module.

import { createLocalId } from '../localIds';
import { offlineDb, type NcrCreateSyncData } from './core';

export interface QueueOfflineNcrInput {
  projectId: string;
  description: string;
  category: string;
  lotIds?: string[];
}

// Queue a defect NCR for creation on the next sync. Returns the local
// placeholder id so the caller can capture its evidence photo against it — the
// worker rewrites that id to the real server id once the NCR is created.
export async function queueOfflineNcrCreate(
  input: QueueOfflineNcrInput,
): Promise<{ ncrId: string }> {
  const ncrId = createLocalId('offline-ncr');
  const data: NcrCreateSyncData = {
    ncrId,
    projectId: input.projectId,
    description: input.description,
    category: input.category,
    ...(input.lotIds && input.lotIds.length > 0 ? { lotIds: input.lotIds } : {}),
  };

  await offlineDb.syncQueue.add({
    type: 'ncr_create',
    action: 'create',
    data,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });

  return { ncrId };
}
