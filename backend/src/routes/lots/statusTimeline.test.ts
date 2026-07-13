import { describe, expect, it } from 'vitest';

import {
  buildStatusTimeline,
  lotStatusEventsFromAudit,
  type AuditRowForTimeline,
} from './statusTimeline.js';

function row(over: Partial<AuditRowForTimeline>): AuditRowForTimeline {
  return {
    entityId: 'lot-1',
    action: 'lot_status_changed',
    changes: JSON.stringify({ status: { from: 'in_progress', to: 'completed' } }),
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    ...over,
  };
}

describe('lotStatusEventsFromAudit', () => {
  it('groups status transitions by lot, sorted ascending by time', () => {
    const events = lotStatusEventsFromAudit([
      row({
        createdAt: new Date('2026-03-01T00:00:00Z'),
        changes: JSON.stringify({ status: { from: 'completed', to: 'conformed' } }),
      }),
      row({
        createdAt: new Date('2026-01-01T00:00:00Z'),
        changes: JSON.stringify({ status: { from: 'not_started', to: 'in_progress' } }),
      }),
    ]);
    const lot = events.get('lot-1');
    expect(lot).toHaveLength(2);
    expect(lot?.[0]).toEqual({
      at: '2026-01-01T00:00:00.000Z',
      from: 'not_started',
      to: 'in_progress',
    });
    expect(lot?.[1]).toEqual({
      at: '2026-03-01T00:00:00.000Z',
      from: 'completed',
      to: 'conformed',
    });
  });

  it('includes lot_updated and lot_force_conformed but ignores unrelated actions', () => {
    const events = lotStatusEventsFromAudit([
      row({ action: 'lot_updated' }),
      row({ action: 'lot_force_conformed', entityId: 'lot-2' }),
      // A subcontractor-assignment row also carries changes.status but is not a lot-status action.
      row({ action: 'lot_subcontractor_assignment_updated', entityId: 'lot-3' }),
    ]);
    expect(events.has('lot-1')).toBe(true);
    expect(events.has('lot-2')).toBe(true);
    expect(events.has('lot-3')).toBe(false);
  });

  it('skips unparseable or malformed changes without throwing', () => {
    const events = lotStatusEventsFromAudit([
      row({ changes: null }),
      row({ changes: 'not json{' }),
      row({ changes: JSON.stringify({ status: 'oops' }) }),
      row({ changes: JSON.stringify({ status: { from: 'a' } }) }), // no `to`
      row({ changes: JSON.stringify({ fields: ['budget'] }) }), // status not changed
    ]);
    expect(events.size).toBe(0);
  });

  it('treats a non-string from as null', () => {
    const events = lotStatusEventsFromAudit([
      row({ changes: JSON.stringify({ status: { from: null, to: 'in_progress' } }) }),
    ]);
    expect(events.get('lot-1')?.[0].from).toBeNull();
  });
});

describe('buildStatusTimeline', () => {
  it('assembles per-lot payload and the earliest reachable instant', () => {
    const eventsByLot = lotStatusEventsFromAudit([
      row({
        entityId: 'lot-1',
        createdAt: new Date('2026-02-15T00:00:00Z'),
        changes: JSON.stringify({ status: { from: 'not_started', to: 'in_progress' } }),
      }),
    ]);
    const result = buildStatusTimeline(
      [
        { id: 'lot-1', status: 'in_progress', createdAt: new Date('2026-01-10T00:00:00Z') },
        { id: 'lot-2', status: 'not_started', createdAt: new Date('2026-03-01T00:00:00Z') },
      ],
      eventsByLot,
    );
    // Earliest = earliest lot createdAt (lot-1), predating its event.
    expect(result.earliest).toBe('2026-01-10T00:00:00.000Z');
    expect(result.lots).toHaveLength(2);
    expect(result.lots[0]).toMatchObject({ lotId: 'lot-1', currentStatus: 'in_progress' });
    expect(result.lots[0].events).toHaveLength(1);
    expect(result.lots[1].events).toEqual([]);
  });

  it('returns null earliest for no lots', () => {
    expect(buildStatusTimeline([], new Map())).toEqual({ earliest: null, lots: [] });
  });
});
