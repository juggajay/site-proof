// Offline write path for the mobile diary quick-add sheets.
//
// When a quick-add POST fails on a retriable network failure (offline,
// timeout, fetch-level failure, 5xx), useDiaryMobileHandlers queues the typed
// entry here instead of losing it. Two existing stores are reused — nothing
// new is invented:
//
//  - Activities, delays, plant, and weather ride the OfflineDailyDiary
//    snapshot (saveDiaryOffline + the worker's existing `diary_save` executor,
//    which upserts POST /api/diary and replays entries with dedupe keys).
//    The snapshot model is deliberately narrow, so fields it cannot represent
//    are folded into the surviving free-text field rather than dropped:
//    activity quantity/unit -> progress (synced as notes), plant rego/company
//    -> status (synced as notes). A delay's lot link has no offline home and
//    is dropped — the description text the foreman typed is preserved.
//  - Deliveries and events get full-fidelity rows in the dedicated
//    diaryDeliveries/diaryEvents tables (Dexie v6) and queue the
//    `delivery_save`/`event_save` items the worker now executes.
//
// Queue hygiene: every snapshot write queues another `diary_save` item for the
// same diary id. Replays are safe (the snapshot sync dedupes per-entry), and a
// previously SYNCED snapshot is restarted fresh so already-delivered entries
// are never replayed against later online edits.

import { createLocalId } from '../localIds';
import {
  offlineDb,
  type OfflineDailyDiary,
  type OfflineDiaryDelivery,
  type OfflineDiaryEvent,
} from './core';
import { getOfflineDiary, saveDiaryOffline } from './diaries';

// createdBy is local-only metadata (the snapshot sync never sends it; the
// server attributes writes to the authenticated user at sync time).
const OFFLINE_USER = 'offline';

type OfflineDiarySnapshotDraft = Omit<
  OfflineDailyDiary,
  'id' | 'projectId' | 'date' | 'syncStatus' | 'localUpdatedAt'
>;

// Where a queued delivery/event belongs. With a server diary on hand, store
// its id directly; with no server diary yet (fully offline day), anchor to the
// local snapshot — the sync worker resolves the snapshot to a server diary id
// before posting the entry.
export type OfflineDiaryRef = { diaryId: string } | { projectId: string; date: string };

function emptySnapshotDraft(): OfflineDiarySnapshotDraft {
  return {
    status: 'draft',
    weather: {},
    workforce: { contractors: 0, subcontractors: 0, visitors: 0 },
    activities: [],
    delays: [],
    equipment: [],
    notes: '',
    createdBy: OFFLINE_USER,
  };
}

function joinDetailText(parts: Array<string | undefined>): string | undefined {
  const text = parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' — ');
  return text || undefined;
}

// Load the unsynced snapshot for the date, or start a fresh one. A snapshot
// already marked 'synced' must NOT be appended to: its entries reached the
// server, and replaying them after later online edits would duplicate them.
async function upsertSnapshot(
  projectId: string,
  date: string,
  mutate: (draft: OfflineDiarySnapshotDraft) => void,
): Promise<OfflineDailyDiary> {
  const existing = await getOfflineDiary(projectId, date);
  const draft: OfflineDiarySnapshotDraft =
    existing && existing.syncStatus !== 'synced'
      ? {
          status: existing.status,
          weather: { ...existing.weather },
          workforce: { ...existing.workforce },
          activities: [...existing.activities],
          delays: [...existing.delays],
          equipment: [...existing.equipment],
          notes: existing.notes,
          createdBy: existing.createdBy,
        }
      : emptySnapshotDraft();

  mutate(draft);
  return saveDiaryOffline(projectId, date, draft, draft.createdBy || OFFLINE_USER);
}

// --- Snapshot-backed quick-adds (activity / delay / plant / weather) --------

export async function queueDiaryActivityOffline(
  projectId: string,
  date: string,
  data: { description: string; lotId?: string; quantity?: number; unit?: string; notes?: string },
): Promise<OfflineDailyDiary> {
  return upsertSnapshot(projectId, date, (draft) => {
    draft.activities.push({
      id: createLocalId('activity'),
      description: data.description,
      lotIds: data.lotId ? [data.lotId] : undefined,
      // The snapshot has no quantity/unit fields; fold them into the progress
      // text (synced as the activity's notes) so the figures are not lost.
      progress: joinDetailText([
        data.notes,
        data.quantity !== undefined
          ? `Qty: ${data.quantity}${data.unit ? ` ${data.unit}` : ''}`
          : undefined,
      ]),
    });
  });
}

export async function queueDiaryDelayOffline(
  projectId: string,
  date: string,
  data: { delayType: string; description: string; durationHours?: number; impact?: string },
): Promise<OfflineDailyDiary> {
  return upsertSnapshot(projectId, date, (draft) => {
    draft.delays.push({
      id: createLocalId('delay'),
      type: data.delayType,
      description: data.description,
      duration: data.durationHours,
      impact: data.impact,
    });
  });
}

export async function queueDiaryPlantOffline(
  projectId: string,
  date: string,
  data: { description: string; idRego?: string; company?: string; hoursOperated?: number },
): Promise<OfflineDailyDiary> {
  return upsertSnapshot(projectId, date, (draft) => {
    draft.equipment.push({
      id: createLocalId('plant'),
      name: data.description,
      hours: data.hoursOperated,
      // The snapshot has no rego/company fields; fold them into the status
      // text (synced as the plant entry's notes) so they are not lost.
      status: joinDetailText([data.idRego ? `Rego: ${data.idRego}` : undefined, data.company]),
    });
  });
}

export async function queueDiaryWeatherOffline(
  projectId: string,
  date: string,
  data: {
    conditions?: string;
    temperatureMin?: number;
    temperatureMax?: number;
    rainfallMm?: number;
  },
): Promise<OfflineDailyDiary> {
  return upsertSnapshot(projectId, date, (draft) => {
    draft.weather = {
      ...draft.weather,
      conditions: data.conditions ?? draft.weather.conditions,
      temperatureMin: data.temperatureMin ?? draft.weather.temperatureMin,
      temperatureMax: data.temperatureMax ?? draft.weather.temperatureMax,
      rainfall: data.rainfallMm ?? draft.weather.rainfall,
    };
  });
}

// --- Table-backed quick-adds (delivery / event) ------------------------------

async function resolveDiaryAnchorId(ref: OfflineDiaryRef): Promise<string> {
  if ('diaryId' in ref) {
    return ref.diaryId;
  }

  // No server diary yet: anchor to the local snapshot, creating it (and its
  // diary_save queue item, which upserts the server diary on sync) if needed.
  const existing = await getOfflineDiary(ref.projectId, ref.date);
  if (existing) {
    return existing.id;
  }

  const created = await saveDiaryOffline(
    ref.projectId,
    ref.date,
    emptySnapshotDraft(),
    OFFLINE_USER,
  );
  return created.id;
}

export async function queueDiaryDeliveryOffline(
  ref: OfflineDiaryRef,
  data: {
    description: string;
    supplier?: string;
    docketNumber?: string;
    quantity?: number;
    unit?: string;
    lotId?: string;
    notes?: string;
  },
): Promise<OfflineDiaryDelivery> {
  const delivery: OfflineDiaryDelivery = {
    id: createLocalId('delivery'),
    diaryId: await resolveDiaryAnchorId(ref),
    description: data.description,
    supplier: data.supplier,
    docketNumber: data.docketNumber,
    quantity: data.quantity,
    unit: data.unit,
    lotId: data.lotId,
    notes: data.notes,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
  };

  await offlineDb.diaryDeliveries.put(delivery);
  await offlineDb.syncQueue.add({
    type: 'delivery_save',
    action: 'create',
    data: { deliveryId: delivery.id },
    createdAt: new Date().toISOString(),
    attempts: 0,
  });

  return delivery;
}

export async function queueDiaryEventOffline(
  ref: OfflineDiaryRef,
  data: { eventType: string; description: string; notes?: string; lotId?: string },
): Promise<OfflineDiaryEvent> {
  const event: OfflineDiaryEvent = {
    id: createLocalId('event'),
    diaryId: await resolveDiaryAnchorId(ref),
    eventType: data.eventType,
    description: data.description,
    notes: data.notes,
    lotId: data.lotId,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
  };

  await offlineDb.diaryEvents.put(event);
  await offlineDb.syncQueue.add({
    type: 'event_save',
    action: 'create',
    data: { eventId: event.id },
    createdAt: new Date().toISOString(),
    attempts: 0,
  });

  return event;
}

// --- Sync-status markers used by the worker's delivery/event executors ------

export async function markDeliverySynced(deliveryId: string): Promise<void> {
  await offlineDb.diaryDeliveries.update(deliveryId, {
    syncStatus: 'synced',
    localUpdatedAt: new Date().toISOString(),
  });
}

export async function markDeliverySyncError(deliveryId: string): Promise<void> {
  await offlineDb.diaryDeliveries.update(deliveryId, {
    syncStatus: 'error',
    localUpdatedAt: new Date().toISOString(),
  });
}

export async function markEventSynced(eventId: string): Promise<void> {
  await offlineDb.diaryEvents.update(eventId, {
    syncStatus: 'synced',
    localUpdatedAt: new Date().toISOString(),
  });
}

export async function markEventSyncError(eventId: string): Promise<void> {
  await offlineDb.diaryEvents.update(eventId, {
    syncStatus: 'error',
    localUpdatedAt: new Date().toISOString(),
  });
}
