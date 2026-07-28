// Pure sync-queue vocabulary and folding. The only runtime import is
// ./syncErrors, which is itself pure and dependency-free; the `SyncQueueItem`
// import is type-only and erased. So anything that needs the kind vocabulary
// (including UI in the shell chunk) can use this module without pulling Dexie
// in behind it.

import type { SyncQueueItem } from './core';
import { humanSyncErrorText } from './syncErrors';

// A queue item that has failed this many times is "dead-lettered": the sync
// worker stops retrying it (so it can't trigger an endless retry storm) but it
// is NEVER deleted. The user keeps their data and can manually retry. Using the
// existing `attempts` count as the dead-letter predicate avoids a Dexie schema
// change (no new field, no version bump). Lives here rather than in
// syncQueue.ts so the pure fold below can read it without a circular import.
export const MAX_SYNC_ATTEMPTS = 5;

// localStorage key for the last successful flush. Written by whichever hook
// instance owns the sync worker, read by every instance on its poll — it is the
// only channel between instances of a non-shared hook.
export const LAST_SYNCED_AT_STORAGE_KEY = 'civos.sync.lastSyncedAt';

export type SyncKind = 'photos' | 'diary' | 'dockets' | 'itp' | 'defects' | 'lots';

// Display order. Fixed, never sorted by count, so a panel showing these rows
// does not reshuffle under the user's thumb while the queue drains.
export const SYNC_KINDS: readonly SyncKind[] = [
  'photos',
  'diary',
  'dockets',
  'itp',
  'defects',
  'lots',
];

// Every queue type maps to a kind. Typed as a total record so adding a twelfth
// queue type to SyncQueueItem is a compile error here, not a silent omission.
const KIND_BY_TYPE: Record<SyncQueueItem['type'], SyncKind> = {
  photo_upload: 'photos',
  diary_save: 'diary',
  diary_submit: 'diary',
  delivery_save: 'diary',
  event_save: 'diary',
  docket_create: 'dockets',
  docket_submit: 'dockets',
  itp_completion: 'itp',
  ncr_create: 'defects',
  lot_edit: 'lots',
  lot_conflict: 'lots',
};

// Unknown types return undefined: they are counted in the totals but excluded
// from the breakdown, matching the worker, which GCs unrecognised types. A kind
// row must never claim more than the total.
export function syncKindForType(type: string): SyncKind | undefined {
  return KIND_BY_TYPE[type as SyncQueueItem['type']];
}

export function emptySyncKindCounts(): Record<SyncKind, number> {
  return { photos: 0, diary: 0, dockets: 0, itp: 0, defects: 0, lots: 0 };
}

// "Last synced 10:42" for today, "Last synced Sat 26 Jul, 16:08" for any
// earlier day. A bare time for a sync that happened two days ago is the exact
// kind of lie this panel cannot afford. Pure and `now`-injected so it is
// testable without mocking the clock; native Intl, no date library.
export function formatLastSynced(iso: string | null, now: number): string {
  const synced = iso ? new Date(iso) : null;
  if (!synced || Number.isNaN(synced.getTime())) return 'Not synced on this device yet';

  const time = synced.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const today = new Date(now);
  const sameDay =
    synced.getFullYear() === today.getFullYear() &&
    synced.getMonth() === today.getMonth() &&
    synced.getDate() === today.getDate();
  if (sameDay) return `Last synced ${time}`;

  const date = synced.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `Last synced ${date}, ${time}`;
}

// A dead-lettered row, carrying the reason it stopped so the Sync Centre can
// say WHY instead of just how many. `lastError` was captured on every failure
// and rendered nowhere until this shape existed.
export interface SyncFailedItem {
  id?: number;
  kind?: SyncKind;
  message?: string;
}

export interface SyncQueueSummary {
  live: number; // attempts < MAX_SYNC_ATTEMPTS
  failed: number; // attempts >= MAX_SYNC_ATTEMPTS (dead-lettered)
  oldestPendingAgeMs: number | null; // null when the queue is empty
  // LIVE rows only. This feeds the panel's "Waiting" rows, and a dead-lettered
  // row is not waiting — it has stopped. Failures are reported by `failedItems`
  // under their own label; counting them here told the foreman to sit tight on
  // work that will never move on its own.
  byKind: Record<SyncKind, number>;
  failedItems: SyncFailedItem[];
}

function isDeadLettered(item: SyncQueueItem): boolean {
  return item.attempts >= MAX_SYNC_ATTEMPTS;
}

// One offline diary quick-add rewrites the whole day snapshot and queues
// ANOTHER `diary_save` replay for the same diary. The replays are idempotent
// (the snapshot sync dedupes per entry server-side), so twelve queued rows for
// one diary are ONE piece of pending work — "12 diary entries waiting" for a
// single diary is a lie about how much is outstanding.
//
// Counted once here rather than suppressed at enqueue time on purpose: the
// worker re-reads the diary from Dexie when it runs an item, so refusing the
// enqueue could silently drop a quick-add made while that item was mid-flight.
// ponytail: display-level coalescing; the queue still holds every replay (they
// are cheap and self-healing). Move it to enqueue time only if the redundant
// POSTs start costing something measurable.
function coalesceDiaryReplays(items: SyncQueueItem[]): SyncQueueItem[] {
  const indexByDiaryId = new Map<string, number>();
  const distinct: SyncQueueItem[] = [];

  for (const item of items) {
    if (item.type !== 'diary_save') {
      distinct.push(item);
      continue;
    }

    const diaryId = item.data.diaryId;
    const at = indexByDiaryId.get(diaryId);
    if (at === undefined) {
      indexByDiaryId.set(diaryId, distinct.length);
      distinct.push(item);
      continue;
    }
    // Prefer a replay the worker will still attempt: the diary only counts as
    // failed once EVERY replay for it has dead-lettered.
    if (isDeadLettered(distinct[at]) && !isDeadLettered(item)) {
      distinct[at] = item;
    }
  }

  return distinct;
}

// One pass over the queue, replacing the three separate full scans that used to
// run every 5 s in every mounted consumer.
export function summariseSyncQueueItems(items: SyncQueueItem[], now: number): SyncQueueSummary {
  const byKind = emptySyncKindCounts();
  const failedItems: SyncFailedItem[] = [];
  let live = 0;
  let failed = 0;
  let oldestCreatedMs: number | null = null;

  for (const item of coalesceDiaryReplays(items)) {
    const kind = syncKindForType(item.type);

    if (isDeadLettered(item)) {
      failed += 1;
      failedItems.push({ id: item.id, kind, message: humanSyncErrorText(item.lastError) });
    } else {
      live += 1;
      if (kind) {
        byKind[kind] += 1;
      }
    }
  }

  // Deliberately over EVERY row — dead-lettered AND coalesced replays included:
  // this reproduces getOldestPendingItemAge's Math.min over all createdAt
  // values, and its value feeds the "stuck" warning. Filtering here would switch
  // that warning off on precisely the queues that are most stuck.
  for (const item of items) {
    const createdMs = new Date(item.createdAt).getTime();
    if (!Number.isNaN(createdMs) && (oldestCreatedMs === null || createdMs < oldestCreatedMs)) {
      oldestCreatedMs = createdMs;
    }
  }

  return {
    live,
    failed,
    byKind,
    failedItems,
    oldestPendingAgeMs: oldestCreatedMs === null ? null : now - oldestCreatedMs,
  };
}
