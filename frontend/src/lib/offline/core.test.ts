import { describe, expect, it } from 'vitest';
// Import through the public path: this also pins that the offlineDb singleton
// stays importable from '@/lib/offlineDb' after the core split.
import { offlineDb } from '@/lib/offlineDb';

// DB-free schema characterization: Dexie's version().stores() declarations are
// pure metadata, so the table layout is assertable without opening IndexedDB
// (jsdom has none). If this test fails, a shipped schema version was probably
// edited in place -- add a NEW Dexie version instead, because installed
// devices upgrade by replaying the version history they already hold.
describe('offline database core schema', () => {
  it('keeps the database name', () => {
    expect(offlineDb.name).toBe('SiteProofOfflineDB');
  });

  it('keeps the latest declared schema version at 6', () => {
    expect(offlineDb.verno).toBe(6);
  });

  it('keeps every table with its exact primary key and indexes', () => {
    const schema = Object.fromEntries(
      offlineDb.tables.map((table) => [
        table.name,
        [table.schema.primKey.src, ...table.schema.indexes.map((index) => index.src)],
      ]),
    );

    expect(schema).toEqual({
      itpChecklists: ['id', 'lotId', 'templateId', 'cachedAt'],
      itpCompletions: ['id', 'lotId', 'checklistItemId', 'syncStatus', 'localUpdatedAt'],
      syncQueue: ['++id', 'type', 'action', 'createdAt'],
      photos: ['id', 'projectId', 'lotId', 'entityType', 'entityId', 'syncStatus', 'capturedAt'],
      diaries: ['id', 'projectId', 'date', 'status', 'syncStatus', 'localUpdatedAt'],
      dockets: [
        'id',
        'projectId',
        'subcontractorCompanyId',
        'date',
        'status',
        'syncStatus',
        'localUpdatedAt',
      ],
      lots: ['id', 'projectId', 'lotNumber', 'syncStatus', 'localUpdatedAt'],
      diaryDeliveries: ['id', 'diaryId', 'syncStatus', 'localUpdatedAt'],
      diaryEvents: ['id', 'diaryId', 'syncStatus', 'localUpdatedAt'],
    });
  });
});
