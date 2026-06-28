// Per-item sync dispatch + the per-type executors, extracted verbatim from the
// `runExclusiveOfflineSync(async () => {...})` worker loop in
// ../useOfflineStatus.ts (see
// .gstack/dev-browser/offline-worker-restructure-plan-2026-06-07.md, Slices 2-3).
//
// The hook's loop now delegates each queue item to `syncSingleItem`, which
// dispatches on `item.type`. Each executor is moved byte-for-byte (same network
// calls, same offlineDb marker calls, same error-message sources, same log
// strings) so the characterization suite (useOfflineStatus.test.tsx) stays
// green untouched. A shared `runSyncStep` wrapper collapses the identical
// `error instanceof Error ? error.message : 'Unknown error'` catch ternaries
// into one place.
//
// Slice 3 finished the move: photo_upload and lot_edit now live here too, so no
// queue type defers back to the hook. The readiness assertions for their pinned
// strings (productionReadiness.spec.ts) were repointed from useOfflineStatus.ts
// to this module, and the raw-network allow-list entry moved with the
// photo_upload dataUrl read that this module now owns.

import { apiUrl, authFetch } from '../api';
import { devLog, devWarn } from '../logger';
import {
  offlineDb,
  removeSyncQueueItem,
  markSyncItemError,
  markSyncItemTerminalError,
  markCompletionSynced,
  reconcileItpCompletionFromServer,
  markDiarySynced,
  markDiarySyncError,
  markDeliverySynced,
  markDeliverySyncError,
  markEventSynced,
  markEventSyncError,
  markDocketSyncError,
  getOfflinePhoto,
  markPhotoSynced,
  markPhotoUploadedAwaitingAttach,
  markPhotoSyncError,
  getOfflineLot,
  detectLotSyncConflict,
  markLotSynced,
  markLotSyncError,
  type ItpServerCompletionSnapshot,
  type OfflineDailyDiary,
  type SyncQueueItem,
} from '../offlineDb';
import { readResponseError, syncOfflineDiarySnapshot } from './syncClient';
import { buildOfflineLotEditPayload } from './syncPayloads';

// Outcome of dispatching a single queue item.
//  - 'synced'  : a per-type success path that the loop counts (syncedCount++).
//  - 'handled' : fully processed by the worker (error-marked / removed / GC'd /
//                deliberately not-synced), no count and no further loop work.
export type SyncItemResult = { status: 'synced' | 'handled' };

// Conflict-notification callback threaded from the hook's caller so the
// lot_edit executor can surface a sync conflict to the UI. Only the callback
// truly needs threading; everything else is a direct module import.
export interface SyncWorkerCallbacks {
  onConflictDetected?: (lotId: string, lotNumber: string, message: string) => void;
}

const SYNCED: SyncItemResult = { status: 'synced' };
const HANDLED: SyncItemResult = { status: 'handled' };

// Known queue types the worker recognizes. Unrecognized types are garbage
// collected (see the dispatcher default) so the queue can't wedge.
// `delivery_save`/`event_save` were a declared-but-branch-less latent gap
// (queued items were GC'd); they now have real executors below, wired up for
// the diary quick-add offline path.
const KNOWN_TYPES = [
  'itp_completion',
  'photo_upload',
  'diary_save',
  'diary_submit',
  'delivery_save',
  'event_save',
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
type DeliveryItem = Extract<SyncQueueItem, { type: 'delivery_save' }>;
type EventItem = Extract<SyncQueueItem, { type: 'event_save' }>;
type DocketItem = Extract<SyncQueueItem, { type: 'docket_create' | 'docket_submit' }>;
type PhotoUploadItem = Extract<SyncQueueItem, { type: 'photo_upload' }>;
type LotEditItem = Extract<SyncQueueItem, { type: 'lot_edit' }>;

function isOfflineCompletionId(completionId: string): boolean {
  return completionId.startsWith('offline-');
}

function isTerminalItpSyncRejection(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

function isKnownTerminalDiarySyncError(errorText: string): boolean {
  return (
    errorText.includes('Diary already submitted') ||
    errorText.includes('Cannot modify submitted diary')
  );
}

function isTerminalDiarySyncRejection(status: number, errorText: string): boolean {
  return (
    isKnownTerminalDiarySyncError(errorText) ||
    (status >= 400 && status < 500 && status !== 408 && status !== 429)
  );
}

async function markDiaryTerminalSyncError(
  itemId: number,
  diaryId: string,
  errorText: string,
): Promise<void> {
  await markSyncItemTerminalError(itemId, errorText);
  await markDiarySyncError(diaryId);
}

type ServerDiaryStatusSnapshot = {
  id?: string | null;
  status?: string | null;
};

async function verifySubmittedServerDiary(diary: OfflineDailyDiary): Promise<boolean> {
  const response = await authFetch(
    apiUrl(
      `/api/diary/${encodeURIComponent(diary.projectId)}/${encodeURIComponent(
        diary.date,
      )}?missing=null`,
    ),
  );

  if (!response.ok) {
    return false;
  }

  const serverDiary = (await response.json()) as ServerDiaryStatusSnapshot | null;
  return serverDiary?.status === 'submitted';
}

async function clearVerifiedDuplicateDiarySubmit(
  itemId: number,
  diaryId: string,
  diary: OfflineDailyDiary,
): Promise<boolean> {
  if (diary.status !== 'submitted') {
    return false;
  }

  if (!(await verifySubmittedServerDiary(diary))) {
    return false;
  }

  await removeSyncQueueItem(itemId);
  await markDiarySynced(diaryId);
  return true;
}

async function resolveKnownDiarySyncConflict(
  item: DiaryItem,
  itemId: number,
  diaryId: string,
  diary: OfflineDailyDiary,
  errorText: string,
): Promise<SyncItemResult | undefined> {
  if (!isKnownTerminalDiarySyncError(errorText)) {
    return undefined;
  }

  if (
    item.type === 'diary_submit' &&
    (await clearVerifiedDuplicateDiarySubmit(itemId, diaryId, diary))
  ) {
    return SYNCED;
  }

  await markDiaryTerminalSyncError(itemId, diaryId, errorText);
  return HANDLED;
}

type DiarySnapshotSyncResult =
  | { kind: 'ready'; serverDiaryId: string }
  | { kind: 'handled'; result: SyncItemResult };

async function syncDiarySnapshotForQueue(
  item: DiaryItem,
  itemId: number,
  diaryId: string,
  diary: OfflineDailyDiary,
): Promise<DiarySnapshotSyncResult> {
  try {
    return { kind: 'ready', serverDiaryId: await syncOfflineDiarySnapshot(diary) };
  } catch (error) {
    const errorText = error instanceof Error ? error.message : 'Unknown error';
    const knownConflictResult = await resolveKnownDiarySyncConflict(
      item,
      itemId,
      diaryId,
      diary,
      errorText,
    );
    if (knownConflictResult) {
      return { kind: 'handled', result: knownConflictResult };
    }

    throw error;
  }
}

async function syncDiarySubmitResponse(
  item: DiaryItem,
  itemId: number,
  diaryId: string,
  diary: OfflineDailyDiary,
  response: Response,
): Promise<SyncItemResult | undefined> {
  if (response.ok) {
    return undefined;
  }

  const errorText = await readResponseError(response);
  const knownConflictResult = await resolveKnownDiarySyncConflict(
    item,
    itemId,
    diaryId,
    diary,
    errorText,
  );
  if (knownConflictResult) {
    return knownConflictResult;
  }

  if (isTerminalDiarySyncRejection(response.status, errorText)) {
    await markDiaryTerminalSyncError(itemId, diaryId, errorText);
  } else {
    await markSyncItemError(itemId, errorText);
    await markDiarySyncError(diaryId);
  }

  return HANDLED;
}

interface ItpInstanceSyncResponse {
  instance?: {
    id?: string;
    completions?: ItpServerCompletionSnapshot[];
  } | null;
}

async function syncItpCompletion(item: ItpCompletionItem, itemId: number): Promise<SyncItemResult> {
  return runSyncStep(item, async () => {
    const completion = item.data;

    // First, get the ITP instance for this lot
    const instanceResponse = await authFetch(apiUrl(`/api/itp/instances/lot/${completion.lotId}`));

    if (!instanceResponse.ok) {
      await markSyncItemError(itemId, 'Could not find ITP instance for lot');
      return HANDLED;
    }

    const instanceData = (await instanceResponse.json()) as ItpInstanceSyncResponse;
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
        ...(completion.serverCompletionBase
          ? { expectedPreviousCompletion: completion.serverCompletionBase }
          : {}),
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
      if (isTerminalItpSyncRejection(response.status)) {
        const serverCompletion = instanceData.instance?.completions?.find(
          (candidate) => candidate.checklistItemId === completion.checklistItemId,
        );
        await reconcileItpCompletionFromServer(
          completion.lotId,
          completion.checklistItemId,
          serverCompletion,
        );
        await markSyncItemTerminalError(itemId, errorText);
        return HANDLED;
      }

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

      const snapshotResult = await syncDiarySnapshotForQueue(item, itemId, diaryId, diary);
      if (snapshotResult.kind === 'handled') {
        return snapshotResult.result;
      }

      if (item.type === 'diary_submit') {
        const response = await authFetch(
          apiUrl(`/api/diary/${snapshotResult.serverDiaryId}/submit`),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ acknowledgeWarnings: true }),
          },
        );

        const submitResult = await syncDiarySubmitResponse(item, itemId, diaryId, diary, response);
        if (submitResult) {
          return submitResult;
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

// A queued delivery/event is anchored either to a server diary id directly or
// to a local offline diary snapshot (`diary-<project>-<date>`, when the day
// was started fully offline). For a local anchor, push the snapshot first —
// POST /api/diary upserts by project+date, so this is safe to repeat — and use
// the server id it returns.
async function resolveServerDiaryId(anchorDiaryId: string): Promise<string> {
  const localDiary = await offlineDb.diaries.get(anchorDiaryId);
  if (!localDiary) {
    return anchorDiaryId;
  }
  return syncOfflineDiarySnapshot(localDiary);
}

// Mirrors syncDiary: load the queued entry, resolve the diary it belongs to,
// POST it, then remove the queue item and mark the entry synced.
async function syncDelivery(item: DeliveryItem, itemId: number): Promise<SyncItemResult> {
  return runSyncStep(
    item,
    async () => {
      const { deliveryId } = item.data;
      const delivery = await offlineDb.diaryDeliveries.get(deliveryId);

      if (!delivery) {
        // Delivery was deleted, remove from queue
        await removeSyncQueueItem(itemId);
        return HANDLED;
      }

      const serverDiaryId = await resolveServerDiaryId(delivery.diaryId);

      const response = await authFetch(apiUrl(`/api/diary/${serverDiaryId}/deliveries`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: delivery.description,
          supplier: delivery.supplier,
          docketNumber: delivery.docketNumber,
          quantity: delivery.quantity,
          unit: delivery.unit,
          lotId: delivery.lotId,
          notes: delivery.notes,
        }),
      });

      if (!response.ok) {
        const errorText = await readResponseError(response);
        await markSyncItemError(itemId, errorText);
        await markDeliverySyncError(deliveryId);
        return HANDLED;
      }

      await removeSyncQueueItem(itemId);
      await markDeliverySynced(deliveryId);
      return SYNCED;
    },
    async () => {
      if (item.data?.deliveryId) {
        await markDeliverySyncError(item.data.deliveryId);
      }
    },
  );
}

async function syncEvent(item: EventItem, itemId: number): Promise<SyncItemResult> {
  return runSyncStep(
    item,
    async () => {
      const { eventId } = item.data;
      const event = await offlineDb.diaryEvents.get(eventId);

      if (!event) {
        // Event was deleted, remove from queue
        await removeSyncQueueItem(itemId);
        return HANDLED;
      }

      const serverDiaryId = await resolveServerDiaryId(event.diaryId);

      const response = await authFetch(apiUrl(`/api/diary/${serverDiaryId}/events`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: event.eventType,
          description: event.description,
          notes: event.notes,
          lotId: event.lotId,
        }),
      });

      if (!response.ok) {
        const errorText = await readResponseError(response);
        await markSyncItemError(itemId, errorText);
        await markEventSyncError(eventId);
        return HANDLED;
      }

      await removeSyncQueueItem(itemId);
      await markEventSynced(eventId);
      return SYNCED;
    },
    async () => {
      if (item.data?.eventId) {
        await markEventSyncError(item.data.eventId);
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

      await markSyncItemError(
        itemId,
        'Offline docket sync is disabled until labour, plant, rates, and lot allocations can be replayed safely. Recreate or finish this docket online.',
      );
      await markDocketSyncError(docketId);
      return HANDLED;
    },
    async () => {
      if (item.data?.docketId) {
        await markDocketSyncError(item.data.docketId);
      }
    },
  );
}

// Feature #311: Sync offline photos
async function syncPhoto(item: PhotoUploadItem, itemId: number): Promise<SyncItemResult> {
  return runSyncStep(
    item,
    async () => {
      const { photoId } = item.data;
      const photo = await getOfflinePhoto(photoId);

      if (!photo) {
        // Photo was deleted, remove from queue
        await removeSyncQueueItem(itemId);
        return HANDLED;
      }

      // Some evidence photos need a second step after upload: linking the
      // created Document to its domain row. serverDocumentId persisted after a
      // successful upload makes a retried item skip straight to the attach step
      // instead of re-uploading a duplicate file.
      let itpCompletionId =
        photo.attachAs === 'itp_completion_attachment'
          ? (photo.completionId ?? photo.entityId)
          : undefined;
      const needsItpAttach = !!itpCompletionId;
      const needsNcrAttach =
        (photo.attachAs === 'ncr_evidence' || (!photo.attachAs && photo.entityType === 'ncr')) &&
        !!photo.entityId;
      const needsPostUploadAttach = needsItpAttach || needsNcrAttach;
      let documentId = photo.serverDocumentId;
      const keepPostUploadAttachQueued = async (message: string): Promise<SyncItemResult> => {
        await markSyncItemError(itemId, message);
        return HANDLED;
      };

      if (
        needsItpAttach &&
        itpCompletionId &&
        isOfflineCompletionId(itpCompletionId) &&
        photo.lotId &&
        photo.checklistItemId
      ) {
        try {
          const instanceResponse = await authFetch(apiUrl(`/api/itp/instances/lot/${photo.lotId}`));

          if (!instanceResponse.ok) {
            return keepPostUploadAttachQueued(
              'Waiting for synced ITP completion before attaching evidence',
            );
          }

          const instanceData = await instanceResponse.json();
          const serverCompletion = instanceData.instance?.completions?.find(
            (completion: { id?: string; checklistItemId?: string }) =>
              completion.checklistItemId === photo.checklistItemId,
          );

          if (!serverCompletion?.id) {
            return keepPostUploadAttachQueued(
              'Waiting for synced ITP completion before attaching evidence',
            );
          }

          itpCompletionId = serverCompletion.id;
        } catch {
          return keepPostUploadAttachQueued(
            'Waiting for synced ITP completion before attaching evidence',
          );
        }
      }

      if (!documentId) {
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
        if (!needsItpAttach) {
          formData.append('entityType', photo.entityType);
          if (photo.entityId) formData.append('entityId', photo.entityId);
        }
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

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          await markSyncItemError(itemId, errorText);
          await markPhotoSyncError(photoId);
          return HANDLED;
        }

        const result = await uploadResponse.json();
        documentId = (result?.id ?? result?.document?.id) as string | undefined;

        if (needsPostUploadAttach && !documentId) {
          throw new Error('Document upload response did not include a document id');
        }

        if (needsPostUploadAttach && documentId) {
          // Upload succeeded; remember the document so a failed attach below
          // never re-uploads on retry.
          await markPhotoUploadedAwaitingAttach(photoId, documentId);
        }
      }

      if (needsItpAttach && documentId && itpCompletionId) {
        let attachResponse: Response;
        try {
          attachResponse = await authFetch(
            apiUrl(`/api/itp/completions/${encodeURIComponent(itpCompletionId)}/attachments`),
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                documentId,
                ...(photo.caption ? { caption: photo.caption } : {}),
                gpsLatitude: photo.gpsLatitude ?? null,
                gpsLongitude: photo.gpsLongitude ?? null,
              }),
            },
          );
        } catch (error) {
          return keepPostUploadAttachQueued(
            error instanceof Error ? error.message : 'Failed to attach ITP evidence',
          );
        }

        if (!attachResponse.ok) {
          // The file is safely on the server; only the ITP link is missing.
          // Keep the queue item so the attach step retries.
          const errorText = await attachResponse.text();
          return keepPostUploadAttachQueued(errorText || 'Failed to attach ITP evidence');
        }
      }

      if (needsNcrAttach && documentId) {
        let attachResponse: Response;
        try {
          attachResponse = await authFetch(apiUrl(`/api/ncrs/${photo.entityId}/evidence`), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              documentId,
              evidenceType: 'photo',
              ...(photo.caption ? { caption: photo.caption } : {}),
            }),
          });
        } catch (error) {
          return keepPostUploadAttachQueued(
            error instanceof Error ? error.message : 'Failed to attach NCR evidence',
          );
        }

        if (!attachResponse.ok) {
          // The file is safely on the server; only the NCR link is missing.
          // Keep the queue item so the attach step retries.
          const errorText = await attachResponse.text();
          return keepPostUploadAttachQueued(errorText || 'Failed to attach NCR evidence');
        }
      }

      // Remove from sync queue
      await removeSyncQueueItem(itemId);
      // Mark photo as synced
      await markPhotoSynced(photoId, documentId);
      return SYNCED;
    },
    async () => {
      if (item.data?.photoId) {
        await markPhotoSyncError(item.data.photoId);
      }
    },
  );
}

// Feature #314: Sync offline lot edits with conflict detection
async function syncLotEdit(
  item: LotEditItem,
  itemId: number,
  callbacks?: SyncWorkerCallbacks,
): Promise<SyncItemResult> {
  return runSyncStep(
    item,
    async () => {
      const { lotId, forceOverwrite } = item.data;
      const lot = await getOfflineLot(lotId);

      if (!lot) {
        // Lot was deleted, remove from queue
        await removeSyncQueueItem(itemId);
        return HANDLED;
      }

      if (!forceOverwrite && lot.syncStatus === 'conflict') {
        devWarn('[Sync] Removing stale lot edit queue item for conflicted lot:', lotId);
        await removeSyncQueueItem(itemId);
        return HANDLED;
      }

      if (!forceOverwrite && lot.syncStatus === 'synced') {
        devLog('[Sync] Removing stale lot edit queue item for synced lot:', lotId);
        await removeSyncQueueItem(itemId);
        return HANDLED;
      }

      // First, fetch current server state to check for conflicts
      const serverCheckResponse = await authFetch(apiUrl(`/api/lots/${lotId}`), {
        method: 'GET',
      });

      if (!serverCheckResponse.ok) {
        const errorText = await serverCheckResponse.text();
        await markSyncItemError(itemId, errorText);
        await markLotSyncError(lotId);
        return HANDLED;
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
          await removeSyncQueueItem(itemId);
          return HANDLED;
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
        await removeSyncQueueItem(itemId);
        // Mark lot as synced with new server timestamp
        await markLotSynced(lotId, result.lot?.updatedAt || new Date().toISOString());
        devLog('[Sync] Lot synced successfully:', lotId);
        return SYNCED;
      } else {
        const errorText = await syncResponse.text();
        await markSyncItemError(itemId, errorText);
        await markLotSyncError(lotId);
        return HANDLED;
      }
    },
    async () => {
      if (item.data?.lotId) {
        await markLotSyncError(item.data.lotId);
      }
    },
  );
}

async function syncLotConflict(itemId: number): Promise<SyncItemResult> {
  // Conflict notification item - just remove it, conflict is tracked in lot record
  await removeSyncQueueItem(itemId);
  return HANDLED;
}

// Dispatch a single queue item to its per-type executor. Every recognized type
// is owned here; unrecognized types are garbage collected.
export async function syncSingleItem(
  item: SyncQueueItem,
  callbacks?: SyncWorkerCallbacks,
): Promise<SyncItemResult> {
  if (item.type === 'itp_completion' && item.id) {
    return syncItpCompletion(item, item.id);
  }

  // Feature #312: Sync offline diaries
  if ((item.type === 'diary_save' || item.type === 'diary_submit') && item.id) {
    return syncDiary(item, item.id);
  }

  // Diary quick-add offline path: queued deliveries and events
  if (item.type === 'delivery_save' && item.id) {
    return syncDelivery(item, item.id);
  }

  if (item.type === 'event_save' && item.id) {
    return syncEvent(item, item.id);
  }

  // Feature #313: Sync offline dockets
  if ((item.type === 'docket_create' || item.type === 'docket_submit') && item.id) {
    return syncDocket(item, item.id);
  }

  // Feature #311: Sync offline photos
  if (item.type === 'photo_upload' && item.id) {
    return syncPhoto(item, item.id);
  }

  // Feature #314: Sync offline lot edits with conflict detection
  if (item.type === 'lot_edit' && item.id) {
    return syncLotEdit(item, item.id, callbacks);
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
