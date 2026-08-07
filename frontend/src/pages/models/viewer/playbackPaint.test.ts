import { describe, expect, it } from 'vitest';

import {
  buildPaintPlan,
  currentStatusByLot,
  GHOST_LAYER,
  paintOpacityForStatus,
} from './playbackPaint';

const guidIndex = new Map<string, number>([
  ['guid-a', 1],
  ['guid-b', 2],
  ['guid-c', 3],
  ['guid-d', 4],
]);

const links = [
  { ifcGuid: 'guid-a', lotId: 'lot-1' },
  { ifcGuid: 'guid-b', lotId: 'lot-1' },
  { ifcGuid: 'guid-c', lotId: 'lot-2' },
  { ifcGuid: 'guid-d', lotId: 'lot-3' },
  { ifcGuid: 'guid-missing', lotId: 'lot-1' }, // no geometry in the frag
];

describe('buildPaintPlan', () => {
  it('ghosts everything first, then buckets linked elements by as-at status', () => {
    const statusAtDate = new Map([
      ['lot-1', 'conformed'],
      ['lot-2', 'in_progress'],
      // lot-3 absent: not created as of the date -> element stays ghosted
    ]);

    const plan = buildPaintPlan(links, guidIndex, statusAtDate);

    expect(plan.layers[0]).toEqual(GHOST_LAYER);
    // Legend order: in_progress before conformed (canonical vocabulary order).
    expect(plan.layers.slice(1)).toEqual([
      { localIds: [3], color: '#56B4E9', opacity: 0.6 },
      { localIds: [1, 2], color: '#009E73', opacity: 1 },
    ]);
    expect([...plan.statusCounts.entries()]).toEqual([
      ['in_progress', 1],
      ['conformed', 2],
    ]);
    expect(plan.noRecordCount).toBe(1);
    expect(plan.changedCount).toBeNull();
  });

  it('an element with no link never receives a painted status (ghost only)', () => {
    // Only guid-a is linked; guid-b..d exist in the model but have no link rows.
    const plan = buildPaintPlan(
      [{ ifcGuid: 'guid-a', lotId: 'lot-1' }],
      guidIndex,
      new Map([['lot-1', 'claimed']]),
    );

    const paintedIds = plan.layers.slice(1).flatMap((layer) => layer.localIds ?? []);
    expect(paintedIds).toEqual([1]);
    // The ghost layer targets ALL elements (undefined = whole model) so
    // unlinked geometry reads neutral, never a status colour.
    expect(plan.layers[0].localIds).toBeUndefined();
  });

  it('compare mode paints only changed elements, by their current status', () => {
    const statusAtDate = new Map([
      ['lot-1', 'in_progress'],
      ['lot-2', 'conformed'],
    ]);
    const current = new Map([
      ['lot-1', 'conformed'], // changed since the date
      ['lot-2', 'conformed'], // unchanged -> ghost
      ['lot-3', 'in_progress'], // did not exist at the date -> changed
    ]);

    const plan = buildPaintPlan(links, guidIndex, statusAtDate, current);

    expect(plan.changedCount).toBe(3);
    expect([...plan.statusCounts.entries()]).toEqual([
      ['in_progress', 1],
      ['conformed', 2],
    ]);
    // lot-2's element (localId 3) is unchanged: ghosted, not painted.
    const paintedIds = plan.layers.slice(1).flatMap((layer) => layer.localIds ?? []);
    expect(paintedIds).not.toContain(3);
  });

  it('unknown statuses still paint with the fallback swatch', () => {
    const plan = buildPaintPlan(
      [{ ifcGuid: 'guid-a', lotId: 'lot-1' }],
      guidIndex,
      new Map([['lot-1', 'somehow_new_status']]),
    );
    expect(plan.statusCounts.get('somehow_new_status')).toBe(1);
    expect(plan.layers[1].color).toBe('#9ca3af');
  });
});

describe('paintOpacityForStatus', () => {
  it('solid for closed-out statuses, translucent for open ones', () => {
    expect(paintOpacityForStatus('conformed')).toBe(1);
    expect(paintOpacityForStatus('claimed')).toBe(1);
    expect(paintOpacityForStatus('in_progress')).toBeLessThan(1);
    expect(paintOpacityForStatus('ncr_raised')).toBeLessThan(1);
  });
});

describe('currentStatusByLot', () => {
  it('maps the timeline payload directly', () => {
    expect(
      currentStatusByLot([
        { lotId: 'a', currentStatus: 'conformed' },
        { lotId: 'b', currentStatus: 'in_progress' },
      ]),
    ).toEqual(
      new Map([
        ['a', 'conformed'],
        ['b', 'in_progress'],
      ]),
    );
  });
});
