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

  // F0.4b PR 5: claim create writes ONE decision row against the CLAIM, so the
  // conformed -> claimed transition for every lot the claim completed has to be
  // expanded out of `changes.fullyClaimedLotIds` (`[R3.1-R4]`).
  it('expands a claim_created decision row into per-lot conformed -> claimed events', () => {
    const events = lotStatusEventsFromAudit([
      row({
        entityId: 'claim-9',
        action: 'claim_created',
        createdAt: new Date('2026-04-01T00:00:00Z'),
        changes: JSON.stringify({
          decisionKind: 'inclusion',
          claimNumber: 3,
          fullyClaimedLotIds: ['lot-7', 'lot-8'],
        }),
      }),
    ]);

    expect(events.get('lot-7')).toEqual([
      { at: '2026-04-01T00:00:00.000Z', from: 'conformed', to: 'claimed' },
    ]);
    expect(events.get('lot-8')).toHaveLength(1);
    // The claim itself is never a timeline subject.
    expect(events.has('claim-9')).toBe(false);
  });

  it('ignores a claim_created row with no or malformed fullyClaimedLotIds', () => {
    // A claim that completed no lots (every member partial) legitimately has no
    // array, and a malformed one must not break the scrubber.
    const events = lotStatusEventsFromAudit([
      row({ action: 'claim_created', changes: JSON.stringify({ claimNumber: 1 }) }),
      row({ action: 'claim_created', changes: JSON.stringify({ fullyClaimedLotIds: 'lot-7' }) }),
      row({ action: 'claim_created', changes: JSON.stringify({ fullyClaimedLotIds: [42] }) }),
    ]);
    expect(events.size).toBe(0);
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
