import { describe, it, expect } from 'vitest';
import { planSentToLabBackfill } from './sentToLabBackfill.js';

describe('planSentToLabBackfill (Wave C2 Phase 3, spec §4.2)', () => {
  // AT-67 [C2R-B4]: the predicate is `changes.newStatus`. Rev 1's `changes.status`
  // would have matched zero rows on this action and reported success — this is
  // the proof-of-catch for that exact mistake.
  it('AT-67: matches changes.newStatus and NOT changes.status', () => {
    const plan = planSentToLabBackfill([
      {
        entityId: 'real',
        changes: JSON.stringify({ previousStatus: 'requested', newStatus: 'at_lab' }),
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      },
      {
        entityId: 'wrong-shape',
        changes: JSON.stringify({ status: 'at_lab' }),
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    ]);

    expect([...plan.keys()]).toEqual(['real']);
  });

  it('AT-67: takes the earliest transition per test, whatever the row order', () => {
    const plan = planSentToLabBackfill([
      {
        entityId: 'test-1',
        changes: JSON.stringify({ previousStatus: 'entered', newStatus: 'at_lab' }),
        createdAt: new Date('2026-07-09T00:00:00.000Z'),
      },
      {
        entityId: 'test-1',
        changes: JSON.stringify({ previousStatus: 'requested', newStatus: 'at_lab' }),
        createdAt: new Date('2026-07-02T00:00:00.000Z'),
      },
    ]);

    expect(plan.get('test-1')?.toISOString()).toBe('2026-07-02T00:00:00.000Z');
  });

  it('ignores other transitions, null changes and unparseable changes', () => {
    const plan = planSentToLabBackfill([
      {
        entityId: 'a',
        changes: JSON.stringify({ previousStatus: 'entered', newStatus: 'verified' }),
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      },
      { entityId: 'b', changes: null, createdAt: new Date('2026-07-01T00:00:00.000Z') },
      { entityId: 'c', changes: 'not json', createdAt: new Date('2026-07-01T00:00:00.000Z') },
    ]);

    expect(plan.size).toBe(0);
  });
});
