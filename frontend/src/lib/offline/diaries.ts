// Offline daily diary persistence, moved verbatim from ../offlineDb.ts so the
// diary slice lives beside the database core. The public import path is
// unchanged: '@/lib/offlineDb' re-exports everything exported here, so
// callers keep importing from '@/lib/offlineDb'.

import { offlineDb, type OfflineDailyDiary } from './core';
import { MISSING_OFFLINE_DIARY_SUBMIT_SNAPSHOT_MESSAGE } from './diaryMessages';

type OfflineDailyDiaryServerData = Partial<
  Omit<
    OfflineDailyDiary,
    'id' | 'projectId' | 'date' | 'createdBy' | 'syncStatus' | 'localUpdatedAt'
  >
> & {
  createdById?: string;
};

// ============================================================================
// Feature #312: Offline Daily Diary Functions
// ============================================================================

// Generate diary ID
function generateDiaryId(projectId: string, date: string): string {
  return `diary-${projectId}-${date}`;
}

// Save diary offline (draft)
export async function saveDiaryOffline(
  projectId: string,
  date: string,
  data: Omit<OfflineDailyDiary, 'id' | 'projectId' | 'date' | 'syncStatus' | 'localUpdatedAt'>,
  userId: string,
): Promise<OfflineDailyDiary> {
  const id = generateDiaryId(projectId, date);

  const diary: OfflineDailyDiary = {
    id,
    projectId,
    date,
    status: data.status,
    weather: data.weather,
    workforce: data.workforce,
    activities: data.activities,
    delays: data.delays,
    equipment: data.equipment,
    notes: data.notes,
    createdBy: userId,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
  };

  // Store the diary
  await offlineDb.diaries.put(diary);

  // Add to sync queue
  await offlineDb.syncQueue.add({
    type: 'diary_save',
    action: 'update',
    data: { diaryId: id },
    createdAt: new Date().toISOString(),
    attempts: 0,
  });

  return diary;
}

// Submit diary offline
export async function submitDiaryOffline(projectId: string, date: string): Promise<void> {
  const id = generateDiaryId(projectId, date);
  const existing = await offlineDb.diaries.get(id);

  if (!existing) {
    throw new Error(MISSING_OFFLINE_DIARY_SUBMIT_SNAPSHOT_MESSAGE);
  }

  // Update status to submitted
  await offlineDb.diaries.update(id, {
    status: 'submitted',
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
  });

  // Add submission to sync queue
  await offlineDb.syncQueue.add({
    type: 'diary_submit',
    action: 'update',
    data: { diaryId: id },
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}

// Get diary for a date
export async function getOfflineDiary(
  projectId: string,
  date: string,
): Promise<OfflineDailyDiary | undefined> {
  const id = generateDiaryId(projectId, date);
  return offlineDb.diaries.get(id);
}

// Get all offline diaries for a project
export async function getOfflineDiariesForProject(projectId: string): Promise<OfflineDailyDiary[]> {
  return offlineDb.diaries.where('projectId').equals(projectId).toArray();
}

// Get all pending diary syncs
export async function getPendingDiaries(): Promise<OfflineDailyDiary[]> {
  return offlineDb.diaries.where('syncStatus').equals('pending').toArray();
}

// Mark diary as synced
export async function markDiarySynced(diaryId: string): Promise<void> {
  await offlineDb.diaries.update(diaryId, {
    syncStatus: 'synced',
    localUpdatedAt: new Date().toISOString(),
  });
}

// Mark diary sync error
export async function markDiarySyncError(diaryId: string): Promise<void> {
  await offlineDb.diaries.update(diaryId, {
    syncStatus: 'error',
    localUpdatedAt: new Date().toISOString(),
  });
}

// Delete offline diary
export async function deleteOfflineDiary(diaryId: string): Promise<void> {
  await offlineDb.diaries.delete(diaryId);
}

// Cache diary data from server
export async function cacheDiaryFromServer(
  projectId: string,
  date: string,
  serverData: OfflineDailyDiaryServerData,
  userId: string,
): Promise<void> {
  const id = generateDiaryId(projectId, date);

  const diary: OfflineDailyDiary = {
    id,
    projectId,
    date,
    status: serverData.status || 'draft',
    weather: serverData.weather || {
      conditions: '',
      temperature: undefined,
      rainfall: undefined,
      notes: '',
    },
    workforce: serverData.workforce || {
      contractors: 0,
      subcontractors: 0,
      visitors: 0,
      notes: '',
    },
    activities: serverData.activities || [],
    delays: serverData.delays || [],
    equipment: serverData.equipment || [],
    notes: serverData.notes || '',
    createdBy: serverData.createdById || userId,
    syncStatus: 'synced', // Already on server
    localUpdatedAt: new Date().toISOString(),
  };

  await offlineDb.diaries.put(diary);
}
