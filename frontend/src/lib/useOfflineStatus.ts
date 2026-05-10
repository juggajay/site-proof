import { useState, useEffect, useCallback } from 'react';
import {
  getPendingSyncCount,
  getPendingSyncItems,
  removeSyncQueueItem,
  markSyncItemError,
  markCompletionSynced,
  getOfflinePhoto,
  markPhotoSynced,
  markPhotoSyncError,
  offlineDb,
  markDiarySynced,
  markDiarySyncError,
  markDocketSynced,
  markDocketServerId,
  markDocketSyncError,
  getOfflineLot,
  detectLotSyncConflict,
  markLotSynced,
  markLotSyncError,
  getConflictedLotsCount,
} from './offlineDb';
import type { OfflineDailyDiary, OfflineDocket } from './offlineDb';
import { apiUrl, authFetch } from './api';
import { devLog, devWarn } from './logger';

// Type for sync notification callbacks
export interface SyncCallbacks {
  onConflictDetected?: (lotId: string, lotNumber: string, message: string) => void;
  onSyncComplete?: (syncedCount: number) => void;
}

type ServerDiary = {
  id: string;
  activities?: Array<{ description: string; lotId?: string | null; notes?: string | null }>;
  delays?: Array<{
    delayType: string;
    description: string;
    durationHours?: number | string | null;
    impact?: string | null;
  }>;
  plant?: Array<{
    description: string;
    hoursOperated?: number | string | null;
    notes?: string | null;
  }>;
};

function toFiniteNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function compactText(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

function syncKey(...parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => (part === null || part === undefined ? '' : String(part).trim().toLowerCase()))
    .join('|');
}

async function readResponseError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `Request failed with ${response.status}`;
  }

  try {
    const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || text;
  } catch {
    return text;
  }
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await authFetch(url, init);
  if (!response.ok) {
    throw new Error(await readResponseError(response));
  }

  return response.json() as Promise<T>;
}

function buildOfflineDiaryNotes(diary: OfflineDailyDiary): string | undefined {
  const sections: string[] = [];

  const notes = compactText(diary.notes);
  if (notes) {
    sections.push(notes);
  }

  const workforceParts = [
    diary.workforce.contractors > 0 ? `${diary.workforce.contractors} contractors` : '',
    diary.workforce.subcontractors > 0 ? `${diary.workforce.subcontractors} subcontractors` : '',
    diary.workforce.visitors > 0 ? `${diary.workforce.visitors} visitors` : '',
  ].filter(Boolean);
  const workforceNotes = compactText(diary.workforce.notes);
  if (workforceParts.length > 0 || workforceNotes) {
    sections.push(
      ['Offline workforce summary:', workforceParts.join(', '), workforceNotes]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return sections.join('\n\n') || undefined;
}

function buildOfflineDiaryPayload(diary: OfflineDailyDiary) {
  const temperature = toFiniteNumber(diary.weather.temperature);

  return {
    projectId: diary.projectId,
    date: diary.date,
    weatherConditions: compactText(diary.weather.conditions),
    temperatureMin: temperature,
    temperatureMax: temperature,
    rainfallMm: toFiniteNumber(diary.weather.rainfall),
    weatherNotes: compactText(diary.weather.notes),
    generalNotes: buildOfflineDiaryNotes(diary),
  };
}

async function syncOfflineDiarySnapshot(diary: OfflineDailyDiary): Promise<string> {
  const headers = {
    'Content-Type': 'application/json',
  };

  const serverDiary = await fetchJson<ServerDiary>(apiUrl('/api/diary'), {
    method: 'POST',
    headers,
    body: JSON.stringify(buildOfflineDiaryPayload(diary)),
  });

  const activityKeys = new Set(
    (serverDiary.activities || []).map((activity) =>
      syncKey(activity.description, activity.lotId, activity.notes),
    ),
  );

  for (const activity of diary.activities) {
    const description = compactText(activity.description);
    if (!description) continue;

    const payload = {
      description,
      lotId: activity.lotIds?.[0],
      notes: compactText(activity.progress),
    };
    const key = syncKey(payload.description, payload.lotId, payload.notes);
    if (activityKeys.has(key)) continue;

    await fetchJson<unknown>(apiUrl(`/api/diary/${serverDiary.id}/activities`), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    activityKeys.add(key);
  }

  const delayKeys = new Set(
    (serverDiary.delays || []).map((delay) =>
      syncKey(
        delay.delayType,
        delay.description,
        toFiniteNumber(delay.durationHours),
        delay.impact,
      ),
    ),
  );

  for (const delay of diary.delays) {
    const description = compactText(delay.description);
    if (!description) continue;

    const payload = {
      delayType: compactText(delay.type) || 'other',
      description,
      durationHours: toFiniteNumber(delay.duration),
      impact: compactText(delay.impact),
    };
    const key = syncKey(
      payload.delayType,
      payload.description,
      payload.durationHours,
      payload.impact,
    );
    if (delayKeys.has(key)) continue;

    await fetchJson<unknown>(apiUrl(`/api/diary/${serverDiary.id}/delays`), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    delayKeys.add(key);
  }

  const plantKeys = new Set(
    (serverDiary.plant || []).map((plant) =>
      syncKey(plant.description, toFiniteNumber(plant.hoursOperated), plant.notes),
    ),
  );

  for (const equipment of diary.equipment) {
    const description = compactText(equipment.name);
    if (!description) continue;

    const payload = {
      description,
      hoursOperated: toFiniteNumber(equipment.hours),
      notes: compactText(equipment.status),
    };
    const key = syncKey(payload.description, payload.hoursOperated, payload.notes);
    if (plantKeys.has(key)) continue;

    await fetchJson<unknown>(apiUrl(`/api/diary/${serverDiary.id}/plant`), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    plantKeys.add(key);
  }

  return serverDiary.id;
}

function sumDocketLabourHours(docket: OfflineDocket): number {
  return docket.labourEntries.reduce((total, entry) => {
    const workers = toFiniteNumber(entry.numberOfWorkers) ?? 1;
    const hours = toFiniteNumber(entry.hoursWorked) ?? 0;
    return total + workers * hours;
  }, 0);
}

function sumDocketPlantHours(docket: OfflineDocket): number {
  return docket.plantEntries.reduce(
    (total, entry) => total + (toFiniteNumber(entry.hoursUsed) ?? 0),
    0,
  );
}

function buildOfflineDocketNotes(docket: OfflineDocket): string | undefined {
  const sections: string[] = [];
  const notes = compactText(docket.notes);
  if (notes) {
    sections.push(notes);
  }

  if (docket.labourEntries.length > 0) {
    sections.push(
      [
        'Offline labour summary:',
        ...docket.labourEntries.map(
          (entry) =>
            `- ${entry.description}: ${entry.numberOfWorkers} worker(s) x ${entry.hoursWorked}h${entry.notes ? ` (${entry.notes})` : ''}`,
        ),
      ].join('\n'),
    );
  }

  if (docket.plantEntries.length > 0) {
    sections.push(
      [
        'Offline plant summary:',
        ...docket.plantEntries.map(
          (entry) =>
            `- ${entry.equipmentType}: ${entry.hoursUsed}h${entry.notes ? ` (${entry.notes})` : ''}`,
        ),
      ].join('\n'),
    );
  }

  return sections.join('\n\n') || undefined;
}

async function syncOfflineDocketDraft(docket: OfflineDocket): Promise<string> {
  if (docket.serverId) {
    return docket.serverId;
  }

  const result = await fetchJson<{ docket?: { id?: string } }>(apiUrl('/api/dockets'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId: docket.projectId,
      date: docket.date,
      labourHours: sumDocketLabourHours(docket),
      plantHours: sumDocketPlantHours(docket),
      notes: buildOfflineDocketNotes(docket),
    }),
  });

  const serverId = result.docket?.id;
  if (!serverId) {
    throw new Error('Docket sync did not return a server id');
  }

  return serverId;
}

export function useOfflineStatus(callbacks?: SyncCallbacks) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [conflictCount, setConflictCount] = useState(0);

  // Update online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update pending sync count and conflict count periodically
  useEffect(() => {
    const updateCounts = async () => {
      const syncCount = await getPendingSyncCount();
      setPendingSyncCount(syncCount);
      const conflicts = await getConflictedLotsCount();
      setConflictCount(conflicts);
    };

    updateCounts();
    const interval = setInterval(updateCounts, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Sync function
  const syncPendingChanges = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    let syncedCount = 0;
    const MAX_ATTEMPTS = 5;

    try {
      const items = await getPendingSyncItems();

      for (const item of items) {
        // Skip and remove items that have failed too many times
        if (item.attempts >= MAX_ATTEMPTS && item.id) {
          devWarn('[Sync] Removing item after max attempts:', item.type, item.id);
          await removeSyncQueueItem(item.id);
          continue;
        }

        if (item.type === 'itp_completion' && item.id) {
          try {
            const completion = item.data;

            // First, get the ITP instance for this lot
            const instanceResponse = await authFetch(
              apiUrl(`/api/itp/instances/lot/${completion.lotId}`),
            );

            if (!instanceResponse.ok) {
              await markSyncItemError(item.id, 'Could not find ITP instance for lot');
              continue;
            }

            const instanceData = await instanceResponse.json();
            const itpInstanceId = instanceData.instance?.id;

            if (!itpInstanceId) {
              await markSyncItemError(item.id, 'No ITP instance found for lot');
              continue;
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
              await removeSyncQueueItem(item.id);
              // Mark as synced
              await markCompletionSynced(completion.lotId, completion.checklistItemId);
              syncedCount++;
            } else {
              const errorText = await response.text();
              await markSyncItemError(item.id, errorText);
            }
          } catch (error) {
            if (item.id) {
              await markSyncItemError(
                item.id,
                error instanceof Error ? error.message : 'Unknown error',
              );
            }
          }
        }

        // Feature #312: Sync offline diaries
        if ((item.type === 'diary_save' || item.type === 'diary_submit') && item.id) {
          try {
            const { diaryId } = item.data;
            const diary = await offlineDb.diaries.get(diaryId);

            if (!diary) {
              // Diary was deleted, remove from queue
              await removeSyncQueueItem(item.id);
              continue;
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
                  await markSyncItemError(item.id, errorText);
                  await markDiarySyncError(diaryId);
                  continue;
                }
              }
            }

            // Remove from sync queue
            await removeSyncQueueItem(item.id);
            // Mark diary as synced
            await markDiarySynced(diaryId);
            syncedCount++;
          } catch (error) {
            if (item.id) {
              await markSyncItemError(
                item.id,
                error instanceof Error ? error.message : 'Unknown error',
              );
            }
            if (item.data?.diaryId) {
              await markDiarySyncError(item.data.diaryId);
            }
          }
        }

        // Feature #313: Sync offline dockets
        if ((item.type === 'docket_create' || item.type === 'docket_submit') && item.id) {
          try {
            const { docketId } = item.data;
            const docket = await offlineDb.dockets.get(docketId);

            if (!docket) {
              // Docket was deleted, remove from queue
              await removeSyncQueueItem(item.id);
              continue;
            }

            if (item.type === 'docket_create' && docket.serverId) {
              await markSyncItemError(
                item.id,
                'This offline docket is already synced. Open it online to make further changes.',
              );
              await markDocketSyncError(docketId);
              continue;
            }

            const serverId = await syncOfflineDocketDraft(docket);

            if (item.type === 'docket_create') {
              // Remove from sync queue
              await removeSyncQueueItem(item.id);
              // Mark docket as synced
              await markDocketSynced(docketId, serverId);
              syncedCount++;
            } else {
              await markDocketServerId(docketId, serverId);
              await markSyncItemError(
                item.id,
                'Offline docket draft synced. Submission requires online review so labour, plant, and lot allocations can be validated before approval.',
              );
              await markDocketSyncError(docketId);
            }
          } catch (error) {
            if (item.id) {
              await markSyncItemError(
                item.id,
                error instanceof Error ? error.message : 'Unknown error',
              );
            }
            if (item.data?.docketId) {
              await markDocketSyncError(item.data.docketId);
            }
          }
        }

        // Feature #311: Sync offline photos
        if (item.type === 'photo_upload' && item.id) {
          try {
            const { photoId } = item.data;
            const photo = await getOfflinePhoto(photoId);

            if (!photo) {
              // Photo was deleted, remove from queue
              await removeSyncQueueItem(item.id);
              continue;
            }

            // Convert base64 to blob for upload
            const response = await fetch(photo.dataUrl);
            const blob = await response.blob();

            // Create FormData for multipart upload
            const formData = new FormData();
            formData.append('file', blob, photo.fileName);
            formData.append('projectId', photo.projectId);
            if (photo.lotId) formData.append('lotId', photo.lotId);
            formData.append('entityType', photo.entityType);
            if (photo.entityId) formData.append('entityId', photo.entityId);
            if (photo.caption) formData.append('caption', photo.caption);
            if (photo.tags) formData.append('tags', JSON.stringify(photo.tags));
            if (photo.gpsLatitude) formData.append('gpsLatitude', String(photo.gpsLatitude));
            if (photo.gpsLongitude) formData.append('gpsLongitude', String(photo.gpsLongitude));
            formData.append('capturedAt', photo.capturedAt);

            // Upload to server
            const uploadResponse = await authFetch(apiUrl('/api/documents/upload'), {
              method: 'POST',
              body: formData,
            });

            if (uploadResponse.ok) {
              const result = await uploadResponse.json();
              // Remove from sync queue
              await removeSyncQueueItem(item.id);
              // Mark photo as synced
              await markPhotoSynced(photoId, result.document?.id);
              syncedCount++;
            } else {
              const errorText = await uploadResponse.text();
              await markSyncItemError(item.id, errorText);
              await markPhotoSyncError(photoId);
            }
          } catch (error) {
            if (item.id) {
              await markSyncItemError(
                item.id,
                error instanceof Error ? error.message : 'Unknown error',
              );
            }
            if (item.data?.photoId) {
              await markPhotoSyncError(item.data.photoId);
            }
          }
        }

        // Feature #314: Sync offline lot edits with conflict detection
        if (item.type === 'lot_edit' && item.id) {
          try {
            const { lotId, forceOverwrite } = item.data;
            const lot = await getOfflineLot(lotId);

            if (!lot) {
              // Lot was deleted, remove from queue
              await removeSyncQueueItem(item.id);
              continue;
            }

            if (!forceOverwrite && lot.syncStatus === 'conflict') {
              devWarn('[Sync] Removing stale lot edit queue item for conflicted lot:', lotId);
              await removeSyncQueueItem(item.id);
              continue;
            }

            if (!forceOverwrite && lot.syncStatus === 'synced') {
              devLog('[Sync] Removing stale lot edit queue item for synced lot:', lotId);
              await removeSyncQueueItem(item.id);
              continue;
            }

            // First, fetch current server state to check for conflicts
            const serverCheckResponse = await authFetch(apiUrl(`/api/lots/${lotId}`), {
              method: 'GET',
            });

            if (!serverCheckResponse.ok) {
              const errorText = await serverCheckResponse.text();
              await markSyncItemError(item.id, errorText);
              await markLotSyncError(lotId);
              continue;
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
                budget: serverLot.lot?.budget || serverLot.budget,
                notes: serverLot.lot?.notes || serverLot.notes,
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
                await removeSyncQueueItem(item.id);
                continue;
              }
            }

            // No conflict (or force overwrite) - proceed with sync
            const syncResponse = await authFetch(apiUrl(`/api/lots/${lotId}`), {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                lotNumber: lot.lotNumber,
                description: lot.description,
                chainage: lot.chainage,
                chainageStart: lot.chainageStart,
                chainageEnd: lot.chainageEnd,
                offset: lot.offset,
                offsetLeft: lot.offsetLeft,
                offsetRight: lot.offsetRight,
                layer: lot.layer,
                areaZone: lot.areaZone,
                activityType: lot.activityType,
                status: lot.status,
                budget: lot.budget,
                notes: lot.notes,
              }),
            });

            if (syncResponse.ok) {
              const result = await syncResponse.json();
              // Remove from sync queue
              await removeSyncQueueItem(item.id);
              // Mark lot as synced with new server timestamp
              await markLotSynced(lotId, result.lot?.updatedAt || new Date().toISOString());
              devLog('[Sync] Lot synced successfully:', lotId);
              syncedCount++;
            } else {
              const errorText = await syncResponse.text();
              await markSyncItemError(item.id, errorText);
              await markLotSyncError(lotId);
            }
          } catch (error) {
            if (item.id) {
              await markSyncItemError(
                item.id,
                error instanceof Error ? error.message : 'Unknown error',
              );
            }
            if (item.data?.lotId) {
              await markLotSyncError(item.data.lotId);
            }
          }
        }

        // Feature #314: Handle conflict notifications (just remove from queue after processing)
        if (item.type === 'lot_conflict' && item.id) {
          // Conflict notification item - just remove it, conflict is tracked in lot record
          await removeSyncQueueItem(item.id);
          continue;
        }

        // Remove unrecognized item types to prevent queue buildup
        const knownTypes = [
          'itp_completion',
          'photo_upload',
          'diary_save',
          'diary_submit',
          'docket_create',
          'docket_submit',
          'lot_edit',
          'lot_conflict',
        ];
        if (!knownTypes.includes(item.type) && item.id) {
          devWarn('[Sync] Removing unknown item type:', item.type);
          await removeSyncQueueItem(item.id);
        }
      }

      // Update counts after sync
      const count = await getPendingSyncCount();
      setPendingSyncCount(count);
      const conflicts = await getConflictedLotsCount();
      setConflictCount(conflicts);

      // Notify of sync completion if any items were synced
      if (syncedCount > 0 && callbacks?.onSyncComplete) {
        callbacks.onSyncComplete(syncedCount);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, callbacks]);

  // Auto-sync when coming back online (with debounce to prevent rapid re-triggering)
  useEffect(() => {
    if (isOnline && pendingSyncCount > 0 && !isSyncing) {
      const timeout = setTimeout(() => {
        syncPendingChanges();
      }, 1000); // Wait 1 second before auto-syncing
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, pendingSyncCount, isSyncing]); // Don't include syncPendingChanges to prevent loops

  return {
    isOnline,
    pendingSyncCount,
    isSyncing,
    syncPendingChanges,
    conflictCount,
  };
}
