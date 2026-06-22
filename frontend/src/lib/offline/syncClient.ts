import { apiUrl, authFetch } from '../api';
import type { OfflineDailyDiary, OfflineDocket } from '../offlineDb';
import {
  buildOfflineDiaryPayload,
  buildOfflineDocketNotes,
  compactText,
  sumDocketLabourHours,
  sumDocketPlantHours,
  syncKey,
  toFiniteNumber,
} from './syncPayloads';

export type SyncWorkerResult = {
  syncedCount: number;
};

type BrowserLockManager = {
  request<T>(
    name: string,
    options: { ifAvailable: true },
    callback: (lock: unknown | null) => T | Promise<T>,
  ): Promise<T>;
};

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

const OFFLINE_SYNC_LOCK_NAME = 'siteproof-offline-sync';
let activeOfflineSyncPromise: Promise<SyncWorkerResult> | null = null;

function getBrowserLockManager(): BrowserLockManager | undefined {
  return (navigator as Navigator & { locks?: BrowserLockManager }).locks;
}

export async function runExclusiveOfflineSync(
  worker: () => Promise<SyncWorkerResult>,
): Promise<SyncWorkerResult> {
  if (activeOfflineSyncPromise) {
    return activeOfflineSyncPromise;
  }

  activeOfflineSyncPromise = (async () => {
    const locks = getBrowserLockManager();
    if (!locks) {
      return worker();
    }

    return locks.request(OFFLINE_SYNC_LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (!lock) {
        return { syncedCount: 0 };
      }

      return worker();
    });
  })().finally(() => {
    activeOfflineSyncPromise = null;
  });

  return activeOfflineSyncPromise;
}

export async function readResponseError(response: Response): Promise<string> {
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

export async function syncOfflineDiarySnapshot(diary: OfflineDailyDiary): Promise<string> {
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

export async function syncOfflineDocketDraft(docket: OfflineDocket): Promise<string> {
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
      subcontractorCompanyId: docket.subcontractorCompanyId,
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
