import { describe, expect, it } from 'vitest';

import { formatDateKey } from '@/lib/localDate';
import {
  dateKeySpan,
  dayNumberToDateKey,
  historicalStatusByLot,
  lotStatusAtDate,
  type LotTimeline,
  type StatusTimeline,
} from './statusTimelineData';

const TZ = 'Australia/Sydney';

function lot(over: Partial<LotTimeline> = {}): LotTimeline {
  return {
    lotId: 'lot-1',
    createdAt: '2026-01-10T00:00:00.000Z',
    currentStatus: 'completed',
    events: [
      { at: '2026-01-15T02:00:00.000Z', from: 'not_started', to: 'in_progress' },
      { at: '2026-03-01T02:00:00.000Z', from: 'in_progress', to: 'completed' },
    ],
    ...over,
  };
}

describe('lotStatusAtDate', () => {
  it('hides a lot that did not exist yet on the selected date', () => {
    expect(lotStatusAtDate(lot(), '2026-01-09', TZ)).toBeNull();
  });

  it('returns the first event from-state before any event fires', () => {
    // Created 10 Jan, first event 15 Jan → on 12 Jan the lot is at its start state.
    expect(lotStatusAtDate(lot(), '2026-01-12', TZ)).toBe('not_started');
  });

  it('replays events up to and including the selected day', () => {
    expect(lotStatusAtDate(lot(), '2026-01-15', TZ)).toBe('in_progress');
    expect(lotStatusAtDate(lot(), '2026-02-28', TZ)).toBe('in_progress');
    expect(lotStatusAtDate(lot(), '2026-03-01', TZ)).toBe('completed');
    expect(lotStatusAtDate(lot(), '2026-06-01', TZ)).toBe('completed');
  });

  it('uses currentStatus when there are no events', () => {
    expect(
      lotStatusAtDate(lot({ events: [], currentStatus: 'not_started' }), '2026-05-01', TZ),
    ).toBe('not_started');
  });

  it('clamps to currentStatus at/after today even when the audit trail has a gap', () => {
    // Recorded history only reaches "conformed"; the live status is "claimed"
    // (an un-audited transition, historically). Today must show live status.
    const gappy = lot({
      createdAt: '2026-01-10T00:00:00.000Z',
      currentStatus: 'claimed',
      events: [{ at: '2026-01-15T02:00:00.000Z', from: 'completed', to: 'conformed' }],
    });
    const todayKey = formatDateKey(new Date(), TZ);
    const yesterdayKey = dayNumberToDateKey(dateKeySpanBase(todayKey) - 1);

    expect(lotStatusAtDate(gappy, todayKey, TZ)).toBe('claimed'); // clamp to live
    expect(lotStatusAtDate(gappy, yesterdayKey, TZ)).toBe('conformed'); // recorded history
  });
});

describe('historicalStatusByLot', () => {
  it('includes visible lots and omits not-yet-created ones', () => {
    const timeline: StatusTimeline = {
      earliest: '2026-01-10T00:00:00.000Z',
      lots: [
        lot({ lotId: 'lot-1' }),
        lot({ lotId: 'lot-2', createdAt: '2026-04-01T00:00:00.000Z', events: [] }),
      ],
    };
    const map = historicalStatusByLot(timeline, '2026-02-01', TZ);
    expect(map.get('lot-1')).toBe('in_progress');
    expect(map.has('lot-2')).toBe(false); // created after the selected date
  });
});

describe('date-key math', () => {
  it('dayNumberToDateKey inverts dateKeySpan against a base', () => {
    expect(dateKeySpan('2026-01-10', '2026-01-15')).toBe(5);
    expect(dayNumberToDateKey(dateKeySpanBase('2026-01-10') + 5)).toBe('2026-01-15');
  });
});

// Helper mirroring the panel's slider math: base day-number for a key.
function dateKeySpanBase(key: string): number {
  return dateKeySpan('1970-01-01', key);
}
