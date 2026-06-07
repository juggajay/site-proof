// Focused unit tests for offline/syncWorker.ts — the per-item dispatcher and
// the low-risk per-type executors extracted from useOfflineStatus.ts (Slice 2).
//
// These complement the hook-level characterization suite (useOfflineStatus.test.tsx):
// here we call `syncSingleItem(item)` directly with the module boundaries mocked,
// asserting the returned SyncItemResult status AND the marker/fetch side effects
// for each executor. The hook tests prove the loop integrates this correctly;
// these prove the executors in isolation, including the `deferred` seam that
// keeps photo_upload and lot_edit running inline in the hook for now.

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../offlineDb', () => ({
  removeSyncQueueItem: vi.fn(),
  markSyncItemError: vi.fn(),
  markCompletionSynced: vi.fn(),
  markDiarySynced: vi.fn(),
  markDiarySyncError: vi.fn(),
  markDocketSynced: vi.fn(),
  markDocketServerId: vi.fn(),
  markDocketSyncError: vi.fn(),
  offlineDb: {
    diaries: { get: vi.fn() },
    dockets: { get: vi.fn() },
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

vi.mock('../logger', () => ({
  devWarn: vi.fn(),
}));

import {
  removeSyncQueueItem,
  markSyncItemError,
  markCompletionSynced,
  markDiarySynced,
  markDiarySyncError,
  markDocketSynced,
  markDocketServerId,
  markDocketSyncError,
  offlineDb,
  type SyncQueueItem,
} from '../offlineDb';
import { authFetch } from '../api';
import { readResponseError, syncOfflineDiarySnapshot, syncOfflineDocketDraft } from './syncClient';
import { devWarn } from '../logger';
import { syncSingleItem } from './syncWorker';

const removeSyncQueueItemMock = removeSyncQueueItem as Mock;
const markSyncItemErrorMock = markSyncItemError as Mock;
const markCompletionSyncedMock = markCompletionSynced as Mock;
const markDiarySyncedMock = markDiarySynced as Mock;
const markDiarySyncErrorMock = markDiarySyncError as Mock;
const markDocketSyncedMock = markDocketSynced as Mock;
const markDocketServerIdMock = markDocketServerId as Mock;
const markDocketSyncErrorMock = markDocketSyncError as Mock;
const diariesGetMock = offlineDb.diaries.get as unknown as Mock;
const docketsGetMock = offlineDb.dockets.get as unknown as Mock;
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

beforeEach(() => {
  readResponseErrorMock.mockImplementation(async (response: Response) => response.text());
});

afterEach(() => {
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

describe('syncSingleItem — deferred seam (photo_upload, lot_edit stay in the hook)', () => {
  it('returns "deferred" for photo_upload without touching it', async () => {
    const result = await syncSingleItem(
      queueItem({ id: 41, type: 'photo_upload', data: { photoId: 'ph-1' } }),
    );

    expect(result).toEqual({ status: 'deferred' });
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markSyncItemErrorMock).not.toHaveBeenCalled();
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('returns "deferred" for lot_edit without touching it', async () => {
    const result = await syncSingleItem(
      queueItem({ id: 51, type: 'lot_edit', data: { lotId: 'lot-1' } }),
    );

    expect(result).toEqual({ status: 'deferred' });
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(authFetchMock).not.toHaveBeenCalled();
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

  it('GCs the branch-less delivery_save / event_save union members (pinned latent gap)', async () => {
    await syncSingleItem(
      queueItem({ id: 72, type: 'delivery_save', data: { deliveryId: 'del-1' } }),
    );
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(72);
    expect(devWarnMock).toHaveBeenCalledWith('[Sync] Removing unknown item type:', 'delivery_save');

    await syncSingleItem(queueItem({ id: 73, type: 'event_save', data: { eventId: 'evt-1' } }));
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(73);
    expect(devWarnMock).toHaveBeenCalledWith('[Sync] Removing unknown item type:', 'event_save');
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
