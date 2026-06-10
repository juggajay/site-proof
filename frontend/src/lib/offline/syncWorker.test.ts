// Focused unit tests for offline/syncWorker.ts — the per-item dispatcher and
// every per-type executor extracted from useOfflineStatus.ts (Slices 2-3:
// itp_completion, diary, docket, lot_conflict, unknown-GC in Slice 2;
// photo_upload and lot_edit in Slice 3).
//
// These complement the hook-level characterization suite (useOfflineStatus.test.tsx):
// here we call `syncSingleItem(item)` directly with the module boundaries mocked,
// asserting the returned SyncItemResult status AND the marker/fetch side effects
// for each executor. The hook tests prove the loop integrates this correctly;
// these prove the executors in isolation.

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../offlineDb', () => ({
  removeSyncQueueItem: vi.fn(),
  markSyncItemError: vi.fn(),
  markCompletionSynced: vi.fn(),
  markDiarySynced: vi.fn(),
  markDiarySyncError: vi.fn(),
  markDeliverySynced: vi.fn(),
  markDeliverySyncError: vi.fn(),
  markEventSynced: vi.fn(),
  markEventSyncError: vi.fn(),
  markDocketSynced: vi.fn(),
  markDocketServerId: vi.fn(),
  markDocketSyncError: vi.fn(),
  getOfflinePhoto: vi.fn(),
  markPhotoSynced: vi.fn(),
  markPhotoSyncError: vi.fn(),
  getOfflineLot: vi.fn(),
  detectLotSyncConflict: vi.fn(),
  markLotSynced: vi.fn(),
  markLotSyncError: vi.fn(),
  offlineDb: {
    diaries: { get: vi.fn() },
    dockets: { get: vi.fn() },
    diaryDeliveries: { get: vi.fn() },
    diaryEvents: { get: vi.fn() },
  },
}));

vi.mock('../api', () => ({
  apiUrl: vi.fn((path: string) => path),
  authFetch: vi.fn(),
}));

vi.mock('./syncClient', () => ({
  readResponseError: vi.fn(async (response: Response) => response.text()),
  syncOfflineDiarySnapshot: vi.fn(),
  syncOfflineDocketDraft: vi.fn(),
}));

vi.mock('./syncPayloads', () => ({
  buildOfflineLotEditPayload: vi.fn((lot: unknown) => ({ payload: lot })),
}));

vi.mock('../logger', () => ({
  devLog: vi.fn(),
  devWarn: vi.fn(),
}));

import {
  removeSyncQueueItem,
  markSyncItemError,
  markCompletionSynced,
  markDiarySynced,
  markDiarySyncError,
  markDeliverySynced,
  markDeliverySyncError,
  markEventSynced,
  markEventSyncError,
  markDocketSynced,
  markDocketServerId,
  markDocketSyncError,
  getOfflinePhoto,
  markPhotoSynced,
  markPhotoSyncError,
  getOfflineLot,
  detectLotSyncConflict,
  markLotSynced,
  markLotSyncError,
  offlineDb,
  type SyncQueueItem,
} from '../offlineDb';
import { authFetch } from '../api';
import { readResponseError, syncOfflineDiarySnapshot, syncOfflineDocketDraft } from './syncClient';
import { buildOfflineLotEditPayload } from './syncPayloads';
import { devWarn } from '../logger';
import { syncSingleItem } from './syncWorker';

const removeSyncQueueItemMock = removeSyncQueueItem as Mock;
const markSyncItemErrorMock = markSyncItemError as Mock;
const markCompletionSyncedMock = markCompletionSynced as Mock;
const markDiarySyncedMock = markDiarySynced as Mock;
const markDiarySyncErrorMock = markDiarySyncError as Mock;
const markDeliverySyncedMock = markDeliverySynced as Mock;
const markDeliverySyncErrorMock = markDeliverySyncError as Mock;
const markEventSyncedMock = markEventSynced as Mock;
const markEventSyncErrorMock = markEventSyncError as Mock;
const markDocketSyncedMock = markDocketSynced as Mock;
const markDocketServerIdMock = markDocketServerId as Mock;
const markDocketSyncErrorMock = markDocketSyncError as Mock;
const getOfflinePhotoMock = getOfflinePhoto as Mock;
const markPhotoSyncedMock = markPhotoSynced as Mock;
const markPhotoSyncErrorMock = markPhotoSyncError as Mock;
const getOfflineLotMock = getOfflineLot as Mock;
const detectLotSyncConflictMock = detectLotSyncConflict as Mock;
const markLotSyncedMock = markLotSynced as Mock;
const markLotSyncErrorMock = markLotSyncError as Mock;
const buildOfflineLotEditPayloadMock = buildOfflineLotEditPayload as Mock;
const diariesGetMock = offlineDb.diaries.get as unknown as Mock;
const docketsGetMock = offlineDb.dockets.get as unknown as Mock;
const diaryDeliveriesGetMock = offlineDb.diaryDeliveries.get as unknown as Mock;
const diaryEventsGetMock = offlineDb.diaryEvents.get as unknown as Mock;
const authFetchMock = authFetch as Mock;
const readResponseErrorMock = readResponseError as Mock;
const syncOfflineDiarySnapshotMock = syncOfflineDiarySnapshot as Mock;
const syncOfflineDocketDraftMock = syncOfflineDocketDraft as Mock;
const devWarnMock = devWarn as Mock;

function queueItem(overrides: { type: string; id?: number; data?: unknown }): SyncQueueItem {
  return {
    id: 1,
    action: 'update',
    data: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    attempts: 0,
    ...overrides,
  } as unknown as SyncQueueItem;
}

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, text: string): Response {
  return new Response(text, { status });
}

// The photo_upload executor reads its in-memory base64 dataUrl via the global
// `fetch` (NOT authFetch) and calls `.blob()` on it. jsdom's Blob lacks a
// `.stream()` method, so wrapping a real Blob in a real Response throws; mirror
// the characterization suite and return a minimal stub exposing only the
// `.blob()` the worker uses.
const globalFetchMock = vi.fn();

beforeEach(() => {
  readResponseErrorMock.mockImplementation(async (response: Response) => response.text());
  const blob = new Blob(['x'], { type: 'image/jpeg' });
  globalFetchMock.mockResolvedValue({ blob: async () => blob } as unknown as Response);
  vi.stubGlobal('fetch', globalFetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('syncSingleItem — itp_completion', () => {
  it('returns "synced" and removes + marks the completion on the 2-step success path', async () => {
    authFetchMock
      .mockResolvedValueOnce(okJson({ instance: { id: 'inst-1' } }))
      .mockResolvedValueOnce(okJson({ ok: true }));

    const result = await syncSingleItem(
      queueItem({
        id: 11,
        type: 'itp_completion',
        data: { lotId: 'lot-1', checklistItemId: 'ci-1', status: 'completed' },
      }),
    );

    expect(result).toEqual({ status: 'synced' });
    expect(authFetchMock).toHaveBeenNthCalledWith(1, '/api/itp/instances/lot/lot-1');
    expect(JSON.parse(authFetchMock.mock.calls[1][1].body)).toEqual({
      itpInstanceId: 'inst-1',
      checklistItemId: 'ci-1',
      isCompleted: true,
      status: undefined,
      notes: undefined,
    });
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(11);
    expect(markCompletionSyncedMock).toHaveBeenCalledWith('lot-1', 'ci-1');
  });

  it("maps 'na' -> not_applicable and 'failed' -> failed", async () => {
    authFetchMock
      .mockResolvedValueOnce(okJson({ instance: { id: 'i' } }))
      .mockResolvedValueOnce(okJson({ ok: true }));
    await syncSingleItem(
      queueItem({
        id: 11,
        type: 'itp_completion',
        data: { lotId: 'l', checklistItemId: 'c', status: 'na' },
      }),
    );
    expect(JSON.parse(authFetchMock.mock.calls[1][1].body)).toMatchObject({
      isCompleted: false,
      status: 'not_applicable',
    });

    authFetchMock.mockClear();
    authFetchMock
      .mockResolvedValueOnce(okJson({ instance: { id: 'i' } }))
      .mockResolvedValueOnce(okJson({ ok: true }));
    await syncSingleItem(
      queueItem({
        id: 11,
        type: 'itp_completion',
        data: { lotId: 'l', checklistItemId: 'c', status: 'failed' },
      }),
    );
    expect(JSON.parse(authFetchMock.mock.calls[1][1].body)).toMatchObject({
      isCompleted: false,
      status: 'failed',
    });
  });

  it('returns "handled" and error-marks (no removal) when the instance lookup fails', async () => {
    authFetchMock.mockResolvedValueOnce(errorResponse(500, 'boom'));

    const result = await syncSingleItem(
      queueItem({
        id: 11,
        type: 'itp_completion',
        data: { lotId: 'l', checklistItemId: 'c', status: 'completed' },
      }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(11, 'Could not find ITP instance for lot');
    expect(authFetchMock).toHaveBeenCalledTimes(1);
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
  });

  it('error-marks with the response text when the completion POST is not ok', async () => {
    authFetchMock
      .mockResolvedValueOnce(okJson({ instance: { id: 'i' } }))
      .mockResolvedValueOnce(errorResponse(422, 'validation failed'));

    const result = await syncSingleItem(
      queueItem({
        id: 11,
        type: 'itp_completion',
        data: { lotId: 'l', checklistItemId: 'c', status: 'completed' },
      }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(11, 'validation failed');
    expect(markCompletionSyncedMock).not.toHaveBeenCalled();
  });

  it('catches a thrown error via the shared runSyncStep wrapper', async () => {
    authFetchMock.mockRejectedValueOnce(new Error('network down'));

    const result = await syncSingleItem(
      queueItem({
        id: 11,
        type: 'itp_completion',
        data: { lotId: 'l', checklistItemId: 'c', status: 'completed' },
      }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(11, 'network down');
  });
});

describe('syncSingleItem — diary', () => {
  it('diary_save returns "synced", removes the item and marks the diary synced', async () => {
    diariesGetMock.mockResolvedValue({ id: 'd-1' });
    syncOfflineDiarySnapshotMock.mockResolvedValue('server-d-1');

    const result = await syncSingleItem(
      queueItem({ id: 21, type: 'diary_save', data: { diaryId: 'd-1' } }),
    );

    expect(result).toEqual({ status: 'synced' });
    expect(syncOfflineDiarySnapshotMock).toHaveBeenCalledWith({ id: 'd-1' });
    expect(authFetchMock).not.toHaveBeenCalled();
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(21);
    expect(markDiarySyncedMock).toHaveBeenCalledWith('d-1');
  });

  it('diary_submit POSTs /submit then returns "synced"', async () => {
    diariesGetMock.mockResolvedValue({ id: 'd-2' });
    syncOfflineDiarySnapshotMock.mockResolvedValue('server-d-2');
    authFetchMock.mockResolvedValue(okJson({ ok: true }));

    const result = await syncSingleItem(
      queueItem({ id: 21, type: 'diary_submit', data: { diaryId: 'd-2' } }),
    );

    expect(result).toEqual({ status: 'synced' });
    expect(authFetchMock).toHaveBeenCalledWith('/api/diary/server-d-2/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledgeWarnings: true }),
    });
    expect(markDiarySyncedMock).toHaveBeenCalledWith('d-2');
  });

  it('diary_submit swallows "Diary already submitted" as success', async () => {
    diariesGetMock.mockResolvedValue({ id: 'd-3' });
    syncOfflineDiarySnapshotMock.mockResolvedValue('server-d-3');
    authFetchMock.mockResolvedValue(errorResponse(409, 'Diary already submitted'));
    readResponseErrorMock.mockResolvedValue('Diary already submitted');

    const result = await syncSingleItem(
      queueItem({ id: 21, type: 'diary_submit', data: { diaryId: 'd-3' } }),
    );

    expect(result).toEqual({ status: 'synced' });
    expect(markSyncItemErrorMock).not.toHaveBeenCalled();
    expect(markDiarySyncErrorMock).not.toHaveBeenCalled();
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(21);
    expect(markDiarySyncedMock).toHaveBeenCalledWith('d-3');
  });

  it('diary_submit other error returns "handled" and error-marks item + diary', async () => {
    diariesGetMock.mockResolvedValue({ id: 'd-4' });
    syncOfflineDiarySnapshotMock.mockResolvedValue('server-d-4');
    authFetchMock.mockResolvedValue(errorResponse(400, 'missing weather'));
    readResponseErrorMock.mockResolvedValue('missing weather');

    const result = await syncSingleItem(
      queueItem({ id: 21, type: 'diary_submit', data: { diaryId: 'd-4' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(21, 'missing weather');
    expect(markDiarySyncErrorMock).toHaveBeenCalledWith('d-4');
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
  });

  it('removes the item (handled) when the diary no longer exists', async () => {
    diariesGetMock.mockResolvedValue(undefined);

    const result = await syncSingleItem(
      queueItem({ id: 21, type: 'diary_save', data: { diaryId: 'gone' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(21);
    expect(syncOfflineDiarySnapshotMock).not.toHaveBeenCalled();
  });

  it('catches a thrown snapshot error and marks item + diary', async () => {
    diariesGetMock.mockResolvedValue({ id: 'd-5' });
    syncOfflineDiarySnapshotMock.mockRejectedValue(new Error('activity post failed'));

    const result = await syncSingleItem(
      queueItem({ id: 21, type: 'diary_save', data: { diaryId: 'd-5' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(21, 'activity post failed');
    expect(markDiarySyncErrorMock).toHaveBeenCalledWith('d-5');
  });
});

describe('syncSingleItem — delivery_save / event_save (diary quick-add offline path)', () => {
  const deliveryRecord = {
    id: 'del-1',
    diaryId: 'server-d-1',
    description: '20t road base',
    supplier: 'Quarry Co',
    docketNumber: 'QC-441',
    quantity: 20,
    unit: 't',
    lotId: 'lot-1',
    notes: 'tipped at CH200',
    syncStatus: 'pending',
    localUpdatedAt: '2026-01-01T00:00:00.000Z',
  };

  const eventRecord = {
    id: 'evt-1',
    diaryId: 'server-d-1',
    eventType: 'inspection',
    description: 'Council walkover',
    notes: 'no issues raised',
    lotId: 'lot-2',
    syncStatus: 'pending',
    localUpdatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('delivery_save POSTs to the stored server diary id, returns "synced", removes + marks', async () => {
    diaryDeliveriesGetMock.mockResolvedValue(deliveryRecord);
    diariesGetMock.mockResolvedValue(undefined); // diaryId is already a server id
    authFetchMock.mockResolvedValue(okJson({ ok: true }));

    const result = await syncSingleItem(
      queueItem({ id: 81, type: 'delivery_save', data: { deliveryId: 'del-1' } }),
    );

    expect(result).toEqual({ status: 'synced' });
    expect(syncOfflineDiarySnapshotMock).not.toHaveBeenCalled();
    expect(authFetchMock).toHaveBeenCalledWith('/api/diary/server-d-1/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: '20t road base',
        supplier: 'Quarry Co',
        docketNumber: 'QC-441',
        quantity: 20,
        unit: 't',
        lotId: 'lot-1',
        notes: 'tipped at CH200',
      }),
    });
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(81);
    expect(markDeliverySyncedMock).toHaveBeenCalledWith('del-1');
  });

  it('delivery_save anchored to a LOCAL diary snapshot resolves the server id via the snapshot sync', async () => {
    diaryDeliveriesGetMock.mockResolvedValue({
      ...deliveryRecord,
      diaryId: 'diary-project-1-2026-06-09',
    });
    const localDiary = { id: 'diary-project-1-2026-06-09' };
    diariesGetMock.mockResolvedValue(localDiary);
    syncOfflineDiarySnapshotMock.mockResolvedValue('server-d-9');
    authFetchMock.mockResolvedValue(okJson({ ok: true }));

    const result = await syncSingleItem(
      queueItem({ id: 81, type: 'delivery_save', data: { deliveryId: 'del-1' } }),
    );

    expect(result).toEqual({ status: 'synced' });
    expect(syncOfflineDiarySnapshotMock).toHaveBeenCalledWith(localDiary);
    expect(authFetchMock.mock.calls[0][0]).toBe('/api/diary/server-d-9/deliveries');
    expect(markDeliverySyncedMock).toHaveBeenCalledWith('del-1');
  });

  it('delivery_save removes the item (handled) when the delivery no longer exists', async () => {
    diaryDeliveriesGetMock.mockResolvedValue(undefined);

    const result = await syncSingleItem(
      queueItem({ id: 81, type: 'delivery_save', data: { deliveryId: 'gone' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(81);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('delivery_save POST not ok -> error-marks item + delivery (handled, no removal)', async () => {
    diaryDeliveriesGetMock.mockResolvedValue(deliveryRecord);
    diariesGetMock.mockResolvedValue(undefined);
    authFetchMock.mockResolvedValue(errorResponse(422, 'invalid delivery'));

    const result = await syncSingleItem(
      queueItem({ id: 81, type: 'delivery_save', data: { deliveryId: 'del-1' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(81, 'invalid delivery');
    expect(markDeliverySyncErrorMock).toHaveBeenCalledWith('del-1');
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markDeliverySyncedMock).not.toHaveBeenCalled();
  });

  it('delivery_save catches a thrown error and marks item + delivery via the shared onError', async () => {
    diaryDeliveriesGetMock.mockResolvedValue(deliveryRecord);
    diariesGetMock.mockResolvedValue(undefined);
    authFetchMock.mockRejectedValue(new Error('network down'));

    const result = await syncSingleItem(
      queueItem({ id: 81, type: 'delivery_save', data: { deliveryId: 'del-1' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(81, 'network down');
    expect(markDeliverySyncErrorMock).toHaveBeenCalledWith('del-1');
  });

  it('event_save POSTs to /events, returns "synced", removes + marks', async () => {
    diaryEventsGetMock.mockResolvedValue(eventRecord);
    diariesGetMock.mockResolvedValue(undefined);
    authFetchMock.mockResolvedValue(okJson({ ok: true }));

    const result = await syncSingleItem(
      queueItem({ id: 82, type: 'event_save', data: { eventId: 'evt-1' } }),
    );

    expect(result).toEqual({ status: 'synced' });
    expect(authFetchMock).toHaveBeenCalledWith('/api/diary/server-d-1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'inspection',
        description: 'Council walkover',
        notes: 'no issues raised',
        lotId: 'lot-2',
      }),
    });
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(82);
    expect(markEventSyncedMock).toHaveBeenCalledWith('evt-1');
  });

  it('event_save removes the item (handled) when the event no longer exists', async () => {
    diaryEventsGetMock.mockResolvedValue(undefined);

    const result = await syncSingleItem(
      queueItem({ id: 82, type: 'event_save', data: { eventId: 'gone' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(82);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('event_save POST not ok -> error-marks item + event (handled, no removal)', async () => {
    diaryEventsGetMock.mockResolvedValue(eventRecord);
    diariesGetMock.mockResolvedValue(undefined);
    authFetchMock.mockResolvedValue(errorResponse(400, 'invalid event'));

    const result = await syncSingleItem(
      queueItem({ id: 82, type: 'event_save', data: { eventId: 'evt-1' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(82, 'invalid event');
    expect(markEventSyncErrorMock).toHaveBeenCalledWith('evt-1');
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markEventSyncedMock).not.toHaveBeenCalled();
  });
});

describe('syncSingleItem — docket', () => {
  it('docket_create drafts, returns "synced", removes + marks synced with the server id', async () => {
    docketsGetMock.mockResolvedValue({ id: 'dk-1' });
    syncOfflineDocketDraftMock.mockResolvedValue('server-dk-1');

    const result = await syncSingleItem(
      queueItem({ id: 31, type: 'docket_create', data: { docketId: 'dk-1' } }),
    );

    expect(result).toEqual({ status: 'synced' });
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(31);
    expect(markDocketSyncedMock).toHaveBeenCalledWith('dk-1', 'server-dk-1');
  });

  it('docket_create guards double-sync (serverId) -> "handled", error-marked, not re-created', async () => {
    docketsGetMock.mockResolvedValue({ id: 'dk-2', serverId: 'already' });

    const result = await syncSingleItem(
      queueItem({ id: 31, type: 'docket_create', data: { docketId: 'dk-2' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(
      31,
      'This offline docket is already synced. Open it online to make further changes.',
    );
    expect(markDocketSyncErrorMock).toHaveBeenCalledWith('dk-2');
    expect(syncOfflineDocketDraftMock).not.toHaveBeenCalled();
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
  });

  it('docket_submit deliberately does NOT auto-submit -> "handled", stores serverId + explanatory error', async () => {
    docketsGetMock.mockResolvedValue({ id: 'dk-3' });
    syncOfflineDocketDraftMock.mockResolvedValue('server-dk-3');

    const result = await syncSingleItem(
      queueItem({ id: 31, type: 'docket_submit', data: { docketId: 'dk-3' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markDocketServerIdMock).toHaveBeenCalledWith('dk-3', 'server-dk-3');
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(
      31,
      'Offline docket draft synced. Submission requires online review so labour, plant, and lot allocations can be validated before approval.',
    );
    expect(markDocketSyncErrorMock).toHaveBeenCalledWith('dk-3');
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markDocketSyncedMock).not.toHaveBeenCalled();
  });

  it('removes the item (handled) when the docket no longer exists', async () => {
    docketsGetMock.mockResolvedValue(undefined);

    const result = await syncSingleItem(
      queueItem({ id: 31, type: 'docket_create', data: { docketId: 'gone' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(31);
    expect(syncOfflineDocketDraftMock).not.toHaveBeenCalled();
  });

  it('catches a thrown draft error and marks item + docket', async () => {
    docketsGetMock.mockResolvedValue({ id: 'dk-4' });
    syncOfflineDocketDraftMock.mockRejectedValue(new Error('docket post failed'));

    const result = await syncSingleItem(
      queueItem({ id: 31, type: 'docket_create', data: { docketId: 'dk-4' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(31, 'docket post failed');
    expect(markDocketSyncErrorMock).toHaveBeenCalledWith('dk-4');
  });
});

describe('syncSingleItem — lot_conflict', () => {
  it('just removes the queue item (handled) and never error-marks it', async () => {
    const result = await syncSingleItem(
      queueItem({
        id: 61,
        type: 'lot_conflict',
        data: { lotId: 'l', lotNumber: 'L', projectId: 'p', message: 'm' },
      }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(61);
    expect(markSyncItemErrorMock).not.toHaveBeenCalled();
    expect(authFetchMock).not.toHaveBeenCalled();
  });
});

describe('syncSingleItem — photo_upload (Slice 3, moved from the hook)', () => {
  const photoRecord = {
    dataUrl: 'data:image/jpeg;base64,abc',
    fileName: 'site.jpg',
    projectId: 'proj-1',
    lotId: 'lot-1',
    documentType: 'photo',
    category: 'progress',
    entityType: 'lot',
    entityId: 'ent-1',
    caption: 'a caption',
    tags: ['t1', 't2'],
    gpsLatitude: -33.8,
    gpsLongitude: 151.2,
    capturedAt: '2026-01-01T00:00:00.000Z',
  };

  it('reads the dataUrl blob, POSTs multipart, returns "synced" and marks the photo', async () => {
    getOfflinePhotoMock.mockResolvedValue(photoRecord);
    authFetchMock.mockResolvedValue(okJson({ document: { id: 'doc-9' } }));

    const result = await syncSingleItem(
      queueItem({ id: 41, type: 'photo_upload', data: { photoId: 'ph-1' } }),
    );

    expect(result).toEqual({ status: 'synced' });
    // The in-memory dataUrl is read via the global fetch, not authFetch.
    expect(globalFetchMock).toHaveBeenCalledWith('data:image/jpeg;base64,abc');
    // Uploaded via authFetch to the documents endpoint as multipart FormData.
    expect(authFetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = authFetchMock.mock.calls[0];
    expect(url).toBe('/api/documents/upload');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    const fd = options.body as FormData;
    expect(fd.get('projectId')).toBe('proj-1');
    expect(fd.get('lotId')).toBe('lot-1');
    expect(fd.get('documentType')).toBe('photo');
    expect(fd.get('category')).toBe('progress');
    expect(fd.get('entityType')).toBe('lot');
    expect(fd.get('entityId')).toBe('ent-1');
    expect(fd.get('caption')).toBe('a caption');
    expect(fd.get('tags')).toBe(JSON.stringify(['t1', 't2']));
    expect(fd.get('gpsLatitude')).toBe('-33.8');
    expect(fd.get('gpsLongitude')).toBe('151.2');
    expect(fd.get('capturedAt')).toBe('2026-01-01T00:00:00.000Z');

    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(41);
    expect(markPhotoSyncedMock).toHaveBeenCalledWith('ph-1', 'doc-9');
  });

  it('omits optional GPS fields when undefined', async () => {
    getOfflinePhotoMock.mockResolvedValue({
      dataUrl: 'data:image/jpeg;base64,abc',
      fileName: 'site.jpg',
      projectId: 'proj-1',
      documentType: 'photo',
      entityType: 'lot',
      capturedAt: '2026-01-01T00:00:00.000Z',
      // no lotId/category/entityId/caption/tags/gps*
    });
    authFetchMock.mockResolvedValue(okJson({ document: { id: 'doc-9' } }));

    await syncSingleItem(queueItem({ id: 41, type: 'photo_upload', data: { photoId: 'ph-1' } }));

    const fd = authFetchMock.mock.calls[0][1].body as FormData;
    expect(fd.has('gpsLatitude')).toBe(false);
    expect(fd.has('gpsLongitude')).toBe(false);
    expect(fd.has('lotId')).toBe(false);
    expect(fd.has('category')).toBe(false);
  });

  it('removes the item (handled) when the photo no longer exists', async () => {
    getOfflinePhotoMock.mockResolvedValue(undefined);

    const result = await syncSingleItem(
      queueItem({ id: 41, type: 'photo_upload', data: { photoId: 'gone' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(41);
    expect(globalFetchMock).not.toHaveBeenCalled();
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('error-marks item + photo (handled, no removal) when the upload is not ok', async () => {
    getOfflinePhotoMock.mockResolvedValue(photoRecord);
    authFetchMock.mockResolvedValue(errorResponse(500, 'upload boom'));

    const result = await syncSingleItem(
      queueItem({ id: 41, type: 'photo_upload', data: { photoId: 'ph-1' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(41, 'upload boom');
    expect(markPhotoSyncErrorMock).toHaveBeenCalledWith('ph-1');
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markPhotoSyncedMock).not.toHaveBeenCalled();
  });

  it('catches a thrown error and marks item + photo via the shared onError', async () => {
    getOfflinePhotoMock.mockResolvedValue(photoRecord);
    authFetchMock.mockRejectedValue(new Error('network down'));

    const result = await syncSingleItem(
      queueItem({ id: 41, type: 'photo_upload', data: { photoId: 'ph-1' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(41, 'network down');
    expect(markPhotoSyncErrorMock).toHaveBeenCalledWith('ph-1');
  });
});

describe('syncSingleItem — lot_edit (Slice 3, moved from the hook)', () => {
  const lotRecord = { lotNumber: 'L-100', syncStatus: 'pending' };

  it('no conflict -> PATCHes via buildOfflineLotEditPayload, returns "synced", marks the lot', async () => {
    getOfflineLotMock.mockResolvedValue(lotRecord);
    detectLotSyncConflictMock.mockResolvedValue({ hasConflict: false });
    authFetchMock
      .mockResolvedValueOnce(okJson({ lot: { updatedAt: '2026-02-02T00:00:00.000Z' } })) // GET
      .mockResolvedValueOnce(okJson({ lot: { updatedAt: '2026-03-03T00:00:00.000Z' } })); // PATCH

    const result = await syncSingleItem(
      queueItem({ id: 51, type: 'lot_edit', data: { lotId: 'lot-1' } }),
    );

    expect(result).toEqual({ status: 'synced' });
    expect(authFetchMock).toHaveBeenNthCalledWith(1, '/api/lots/lot-1', { method: 'GET' });
    const patchCall = authFetchMock.mock.calls[1];
    expect(patchCall[0]).toBe('/api/lots/lot-1');
    expect(patchCall[1].method).toBe('PATCH');
    expect(buildOfflineLotEditPayloadMock).toHaveBeenCalledWith(lotRecord);
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(51);
    expect(markLotSyncedMock).toHaveBeenCalledWith('lot-1', '2026-03-03T00:00:00.000Z');
  });

  it('maps server budgetAmount into the internal budget field for conflict detection', async () => {
    getOfflineLotMock.mockResolvedValue(lotRecord);
    detectLotSyncConflictMock.mockResolvedValue({ hasConflict: false });
    authFetchMock
      .mockResolvedValueOnce(
        okJson({
          lot: {
            updatedAt: '2026-02-02T00:00:00.000Z',
            lotNumber: 'L-100',
            budgetAmount: 12345,
            chainageStart: 'CH1',
          },
        }),
      )
      .mockResolvedValueOnce(okJson({ lot: { updatedAt: '2026-03-03T00:00:00.000Z' } }));

    await syncSingleItem(queueItem({ id: 51, type: 'lot_edit', data: { lotId: 'lot-1' } }));

    expect(detectLotSyncConflictMock).toHaveBeenCalledWith(
      'lot-1',
      expect.objectContaining({
        updatedAt: '2026-02-02T00:00:00.000Z',
        lotNumber: 'L-100',
        chainageStart: 'CH1',
        budget: 12345,
      }),
    );
  });

  it('conflict detected -> fires onConflictDetected, removes item, NO PATCH, returns "handled"', async () => {
    getOfflineLotMock.mockResolvedValue(lotRecord);
    detectLotSyncConflictMock.mockResolvedValue({ hasConflict: true });
    authFetchMock.mockResolvedValueOnce(okJson({ lot: { updatedAt: 'x' } })); // GET only
    const onConflictDetected = vi.fn();

    const result = await syncSingleItem(
      queueItem({ id: 51, type: 'lot_edit', data: { lotId: 'lot-1' } }),
      { onConflictDetected },
    );

    expect(result).toEqual({ status: 'handled' });
    expect(onConflictDetected).toHaveBeenCalledWith(
      'lot-1',
      'L-100',
      'Sync conflict detected for lot L-100. Another user edited this lot while you were offline.',
    );
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(51);
    // Only the GET ran; no PATCH.
    expect(authFetchMock).toHaveBeenCalledTimes(1);
    expect(markLotSyncedMock).not.toHaveBeenCalled();
  });

  it("stale-skip: removes the item (handled) when the lot is already 'conflict'", async () => {
    getOfflineLotMock.mockResolvedValue({ lotNumber: 'L-100', syncStatus: 'conflict' });

    const result = await syncSingleItem(
      queueItem({ id: 51, type: 'lot_edit', data: { lotId: 'lot-1' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(51);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it("stale-skip: removes the item (handled) when the lot is already 'synced'", async () => {
    getOfflineLotMock.mockResolvedValue({ lotNumber: 'L-100', syncStatus: 'synced' });

    const result = await syncSingleItem(
      queueItem({ id: 51, type: 'lot_edit', data: { lotId: 'lot-1' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(51);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it("forceOverwrite bypasses both the stale-skip and the conflict check, PATCHing 'synced' lots", async () => {
    getOfflineLotMock.mockResolvedValue({ lotNumber: 'L-100', syncStatus: 'synced' });
    authFetchMock
      .mockResolvedValueOnce(okJson({ lot: { updatedAt: 'x' } })) // GET
      .mockResolvedValueOnce(okJson({ lot: { updatedAt: '2026-03-03T00:00:00.000Z' } })); // PATCH

    const result = await syncSingleItem(
      queueItem({ id: 51, type: 'lot_edit', data: { lotId: 'lot-1', forceOverwrite: true } }),
    );

    expect(result).toEqual({ status: 'synced' });
    expect(detectLotSyncConflictMock).not.toHaveBeenCalled();
    expect(markLotSyncedMock).toHaveBeenCalledWith('lot-1', '2026-03-03T00:00:00.000Z');
  });

  it('removes the item (handled) when the lot no longer exists', async () => {
    getOfflineLotMock.mockResolvedValue(undefined);

    const result = await syncSingleItem(
      queueItem({ id: 51, type: 'lot_edit', data: { lotId: 'gone' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(51);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('GET not ok -> error-marks item + lot (handled, no removal, no PATCH)', async () => {
    getOfflineLotMock.mockResolvedValue(lotRecord);
    authFetchMock.mockResolvedValueOnce(errorResponse(404, 'lot gone server-side'));

    const result = await syncSingleItem(
      queueItem({ id: 51, type: 'lot_edit', data: { lotId: 'lot-1' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(51, 'lot gone server-side');
    expect(markLotSyncErrorMock).toHaveBeenCalledWith('lot-1');
    expect(authFetchMock).toHaveBeenCalledTimes(1);
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
  });

  it('PATCH not ok -> error-marks item + lot (handled, no removal)', async () => {
    getOfflineLotMock.mockResolvedValue(lotRecord);
    detectLotSyncConflictMock.mockResolvedValue({ hasConflict: false });
    authFetchMock
      .mockResolvedValueOnce(okJson({ lot: { updatedAt: 'x' } })) // GET
      .mockResolvedValueOnce(errorResponse(422, 'invalid patch')); // PATCH

    const result = await syncSingleItem(
      queueItem({ id: 51, type: 'lot_edit', data: { lotId: 'lot-1' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(51, 'invalid patch');
    expect(markLotSyncErrorMock).toHaveBeenCalledWith('lot-1');
    expect(markLotSyncedMock).not.toHaveBeenCalled();
  });

  it('catches a thrown error and marks item + lot via the shared onError', async () => {
    getOfflineLotMock.mockResolvedValue(lotRecord);
    authFetchMock.mockRejectedValueOnce(new Error('network down'));

    const result = await syncSingleItem(
      queueItem({ id: 51, type: 'lot_edit', data: { lotId: 'lot-1' } }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(51, 'network down');
    expect(markLotSyncErrorMock).toHaveBeenCalledWith('lot-1');
  });
});

describe('syncSingleItem — unknown-type GC (invariant 8)', () => {
  it('removes an unrecognized type and warns', async () => {
    const result = await syncSingleItem(queueItem({ id: 71, type: 'totally_unknown', data: {} }));

    expect(result).toEqual({ status: 'handled' });
    expect(devWarnMock).toHaveBeenCalledWith(
      '[Sync] Removing unknown item type:',
      'totally_unknown',
    );
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(71);
  });

  it('no longer GCs delivery_save / event_save — they have real executors now', async () => {
    // These union members used to be branch-less and fell through to the
    // unknown-type sweep (queued entries silently discarded). They are now
    // dispatched to their executors; the GC sweep must never see them.
    diaryDeliveriesGetMock.mockResolvedValue(undefined);
    await syncSingleItem(
      queueItem({ id: 72, type: 'delivery_save', data: { deliveryId: 'del-1' } }),
    );
    expect(devWarnMock).not.toHaveBeenCalledWith(
      '[Sync] Removing unknown item type:',
      'delivery_save',
    );

    diaryEventsGetMock.mockResolvedValue(undefined);
    await syncSingleItem(queueItem({ id: 73, type: 'event_save', data: { eventId: 'evt-1' } }));
    expect(devWarnMock).not.toHaveBeenCalledWith(
      '[Sync] Removing unknown item type:',
      'event_save',
    );
  });

  it('does not GC a known type (returns handled without removing) — itp with no id falls through', async () => {
    // An itp_completion item missing its id does not match the id-guarded
    // branch; because itp_completion is on KNOWN_TYPES it is NOT GC'd either.
    const result = await syncSingleItem(
      queueItem({ type: 'itp_completion', id: undefined, data: {} }),
    );

    expect(result).toEqual({ status: 'handled' });
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(devWarnMock).not.toHaveBeenCalled();
  });
});
