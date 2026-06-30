// Characterization tests for the offline sync worker loop in useOfflineStatus.ts.
//
// This file pins the CURRENT end-to-end behavior of the
// `runExclusiveOfflineSync(async () => {...})` worker callback (the codebase's
// most complex untested function). It is the regression net for the planned
// `offline/syncWorker.ts` extraction (see
// .gstack/dev-browser/offline-worker-restructure-plan-2026-06-07.md): each test
// maps to an invariant in that plan's "Invariants from bugfix history" and
// "Test coverage gaps" sections.
//
// Strategy (mirrors the house recipe in useEffectiveProjectId.test.ts /
// useEmailPreferences.test.tsx): mock only the module boundaries the worker
// talks to, keep the worker loop itself real. We mock `runExclusiveOfflineSync`
// to invoke the worker directly (the lock/coalesce primitive is already
// characterized in offline/syncClient.test.ts), so each test exercises the
// dispatch + per-type branches without the Web Locks machinery. The hook is
// driven via `renderHook` and the returned `syncPendingChanges` callback.
//
// No real network, no real IndexedDB, no fake-IndexedDB harness: the offlineDb
// queue API and the per-entity status markers are mocked functions. Determinism
// is preserved with fake timers (neutralizing the 5s count poll and the 1s
// auto-sync debounce) so only the explicit `syncPendingChanges()` call drives
// the worker.

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// --- Module boundary mocks -------------------------------------------------

// The whole offlineDb facade: the generic queue API, the per-entity status
// markers, and the Dexie-backed `offlineDb.diaries.get` / `offlineDb.dockets.get`
// reads the worker performs inline. MAX_SYNC_ATTEMPTS keeps its real value (5)
// so the dead-letter threshold under test matches production.
vi.mock('./offlineDb', () => ({
  MAX_SYNC_ATTEMPTS: 5,
  getPendingSyncItems: vi.fn(),
  removeSyncQueueItem: vi.fn(),
  markSyncItemError: vi.fn(),
  markSyncItemTerminalError: vi.fn(),
  markCompletionSynced: vi.fn(),
  reconcileItpCompletionFromServer: vi.fn(),
  getOfflinePhoto: vi.fn(),
  markPhotoSynced: vi.fn(),
  markPhotoSyncError: vi.fn(),
  markDiarySynced: vi.fn(),
  markDiarySyncError: vi.fn(),
  markDeliverySynced: vi.fn(),
  markDeliverySyncError: vi.fn(),
  markEventSynced: vi.fn(),
  markEventSyncError: vi.fn(),
  markDocketSynced: vi.fn(),
  markDocketServerId: vi.fn(),
  markDocketSyncError: vi.fn(),
  getOfflineLot: vi.fn(),
  detectLotSyncConflict: vi.fn(),
  markLotSynced: vi.fn(),
  markLotSyncError: vi.fn(),
  getConflictedLotsCount: vi.fn(),
  getLiveSyncCount: vi.fn(),
  getFailedSyncCount: vi.fn(),
  getOldestPendingItemAge: vi.fn(),
  resetFailedSyncItems: vi.fn(),
  offlineDb: {
    diaries: { get: vi.fn() },
    dockets: { get: vi.fn() },
    diaryDeliveries: { get: vi.fn() },
    diaryEvents: { get: vi.fn() },
  },
}));

// The sync-client primitives. We pass `runExclusiveOfflineSync` straight through
// to the worker so the loop runs once per sync call (the lock/coalesce behavior
// is owned by offline/syncClient.test.ts). The multi-POST diary/docket builders
// are mocked so we can pin the worker's use of their return value and failures.
vi.mock('./offline/syncClient', () => ({
  runExclusiveOfflineSync: vi.fn(async (worker: () => Promise<unknown>) => worker()),
  readResponseError: vi.fn(async (response: Response) => response.text()),
  syncOfflineDiarySnapshot: vi.fn(),
  syncOfflineDocketDraft: vi.fn(),
}));

vi.mock('./offline/syncPayloads', () => ({
  buildOfflineLotEditPayload: vi.fn((lot: { lotNumber: string }) => ({
    lotNumber: lot.lotNumber,
    budgetAmount: undefined,
  })),
}));

// apiUrl is a passthrough so assertions can match readable paths; authFetch is
// the single HTTP boundary the worker uses for everything except the photo
// dataUrl read (which goes through the global `fetch`).
vi.mock('./api', () => ({
  apiUrl: vi.fn((path: string) => path),
  authFetch: vi.fn(),
}));

vi.mock('./logger', () => ({
  devLog: vi.fn(),
  devWarn: vi.fn(),
}));

import {
  getPendingSyncItems,
  removeSyncQueueItem,
  markSyncItemError,
  markSyncItemTerminalError,
  markCompletionSynced,
  reconcileItpCompletionFromServer,
  getOfflinePhoto,
  markPhotoSynced,
  markPhotoSyncError,
  markDiarySynced,
  markDiarySyncError,
  markDeliverySynced,
  markEventSynced,
  markDocketSynced,
  markDocketServerId,
  markDocketSyncError,
  getOfflineLot,
  detectLotSyncConflict,
  markLotSynced,
  markLotSyncError,
  getConflictedLotsCount,
  getLiveSyncCount,
  getFailedSyncCount,
  getOldestPendingItemAge,
  offlineDb,
  type SyncQueueItem,
} from './offlineDb';
import { authFetch } from './api';
import {
  readResponseError,
  syncOfflineDiarySnapshot,
  syncOfflineDocketDraft,
} from './offline/syncClient';
import { MISSING_OFFLINE_DIARY_SUBMIT_SNAPSHOT_MESSAGE } from './offline/diaryMessages';
import { buildOfflineLotEditPayload } from './offline/syncPayloads';
import { devWarn } from './logger';
import { useOfflineStatus, type SyncCallbacks } from './useOfflineStatus';

// --- Typed mock handles ----------------------------------------------------

const getPendingSyncItemsMock = getPendingSyncItems as Mock;
const removeSyncQueueItemMock = removeSyncQueueItem as Mock;
const markSyncItemErrorMock = markSyncItemError as Mock;
const markSyncItemTerminalErrorMock = markSyncItemTerminalError as Mock;
const markCompletionSyncedMock = markCompletionSynced as Mock;
const reconcileItpCompletionFromServerMock = reconcileItpCompletionFromServer as Mock;
const getOfflinePhotoMock = getOfflinePhoto as Mock;
const markPhotoSyncedMock = markPhotoSynced as Mock;
const markPhotoSyncErrorMock = markPhotoSyncError as Mock;
const markDiarySyncedMock = markDiarySynced as Mock;
const markDiarySyncErrorMock = markDiarySyncError as Mock;
const markDeliverySyncedMock = markDeliverySynced as Mock;
const markEventSyncedMock = markEventSynced as Mock;
const markDocketSyncedMock = markDocketSynced as Mock;
const markDocketServerIdMock = markDocketServerId as Mock;
const markDocketSyncErrorMock = markDocketSyncError as Mock;
const getOfflineLotMock = getOfflineLot as Mock;
const detectLotSyncConflictMock = detectLotSyncConflict as Mock;
const markLotSyncedMock = markLotSynced as Mock;
const markLotSyncErrorMock = markLotSyncError as Mock;
const getConflictedLotsCountMock = getConflictedLotsCount as Mock;
const getLiveSyncCountMock = getLiveSyncCount as Mock;
const getFailedSyncCountMock = getFailedSyncCount as Mock;
const getOldestPendingItemAgeMock = getOldestPendingItemAge as Mock;
const diariesGetMock = offlineDb.diaries.get as unknown as Mock;
const docketsGetMock = offlineDb.dockets.get as unknown as Mock;
const diaryDeliveriesGetMock = offlineDb.diaryDeliveries.get as unknown as Mock;
const diaryEventsGetMock = offlineDb.diaryEvents.get as unknown as Mock;
const authFetchMock = authFetch as Mock;
const readResponseErrorMock = readResponseError as Mock;
const syncOfflineDiarySnapshotMock = syncOfflineDiarySnapshot as Mock;
const syncOfflineDocketDraftMock = syncOfflineDocketDraft as Mock;
const buildOfflineLotEditPayloadMock = buildOfflineLotEditPayload as Mock;
const devWarnMock = devWarn as Mock;

// --- Helpers ---------------------------------------------------------------

// Build a queue item with sensible defaults. The parameter is intentionally
// loose (not the SyncQueueItem union) so tests can supply arbitrary type/data
// shapes — including unknown types — the way the real heterogeneous queue
// does. The cast happens once, here, at the boundary.
type QueueItemInput = {
  type: string;
  id?: number;
  action?: string;
  data?: unknown;
  createdAt?: string;
  attempts?: number;
  lastError?: string;
};

function queueItem(overrides: QueueItemInput): SyncQueueItem {
  return {
    id: 1,
    action: 'update',
    data: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    attempts: 0,
    ...overrides,
  } as unknown as SyncQueueItem;
}

// A successful JSON Response with `.ok === true`.
function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// A non-ok Response carrying a plain-text error body.
function errorResponse(status: number, text: string): Response {
  return new Response(text, { status });
}

// Render the hook with the worker enabled and the device online, run a single
// sync pass, and return the captured callbacks. The counts default to 0 so the
// auto-sync effect (gated on pendingSyncCount > 0) never fires on its own.
async function runSync(callbacks?: Partial<SyncCallbacks>) {
  const onConflictDetected = vi.fn();
  const onSyncComplete = vi.fn();

  const { result, unmount } = renderHook(() =>
    useOfflineStatus({
      enableSyncWorker: true,
      onConflictDetected,
      onSyncComplete,
      ...callbacks,
    }),
  );

  await act(async () => {
    await result.current.syncPendingChanges();
  });

  return { onConflictDetected, onSyncComplete, result, unmount };
}

beforeEach(() => {
  vi.useFakeTimers();
  // navigator.onLine is read once at mount; force it true so the worker runs.
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

  // Default: empty queue and zeroed counts. Individual tests override the queue.
  getPendingSyncItemsMock.mockResolvedValue([]);
  getLiveSyncCountMock.mockResolvedValue(0);
  getFailedSyncCountMock.mockResolvedValue(0);
  getConflictedLotsCountMock.mockResolvedValue(0);
  getOldestPendingItemAgeMock.mockResolvedValue(null);
});

afterEach(() => {
  // Flush any pending timers the hook scheduled, then restore real timers.
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ===========================================================================
// Invariant 1 — Dead-letter: items at attempts >= MAX_SYNC_ATTEMPTS are KEPT
// and skipped (never deleted, never re-attempted). Commit a2cea19 / #721.
// ===========================================================================
describe('dead-letter invariant (attempts >= MAX_SYNC_ATTEMPTS)', () => {
  it('skips a dead-lettered item without fetching, removing, or re-attempting it', async () => {
    getPendingSyncItemsMock.mockResolvedValue([
      queueItem({ id: 7, type: 'itp_completion', attempts: 5, data: { lotId: 'lot-1' } }),
    ]);

    await runSync();

    // No network, no delete, no error-mark: the item is left untouched in the
    // queue so the user can retry it later.
    expect(authFetchMock).not.toHaveBeenCalled();
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markSyncItemErrorMock).not.toHaveBeenCalled();
    // It is surfaced via a dev warning, not silently dropped.
    expect(devWarnMock).toHaveBeenCalledWith(
      '[Sync] Skipping item after max attempts:',
      'itp_completion',
      7,
    );
  });

  it('treats attempts beyond the threshold as dead too', async () => {
    getPendingSyncItemsMock.mockResolvedValue([
      queueItem({ id: 8, type: 'photo_upload', attempts: 9, data: { photoId: 'p-1' } }),
    ]);

    await runSync();

    expect(getOfflinePhotoMock).not.toHaveBeenCalled();
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
  });

  it('processes a live item that is one below the threshold', async () => {
    // attempts === 4 (< 5) must still be attempted.
    getPendingSyncItemsMock.mockResolvedValue([
      queueItem({ id: 9, type: 'itp_completion', attempts: 4, data: { lotId: 'lot-1' } }),
    ]);
    authFetchMock.mockResolvedValue(errorResponse(404, 'no instance'));

    await runSync();

    expect(authFetchMock).toHaveBeenCalledWith('/api/itp/instances/lot/lot-1');
  });
});

// ===========================================================================
// Invariant 2/3 (per-type dispatch + success path) — itp_completion
// ===========================================================================
describe('itp_completion dispatch', () => {
  const itpItem = (data: Record<string, unknown>) =>
    queueItem({ id: 11, type: 'itp_completion', attempts: 0, data });

  it('runs the 2-step flow and on success removes the item + marks the completion synced', async () => {
    getPendingSyncItemsMock.mockResolvedValue([
      itpItem({
        lotId: 'lot-1',
        checklistItemId: 'item-1',
        status: 'completed',
        notes: 'all good',
      }),
    ]);
    authFetchMock
      // Step 1: GET the ITP instance for the lot.
      .mockResolvedValueOnce(okJson({ instance: { id: 'instance-9' } }))
      // Step 2: POST the completion.
      .mockResolvedValueOnce(okJson({ ok: true }));

    const { onSyncComplete } = await runSync();

    // Step 1 hits the instance lookup; step 2 posts the completion with the
    // resolved instance id and isCompleted=true (status 'completed' → no
    // directStatus override).
    expect(authFetchMock).toHaveBeenNthCalledWith(1, '/api/itp/instances/lot/lot-1');
    expect(authFetchMock).toHaveBeenNthCalledWith(2, '/api/itp/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itpInstanceId: 'instance-9',
        checklistItemId: 'item-1',
        isCompleted: true,
        status: undefined,
        notes: 'all good',
      }),
    });
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(11);
    expect(markCompletionSyncedMock).toHaveBeenCalledWith('lot-1', 'item-1');
    expect(markSyncItemErrorMock).not.toHaveBeenCalled();
    // Tail tally fires with syncedCount > 0 and the current failedCount.
    expect(onSyncComplete).toHaveBeenCalledWith({ syncedCount: 1, failedCount: 0 });
  });

  it("maps status 'na' to not_applicable and 'failed' to failed in the POST body", async () => {
    getPendingSyncItemsMock.mockResolvedValue([
      itpItem({ lotId: 'lot-2', checklistItemId: 'item-2', status: 'na' }),
    ]);
    authFetchMock
      .mockResolvedValueOnce(okJson({ instance: { id: 'inst-na' } }))
      .mockResolvedValueOnce(okJson({ ok: true }));

    await runSync();

    const postBody = JSON.parse(authFetchMock.mock.calls[1][1].body);
    expect(postBody).toMatchObject({ isCompleted: false, status: 'not_applicable' });

    authFetchMock.mockClear();
    getPendingSyncItemsMock.mockResolvedValue([
      itpItem({ lotId: 'lot-3', checklistItemId: 'item-3', status: 'failed' }),
    ]);
    authFetchMock
      .mockResolvedValueOnce(okJson({ instance: { id: 'inst-fail' } }))
      .mockResolvedValueOnce(okJson({ ok: true }));

    await runSync();

    const failedBody = JSON.parse(authFetchMock.mock.calls[1][1].body);
    expect(failedBody).toMatchObject({ isCompleted: false, status: 'failed' });
  });

  it('marks an error and skips the POST when the ITP instance lookup is not ok', async () => {
    getPendingSyncItemsMock.mockResolvedValue([
      itpItem({ lotId: 'lot-4', checklistItemId: 'item-4', status: 'completed' }),
    ]);
    authFetchMock.mockResolvedValueOnce(errorResponse(500, 'boom'));

    await runSync();

    expect(markSyncItemErrorMock).toHaveBeenCalledWith(11, 'Could not find ITP instance for lot');
    // No completion POST, no removal, no synced mark.
    expect(authFetchMock).toHaveBeenCalledTimes(1);
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markCompletionSyncedMock).not.toHaveBeenCalled();
  });

  it('marks an error when the instance response has no instance id', async () => {
    getPendingSyncItemsMock.mockResolvedValue([
      itpItem({ lotId: 'lot-5', checklistItemId: 'item-5', status: 'completed' }),
    ]);
    authFetchMock.mockResolvedValueOnce(okJson({ instance: {} }));

    await runSync();

    expect(markSyncItemErrorMock).toHaveBeenCalledWith(11, 'No ITP instance found for lot');
  });

  it('dead-letters and reconciles from the server when the completion POST is terminally rejected', async () => {
    const serverCompletion = {
      checklistItemId: 'item-6',
      isFailed: true,
      notes: 'Server already failed',
      completedAt: '2026-06-13T01:02:03.000Z',
      completedBy: { fullName: 'QA Manager' },
    };
    getPendingSyncItemsMock.mockResolvedValue([
      itpItem({ lotId: 'lot-6', checklistItemId: 'item-6', status: 'completed' }),
    ]);
    authFetchMock
      .mockResolvedValueOnce(
        okJson({ instance: { id: 'inst-6', completions: [serverCompletion] } }),
      )
      .mockResolvedValueOnce(errorResponse(422, 'validation failed'));

    const { onSyncComplete } = await runSync();

    expect(reconcileItpCompletionFromServerMock).toHaveBeenCalledWith(
      'lot-6',
      'item-6',
      serverCompletion,
    );
    expect(markSyncItemTerminalErrorMock).toHaveBeenCalledWith(11, 'validation failed');
    expect(markSyncItemErrorMock).not.toHaveBeenCalled();
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markCompletionSyncedMock).not.toHaveBeenCalled();
    // syncedCount stayed 0, so the completion callback is suppressed.
    expect(onSyncComplete).not.toHaveBeenCalled();
  });

  it('catches a thrown error and marks the item error with the message', async () => {
    getPendingSyncItemsMock.mockResolvedValue([
      itpItem({ lotId: 'lot-7', checklistItemId: 'item-7', status: 'completed' }),
    ]);
    authFetchMock.mockRejectedValueOnce(new Error('network down'));

    await runSync();

    expect(markSyncItemErrorMock).toHaveBeenCalledWith(11, 'network down');
  });
});

// ===========================================================================
// Invariant 2/3/10 — diary_save / diary_submit
// ===========================================================================
describe('diary dispatch', () => {
  const diaryItem = (type: 'diary_save' | 'diary_submit', data: Record<string, unknown>) =>
    queueItem({ id: 21, type, attempts: 0, data });

  it('diary_save: snapshots the diary, removes the item, and marks the diary synced', async () => {
    getPendingSyncItemsMock.mockResolvedValue([diaryItem('diary_save', { diaryId: 'd-1' })]);
    diariesGetMock.mockResolvedValue({ id: 'd-1' });
    syncOfflineDiarySnapshotMock.mockResolvedValue('server-d-1');

    await runSync();

    expect(diariesGetMock).toHaveBeenCalledWith('d-1');
    expect(syncOfflineDiarySnapshotMock).toHaveBeenCalledWith({ id: 'd-1' });
    // diary_save does NOT call the /submit endpoint.
    expect(authFetchMock).not.toHaveBeenCalled();
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(21);
    expect(markDiarySyncedMock).toHaveBeenCalledWith('d-1');
  });

  it('diary_submit: snapshots then POSTs /submit, removes the item, and marks synced', async () => {
    getPendingSyncItemsMock.mockResolvedValue([diaryItem('diary_submit', { diaryId: 'd-2' })]);
    diariesGetMock.mockResolvedValue({ id: 'd-2' });
    syncOfflineDiarySnapshotMock.mockResolvedValue('server-d-2');
    authFetchMock.mockResolvedValue(okJson({ ok: true }));

    await runSync();

    expect(authFetchMock).toHaveBeenCalledWith('/api/diary/server-d-2/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledgeWarnings: true }),
    });
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(21);
    expect(markDiarySyncedMock).toHaveBeenCalledWith('d-2');
  });

  it('diary_submit: verified submitted server diary retry clears as synced', async () => {
    getPendingSyncItemsMock.mockResolvedValue([diaryItem('diary_submit', { diaryId: 'd-2b' })]);
    diariesGetMock.mockResolvedValue({
      id: 'd-2b',
      projectId: 'project-1',
      date: '2026-06-18',
      status: 'submitted',
    });
    syncOfflineDiarySnapshotMock.mockRejectedValue(new Error('Cannot modify submitted diary'));
    authFetchMock.mockResolvedValue(okJson({ id: 'server-d-2b', status: 'submitted' }));

    const { onSyncComplete } = await runSync();

    expect(authFetchMock).toHaveBeenCalledWith('/api/diary/project-1/2026-06-18?missing=null');
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(21);
    expect(markDiarySyncedMock).toHaveBeenCalledWith('d-2b');
    expect(markSyncItemTerminalErrorMock).not.toHaveBeenCalled();
    expect(markSyncItemErrorMock).not.toHaveBeenCalled();
    expect(markDiarySyncErrorMock).not.toHaveBeenCalled();
    expect(onSyncComplete).toHaveBeenCalledWith({ syncedCount: 1, failedCount: 0 });
  });

  it('diary_submit: dead-letters "Diary already submitted" instead of marking synced', async () => {
    getPendingSyncItemsMock.mockResolvedValue([diaryItem('diary_submit', { diaryId: 'd-3' })]);
    diariesGetMock.mockResolvedValue({ id: 'd-3' });
    syncOfflineDiarySnapshotMock.mockResolvedValue('server-d-3');
    authFetchMock.mockResolvedValue(errorResponse(409, 'Diary already submitted'));
    readResponseErrorMock.mockResolvedValue('Diary already submitted');

    await runSync();

    // The "already submitted" case means the local offline submit did not win.
    // Keep the queue item visible as failed instead of pretending it synced.
    expect(markSyncItemTerminalErrorMock).toHaveBeenCalledWith(21, 'Diary already submitted');
    expect(markSyncItemErrorMock).not.toHaveBeenCalled();
    expect(markDiarySyncErrorMock).toHaveBeenCalledWith('d-3');
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markDiarySyncedMock).not.toHaveBeenCalled();
  });

  it('diary_submit: submit validation errors are terminal and skip removal', async () => {
    getPendingSyncItemsMock.mockResolvedValue([diaryItem('diary_submit', { diaryId: 'd-4' })]);
    diariesGetMock.mockResolvedValue({ id: 'd-4' });
    syncOfflineDiarySnapshotMock.mockResolvedValue('server-d-4');
    authFetchMock.mockResolvedValue(errorResponse(400, 'missing weather'));
    readResponseErrorMock.mockResolvedValue('missing weather');

    await runSync();

    expect(markSyncItemTerminalErrorMock).toHaveBeenCalledWith(21, 'missing weather');
    expect(markSyncItemErrorMock).not.toHaveBeenCalled();
    expect(markDiarySyncErrorMock).toHaveBeenCalledWith('d-4');
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markDiarySyncedMock).not.toHaveBeenCalled();
  });

  it('diary_submit: retriable /submit errors use the normal retry path', async () => {
    getPendingSyncItemsMock.mockResolvedValue([diaryItem('diary_submit', { diaryId: 'd-4b' })]);
    diariesGetMock.mockResolvedValue({ id: 'd-4b' });
    syncOfflineDiarySnapshotMock.mockResolvedValue('server-d-4b');
    authFetchMock.mockResolvedValue(errorResponse(500, 'server unavailable'));
    readResponseErrorMock.mockResolvedValue('server unavailable');

    await runSync();

    expect(markSyncItemErrorMock).toHaveBeenCalledWith(21, 'server unavailable');
    expect(markSyncItemTerminalErrorMock).not.toHaveBeenCalled();
    expect(markDiarySyncErrorMock).toHaveBeenCalledWith('d-4b');
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markDiarySyncedMock).not.toHaveBeenCalled();
  });

  it('removes the queue item (and continues) when the diary no longer exists locally', async () => {
    getPendingSyncItemsMock.mockResolvedValue([diaryItem('diary_save', { diaryId: 'gone' })]);
    diariesGetMock.mockResolvedValue(undefined);

    await runSync();

    // Missing entity is benign cleanup, not an error.
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(21);
    expect(syncOfflineDiarySnapshotMock).not.toHaveBeenCalled();
    expect(markDiarySyncedMock).not.toHaveBeenCalled();
    expect(markSyncItemErrorMock).not.toHaveBeenCalled();
  });

  it('diary_submit: dead-letters when its offline snapshot no longer exists locally', async () => {
    getPendingSyncItemsMock.mockResolvedValue([
      diaryItem('diary_submit', { diaryId: 'missing-submit' }),
    ]);
    diariesGetMock.mockResolvedValue(undefined);

    const { onSyncComplete } = await runSync();

    expect(markSyncItemTerminalErrorMock).toHaveBeenCalledWith(
      21,
      MISSING_OFFLINE_DIARY_SUBMIT_SNAPSHOT_MESSAGE,
    );
    for (const sideEffect of [
      removeSyncQueueItemMock,
      syncOfflineDiarySnapshotMock,
      markDiarySyncedMock,
      markDiarySyncErrorMock,
    ]) {
      expect(sideEffect).not.toHaveBeenCalled();
    }
    expect(onSyncComplete).not.toHaveBeenCalled();
  });

  it('catches a thrown snapshot error and marks both the item and the diary error', async () => {
    getPendingSyncItemsMock.mockResolvedValue([diaryItem('diary_save', { diaryId: 'd-5' })]);
    diariesGetMock.mockResolvedValue({ id: 'd-5' });
    syncOfflineDiarySnapshotMock.mockRejectedValue(new Error('activity post failed'));

    await runSync();

    expect(markSyncItemErrorMock).toHaveBeenCalledWith(21, 'activity post failed');
    expect(markDiarySyncErrorMock).toHaveBeenCalledWith('d-5');
  });
});

// ===========================================================================
// Invariant 2/3/9/10 — docket_create / docket_submit
// ===========================================================================
describe('docket dispatch', () => {
  const docketSyncDisabledMessage =
    'Offline docket sync is disabled until labour, plant, rates, and lot allocations can be replayed safely. Recreate or finish this docket online.';
  const docketItem = (type: 'docket_create' | 'docket_submit', data: Record<string, unknown>) =>
    queueItem({ id: 31, type, attempts: 0, data });

  it('docket_create: marks an explanatory error instead of replaying a lossy draft', async () => {
    getPendingSyncItemsMock.mockResolvedValue([docketItem('docket_create', { docketId: 'dk-1' })]);
    docketsGetMock.mockResolvedValue({ id: 'dk-1' });

    await runSync();

    expect(markSyncItemErrorMock).toHaveBeenCalledWith(31, docketSyncDisabledMessage);
    expect(markDocketSyncErrorMock).toHaveBeenCalledWith('dk-1');
    expect(syncOfflineDocketDraftMock).not.toHaveBeenCalled();
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markDocketSyncedMock).not.toHaveBeenCalled();
  });

  it('docket_create: guards double-sync — an already-synced docket (serverId) is error-marked, not re-created', async () => {
    getPendingSyncItemsMock.mockResolvedValue([docketItem('docket_create', { docketId: 'dk-2' })]);
    docketsGetMock.mockResolvedValue({ id: 'dk-2', serverId: 'already-on-server' });

    await runSync();

    expect(markSyncItemErrorMock).toHaveBeenCalledWith(
      31,
      'This offline docket is already synced. Open it online to make further changes.',
    );
    expect(markDocketSyncErrorMock).toHaveBeenCalledWith('dk-2');
    // Guarded before any draft call or removal.
    expect(syncOfflineDocketDraftMock).not.toHaveBeenCalled();
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markDocketSyncedMock).not.toHaveBeenCalled();
  });

  it('docket_submit: marks an explanatory error instead of replaying a lossy submit', async () => {
    getPendingSyncItemsMock.mockResolvedValue([docketItem('docket_submit', { docketId: 'dk-3' })]);
    docketsGetMock.mockResolvedValue({ id: 'dk-3' });

    const { onSyncComplete } = await runSync();

    expect(markSyncItemErrorMock).toHaveBeenCalledWith(31, docketSyncDisabledMessage);
    expect(markDocketSyncErrorMock).toHaveBeenCalledWith('dk-3');
    expect(syncOfflineDocketDraftMock).not.toHaveBeenCalled();
    expect(markDocketServerIdMock).not.toHaveBeenCalled();
    // Intentionally treated as not-synced: no removal, no synced mark, no
    // completion callback.
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markDocketSyncedMock).not.toHaveBeenCalled();
    expect(onSyncComplete).not.toHaveBeenCalled();
  });

  it('removes the queue item when the docket no longer exists locally', async () => {
    getPendingSyncItemsMock.mockResolvedValue([docketItem('docket_create', { docketId: 'gone' })]);
    docketsGetMock.mockResolvedValue(undefined);

    await runSync();

    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(31);
    expect(syncOfflineDocketDraftMock).not.toHaveBeenCalled();
  });

  it('does not call the legacy draft sync path, so draft post failures cannot drop entry data', async () => {
    getPendingSyncItemsMock.mockResolvedValue([docketItem('docket_create', { docketId: 'dk-4' })]);
    docketsGetMock.mockResolvedValue({ id: 'dk-4' });
    syncOfflineDocketDraftMock.mockRejectedValue(new Error('docket post failed'));

    await runSync();

    expect(syncOfflineDocketDraftMock).not.toHaveBeenCalled();
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(31, docketSyncDisabledMessage);
    expect(markDocketSyncErrorMock).toHaveBeenCalledWith('dk-4');
  });
});

// ===========================================================================
// Invariant 2/3/10 — photo_upload
// ===========================================================================
describe('photo_upload dispatch', () => {
  const photoItem = (data: Record<string, unknown>) =>
    queueItem({ id: 41, type: 'photo_upload', attempts: 0, data });

  const basePhoto = {
    id: 'ph-1',
    projectId: 'proj-1',
    documentType: 'site_photo',
    entityType: 'lot',
    fileName: 'photo.jpg',
    dataUrl: 'data:image/jpeg;base64,AAAA',
    capturedAt: '2026-01-01T10:00:00.000Z',
  };

  beforeEach(() => {
    // The photo branch reads the base64 dataUrl through the global fetch, then
    // takes the resulting blob (`await response.blob()`). jsdom's Blob lacks a
    // `.stream()` method, so wrapping a Blob in a real Response throws; return a
    // minimal stub exposing only the `.blob()` the worker uses.
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      blob: async () => blob,
    } as unknown as Response);
  });

  it('uploads the photo via FormData, removes the item, and marks it synced with the returned document id', async () => {
    getPendingSyncItemsMock.mockResolvedValue([photoItem({ photoId: 'ph-1' })]);
    getOfflinePhotoMock.mockResolvedValue(basePhoto);
    authFetchMock.mockResolvedValue(okJson({ id: 'doc-99' }));

    await runSync();

    expect(globalThis.fetch).toHaveBeenCalledWith('data:image/jpeg;base64,AAAA');
    // Upload goes to the documents endpoint as multipart (no JSON header).
    const [url, init] = authFetchMock.mock.calls[0];
    expect(url).toBe('/api/documents/upload');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    const fd = init.body as FormData;
    expect(fd.get('projectId')).toBe('proj-1');
    expect(fd.get('documentType')).toBe('site_photo');
    expect(fd.get('entityType')).toBe('lot');
    expect(fd.get('capturedAt')).toBe('2026-01-01T10:00:00.000Z');

    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(41);
    expect(markPhotoSyncedMock).toHaveBeenCalledWith('ph-1', 'doc-99');
  });

  it('appends optional fields only when present', async () => {
    getPendingSyncItemsMock.mockResolvedValue([photoItem({ photoId: 'ph-2' })]);
    getOfflinePhotoMock.mockResolvedValue({
      ...basePhoto,
      lotId: 'lot-9',
      category: 'progress',
      entityId: 'ent-1',
      caption: 'wall',
      tags: ['a', 'b'],
      gpsLatitude: -33.5,
      gpsLongitude: 151.2,
    });
    authFetchMock.mockResolvedValue(okJson({ document: { id: 'doc-2' } }));

    await runSync();

    const fd = authFetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get('lotId')).toBe('lot-9');
    expect(fd.get('category')).toBe('progress');
    expect(fd.get('entityId')).toBe('ent-1');
    expect(fd.get('caption')).toBe('wall');
    // Tags are JSON-stringified.
    expect(fd.get('tags')).toBe(JSON.stringify(['a', 'b']));
    // GPS coordinates are stringified.
    expect(fd.get('gpsLatitude')).toBe('-33.5');
    expect(fd.get('gpsLongitude')).toBe('151.2');
  });

  it('marks the item + photo error (no removal) when the upload is not ok', async () => {
    getPendingSyncItemsMock.mockResolvedValue([photoItem({ photoId: 'ph-3' })]);
    getOfflinePhotoMock.mockResolvedValue(basePhoto);
    authFetchMock.mockResolvedValue(errorResponse(413, 'file too large'));

    await runSync();

    expect(markSyncItemErrorMock).toHaveBeenCalledWith(41, 'file too large');
    // The error marker keys off the queue item's photoId, not the photo record.
    expect(markPhotoSyncErrorMock).toHaveBeenCalledWith('ph-3');
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markPhotoSyncedMock).not.toHaveBeenCalled();
  });

  it('removes the queue item when the photo no longer exists locally', async () => {
    getPendingSyncItemsMock.mockResolvedValue([photoItem({ photoId: 'gone' })]);
    getOfflinePhotoMock.mockResolvedValue(undefined);

    await runSync();

    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(41);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('catches a thrown error and marks both the item and the photo error', async () => {
    getPendingSyncItemsMock.mockResolvedValue([photoItem({ photoId: 'ph-4' })]);
    getOfflinePhotoMock.mockResolvedValue(basePhoto);
    authFetchMock.mockRejectedValue(new Error('upload exploded'));

    await runSync();

    expect(markSyncItemErrorMock).toHaveBeenCalledWith(41, 'upload exploded');
    // The catch handler keys off the queue item's photoId (item.data.photoId).
    expect(markPhotoSyncErrorMock).toHaveBeenCalledWith('ph-4');
  });
});

// ===========================================================================
// Invariant 4/5/6/7/10 — lot_edit + lot_conflict
// ===========================================================================
describe('lot_edit dispatch', () => {
  const lotItem = (data: Record<string, unknown>) =>
    queueItem({ id: 51, type: 'lot_edit', attempts: 0, data });

  const pendingLot = {
    id: 'lot-1',
    lotNumber: 'L-001',
    syncStatus: 'pending',
    budget: 1000,
  };

  // Seed the common lot_edit arrange: one queued edit for `pendingLot`, a
  // not-a-conflict verdict, and the GET-then-(optional)PATCH authFetch sequence.
  // Tests supply only the server responses that matter to their assertion.
  function seedLotEdit(
    getResponse: Response,
    patchResponse?: Response,
    lot: Record<string, unknown> = pendingLot,
  ) {
    getPendingSyncItemsMock.mockResolvedValue([lotItem({ lotId: 'lot-1' })]);
    getOfflineLotMock.mockResolvedValue(lot);
    detectLotSyncConflictMock.mockResolvedValue({ hasConflict: false });
    authFetchMock.mockResolvedValueOnce(getResponse);
    if (patchResponse) {
      authFetchMock.mockResolvedValueOnce(patchResponse);
    }
  }

  it('no conflict: GET server lot, PATCH via buildOfflineLotEditPayload, remove item + mark synced (invariant 4)', async () => {
    seedLotEdit(
      okJson({ lot: { updatedAt: '2026-02-01T00:00:00.000Z' } }),
      okJson({ lot: { updatedAt: '2026-03-01T00:00:00.000Z' } }),
    );

    await runSync();

    expect(authFetchMock).toHaveBeenNthCalledWith(1, '/api/lots/lot-1', { method: 'GET' });
    // The PATCH body MUST go through buildOfflineLotEditPayload (budget→budgetAmount).
    expect(buildOfflineLotEditPayloadMock).toHaveBeenCalledWith(pendingLot);
    const patchCall = authFetchMock.mock.calls[1];
    expect(patchCall[0]).toBe('/api/lots/lot-1');
    expect(patchCall[1].method).toBe('PATCH');
    expect(JSON.parse(patchCall[1].body)).toEqual({ lotNumber: 'L-001', budgetAmount: undefined });

    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(51);
    // markLotSynced gets the server's returned updatedAt.
    expect(markLotSyncedMock).toHaveBeenCalledWith('lot-1', '2026-03-01T00:00:00.000Z');
  });

  it('passes server budgetAmount into the conflict check as budget (invariant 4 / ba1f6af)', async () => {
    seedLotEdit(
      okJson({ lot: { updatedAt: '2026-02-01T00:00:00.000Z', budgetAmount: 5000 } }),
      okJson({ lot: {} }),
    );

    await runSync();

    // The conflict-detection snapshot reads the server `budgetAmount` field into
    // the internal `budget` key.
    expect(detectLotSyncConflictMock).toHaveBeenCalledWith(
      'lot-1',
      expect.objectContaining({ budget: 5000 }),
    );
  });

  it('conflict detected: fires the onConflictDetected callback, removes the item, and does NOT PATCH (invariant 7)', async () => {
    getPendingSyncItemsMock.mockResolvedValue([lotItem({ lotId: 'lot-1' })]);
    getOfflineLotMock.mockResolvedValue(pendingLot);
    detectLotSyncConflictMock.mockResolvedValue({ hasConflict: true });
    authFetchMock.mockResolvedValueOnce(okJson({ lot: { updatedAt: '2026-02-01T00:00:00.000Z' } }));

    const { onConflictDetected } = await runSync();

    expect(onConflictDetected).toHaveBeenCalledWith(
      'lot-1',
      'L-001',
      'Sync conflict detected for lot L-001. Another user edited this lot while you were offline.',
    );
    // Conflict is tracked on the lot record; the queue item is just removed.
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(51);
    // Only the GET ran — no PATCH, no synced/error mark.
    expect(authFetchMock).toHaveBeenCalledTimes(1);
    expect(markLotSyncedMock).not.toHaveBeenCalled();
    expect(markLotSyncErrorMock).not.toHaveBeenCalled();
  });

  it("stale-skip: a lot already in 'conflict' status is removed + skipped with the readiness-pinned log (invariant 6)", async () => {
    getPendingSyncItemsMock.mockResolvedValue([lotItem({ lotId: 'lot-1' })]);
    getOfflineLotMock.mockResolvedValue({ ...pendingLot, syncStatus: 'conflict' });

    await runSync();

    expect(devWarnMock).toHaveBeenCalledWith(
      '[Sync] Removing stale lot edit queue item for conflicted lot:',
      'lot-1',
    );
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(51);
    // No server round-trip at all for a stale conflict.
    expect(authFetchMock).not.toHaveBeenCalled();
    expect(detectLotSyncConflictMock).not.toHaveBeenCalled();
  });

  it("stale-skip: a lot already in 'synced' status is removed + skipped (invariant 6)", async () => {
    getPendingSyncItemsMock.mockResolvedValue([lotItem({ lotId: 'lot-1' })]);
    getOfflineLotMock.mockResolvedValue({ ...pendingLot, syncStatus: 'synced' });

    await runSync();

    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(51);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('forceOverwrite bypasses stale-skip AND the conflict check, going straight to PATCH', async () => {
    getPendingSyncItemsMock.mockResolvedValue([lotItem({ lotId: 'lot-1', forceOverwrite: true })]);
    // Even a conflict-status lot is force-pushed when forceOverwrite is set.
    getOfflineLotMock.mockResolvedValue({ ...pendingLot, syncStatus: 'conflict' });
    authFetchMock
      .mockResolvedValueOnce(okJson({ lot: { updatedAt: '2026-02-01T00:00:00.000Z' } }))
      .mockResolvedValueOnce(okJson({ lot: { updatedAt: '2026-03-01T00:00:00.000Z' } }));

    await runSync();

    // Stale-skip skipped; conflict detection skipped; PATCH performed.
    expect(detectLotSyncConflictMock).not.toHaveBeenCalled();
    expect(authFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/lots/lot-1',
      expect.objectContaining({
        method: 'PATCH',
      }),
    );
    expect(markLotSyncedMock).toHaveBeenCalledWith('lot-1', '2026-03-01T00:00:00.000Z');
  });

  it('marks item + lot error when the server GET is not ok (no PATCH)', async () => {
    getPendingSyncItemsMock.mockResolvedValue([lotItem({ lotId: 'lot-1' })]);
    getOfflineLotMock.mockResolvedValue(pendingLot);
    authFetchMock.mockResolvedValueOnce(errorResponse(404, 'lot not found'));

    await runSync();

    expect(markSyncItemErrorMock).toHaveBeenCalledWith(51, 'lot not found');
    expect(markLotSyncErrorMock).toHaveBeenCalledWith('lot-1');
    expect(authFetchMock).toHaveBeenCalledTimes(1);
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
  });

  it('marks item + lot error when the PATCH is not ok (no removal)', async () => {
    seedLotEdit(
      okJson({ lot: { updatedAt: '2026-02-01T00:00:00.000Z' } }),
      errorResponse(400, 'invalid lot'),
    );

    await runSync();

    expect(markSyncItemErrorMock).toHaveBeenCalledWith(51, 'invalid lot');
    expect(markLotSyncErrorMock).toHaveBeenCalledWith('lot-1');
    expect(removeSyncQueueItemMock).not.toHaveBeenCalled();
    expect(markLotSyncedMock).not.toHaveBeenCalled();
  });

  it('falls back to a fresh timestamp when the PATCH response omits updatedAt', async () => {
    seedLotEdit(okJson({ lot: { updatedAt: '2026-02-01T00:00:00.000Z' } }), okJson({ lot: {} }));

    // Pin the fallback: markLotSynced is called with a non-empty ISO string.
    await runSync();

    expect(markLotSyncedMock).toHaveBeenCalledTimes(1);
    const [lotId, ts] = markLotSyncedMock.mock.calls[0];
    expect(lotId).toBe('lot-1');
    expect(typeof ts).toBe('string');
    expect(ts.length).toBeGreaterThan(0);
  });

  it('removes the queue item when the lot no longer exists locally', async () => {
    getPendingSyncItemsMock.mockResolvedValue([lotItem({ lotId: 'gone' })]);
    getOfflineLotMock.mockResolvedValue(undefined);

    await runSync();

    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(51);
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it('catches a thrown error and marks both the item and the lot error', async () => {
    getPendingSyncItemsMock.mockResolvedValue([lotItem({ lotId: 'lot-1' })]);
    getOfflineLotMock.mockResolvedValue(pendingLot);
    authFetchMock.mockRejectedValueOnce(new Error('lot sync exploded'));

    await runSync();

    expect(markSyncItemErrorMock).toHaveBeenCalledWith(51, 'lot sync exploded');
    expect(markLotSyncErrorMock).toHaveBeenCalledWith('lot-1');
  });
});

describe('lot_conflict dispatch (invariant 7)', () => {
  it('just removes the queue item — never error-marks it', async () => {
    getPendingSyncItemsMock.mockResolvedValue([
      queueItem({
        id: 61,
        type: 'lot_conflict',
        attempts: 0,
        data: { lotId: 'lot-1', lotNumber: 'L-001', projectId: 'p-1', message: 'conflict' },
      }),
    ]);

    await runSync();

    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(61);
    expect(markSyncItemErrorMock).not.toHaveBeenCalled();
    expect(authFetchMock).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Invariant 8 — Unknown-type GC (including the union members with no branch)
// ===========================================================================
describe('unknown-type garbage collection (invariant 8)', () => {
  it('removes an unrecognized item type to prevent queue buildup', async () => {
    getPendingSyncItemsMock.mockResolvedValue([
      queueItem({ id: 71, type: 'totally_unknown', attempts: 0, data: {} }),
    ]);

    await runSync();

    expect(devWarnMock).toHaveBeenCalledWith(
      '[Sync] Removing unknown item type:',
      'totally_unknown',
    );
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(71);
  });

  // FORMER PINNED ODDITY, now fixed: delivery_save and event_save were declared
  // in the SyncQueueItem union (offline/core.ts) with no worker branch, so they
  // fell through to the unknown-type sweep and were GC'd (silent data loss).
  // The diary quick-add offline wiring gave them real executors; these tests
  // pin the new behavior — queued items SYNC, the GC sweep never sees them.
  it('syncs delivery_save items through their executor instead of GCing them', async () => {
    getPendingSyncItemsMock.mockResolvedValue([
      queueItem({ id: 72, type: 'delivery_save', attempts: 0, data: { deliveryId: 'del-1' } }),
    ]);
    diaryDeliveriesGetMock.mockResolvedValue({
      id: 'del-1',
      diaryId: 'server-d-1',
      description: '20t road base',
    });
    diariesGetMock.mockResolvedValue(undefined); // diaryId is already a server id
    authFetchMock.mockResolvedValue(okJson({ ok: true }));

    await runSync();

    expect(authFetchMock).toHaveBeenCalledWith(
      '/api/diary/server-d-1/deliveries',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(72);
    expect(markDeliverySyncedMock).toHaveBeenCalledWith('del-1');
    expect(devWarnMock).not.toHaveBeenCalledWith(
      '[Sync] Removing unknown item type:',
      'delivery_save',
    );
  });

  it('syncs event_save items through their executor instead of GCing them', async () => {
    getPendingSyncItemsMock.mockResolvedValue([
      queueItem({ id: 73, type: 'event_save', attempts: 0, data: { eventId: 'evt-1' } }),
    ]);
    diaryEventsGetMock.mockResolvedValue({
      id: 'evt-1',
      diaryId: 'server-d-1',
      eventType: 'inspection',
      description: 'Council walkover',
    });
    diariesGetMock.mockResolvedValue(undefined);
    authFetchMock.mockResolvedValue(okJson({ ok: true }));

    await runSync();

    expect(authFetchMock).toHaveBeenCalledWith(
      '/api/diary/server-d-1/events',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(73);
    expect(markEventSyncedMock).toHaveBeenCalledWith('evt-1');
    expect(devWarnMock).not.toHaveBeenCalledWith(
      '[Sync] Removing unknown item type:',
      'event_save',
    );
  });

  it('does NOT GC a known type after it succeeds (the type is on the allow-list)', async () => {
    // A successful itp_completion falls through to the knownTypes check, which
    // must NOT remove it a second time (it was already removed on success).
    getPendingSyncItemsMock.mockResolvedValue([
      queueItem({
        id: 74,
        type: 'itp_completion',
        attempts: 0,
        data: { lotId: 'lot-1', checklistItemId: 'item-1', status: 'completed' },
      }),
    ]);
    authFetchMock
      .mockResolvedValueOnce(okJson({ instance: { id: 'inst' } }))
      .mockResolvedValueOnce(okJson({ ok: true }));

    await runSync();

    // Exactly one removal (the success-path remove), not a second GC remove.
    expect(removeSyncQueueItemMock).toHaveBeenCalledTimes(1);
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(74);
    expect(devWarnMock).not.toHaveBeenCalledWith(
      '[Sync] Removing unknown item type:',
      'itp_completion',
    );
  });
});

// ===========================================================================
// Multi-item loop behavior + tail tally (invariants 2 + 3)
// ===========================================================================
describe('loop resilience and tail tally', () => {
  it('a failing item does not abort the rest of the queue (subsequent items still process)', async () => {
    getPendingSyncItemsMock.mockResolvedValue([
      // Item 1: itp_completion that throws.
      queueItem({
        id: 81,
        type: 'itp_completion',
        attempts: 0,
        data: { lotId: 'lot-x', checklistItemId: 'ci-x', status: 'completed' },
      }),
      // Item 2: lot_conflict that should still be removed afterwards.
      queueItem({
        id: 82,
        type: 'lot_conflict',
        attempts: 0,
        data: { lotId: 'lot-y', lotNumber: 'L-Y', projectId: 'p', message: 'm' },
      }),
    ]);
    // First call (item 1's instance GET) rejects; nothing else uses authFetch.
    authFetchMock.mockRejectedValueOnce(new Error('item 1 down'));

    await runSync();

    // Item 1 was error-marked...
    expect(markSyncItemErrorMock).toHaveBeenCalledWith(81, 'item 1 down');
    // ...and item 2 was still processed (removed).
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(82);
  });

  it('fires onSyncComplete with both counts only when at least one item synced', async () => {
    getPendingSyncItemsMock.mockResolvedValue([
      queueItem({ id: 91, type: 'lot_conflict', attempts: 0, data: {} }),
    ]);
    // After the pass, the queue reports 2 dead-lettered items.
    getFailedSyncCountMock.mockResolvedValue(2);

    const { onSyncComplete } = await runSync();

    // lot_conflict removal does NOT increment syncedCount, so the callback is
    // suppressed even though there are failures.
    expect(onSyncComplete).not.toHaveBeenCalled();
  });

  it('passes the post-sync failedCount alongside syncedCount to onSyncComplete', async () => {
    getPendingSyncItemsMock.mockResolvedValue([
      queueItem({ id: 92, type: 'lot_conflict', attempts: 0, data: {} }),
      queueItem({
        id: 93,
        type: 'itp_completion',
        attempts: 0,
        data: { lotId: 'l', checklistItemId: 'c', status: 'completed' },
      }),
    ]);
    authFetchMock
      .mockResolvedValueOnce(okJson({ instance: { id: 'i' } }))
      .mockResolvedValueOnce(okJson({ ok: true }));
    getFailedSyncCountMock.mockResolvedValue(3);

    const { onSyncComplete } = await runSync();

    expect(onSyncComplete).toHaveBeenCalledWith({ syncedCount: 1, failedCount: 3 });
  });

  it('does nothing (no items fetched) when the worker is disabled', async () => {
    const { result } = renderHook(() => useOfflineStatus({ enableSyncWorker: false }));

    await act(async () => {
      await result.current.syncPendingChanges();
    });

    expect(getPendingSyncItemsMock).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Invariant 5 — Exclusivity wiring
// ===========================================================================
describe('exclusivity (invariant 5)', () => {
  it('runs the whole item loop inside runExclusiveOfflineSync', async () => {
    // runExclusiveOfflineSync is mocked to pass through, but we still pin that
    // the worker delegates to it (the lock/coalesce semantics themselves are
    // characterized in offline/syncClient.test.ts).
    const { runExclusiveOfflineSync } = await import('./offline/syncClient');
    getPendingSyncItemsMock.mockResolvedValue([
      queueItem({ id: 101, type: 'lot_conflict', attempts: 0, data: {} }),
    ]);

    await runSync();

    expect(runExclusiveOfflineSync).toHaveBeenCalledTimes(1);
    expect(runExclusiveOfflineSync).toHaveBeenCalledWith(expect.any(Function));
    // The removal happened, proving the worker body ran inside the wrapper.
    expect(removeSyncQueueItemMock).toHaveBeenCalledWith(101);
  });
});
