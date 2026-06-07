// Per-item sync dispatch + the low-risk per-type executors, extracted verbatim
// from the `runExclusiveOfflineSync(async () => {...})` worker loop in
// ../useOfflineStatus.ts (see
// .gstack/dev-browser/offline-worker-restructure-plan-2026-06-07.md, Slice 2).
//
// The hook's loop now delegates each queue item to `syncSingleItem`, which
// dispatches on `item.type`. Each executor is moved byte-for-byte (same fetch
// calls, same offlineDb marker calls, same error-message sources, same log
// strings) so the characterization suite (useOfflineStatus.test.tsx) stays
// green untouched. A shared `runSyncStep` wrapper collapses the five identical
// `error instanceof Error ? error.message : 'Unknown error'` catch ternaries
// into one place.
//
// Deferred to later slices (their branches still run inline in the hook):
//  - photo_upload: productionReadiness.spec.ts pins its formData/GPS strings
//    and its bare dataUrl read (the raw-fetch allow-list) to useOfflineStatus.ts,
//    so moving it would require editing the readiness guard.
//  - lot_edit: Slice 3. Its stale-skip literals are readiness-pinned to
//    useOfflineStatus.ts (productionReadiness.spec.ts:2078-2080).
// Both are reported back to the loop as `deferred` so it runs its inline branch.

import { apiUrl, authFetch } from '../api';
import { devWarn } from '../logger';
import {
  offlineDb,
  removeSyncQueueItem,
  markSyncItemError,
  markCompletionSynced,
  markDiarySynced,
  markDiarySyncError,
  markDocketSynced,
  markDocketServerId,
  markDocketSyncError,
  type SyncQueueItem,
} from '../offlineDb';
import { readResponseError, syncOfflineDiarySnapshot, syncOfflineDocketDraft } from './syncClient';

// Outcome of dispatching a single queue item.
//  - 'synced'  : a per-type success path that the loop counts (syncedCount++).
//  - 'handled' : fully processed by the worker (error-marked / removed / GC'd /
//                deliberately not-synced), no count and no further loop work.
//  - 'deferred': the item's branch is not (yet) owned here; the hook runs its
//                existing inline branch for it.
export type SyncItemResult = { status: 'synced' | 'handled' | 'deferred' };

const SYNCED: SyncItemResult = { status: 'synced' };
const HANDLED: SyncItemResult = { status: 'handled' };
const DEFERRED: SyncItemResult = { status: 'deferred' };

// Known queue types the worker recognizes. Unrecognized types are garbage
// collected (see the dispatcher default) so the queue can't wedge. NOTE:
// `delivery_save`/`event_save` are declared in the SyncQueueItem union but have
// no branch, so they fall through to GC today — preserved as-is per the plan.
const KNOWN_TYPES = [
  'itp_completion',
  'photo_upload',
  'diary_save',
  'diary_submit',
  'docket_create',
  'docket_submit',
  'lot_edit',
  'lot_conflict',
];

// Shared per-item try/catch. Runs `fn`; on a thrown error marks the queue item
// (when it has an id) with the standard message, then lets the caller mark any
// per-entity error marker via `onError`. Collapses the repeated catch ternary.
async function runSyncStep(
  item: SyncQueueItem,
  fn: () => Promise<SyncItemResult>,
  onError?: (message: string) => Promise<void>,
): Promise<SyncItemResult> {
  try {
    return await fn();
  } catch (error) {
    if (item.id) {
      await markSyncItemError(item.id, error instanceof Error ? error.message : 'Unknown error');
    }
    if (onError) {
      await onError(error instanceof Error ? error.message : 'Unknown error');
    }
    return HANDLED;
  }
}

type ItpCompletionItem = Extract<SyncQueueItem, { type: 'itp_completion' }>;
type DiaryItem = Extract<SyncQueueItem, { type: 'diary_save' | 'diary_submit' }>;
type DocketItem = Extract<SyncQueueItem, { type: 'docket_create' | 'docket_submit' }>;

async function syncItpCompletion(item: ItpCompletionItem, itemId: number): Promise<SyncItemResult> {
  return runSyncStep(item, async () => {
    const completion = item.data;

    // First, get the ITP instance for this lot
    const instanceResponse = await authFetch(apiUrl(`/api/itp/instances/lot/${completion.lotId}`));

    if (!instanceResponse.ok) {
      await markSyncItemError(itemId, 'Could not find ITP instance for lot');
      return HANDLED;
    }

    const instanceData = await instanceResponse.json();
    const itpInstanceId = instanceData.instance?.id;

    if (!itpInstanceId) {
      await markSyncItemError(itemId, 'No ITP instance found for lot');
      return HANDLED;
    }

    // Convert status to backend expected format
    const isCompleted = completion.status === 'completed';
    const directStatus =
      completion.status === 'na'
        ? 'not_applicable'
        : completion.status === 'failed'
          ? 'failed'
          : undefined;

    // Sync to server
    const response = await authFetch(apiUrl('/api/itp/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        itpInstanceId,
        checklistItemId: completion.checklistItemId,
        isCompleted,
        status: directStatus,
        notes: completion.notes,
      }),
    });

    if (response.ok) {
      // Remove from sync queue
      await removeSyncQueueItem(itemId);
      // Mark as synced
      await markCompletionSynced(completion.lotId, completion.checklistItemId);
      return SYNCED;
    } else {
      const errorText = await response.text();
      await markSyncItemError(itemId, errorText);
      return HANDLED;
    }
  });
}

async function syncDiary(item: DiaryItem, itemId: number): Promise<SyncItemResult> {
  return runSyncStep(
    item,
    async () => {
      const { diaryId } = item.data;
      const diary = await offlineDb.diaries.get(diaryId);

      if (!diary) {
        // Diary was deleted, remove from queue
        await removeSyncQueueItem(itemId);
        return HANDLED;
      }

      const serverDiaryId = await syncOfflineDiarySnapshot(diary);

      if (item.type === 'diary_submit') {
        const response = await authFetch(apiUrl(`/api/diary/${serverDiaryId}/submit`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ acknowledgeWarnings: true }),
        });

        if (!response.ok) {
          const errorText = await readResponseError(response);
          if (!errorText.includes('Diary already submitted')) {
            await markSyncItemError(itemId, errorText);
            await markDiarySyncError(diaryId);
            return HANDLED;
          }
        }
      }

      // Remove from sync queue
      await removeSyncQueueItem(itemId);
      // Mark diary as synced
      await markDiarySynced(diaryId);
      return SYNCED;
    },
    async () => {
      if (item.data?.diaryId) {
        await markDiarySyncError(item.data.diaryId);
      }
    },
  );
}

async function syncDocket(item: DocketItem, itemId: number): Promise<SyncItemResult> {
  return runSyncStep(
    item,
    async () => {
      const { docketId } = item.data;
      const docket = await offlineDb.dockets.get(docketId);

      if (!docket) {
        // Docket was deleted, remove from queue
        await removeSyncQueueItem(itemId);
        return HANDLED;
      }

      if (item.type === 'docket_create' && docket.serverId) {
        await markSyncItemError(
          itemId,
          'This offline docket is already synced. Open it online to make further changes.',
        );
        await markDocketSyncError(docketId);
        return HANDLED;
      }

      const serverId = await syncOfflineDocketDraft(docket);

      if (item.type === 'docket_create') {
        // Remove from sync queue
        await removeSyncQueueItem(itemId);
        // Mark docket as synced
        await markDocketSynced(docketId, serverId);
        return SYNCED;
      } else {
        await markDocketServerId(docketId, serverId);
        await markSyncItemError(
          itemId,
          'Offline docket draft synced. Submission requires online review so labour, plant, and lot allocations can be validated before approval.',
        );
        await markDocketSyncError(docketId);
        return HANDLED;
      }
    },
    async () => {
      if (item.data?.docketId) {
        await markDocketSyncError(item.data.docketId);
      }
    },
  );
}

async function syncLotConflict(itemId: number): Promise<SyncItemResult> {
  // Conflict notification item - just remove it, conflict is tracked in lot record
  await removeSyncQueueItem(itemId);
  return HANDLED;
}

// Dispatch a single queue item to its per-type executor. Items whose branch is
// not owned here (photo_upload, lot_edit) return `deferred` so the hook runs
// its inline branch; unrecognized types are garbage collected.
export async function syncSingleItem(item: SyncQueueItem): Promise<SyncItemResult> {
  if (item.type === 'itp_completion' && item.id) {
    return syncItpCompletion(item, item.id);
  }

  // Feature #312: Sync offline diaries
  if ((item.type === 'diary_save' || item.type === 'diary_submit') && item.id) {
    return syncDiary(item, item.id);
  }

  // Feature #313: Sync offline dockets
  if ((item.type === 'docket_create' || item.type === 'docket_submit') && item.id) {
    return syncDocket(item, item.id);
  }

  // Feature #311 (photo_upload) and Feature #314 (lot_edit) still run inline in
  // the hook; defer to it.
  if (item.type === 'photo_upload' || item.type === 'lot_edit') {
    return DEFERRED;
  }

  // Feature #314: Handle conflict notifications (just remove from queue after processing)
  if (item.type === 'lot_conflict' && item.id) {
    return await syncLotConflict(item.id);
  }

  // Remove unrecognized item types to prevent queue buildup
  if (!KNOWN_TYPES.includes(item.type) && item.id) {
    devWarn('[Sync] Removing unknown item type:', item.type);
    await removeSyncQueueItem(item.id);
  }

  return HANDLED;
}
