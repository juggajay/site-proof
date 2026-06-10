// DB-free behavior tests for the diary quick-add offline path. The Dexie
// singleton (./core) is replaced with a focused module mock (same recipe as
// diaries.test.ts), so the functions under test run their real bodies —
// including the real saveDiaryOffline they write snapshots through — and are
// imported via the public '@/lib/offlineDb' path to pin the re-export surface.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./core', () => ({
  offlineDb: {
    diaries: {
      put: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
    },
    diaryDeliveries: {
      put: vi.fn(),
      update: vi.fn(),
    },
    diaryEvents: {
      put: vi.fn(),
      update: vi.fn(),
    },
    syncQueue: {
      add: vi.fn(),
    },
  },
}));

import {
  markDeliverySynced,
  markDeliverySyncError,
  markEventSynced,
  markEventSyncError,
  offlineDb,
  queueDiaryActivityOffline,
  queueDiaryDelayOffline,
  queueDiaryDeliveryOffline,
  queueDiaryEventOffline,
  queueDiaryPlantOffline,
  queueDiaryWeatherOffline,
  type OfflineDailyDiary,
} from '@/lib/offlineDb';

const diariesGetMock = vi.mocked(offlineDb.diaries.get);
const diariesPutMock = vi.mocked(offlineDb.diaries.put);
const syncQueueAddMock = vi.mocked(offlineDb.syncQueue.add);
const deliveriesPutMock = vi.mocked(offlineDb.diaryDeliveries.put);
const eventsPutMock = vi.mocked(offlineDb.diaryEvents.put);

function existingSnapshot(overrides: Partial<OfflineDailyDiary> = {}): OfflineDailyDiary {
  return {
    id: 'diary-project-1-2026-06-09',
    projectId: 'project-1',
    date: '2026-06-09',
    status: 'draft',
    weather: { conditions: 'Sunny', temperatureMin: 8 },
    workforce: { contractors: 2, subcontractors: 0, visitors: 0 },
    activities: [{ id: 'act-existing', description: 'Strip topsoil' }],
    delays: [],
    equipment: [],
    notes: 'existing notes',
    createdBy: 'user-1',
    syncStatus: 'pending',
    localUpdatedAt: '2026-06-09T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  diariesGetMock.mockResolvedValue(undefined);
});

describe('snapshot-backed quick-adds (activity / delay / plant / weather)', () => {
  it('queues an activity into a fresh snapshot and folds quantity/unit into progress', async () => {
    const diary = await queueDiaryActivityOffline('project-1', '2026-06-09', {
      description: 'Pour kerb',
      lotId: 'lot-1',
      quantity: 12,
      unit: 'm3',
      notes: 'east side',
    });

    expect(diary.id).toBe('diary-project-1-2026-06-09');
    expect(diary.syncStatus).toBe('pending');
    expect(diary.activities).toHaveLength(1);
    expect(diary.activities[0]).toMatchObject({
      description: 'Pour kerb',
      lotIds: ['lot-1'],
      progress: 'east side — Qty: 12 m3',
    });
    expect(diariesPutMock).toHaveBeenCalledWith(diary);
    expect(syncQueueAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'diary_save',
        data: { diaryId: 'diary-project-1-2026-06-09' },
      }),
    );
  });

  it('omits progress and lotIds when the activity has no extra details', async () => {
    const diary = await queueDiaryActivityOffline('project-1', '2026-06-09', {
      description: 'Pour kerb',
    });

    expect(diary.activities[0].progress).toBeUndefined();
    expect(diary.activities[0].lotIds).toBeUndefined();
  });

  it('appends to an existing UNSYNCED snapshot, preserving its entries', async () => {
    diariesGetMock.mockResolvedValue(existingSnapshot());

    const diary = await queueDiaryActivityOffline('project-1', '2026-06-09', {
      description: 'Pour kerb',
    });

    expect(diary.activities.map((a) => a.description)).toEqual(['Strip topsoil', 'Pour kerb']);
    expect(diary.notes).toBe('existing notes');
    expect(diary.createdBy).toBe('user-1');
  });

  it('starts FRESH over a previously synced snapshot so delivered entries are never replayed', async () => {
    diariesGetMock.mockResolvedValue(existingSnapshot({ syncStatus: 'synced' }));

    const diary = await queueDiaryActivityOffline('project-1', '2026-06-09', {
      description: 'Pour kerb',
    });

    // The synced snapshot's activities already reached the server; replaying
    // them after later online edits would duplicate them.
    expect(diary.activities.map((a) => a.description)).toEqual(['Pour kerb']);
  });

  it('queues a delay with the snapshot field mapping', async () => {
    const diary = await queueDiaryDelayOffline('project-1', '2026-06-09', {
      delayType: 'weather',
      description: 'Rain stopped paving',
      durationHours: 2.5,
      impact: 'Crew stood down',
    });

    expect(diary.delays[0]).toMatchObject({
      type: 'weather',
      description: 'Rain stopped paving',
      duration: 2.5,
      impact: 'Crew stood down',
    });
  });

  it('queues plant and folds rego/company into the status text', async () => {
    const diary = await queueDiaryPlantOffline('project-1', '2026-06-09', {
      description: '20t excavator',
      idRego: 'XYZ-123',
      company: 'Acme Hire',
      hoursOperated: 6,
    });

    expect(diary.equipment[0]).toMatchObject({
      name: '20t excavator',
      hours: 6,
      status: 'Rego: XYZ-123 — Acme Hire',
    });
  });

  it('merges weather into the snapshot, keeping fields the update does not touch', async () => {
    diariesGetMock.mockResolvedValue(existingSnapshot());

    const diary = await queueDiaryWeatherOffline('project-1', '2026-06-09', {
      temperatureMax: 31,
      rainfallMm: 4,
    });

    expect(diary.weather).toEqual({
      conditions: 'Sunny',
      temperatureMin: 8,
      temperatureMax: 31,
      rainfall: 4,
    });
  });
});

describe('table-backed quick-adds (delivery / event)', () => {
  it('stores a delivery against a server diary id and queues delivery_save', async () => {
    const delivery = await queueDiaryDeliveryOffline(
      { diaryId: 'server-d-1' },
      {
        description: '20t road base',
        supplier: 'Quarry Co',
        docketNumber: 'QC-441',
        quantity: 20,
        unit: 't',
        lotId: 'lot-1',
        notes: 'tipped at CH200',
      },
    );

    expect(delivery).toMatchObject({
      diaryId: 'server-d-1',
      description: '20t road base',
      supplier: 'Quarry Co',
      docketNumber: 'QC-441',
      quantity: 20,
      unit: 't',
      lotId: 'lot-1',
      notes: 'tipped at CH200',
      syncStatus: 'pending',
    });
    expect(deliveriesPutMock).toHaveBeenCalledWith(delivery);
    expect(syncQueueAddMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'delivery_save', data: { deliveryId: delivery.id } }),
    );
    // A server-diary anchor needs no local snapshot.
    expect(diariesPutMock).not.toHaveBeenCalled();
  });

  it('with no server diary, anchors the delivery to a local snapshot it creates (and queues diary_save)', async () => {
    const delivery = await queueDiaryDeliveryOffline(
      { projectId: 'project-1', date: '2026-06-09' },
      { description: '20t road base' },
    );

    expect(delivery.diaryId).toBe('diary-project-1-2026-06-09');
    // The anchor snapshot was created and queued so the server diary exists
    // by the time the delivery syncs.
    expect(diariesPutMock).toHaveBeenCalledTimes(1);
    expect(syncQueueAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'diary_save',
        data: { diaryId: 'diary-project-1-2026-06-09' },
      }),
    );
    expect(syncQueueAddMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'delivery_save', data: { deliveryId: delivery.id } }),
    );
  });

  it('reuses an existing local snapshot as the anchor without rewriting it', async () => {
    diariesGetMock.mockResolvedValue(existingSnapshot());

    const event = await queueDiaryEventOffline(
      { projectId: 'project-1', date: '2026-06-09' },
      { eventType: 'inspection', description: 'Council walkover' },
    );

    expect(event.diaryId).toBe('diary-project-1-2026-06-09');
    expect(diariesPutMock).not.toHaveBeenCalled();
  });

  it('stores an event and queues event_save', async () => {
    const event = await queueDiaryEventOffline(
      { diaryId: 'server-d-1' },
      { eventType: 'inspection', description: 'Council walkover', notes: 'no issues' },
    );

    expect(event).toMatchObject({
      diaryId: 'server-d-1',
      eventType: 'inspection',
      description: 'Council walkover',
      notes: 'no issues',
      syncStatus: 'pending',
    });
    expect(eventsPutMock).toHaveBeenCalledWith(event);
    expect(syncQueueAddMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'event_save', data: { eventId: event.id } }),
    );
  });
});

describe('delivery/event sync-status markers', () => {
  it('mark the matching table row synced or errored', async () => {
    await markDeliverySynced('del-1');
    expect(offlineDb.diaryDeliveries.update).toHaveBeenCalledWith(
      'del-1',
      expect.objectContaining({ syncStatus: 'synced' }),
    );

    await markDeliverySyncError('del-1');
    expect(offlineDb.diaryDeliveries.update).toHaveBeenCalledWith(
      'del-1',
      expect.objectContaining({ syncStatus: 'error' }),
    );

    await markEventSynced('evt-1');
    expect(offlineDb.diaryEvents.update).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ syncStatus: 'synced' }),
    );

    await markEventSyncError('evt-1');
    expect(offlineDb.diaryEvents.update).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ syncStatus: 'error' }),
    );
  });
});
