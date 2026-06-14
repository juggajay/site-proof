import { describe, expect, it } from 'vitest';
import {
  buildEmptyHoldPointListResponse,
  buildHoldPointListResponse,
  buildHoldPointListItems,
  type HoldPointListChecklistItem,
  type HoldPointListCompletion,
  type HoldPointListLot,
  type HoldPointListPersistedHoldPoint,
} from './listPresentation.js';

/**
 * Characterizes the pure hold-point list presentation helper extracted verbatim
 * from backend/src/routes/holdpoints.ts (the GET /project/:projectId list route).
 * These freeze: the release-gated item filter, the persisted-vs-virtual
 * id/fields selection, the `virtual-${lot.id}-${item.id}` key shape, the
 * completion `isCompleted`/`isVerified` derivations, and the
 * "lot number then sequence number" sort. All inputs are plain fixtures — no
 * database. Date fields are passed through by reference, so their assertions are
 * timezone-independent.
 */

const LOT_CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const HP_CREATED_AT = new Date('2026-02-02T03:04:05.000Z');
const HP_NOTIFIED_AT = new Date('2026-02-03T00:00:00.000Z');
const HP_SCHEDULED_AT = new Date('2026-02-04T00:00:00.000Z');
const HP_RELEASED_AT = new Date('2026-02-05T00:00:00.000Z');

function checklistItem(
  overrides: Partial<HoldPointListChecklistItem> & Pick<HoldPointListChecklistItem, 'id'>,
): HoldPointListChecklistItem {
  return {
    description: `desc-${overrides.id}`,
    pointType: 'hold_point',
    responsibleParty: 'contractor',
    sequenceNumber: 1,
    ...overrides,
  };
}

function lot(
  overrides: Partial<HoldPointListLot> & Pick<HoldPointListLot, 'id' | 'lotNumber'>,
): HoldPointListLot {
  return {
    createdAt: LOT_CREATED_AT,
    itpInstance: {
      template: { checklistItems: [] },
      completions: [],
    },
    holdPoints: [],
    ...overrides,
  };
}

describe('buildHoldPointListItems', () => {
  it('includes release-gated hold points and superintendent sign-off items only', () => {
    const result = buildHoldPointListItems([
      lot({
        id: 'lot1',
        lotNumber: 'A',
        itpInstance: {
          template: {
            checklistItems: [
              checklistItem({ id: 'hp', pointType: 'hold_point', sequenceNumber: 1 }),
              checklistItem({
                id: 'sup-review',
                pointType: 'verification',
                responsibleParty: 'superintendent',
                sequenceNumber: 2,
              }),
              checklistItem({
                id: 'sup-witness',
                pointType: 'witness',
                responsibleParty: 'superintendent',
                sequenceNumber: 3,
              }),
              checklistItem({ id: 'wp', pointType: 'witness_point', sequenceNumber: 4 }),
              checklistItem({ id: 'std', pointType: 'standard', sequenceNumber: 3 }),
              checklistItem({ id: 'nullish', pointType: null, sequenceNumber: 4 }),
            ],
          },
          completions: [],
        },
      }),
    ]);

    expect(result.map((hp) => hp.itpChecklistItemId)).toEqual(['hp', 'sup-review']);
  });

  it('uses the assigned ITP snapshot instead of live template edits', () => {
    const result = buildHoldPointListItems([
      lot({
        id: 'lot1',
        lotNumber: 'A',
        itpInstance: {
          templateSnapshot: JSON.stringify({
            id: 'template-1',
            name: 'Assigned template',
            checklistItems: [
              checklistItem({
                id: 'snapshot-hp',
                description: 'Original assigned hold point',
                pointType: 'hold_point',
                sequenceNumber: 1,
              }),
            ],
          }),
          template: {
            checklistItems: [
              checklistItem({
                id: 'live-hp',
                description: 'Later live-template hold point',
                pointType: 'hold_point',
                sequenceNumber: 1,
              }),
            ],
          },
          completions: [],
        },
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      itpChecklistItemId: 'snapshot-hp',
      description: 'Original assigned hold point',
    });
  });

  it('skips lots without an ITP instance, template, or checklist items', () => {
    const result = buildHoldPointListItems([
      lot({ id: 'noInstance', lotNumber: 'A', itpInstance: null }),
      lot({
        id: 'noTemplate',
        lotNumber: 'B',
        itpInstance: { template: null, completions: [] },
      }),
    ]);

    expect(result).toEqual([]);
  });

  it('uses persisted hold point fields when a matching row exists', () => {
    const persisted: HoldPointListPersistedHoldPoint = {
      id: 'persisted-hp-id',
      itpChecklistItemId: 'item1',
      status: 'released',
      notificationSentAt: HP_NOTIFIED_AT,
      scheduledDate: HP_SCHEDULED_AT,
      releasedAt: HP_RELEASED_AT,
      releasedByName: 'Jane Foreman',
      releaseNotes: 'All good',
      createdAt: HP_CREATED_AT,
    };

    const [item] = buildHoldPointListItems([
      lot({
        id: 'lot1',
        lotNumber: 'A',
        itpInstance: {
          template: {
            checklistItems: [
              checklistItem({ id: 'item1', description: 'Pour slab', sequenceNumber: 7 }),
            ],
          },
          completions: [],
        },
        holdPoints: [persisted],
      }),
    ]);

    expect(item).toEqual({
      id: 'persisted-hp-id',
      lotId: 'lot1',
      lotNumber: 'A',
      itpChecklistItemId: 'item1',
      description: 'Pour slab',
      pointType: 'hold_point',
      status: 'released',
      notificationSentAt: HP_NOTIFIED_AT,
      scheduledDate: HP_SCHEDULED_AT,
      releasedAt: HP_RELEASED_AT,
      releasedByName: 'Jane Foreman',
      releaseNotes: 'All good',
      sequenceNumber: 7,
      isCompleted: false,
      isVerified: false,
      createdAt: HP_CREATED_AT,
    });
  });

  it('builds a virtual hold point with defaults when no persisted row exists', () => {
    const [item] = buildHoldPointListItems([
      lot({
        id: 'lot9',
        lotNumber: 'A',
        createdAt: LOT_CREATED_AT,
        itpInstance: {
          template: {
            checklistItems: [
              checklistItem({ id: 'itemX', description: 'Backfill', sequenceNumber: 3 }),
            ],
          },
          completions: [],
        },
        holdPoints: [],
      }),
    ]);

    expect(item).toEqual({
      id: 'virtual-lot9-itemX',
      lotId: 'lot9',
      lotNumber: 'A',
      itpChecklistItemId: 'itemX',
      description: 'Backfill',
      pointType: 'hold_point',
      status: 'pending',
      notificationSentAt: undefined,
      scheduledDate: undefined,
      releasedAt: undefined,
      releasedByName: undefined,
      releaseNotes: undefined,
      sequenceNumber: 3,
      isCompleted: false,
      isVerified: false,
      createdAt: LOT_CREATED_AT,
    });
  });

  it('maps completion status to isCompleted and isVerified exactly', () => {
    const completions: HoldPointListCompletion[] = [
      { checklistItemId: 'done', status: 'completed', verificationStatus: 'verified' },
      { checklistItemId: 'progress', status: 'in_progress', verificationStatus: 'none' },
      // 'missing' has no completion record at all
    ];

    const result = buildHoldPointListItems([
      lot({
        id: 'lot1',
        lotNumber: 'A',
        itpInstance: {
          template: {
            checklistItems: [
              checklistItem({ id: 'done', sequenceNumber: 1 }),
              checklistItem({ id: 'progress', sequenceNumber: 2 }),
              checklistItem({ id: 'missing', sequenceNumber: 3 }),
            ],
          },
          completions,
        },
      }),
    ]);

    expect(
      result.map((hp) => ({
        id: hp.itpChecklistItemId,
        isCompleted: hp.isCompleted,
        isVerified: hp.isVerified,
      })),
    ).toEqual([
      { id: 'done', isCompleted: true, isVerified: true },
      { id: 'progress', isCompleted: false, isVerified: false },
      { id: 'missing', isCompleted: false, isVerified: false },
    ]);
  });

  it('sorts by lot number, then by numeric sequence number', () => {
    const result = buildHoldPointListItems([
      // Fed in reverse lot order and scrambled sequence to prove the sort runs.
      lot({
        id: 'lotB',
        lotNumber: 'B',
        itpInstance: {
          template: {
            checklistItems: [
              checklistItem({ id: 'b2', sequenceNumber: 2 }),
              checklistItem({ id: 'b1', sequenceNumber: 1 }),
            ],
          },
          completions: [],
        },
      }),
      lot({
        id: 'lotA',
        lotNumber: 'A',
        itpInstance: {
          template: {
            checklistItems: [
              // 10 before 2 would mean string sort; numeric sort puts 2 first.
              checklistItem({ id: 'a10', sequenceNumber: 10 }),
              checklistItem({ id: 'a2', sequenceNumber: 2 }),
            ],
          },
          completions: [],
        },
      }),
    ]);

    expect(result.map((hp) => `${hp.lotNumber}:${hp.sequenceNumber}`)).toEqual([
      'A:2',
      'A:10',
      'B:1',
      'B:2',
    ]);
  });
});

describe('buildHoldPointListResponse', () => {
  it('preserves the route response wrapper around paginated hold points', () => {
    const holdPoints = buildHoldPointListItems([
      lot({
        id: 'lot1',
        lotNumber: 'A',
        itpInstance: {
          template: {
            checklistItems: [
              checklistItem({ id: 'item1', description: 'Pour slab', sequenceNumber: 1 }),
            ],
          },
          completions: [],
        },
      }),
    ]);
    const pagination = { page: 1, limit: 20, total: 1, totalPages: 1 };

    expect(buildHoldPointListResponse(holdPoints, pagination)).toEqual({
      holdPoints,
      pagination,
    });
  });
});

describe('buildEmptyHoldPointListResponse', () => {
  it('preserves the no-access/no-company early return shape', () => {
    expect(buildEmptyHoldPointListResponse()).toEqual({ holdPoints: [] });
  });
});
