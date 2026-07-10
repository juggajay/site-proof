import { describe, expect, it } from 'vitest';
import { mapCachedToItpInstance, mapInstanceToOfflineItems } from './itpOfflineMapping';
import type { ITPChecklistItem, ITPCompletion, ITPInstance } from '../types';
import type { OfflineChecklistItem, OfflineITPChecklist } from '@/lib/offlineDb';

// --- fixture builders ------------------------------------------------------

const makeChecklistItem = (overrides: Partial<ITPChecklistItem> = {}): ITPChecklistItem => ({
  id: 'item-1',
  description: 'Compaction test',
  category: 'Earthworks',
  responsibleParty: 'contractor',
  isHoldPoint: false,
  pointType: 'standard',
  evidenceRequired: 'none',
  order: 0,
  testType: null,
  acceptanceCriteria: '95% MDD',
  ...overrides,
});

const makeCompletion = (overrides: Partial<ITPCompletion> = {}): ITPCompletion => ({
  id: 'completion-1',
  checklistItemId: 'item-1',
  isCompleted: false,
  isNotApplicable: false,
  isFailed: false,
  notes: null,
  completedAt: null,
  completedBy: null,
  isVerified: false,
  verifiedAt: null,
  verifiedBy: null,
  attachments: [],
  ...overrides,
});

const makeInstance = (
  checklistItems: ITPChecklistItem[],
  completions: ITPCompletion[],
): ITPInstance => ({
  id: 'instance-1',
  template: { id: 'template-1', name: 'Earthworks ITP', checklistItems },
  completions,
});

// Optional cached fields (description/notes/completedAt/completedBy) are omitted
// from the base so tests can exercise the "missing" branch without relying on
// explicit `undefined`.
const makeCachedItem = (overrides: Partial<OfflineChecklistItem> = {}): OfflineChecklistItem => ({
  id: 'item-1',
  name: 'Compaction test',
  responsibleParty: 'contractor',
  isHoldPoint: false,
  status: 'pending',
  ...overrides,
});

const makeCached = (items: OfflineChecklistItem[]): OfflineITPChecklist => ({
  id: 'lot-cache-1',
  lotId: 'lot-1',
  templateId: 'template-1',
  templateName: 'Earthworks ITP',
  items,
  cachedAt: '2026-05-31T00:00:00.000Z',
});

// --- mapInstanceToOfflineItems (server instance -> offline cache rows) ------

describe('mapInstanceToOfflineItems', () => {
  it('derives completed / na / failed / pending status from the matching completion', () => {
    const items = [
      makeChecklistItem({ id: 'a' }),
      makeChecklistItem({ id: 'b' }),
      makeChecklistItem({ id: 'c' }),
      makeChecklistItem({ id: 'd' }),
    ];
    const completions = [
      makeCompletion({ checklistItemId: 'a', isCompleted: true }),
      makeCompletion({ checklistItemId: 'b', isNotApplicable: true }),
      makeCompletion({ checklistItemId: 'c', isFailed: true }),
      // 'd' has no completion -> pending
    ];

    const result = mapInstanceToOfflineItems(makeInstance(items, completions));

    expect(result.map((i) => i.status)).toEqual(['completed', 'na', 'failed', 'pending']);
  });

  it('treats a completion with no status flags set as pending', () => {
    const items = [makeChecklistItem({ id: 'a' })];
    const completions = [makeCompletion({ checklistItemId: 'a' })]; // all flags false

    expect(mapInstanceToOfflineItems(makeInstance(items, completions))[0].status).toBe('pending');
  });

  it('stores the server completion base used to reject stale offline sync later', () => {
    const items = [makeChecklistItem({ id: 'a' })];
    const completions = [
      makeCompletion({
        id: 'completion-1',
        checklistItemId: 'a',
        isCompleted: true,
        notes: 'Server pass',
        completedAt: '2026-06-12T00:00:00.000Z',
      }),
    ];

    expect(
      mapInstanceToOfflineItems(makeInstance(items, completions))[0].serverCompletionBase,
    ).toEqual({
      exists: true,
      id: 'completion-1',
      status: 'completed',
      notes: 'Server pass',
      completedAt: '2026-06-12T00:00:00.000Z',
    });
  });

  it('prefers failed over N/A/completed when multiple flags are set', () => {
    const items = [makeChecklistItem({ id: 'a' })];
    const completions = [
      makeCompletion({
        checklistItemId: 'a',
        isCompleted: true,
        isNotApplicable: true,
        isFailed: true,
      }),
    ];

    expect(mapInstanceToOfflineItems(makeInstance(items, completions))[0].status).toBe('failed');
  });

  it('maps backend N/A double-flag rows as N/A, not completed', () => {
    const items = [makeChecklistItem({ id: 'a' })];
    const completions = [
      makeCompletion({
        checklistItemId: 'a',
        isCompleted: true,
        isNotApplicable: true,
      }),
    ];

    const [mapped] = mapInstanceToOfflineItems(makeInstance(items, completions));

    expect(mapped.status).toBe('na');
    expect(mapped.serverCompletionBase?.status).toBe('not_applicable');
  });

  it('trusts the raw server status over derived flags when both are present', () => {
    const items = [makeChecklistItem({ id: 'a' })];
    const completions = [
      makeCompletion({
        checklistItemId: 'a',
        status: 'not_applicable',
        isCompleted: true,
        isNotApplicable: true,
      }),
    ];

    const [mapped] = mapInstanceToOfflineItems(makeInstance(items, completions));

    expect(mapped.status).toBe('na');
    expect(mapped.serverCompletionBase?.status).toBe('not_applicable');
  });

  it('maps checklist fields: description->name, acceptanceCriteria->description, party + hold point passthrough', () => {
    const items = [
      makeChecklistItem({
        id: 'a',
        description: 'Proof roll',
        acceptanceCriteria: 'No deflection',
        responsibleParty: 'subcontractor',
        isHoldPoint: true,
      }),
    ];

    const [item] = mapInstanceToOfflineItems(makeInstance(items, []));

    expect(item).toMatchObject({
      id: 'a',
      name: 'Proof roll',
      description: 'No deflection',
      responsibleParty: 'subcontractor',
      isHoldPoint: true,
    });
  });

  it('falls back to undefined description for a null acceptanceCriteria', () => {
    const items = [makeChecklistItem({ acceptanceCriteria: null })];

    expect(mapInstanceToOfflineItems(makeInstance(items, []))[0].description).toBeUndefined();
  });

  it('preserves completion evidence (notes, completedAt, completedBy name) when present', () => {
    const items = [makeChecklistItem({ id: 'a' })];
    const completions = [
      makeCompletion({
        checklistItemId: 'a',
        isCompleted: true,
        notes: 'Looks good',
        completedAt: '2026-05-30T10:00:00.000Z',
        completedBy: { id: 'u1', fullName: 'Jane Foreman', email: 'jane@example.com' },
      }),
    ];

    const [item] = mapInstanceToOfflineItems(makeInstance(items, completions));

    expect(item).toMatchObject({
      notes: 'Looks good',
      completedAt: '2026-05-30T10:00:00.000Z',
      completedBy: 'Jane Foreman',
    });
  });

  it('leaves evidence fields undefined when the completion lacks them', () => {
    const items = [makeChecklistItem({ id: 'a' })];
    const completions = [
      makeCompletion({ checklistItemId: 'a', isCompleted: true, completedBy: null }),
    ];

    const [item] = mapInstanceToOfflineItems(makeInstance(items, completions));

    expect(item.notes).toBeUndefined();
    expect(item.completedAt).toBeUndefined();
    expect(item.completedBy).toBeUndefined();
  });

  it('persists the granular pointType alongside the isHoldPoint flag', () => {
    const items = [
      makeChecklistItem({ id: 'w', pointType: 'witness', isHoldPoint: false }),
      makeChecklistItem({ id: 'h', pointType: 'hold_point', isHoldPoint: true }),
    ];

    const result = mapInstanceToOfflineItems(makeInstance(items, []));

    expect(result.map((i) => i.isHoldPoint)).toEqual([false, true]);
    expect(result.map((i) => i.pointType)).toEqual(['witness', 'hold_point']);
  });
});

// --- mapCachedToItpInstance (offline cache rows -> synthesized instance) ----

describe('mapCachedToItpInstance', () => {
  it('reconstructs the instance id and template metadata from the cached checklist', () => {
    const instance = mapCachedToItpInstance(makeCached([makeCachedItem()]));

    expect(instance.id).toBe('offline-lot-cache-1');
    expect(instance.template.id).toBe('template-1');
    expect(instance.template.name).toBe('Earthworks ITP');
  });

  it('rebuilds every cached item as a checklist item, including pending ones', () => {
    const cached = makeCached([
      makeCachedItem({ id: 'a', status: 'completed' }),
      makeCachedItem({ id: 'b', status: 'pending' }),
    ]);

    expect(mapCachedToItpInstance(cached).template.checklistItems).toHaveLength(2);
  });

  it('maps cached item fields with offline defaults (category, evidenceRequired, order, testType)', () => {
    const cached = makeCached([
      makeCachedItem({
        id: 'a',
        name: 'Compaction',
        description: '95% MDD',
        responsibleParty: 'superintendent',
        isHoldPoint: true,
      }),
    ]);

    const [item] = mapCachedToItpInstance(cached).template.checklistItems;

    expect(item).toEqual({
      id: 'a',
      description: 'Compaction',
      category: 'General',
      responsibleParty: 'superintendent',
      isHoldPoint: true,
      pointType: 'hold_point',
      evidenceRequired: 'none',
      order: 0,
      acceptanceCriteria: '95% MDD',
      testType: null,
    });
  });

  it('normalizes an unknown responsibleParty to "general" and null-ifies a missing description', () => {
    const cached = makeCached([makeCachedItem({ responsibleParty: 'project_manager' })]);

    const [item] = mapCachedToItpInstance(cached).template.checklistItems;

    expect(item.responsibleParty).toBe('general');
    expect(item.acceptanceCriteria).toBeNull();
  });

  it('uses the persisted pointType when present (witness survives, not collapsed to standard)', () => {
    const cached = makeCached([
      makeCachedItem({ id: 'w', pointType: 'witness', isHoldPoint: false }),
      makeCachedItem({ id: 'v', pointType: 'verification', isHoldPoint: false }),
      makeCachedItem({ id: 'h', pointType: 'hold_point', isHoldPoint: true }),
    ]);

    const items = mapCachedToItpInstance(cached).template.checklistItems;

    expect(items.map((i) => i.pointType)).toEqual(['witness', 'verification', 'hold_point']);
  });

  it('falls back to isHoldPoint for pre-fix cache rows that lack pointType', () => {
    // Old cache entries (written before F-08) have no pointType field.
    const cached = makeCached([
      makeCachedItem({ id: 'h', isHoldPoint: true }),
      makeCachedItem({ id: 's', isHoldPoint: false }),
    ]);

    const items = mapCachedToItpInstance(cached).template.checklistItems;

    expect(items.map((i) => i.pointType)).toEqual(['hold_point', 'standard']);
  });

  it('assigns sequential order indexes', () => {
    const cached = makeCached([
      makeCachedItem({ id: 'a' }),
      makeCachedItem({ id: 'b' }),
      makeCachedItem({ id: 'c' }),
    ]);

    const items = mapCachedToItpInstance(cached).template.checklistItems;

    expect(items.map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it('builds completions only for non-pending items', () => {
    const cached = makeCached([
      makeCachedItem({ id: 'a', status: 'completed' }),
      makeCachedItem({ id: 'b', status: 'pending' }),
      makeCachedItem({ id: 'c', status: 'na' }),
      makeCachedItem({ id: 'd', status: 'failed' }),
    ]);

    const { completions } = mapCachedToItpInstance(cached);

    expect(completions.map((c) => c.checklistItemId)).toEqual(['a', 'c', 'd']);
  });

  it('derives completion flags from the cached status', () => {
    const cached = makeCached([
      makeCachedItem({ id: 'a', status: 'completed' }),
      makeCachedItem({ id: 'c', status: 'na' }),
      makeCachedItem({ id: 'd', status: 'failed' }),
    ]);

    const { completions } = mapCachedToItpInstance(cached);

    expect(completions).toEqual([
      expect.objectContaining({
        checklistItemId: 'a',
        isCompleted: true,
        isNotApplicable: false,
        isFailed: false,
      }),
      expect.objectContaining({
        checklistItemId: 'c',
        isCompleted: false,
        isNotApplicable: true,
        isFailed: false,
      }),
      expect.objectContaining({
        checklistItemId: 'd',
        isCompleted: false,
        isNotApplicable: false,
        isFailed: true,
      }),
    ]);
  });

  it('wraps a present completedBy name into an offline user object and defaults the rest', () => {
    const cached = makeCached([
      makeCachedItem({
        id: 'a',
        status: 'completed',
        notes: 'Done',
        completedAt: '2026-05-30T10:00:00.000Z',
        completedBy: 'Jane Foreman',
      }),
    ]);

    const [completion] = mapCachedToItpInstance(cached).completions;

    expect(completion).toEqual({
      id: 'offline-a',
      checklistItemId: 'a',
      isCompleted: true,
      isNotApplicable: false,
      isFailed: false,
      notes: 'Done',
      completedAt: '2026-05-30T10:00:00.000Z',
      completedBy: { id: 'offline', fullName: 'Jane Foreman', email: '' },
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      attachments: [],
    });
  });

  it('null-ifies completedBy/notes/completedAt and empties attachments when the cached item omits them', () => {
    const cached = makeCached([makeCachedItem({ id: 'a', status: 'failed' })]);

    const [completion] = mapCachedToItpInstance(cached).completions;

    expect(completion.completedBy).toBeNull();
    expect(completion.notes).toBeNull();
    expect(completion.completedAt).toBeNull();
    expect(completion.attachments).toEqual([]);
    expect(completion.isVerified).toBe(false);
  });
});

// --- round-trip: pointType is preserved (F-08) ------------------------------

describe('offline round-trip', () => {
  it('preserves a witness point across the round-trip (F-08: no longer collapses to standard)', () => {
    const witnessItem = makeChecklistItem({ id: 'w', pointType: 'witness', isHoldPoint: false });

    const offlineItems = mapInstanceToOfflineItems(makeInstance([witnessItem], []));
    const reconstructed = mapCachedToItpInstance(makeCached(offlineItems));

    expect(reconstructed.template.checklistItems[0].pointType).toBe('witness');
  });

  it('preserves a hold point across the round-trip', () => {
    const holdItem = makeChecklistItem({ id: 'h', pointType: 'hold_point', isHoldPoint: true });

    const offlineItems = mapInstanceToOfflineItems(makeInstance([holdItem], []));
    const reconstructed = mapCachedToItpInstance(makeCached(offlineItems));

    expect(reconstructed.template.checklistItems[0].pointType).toBe('hold_point');
  });

  it('reconstructs a pre-fix cache row (no pointType) without crashing, via isHoldPoint fallback', () => {
    // Simulate a cache row written before F-08: pointType absent on the row.
    const legacyRow = makeCachedItem({ id: 'w', isHoldPoint: false });
    delete (legacyRow as { pointType?: string }).pointType;

    const reconstructed = mapCachedToItpInstance(makeCached([legacyRow]));

    expect(reconstructed.template.checklistItems[0].pointType).toBe('standard');
  });
});
