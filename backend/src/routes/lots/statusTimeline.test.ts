import { describe, expect, it } from 'vitest';

import { buildStatusTimeline, type LotStatusEvent } from './statusTimeline.js';

describe('buildStatusTimeline', () => {
  it('assembles the existing response shape and earliest reachable instant', () => {
    const eventsByLot = new Map<string, LotStatusEvent[]>([
      [
        'lot-1',
        [
          {
            at: '2026-02-15T00:00:00.000Z',
            from: 'not_started',
            to: 'in_progress',
          },
        ],
      ],
    ]);
    const result = buildStatusTimeline(
      [
        { id: 'lot-1', status: 'in_progress', createdAt: new Date('2026-01-10T00:00:00Z') },
        { id: 'lot-2', status: 'not_started', createdAt: new Date('2026-03-01T00:00:00Z') },
      ],
      eventsByLot,
    );

    expect(result).toEqual({
      earliest: '2026-01-10T00:00:00.000Z',
      lots: [
        {
          lotId: 'lot-1',
          createdAt: '2026-01-10T00:00:00.000Z',
          currentStatus: 'in_progress',
          events: [
            {
              at: '2026-02-15T00:00:00.000Z',
              from: 'not_started',
              to: 'in_progress',
            },
          ],
        },
        {
          lotId: 'lot-2',
          createdAt: '2026-03-01T00:00:00.000Z',
          currentStatus: 'not_started',
          events: [],
        },
      ],
    });
  });

  it('allows an event to establish an earlier instant than lot creation', () => {
    const result = buildStatusTimeline(
      [{ id: 'lot-1', status: 'completed', createdAt: new Date('2026-02-01T00:00:00Z') }],
      new Map([['lot-1', [{ at: '2026-01-20T00:00:00.000Z', from: null, to: 'not_started' }]]]),
    );
    expect(result.earliest).toBe('2026-01-20T00:00:00.000Z');
  });

  it('returns null earliest for no lots', () => {
    expect(buildStatusTimeline([], new Map())).toEqual({ earliest: null, lots: [] });
  });
});
