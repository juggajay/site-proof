import { describe, expect, it } from 'vitest';
import {
  buildTemplateSnapshot,
  getChecklistItemsForInstance,
  isSubcontractorVisibleChecklistItem,
  parseTemplateSnapshot,
  resolveChecklistItemForInstance,
} from './templateSnapshot.js';

const SNAPSHOT_AT = new Date('2026-08-09T02:30:00.000Z');

/** The template shape as it existed before Wave G G2 added provenance columns. */
const preG2Template = {
  id: 'template-1',
  name: 'Earthworks ITP',
  description: 'Template description',
  activityType: 'Earthworks',
  checklistItems: [
    {
      id: 'item-2',
      description: 'Second item',
      sequenceNumber: 2,
      pointType: 'verification',
      responsibleParty: 'subcontractor',
      evidenceRequired: 'photo',
      acceptanceCriteria: 'Accepted',
      testType: null,
    },
    {
      id: 'item-1',
      description: 'First item',
      sequenceNumber: 1,
      pointType: 'hold_point',
      responsibleParty: 'superintendent',
      evidenceRequired: 'none',
      acceptanceCriteria: null,
      testType: 'density',
    },
  ],
};

describe('buildTemplateSnapshot', () => {
  it('captures the template fields and ordered checklist items needed by assigned ITP instances', () => {
    const snapshot = buildTemplateSnapshot(preG2Template, { snapshotAt: SNAPSHOT_AT });

    expect(snapshot).toEqual({
      id: 'template-1',
      name: 'Earthworks ITP',
      description: 'Template description',
      activityType: 'Earthworks',
      specificationReference: null,
      stateSpec: null,
      authority: null,
      specEdition: null,
      snapshotAt: '2026-08-09T02:30:00.000Z',
      checklistItems: [
        {
          id: 'item-1',
          description: 'First item',
          sequenceNumber: 1,
          pointType: 'hold_point',
          responsibleParty: 'superintendent',
          evidenceRequired: 'none',
          acceptanceCriteria: null,
          testType: 'density',
          notes: null,
        },
        {
          id: 'item-2',
          description: 'Second item',
          sequenceNumber: 2,
          pointType: 'verification',
          responsibleParty: 'subcontractor',
          evidenceRequired: 'photo',
          acceptanceCriteria: 'Accepted',
          testType: null,
          notes: null,
        },
      ],
    });
  });

  it('stamps a capture instant of its own when none is injected', () => {
    const before = Date.now();
    const snapshot = buildTemplateSnapshot(preG2Template);
    expect(new Date(snapshot.snapshotAt!).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('omits the backfill marker unless the backfill script asks for one', () => {
    expect(buildTemplateSnapshot(preG2Template)).not.toHaveProperty('backfilledAt');
    expect(buildTemplateSnapshot(preG2Template, { backfilledAt: SNAPSHOT_AT }).backfilledAt).toBe(
      '2026-08-09T02:30:00.000Z',
    );
  });
});

/**
 * AT-G11 (spec §2.4) — the G2 snapshot change is additive. Asserted THROUGH
 * `parseTemplateSnapshot`, never on the raw JSON: the parser reconstructs field
 * by field with no spread, so a field the builder writes and the parser forgets
 * would otherwise pass a raw-JSON test and evaporate in production. [GR-A4]
 */
describe('AT-G11 snapshot characterization', () => {
  const PRE_G2_FIELDS = ['id', 'name', 'description', 'activityType'] as const;
  const PRE_G2_ITEM_FIELDS = [
    'id',
    'description',
    'sequenceNumber',
    'pointType',
    'responsibleParty',
    'evidenceRequired',
    'acceptanceCriteria',
    'testType',
  ] as const;

  it('AT-G11 leaves every pre-G2 field byte-identical through a build/parse round trip', () => {
    // The exact bytes a pre-G2 build produced for this template.
    const preG2Json = JSON.stringify({
      id: 'template-1',
      name: 'Earthworks ITP',
      description: 'Template description',
      activityType: 'Earthworks',
      checklistItems: [
        {
          id: 'item-1',
          description: 'First item',
          sequenceNumber: 1,
          pointType: 'hold_point',
          responsibleParty: 'superintendent',
          evidenceRequired: 'none',
          acceptanceCriteria: null,
          testType: 'density',
        },
        {
          id: 'item-2',
          description: 'Second item',
          sequenceNumber: 2,
          pointType: 'verification',
          responsibleParty: 'subcontractor',
          evidenceRequired: 'photo',
          acceptanceCriteria: 'Accepted',
          testType: null,
        },
      ],
    });

    const legacy = parseTemplateSnapshot(preG2Json)!;
    const current = parseTemplateSnapshot(
      JSON.stringify(buildTemplateSnapshot(preG2Template, { snapshotAt: SNAPSHOT_AT })),
    )!;

    for (const field of PRE_G2_FIELDS) {
      expect(current[field]).toEqual(legacy[field]);
    }
    expect(current.checklistItems).toHaveLength(legacy.checklistItems.length);
    current.checklistItems.forEach((item, index) => {
      for (const field of PRE_G2_ITEM_FIELDS) {
        expect(item[field]).toEqual(legacy.checklistItems[index][field]);
      }
    });
  });

  it('AT-G11 carries the new provenance fields through the parser onto new snapshots', () => {
    const snapshot = buildTemplateSnapshot(
      {
        ...preG2Template,
        specificationReference: 'MRWA Spec 820',
        stateSpec: 'MRWA',
        authority: 'MRWA',
        specEdition: '04/10134',
        checklistItems: [
          {
            id: 'item-1',
            description: 'Pre-pour hold',
            sequenceNumber: 1,
            notes: 'MRWA Spec 820.52 HOLD.',
          },
        ],
      },
      { snapshotAt: SNAPSHOT_AT },
    );

    const parsed = parseTemplateSnapshot(JSON.stringify(snapshot))!;

    expect(parsed.specificationReference).toBe('MRWA Spec 820');
    expect(parsed.stateSpec).toBe('MRWA');
    expect(parsed.authority).toBe('MRWA');
    expect(parsed.specEdition).toBe('04/10134');
    expect(parsed.snapshotAt).toBe('2026-08-09T02:30:00.000Z');
    expect(parsed.checklistItems[0].notes).toBe('MRWA Spec 820.52 HOLD.');
  });

  it('AT-G11 reads a pre-G2 snapshot back with the additive fields null, never invented', () => {
    const parsed = parseTemplateSnapshot(
      JSON.stringify({
        id: 'template-1',
        name: 'Legacy',
        checklistItems: [{ id: 'item-1', description: 'Legacy item', sequenceNumber: 1 }],
      }),
    )!;

    expect(parsed.specificationReference).toBeNull();
    expect(parsed.stateSpec).toBeNull();
    expect(parsed.authority).toBeNull();
    expect(parsed.specEdition).toBeNull();
    expect(parsed.snapshotAt).toBeNull();
    expect(parsed.backfilledAt).toBeNull();
  });
});

/**
 * AT-G12 (spec §2.4) — the backfill marker has to survive the reader, because
 * that is the only thing that keeps a reconstructed snapshot distinguishable
 * from a genuine assignment-time capture. [GR-A4]
 */
describe('AT-G12 backfill marker', () => {
  it('AT-G12 survives a parseTemplateSnapshot round trip', () => {
    const backfilled = buildTemplateSnapshot(preG2Template, {
      snapshotAt: SNAPSHOT_AT,
      backfilledAt: SNAPSHOT_AT,
    });

    const parsed = parseTemplateSnapshot(JSON.stringify(backfilled))!;
    expect(parsed.backfilledAt).toBe('2026-08-09T02:30:00.000Z');
  });

  it('AT-G12 stops an instance falling through to live template data once backfilled', () => {
    const items = getChecklistItemsForInstance({
      templateSnapshot: JSON.stringify(
        buildTemplateSnapshot(
          { ...preG2Template, checklistItems: [{ id: 'backfilled-item', sequenceNumber: 1 }] },
          { snapshotAt: SNAPSHOT_AT, backfilledAt: SNAPSHOT_AT },
        ),
      ),
      template: { checklistItems: [{ id: 'live-item', sequenceNumber: 1 }] },
    });

    expect(items.map((item) => item.id)).toEqual(['backfilled-item']);
  });

  it('AT-G12 leaves a malformed snapshot reporting through the existing live fallback', () => {
    // The backfill selects on `templateSnapshot IS NULL` only, so a row whose
    // stored snapshot is unparseable is left for a human — and still reads
    // through the pre-existing fallback rather than a fabricated snapshot.
    expect(parseTemplateSnapshot('{bad json')).toBeNull();
    expect(parseTemplateSnapshot(JSON.stringify({ id: 'x', checklistItems: 'nope' }))).toBeNull();
    expect(
      getChecklistItemsForInstance({
        templateSnapshot: JSON.stringify({ id: 'x', name: 'x', checklistItems: 'nope' }),
        template: { checklistItems: [{ id: 'live-item', sequenceNumber: 1 }] },
      }).map((item) => item.id),
    ).toEqual(['live-item']);
  });
});

describe('getChecklistItemsForInstance', () => {
  it('uses the assigned snapshot instead of the live template when a valid snapshot exists', () => {
    const items = getChecklistItemsForInstance({
      templateSnapshot: JSON.stringify({
        id: 'template-1',
        name: 'Assigned ITP',
        checklistItems: [{ id: 'snapshot-item', description: 'Assigned item', sequenceNumber: 1 }],
      }),
      template: {
        checklistItems: [{ id: 'live-item', description: 'Added later', sequenceNumber: 1 }],
      },
    });

    expect(items.map((item) => item.id)).toEqual(['snapshot-item']);
  });

  it('falls back to the live template when legacy snapshot JSON is malformed', () => {
    const items = getChecklistItemsForInstance({
      templateSnapshot: '{bad json',
      template: {
        checklistItems: [{ id: 'live-item', description: 'Legacy fallback', sequenceNumber: 1 }],
      },
    });

    expect(items.map((item) => item.id)).toEqual(['live-item']);
  });
});

describe('resolveChecklistItemForInstance', () => {
  it('does not resolve live-template items that were added after a valid assignment snapshot', () => {
    const resolved = resolveChecklistItemForInstance(
      {
        templateSnapshot: JSON.stringify({
          id: 'template-1',
          name: 'Assigned ITP',
          checklistItems: [{ id: 'assigned-item', description: 'Assigned', sequenceNumber: 1 }],
        }),
      },
      'live-only-item',
      { id: 'live-only-item', description: 'Added later', sequenceNumber: 2 },
    );

    expect(resolved).toBeNull();
  });

  it('uses the live fallback for legacy instances without a valid snapshot', () => {
    const resolved = resolveChecklistItemForInstance({ templateSnapshot: null }, 'live-item', {
      id: 'live-item',
      description: 'Legacy live item',
      sequenceNumber: 1,
    });

    expect(resolved?.id).toBe('live-item');
  });
});

describe('isSubcontractorVisibleChecklistItem', () => {
  it('allows only contractor, subcontractor, and general items for subcontractor mutation paths', () => {
    expect(isSubcontractorVisibleChecklistItem({ responsibleParty: 'contractor' })).toBe(true);
    expect(isSubcontractorVisibleChecklistItem({ responsibleParty: 'subcontractor' })).toBe(true);
    expect(isSubcontractorVisibleChecklistItem({ responsibleParty: 'general' })).toBe(true);
    expect(isSubcontractorVisibleChecklistItem({ responsibleParty: 'superintendent' })).toBe(false);
    expect(isSubcontractorVisibleChecklistItem({ responsibleParty: 'client' })).toBe(false);
    expect(isSubcontractorVisibleChecklistItem({ responsibleParty: null })).toBe(false);
  });
});
