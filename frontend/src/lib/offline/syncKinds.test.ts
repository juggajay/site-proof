// Unit tests for the pure sync-queue fold. No Dexie, no clock: the fold takes
// `now` so every age assertion is exact.
import { describe, expect, it } from 'vitest';
import type { SyncQueueItem } from './core';
import {
  MAX_SYNC_ATTEMPTS,
  SYNC_KINDS,
  emptySyncKindCounts,
  formatLastSynced,
  summariseSyncQueueItems,
  syncKindForType,
  type SyncKind,
} from './syncKinds';

const NOW = Date.parse('2026-07-28T10:00:00.000Z');

function item(overrides: {
  type: string;
  attempts?: number;
  createdAt?: string;
  id?: number;
}): SyncQueueItem {
  return {
    id: 1,
    action: 'update',
    data: {},
    createdAt: '2026-07-28T09:00:00.000Z',
    attempts: 0,
    ...overrides,
  } as unknown as SyncQueueItem;
}

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

describe('syncKindForType', () => {
  // Declared as a TOTAL record over the queue union: adding a twelfth queue
  // type to SyncQueueItem fails type-check here, so a new type can never be
  // silently dropped from the breakdown.
  const EXPECTED: Record<SyncQueueItem['type'], SyncKind> = {
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

  it('maps every queue type to a kind', () => {
    const types = Object.keys(EXPECTED) as Array<SyncQueueItem['type']>;
    expect(types).toHaveLength(11);
    for (const type of types) {
      expect(syncKindForType(type)).toBe(EXPECTED[type]);
    }
  });

  it('returns undefined for a type the queue no longer knows about', () => {
    expect(syncKindForType('legacy_thing')).toBeUndefined();
  });

  it('exposes every kind exactly once in the display order', () => {
    expect([...SYNC_KINDS].sort()).toEqual([...new Set(Object.values(EXPECTED))].sort());
    expect(Object.keys(emptySyncKindCounts()).sort()).toEqual([...SYNC_KINDS].sort());
  });
});

describe('summariseSyncQueueItems', () => {
  it('reports zeros and a null age for an empty queue', () => {
    expect(summariseSyncQueueItems([], NOW)).toEqual({
      live: 0,
      failed: 0,
      oldestPendingAgeMs: null,
      byKind: emptySyncKindCounts(),
    });
  });

  it('splits live from dead-lettered at the attempts threshold', () => {
    const summary = summariseSyncQueueItems(
      [
        item({ type: 'photo_upload', attempts: 0 }),
        item({ type: 'photo_upload', attempts: MAX_SYNC_ATTEMPTS - 1 }),
        item({ type: 'photo_upload', attempts: MAX_SYNC_ATTEMPTS }),
        item({ type: 'photo_upload', attempts: MAX_SYNC_ATTEMPTS + 2 }),
      ],
      NOW,
    );

    expect(summary.live).toBe(2);
    expect(summary.failed).toBe(2);
  });

  it('counts by kind across the totals, live and failed alike', () => {
    const summary = summariseSyncQueueItems(
      [
        item({ type: 'photo_upload', attempts: 0 }),
        item({ type: 'photo_upload', attempts: MAX_SYNC_ATTEMPTS }),
        item({ type: 'diary_save', attempts: 0 }),
        item({ type: 'event_save', attempts: 0 }),
        item({ type: 'docket_submit', attempts: 0 }),
      ],
      NOW,
    );

    expect(summary.byKind).toEqual({
      photos: 2,
      diary: 2,
      dockets: 1,
      itp: 0,
      defects: 0,
      lots: 0,
    });
    const kindTotal = SYNC_KINDS.reduce((sum, kind) => sum + summary.byKind[kind], 0);
    expect(kindTotal).toBe(summary.live + summary.failed);
  });

  it('counts an unknown type in the totals but never in a kind row', () => {
    const summary = summariseSyncQueueItems(
      [item({ type: 'photo_upload' }), item({ type: 'legacy_thing' })],
      NOW,
    );

    expect(summary.live).toBe(2);
    expect(summary.byKind.photos).toBe(1);
    const kindTotal = SYNC_KINDS.reduce((sum, kind) => sum + summary.byKind[kind], 0);
    expect(kindTotal).toBeLessThan(summary.live + summary.failed);
  });

  it('reports the age of the oldest row', () => {
    const summary = summariseSyncQueueItems(
      [
        item({ type: 'photo_upload', createdAt: minutesAgo(2) }),
        item({ type: 'photo_upload', createdAt: minutesAgo(10) }),
        item({ type: 'diary_save', createdAt: minutesAgo(5) }),
      ],
      NOW,
    );

    expect(summary.oldestPendingAgeMs).toBe(10 * 60_000);
  });

  // [SC-B4] — behaviour preservation for the "stuck" warning. The helper this
  // replaces took Math.min over createdAt with NO attempts filter; filtering the
  // age to live rows would switch the warning off on the most stuck queues.
  it('still reports an age when every row is dead-lettered', () => {
    const summary = summariseSyncQueueItems(
      [
        item({ type: 'photo_upload', attempts: MAX_SYNC_ATTEMPTS, createdAt: minutesAgo(180) }),
        item({ type: 'docket_create', attempts: MAX_SYNC_ATTEMPTS + 3, createdAt: minutesAgo(60) }),
      ],
      NOW,
    );

    expect(summary.live).toBe(0);
    expect(summary.oldestPendingAgeMs).toBe(180 * 60_000);
  });

  it('reports the dead-lettered row when it is the oldest in a mixed queue', () => {
    const summary = summariseSyncQueueItems(
      [
        item({ type: 'photo_upload', attempts: 0, createdAt: minutesAgo(5) }),
        item({ type: 'photo_upload', attempts: MAX_SYNC_ATTEMPTS, createdAt: minutesAgo(240) }),
      ],
      NOW,
    );

    expect(summary.live).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.oldestPendingAgeMs).toBe(240 * 60_000);
  });
});

// TZ-stable: both fixtures are built from NOW's LOCAL calendar day, so the
// same-day / earlier-day branch is exercised in any timezone, and the expected
// strings come from the same Intl formatters the helper uses.
describe('formatLastSynced', () => {
  function localTimeOn(dayOffset: number): Date {
    const at = new Date(NOW);
    at.setDate(at.getDate() + dayOffset);
    at.setHours(10, 42, 0, 0);
    return at;
  }

  it('shows time only for a sync earlier the same day', () => {
    const at = localTimeOn(0);
    expect(formatLastSynced(at.toISOString(), NOW)).toBe(
      `Last synced ${at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`,
    );
  });

  it('includes the date for a sync on an earlier day', () => {
    const at = localTimeOn(-2);
    const formatted = formatLastSynced(at.toISOString(), NOW);
    expect(formatted).toContain(
      at.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
    );
    expect(formatted).toContain(
      at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    );
  });

  it('never synthesises a time when nothing has been recorded', () => {
    expect(formatLastSynced(null, NOW)).toBe('Not synced on this device yet');
    expect(formatLastSynced('not-a-date', NOW)).toBe('Not synced on this device yet');
  });
});
