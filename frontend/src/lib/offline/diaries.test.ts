// DB-free behavior characterization for the offline diary slice. The Dexie
// singleton (./core) is replaced with a focused module mock, so no IndexedDB
// is needed; the functions under test run their real bodies and are imported
// through the public '@/lib/offlineDb' path to pin that the re-export surface
// stays intact.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./core', () => ({
  offlineDb: {
    diaries: {
      put: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
      where: vi.fn(),
    },
    syncQueue: {
      add: vi.fn(),
    },
  },
}));

import {
  cacheDiaryFromServer,
  deleteOfflineDiary,
  getOfflineDiariesForProject,
  getOfflineDiary,
  getPendingDiaries,
  markDiarySynced,
  markDiarySyncError,
  offlineDb,
  saveDiaryOffline,
  submitDiaryOffline,
  type OfflineDailyDiary,
} from '@/lib/offlineDb';

type DiaryDraft = Omit<
  OfflineDailyDiary,
  'id' | 'projectId' | 'date' | 'syncStatus' | 'localUpdatedAt'
>;

const draft: DiaryDraft = {
  status: 'draft',
  weather: { conditions: 'sunny', temperature: 24, rainfall: 0, notes: 'clear all day' },
  workforce: { contractors: 4, subcontractors: 2, visitors: 1, notes: 'full crew' },
  activities: [{ id: 'act-1', description: 'Pour footing F1', lotIds: ['lot-1'] }],
  delays: [{ id: 'delay-1', type: 'weather', description: 'Morning fog', duration: 30 }],
  equipment: [{ id: 'eq-1', name: 'Excavator', hours: 6 }],
  notes: 'general notes',
  createdBy: 'ignored-by-save',
};

function mockWhereChain(rows: OfflineDailyDiary[]) {
  const equals = vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(rows) });
  vi.mocked(offlineDb.diaries.where).mockReturnValue({ equals } as unknown as ReturnType<
    typeof offlineDb.diaries.where
  >);
  return equals;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveDiaryOffline', () => {
  it('stores the draft under the diary-<project>-<date> id and queues a diary_save sync', async () => {
    const diary = await saveDiaryOffline('project-1', '2026-06-05', draft, 'user-1');

    expect(diary).toMatchObject({
      id: 'diary-project-1-2026-06-05',
      projectId: 'project-1',
      date: '2026-06-05',
      status: 'draft',
      weather: draft.weather,
      workforce: draft.workforce,
      activities: draft.activities,
      delays: draft.delays,
      equipment: draft.equipment,
      notes: 'general notes',
      createdBy: 'user-1',
      syncStatus: 'pending',
      localUpdatedAt: expect.any(String),
    });

    expect(offlineDb.diaries.put).toHaveBeenCalledTimes(1);
    expect(offlineDb.diaries.put).toHaveBeenCalledWith(diary);
    expect(offlineDb.syncQueue.add).toHaveBeenCalledTimes(1);
    expect(offlineDb.syncQueue.add).toHaveBeenCalledWith({
      type: 'diary_save',
      action: 'update',
      data: { diaryId: 'diary-project-1-2026-06-05' },
      createdAt: expect.any(String),
      attempts: 0,
    });
  });
});

describe('submitDiaryOffline', () => {
  it('marks the diary submitted/pending and queues a diary_submit sync', async () => {
    vi.mocked(offlineDb.diaries.get).mockResolvedValue({
      id: 'diary-project-1-2026-06-05',
    } as OfflineDailyDiary);

    await submitDiaryOffline('project-1', '2026-06-05');

    expect(offlineDb.diaries.get).toHaveBeenCalledWith('diary-project-1-2026-06-05');
    expect(offlineDb.diaries.update).toHaveBeenCalledWith('diary-project-1-2026-06-05', {
      status: 'submitted',
      syncStatus: 'pending',
      localUpdatedAt: expect.any(String),
    });
    expect(offlineDb.syncQueue.add).toHaveBeenCalledWith({
      type: 'diary_submit',
      action: 'update',
      data: { diaryId: 'diary-project-1-2026-06-05' },
      createdAt: expect.any(String),
      attempts: 0,
    });
  });

  it('rejects instead of queueing a submit when no offline snapshot exists', async () => {
    vi.mocked(offlineDb.diaries.get).mockResolvedValue(undefined);

    await expect(submitDiaryOffline('project-1', '2026-06-05')).rejects.toThrow(
      'Offline diary snapshot not found',
    );

    expect(offlineDb.diaries.update).not.toHaveBeenCalled();
    expect(offlineDb.syncQueue.add).not.toHaveBeenCalled();
  });
});

describe('diary queries', () => {
  it('getOfflineDiary reads by the constructed diary id', async () => {
    const stored = { id: 'diary-project-1-2026-06-05' } as OfflineDailyDiary;
    vi.mocked(offlineDb.diaries.get).mockResolvedValue(stored);

    await expect(getOfflineDiary('project-1', '2026-06-05')).resolves.toBe(stored);
    expect(offlineDb.diaries.get).toHaveBeenCalledWith('diary-project-1-2026-06-05');
  });

  it('getOfflineDiariesForProject queries the projectId index', async () => {
    const rows = [{ id: 'diary-project-1-2026-06-05' } as OfflineDailyDiary];
    const equals = mockWhereChain(rows);

    await expect(getOfflineDiariesForProject('project-1')).resolves.toBe(rows);
    expect(offlineDb.diaries.where).toHaveBeenCalledWith('projectId');
    expect(equals).toHaveBeenCalledWith('project-1');
  });

  it('getPendingDiaries queries the syncStatus index for pending rows', async () => {
    const rows = [{ id: 'diary-project-1-2026-06-05' } as OfflineDailyDiary];
    const equals = mockWhereChain(rows);

    await expect(getPendingDiaries()).resolves.toBe(rows);
    expect(offlineDb.diaries.where).toHaveBeenCalledWith('syncStatus');
    expect(equals).toHaveBeenCalledWith('pending');
  });
});

describe('sync status markers', () => {
  it('markDiarySynced sets syncStatus synced', async () => {
    await markDiarySynced('diary-1');
    expect(offlineDb.diaries.update).toHaveBeenCalledWith('diary-1', {
      syncStatus: 'synced',
      localUpdatedAt: expect.any(String),
    });
  });

  it('markDiarySyncError sets syncStatus error', async () => {
    await markDiarySyncError('diary-1');
    expect(offlineDb.diaries.update).toHaveBeenCalledWith('diary-1', {
      syncStatus: 'error',
      localUpdatedAt: expect.any(String),
    });
  });

  it('deleteOfflineDiary deletes by id', async () => {
    await deleteOfflineDiary('diary-1');
    expect(offlineDb.diaries.delete).toHaveBeenCalledWith('diary-1');
  });
});

describe('cacheDiaryFromServer', () => {
  it('applies the draft/empty defaults, marks the row synced, and does not queue a sync', async () => {
    await cacheDiaryFromServer('project-1', '2026-06-05', {}, 'user-1');

    expect(offlineDb.diaries.put).toHaveBeenCalledWith({
      id: 'diary-project-1-2026-06-05',
      projectId: 'project-1',
      date: '2026-06-05',
      status: 'draft',
      weather: { conditions: '', temperature: undefined, rainfall: undefined, notes: '' },
      workforce: { contractors: 0, subcontractors: 0, visitors: 0, notes: '' },
      activities: [],
      delays: [],
      equipment: [],
      notes: '',
      createdBy: 'user-1',
      syncStatus: 'synced',
      localUpdatedAt: expect.any(String),
    });
    expect(offlineDb.syncQueue.add).not.toHaveBeenCalled();
  });

  it('keeps server-provided values and prefers the server createdById over the local user', async () => {
    await cacheDiaryFromServer(
      'project-1',
      '2026-06-05',
      {
        status: 'submitted',
        weather: draft.weather,
        workforce: draft.workforce,
        activities: draft.activities,
        delays: draft.delays,
        equipment: draft.equipment,
        notes: 'from server',
        createdById: 'server-user',
      },
      'user-1',
    );

    expect(offlineDb.diaries.put).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'submitted',
        weather: draft.weather,
        workforce: draft.workforce,
        notes: 'from server',
        createdBy: 'server-user',
        syncStatus: 'synced',
      }),
    );
  });
});
