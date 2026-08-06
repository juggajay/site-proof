import { describe, expect, it } from 'vitest';

import {
  buildChecklistHoldPointStates,
  type ChecklistHoldPointSource,
} from './checklistHoldPoints.js';

function holdPoint(overrides: Partial<ChecklistHoldPointSource> = {}): ChecklistHoldPointSource {
  return {
    id: 'hp-1',
    itpChecklistItemId: 'item-1',
    status: 'pending',
    scheduledDate: null,
    scheduledTime: null,
    notificationSentAt: null,
    notificationSentTo: null,
    releasedByName: null,
    releasedByOrg: null,
    releaseMethod: null,
    releasedAt: null,
    releaseNotes: null,
    ...overrides,
  };
}

describe('buildChecklistHoldPointStates', () => {
  it('carries the requested state a checklist row needs', () => {
    const scheduledDate = new Date('2026-09-01T00:00:00.000Z');
    const notificationSentAt = new Date('2026-08-30T04:00:00.000Z');

    const states = buildChecklistHoldPointStates(
      [
        holdPoint({
          status: 'notified',
          scheduledDate,
          scheduledTime: '09:30',
          notificationSentAt,
          notificationSentTo: 'super@example.com',
        }),
      ],
      new Set(['item-1']),
    );

    expect(states).toEqual([
      {
        id: 'hp-1',
        itpChecklistItemId: 'item-1',
        status: 'notified',
        scheduledDate,
        scheduledTime: '09:30',
        notificationSentAt,
        notificationSentTo: 'super@example.com',
        releasedByName: null,
        releasedByOrg: null,
        releaseMethod: null,
        releasedAt: null,
        releaseNotes: null,
      },
    ]);
  });

  it('drops hold points whose checklist item is not visible to this viewer', () => {
    const states = buildChecklistHoldPointStates(
      [
        holdPoint({ id: 'hp-visible', itpChecklistItemId: 'item-1' }),
        holdPoint({ id: 'hp-hidden', itpChecklistItemId: 'item-hidden' }),
      ],
      new Set(['item-1']),
    );

    expect(states.map((state) => state.id)).toEqual(['hp-visible']);
  });

  it('keeps the most recent hold point when several share one checklist item', () => {
    const states = buildChecklistHoldPointStates(
      [
        holdPoint({ id: 'hp-old', status: 'pending' }),
        holdPoint({ id: 'hp-new', status: 'notified' }),
      ],
      new Set(['item-1']),
    );

    expect(states).toHaveLength(1);
    expect(states[0]).toMatchObject({ id: 'hp-new', status: 'notified' });
  });

  it('returns nothing when the lot has no hold points', () => {
    expect(buildChecklistHoldPointStates([], new Set(['item-1']))).toEqual([]);
  });
});
