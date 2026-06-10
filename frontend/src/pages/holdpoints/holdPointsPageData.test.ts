import { describe, expect, it } from 'vitest';
import type { HoldPoint } from './types';
import {
  buildHoldPointChartData,
  buildHoldPointStats,
  filterHoldPoints,
  parseSortDirectionParam,
  parseSortFieldParam,
  parseStatusFilterParam,
  sortHoldPoints,
} from './holdPointsPageData';
import { isNoticeExpired } from './components/holdPointTableUtils';

function makeHoldPoint(overrides: Partial<HoldPoint>): HoldPoint {
  return {
    id: 'hp-1',
    lotId: 'lot-1',
    lotNumber: 'LOT-001',
    itpChecklistItemId: 'item-1',
    description: 'Inspection hold point',
    pointType: 'hold',
    status: 'pending',
    notificationSentAt: null,
    scheduledDate: null,
    releasedAt: null,
    releasedByName: null,
    releaseNotes: null,
    sequenceNumber: 1,
    isCompleted: false,
    isVerified: false,
    createdAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildHoldPointStats', () => {
  it('counts totals, statuses, and released hold points inside the last seven days', () => {
    const stats = buildHoldPointStats(
      [
        makeHoldPoint({ id: 'pending', status: 'pending' }),
        makeHoldPoint({ id: 'notified', status: 'notified' }),
        makeHoldPoint({
          id: 'recent-release',
          status: 'released',
          releasedAt: '2026-06-04T10:00:00.000Z',
        }),
        makeHoldPoint({
          id: 'old-release',
          status: 'released',
          releasedAt: '2026-05-20T10:00:00.000Z',
        }),
      ],
      new Date('2026-06-06T12:00:00.000Z'),
    );

    expect(stats).toMatchObject({
      total: 4,
      pending: 1,
      notified: 1,
      releasedThisWeek: 1,
    });
  });
});

describe('buildHoldPointChartData', () => {
  it('builds a seven-day release series with per-day counts', () => {
    const referenceDate = new Date(2026, 5, 6, 12);
    const data = buildHoldPointChartData(
      [
        makeHoldPoint({
          id: 'june-1',
          status: 'released',
          releasedAt: new Date(2026, 5, 1, 10).toISOString(),
        }),
        makeHoldPoint({
          id: 'june-6-a',
          status: 'released',
          releasedAt: new Date(2026, 5, 6, 9).toISOString(),
        }),
        makeHoldPoint({
          id: 'june-6-b',
          status: 'released',
          releasedAt: new Date(2026, 5, 6, 16).toISOString(),
        }),
        makeHoldPoint({
          id: 'outside-range',
          status: 'released',
          releasedAt: new Date(2026, 4, 29, 10).toISOString(),
        }),
      ],
      referenceDate,
    );

    expect(data.releasesOverTime).toHaveLength(7);
    expect(data.releasesOverTime[0]).toEqual({ date: 'May 31', releases: 0 });
    expect(data.releasesOverTime[1]).toEqual({ date: 'Jun 1', releases: 1 });
    expect(data.releasesOverTime[6]).toEqual({ date: 'Jun 6', releases: 2 });
  });

  it('rounds average release time in hours for released hold points with notification times', () => {
    const data = buildHoldPointChartData(
      [
        makeHoldPoint({
          id: 'eight-hours',
          status: 'released',
          notificationSentAt: '2026-06-05T00:00:00.000Z',
          releasedAt: '2026-06-05T08:00:00.000Z',
        }),
        makeHoldPoint({
          id: 'nine-hours',
          status: 'released',
          notificationSentAt: '2026-06-05T00:00:00.000Z',
          releasedAt: '2026-06-05T09:00:00.000Z',
        }),
        makeHoldPoint({
          id: 'missing-notification',
          status: 'released',
          notificationSentAt: null,
          releasedAt: '2026-06-05T12:00:00.000Z',
        }),
      ],
      new Date('2026-06-06T12:00:00.000Z'),
    );

    expect(data.avgTimeToRelease).toBe(9);
  });
});

describe('isNoticeExpired', () => {
  // Reference: midday UTC = 10pm Sydney (AEST) on 2026-06-10.
  const reference = new Date('2026-06-10T12:00:00.000Z');

  it('flags an awaiting-release hold point once the default one-day notice has elapsed', () => {
    const notifiedYesterday = makeHoldPoint({
      status: 'notified',
      notificationSentAt: '2026-06-09T01:00:00.000Z',
    });

    expect(isNoticeExpired(notifiedYesterday, reference)).toBe(true);
  });

  it('does not flag a hold point notified the same Sydney calendar day', () => {
    const notifiedToday = makeHoldPoint({
      status: 'notified',
      notificationSentAt: '2026-06-10T01:00:00.000Z',
    });

    expect(isNoticeExpired(notifiedToday, reference)).toBe(false);
  });

  it('uses Sydney calendar days, not raw UTC dates', () => {
    // 2026-06-09T22:00Z is already 2026-06-10 in Australia/Sydney, so zero
    // calendar days have elapsed even though the UTC date differs.
    const notifiedLateUtc = makeHoldPoint({
      status: 'notified',
      notificationSentAt: '2026-06-09T22:00:00.000Z',
    });

    expect(isNoticeExpired(notifiedLateUtc, reference)).toBe(false);
  });

  it('respects a longer minimum notice period', () => {
    const notified = makeHoldPoint({
      status: 'notified',
      notificationSentAt: '2026-06-08T01:00:00.000Z',
    });

    expect(isNoticeExpired(notified, reference, 2)).toBe(true);
    expect(isNoticeExpired(notified, reference, 3)).toBe(false);
  });

  it('ignores hold points that are not awaiting release or were never notified', () => {
    expect(
      isNoticeExpired(
        makeHoldPoint({ status: 'pending', notificationSentAt: '2026-06-01T01:00:00.000Z' }),
        reference,
      ),
    ).toBe(false);
    expect(
      isNoticeExpired(
        makeHoldPoint({ status: 'released', notificationSentAt: '2026-06-01T01:00:00.000Z' }),
        reference,
      ),
    ).toBe(false);
    expect(
      isNoticeExpired(makeHoldPoint({ status: 'notified', notificationSentAt: null }), reference),
    ).toBe(false);
  });
});

describe('filterHoldPoints', () => {
  const reference = new Date('2026-06-10T12:00:00.000Z');
  const register = [
    makeHoldPoint({ id: 'pending', status: 'pending', lotNumber: 'LOT-001' }),
    makeHoldPoint({
      id: 'notified-fresh',
      status: 'notified',
      lotNumber: 'LOT-002',
      notificationSentAt: '2026-06-10T01:00:00.000Z',
    }),
    makeHoldPoint({
      id: 'notified-expired',
      status: 'notified',
      lotNumber: 'LOT-003',
      description: 'Subgrade proof roll',
      notificationSentAt: '2026-06-05T01:00:00.000Z',
    }),
    makeHoldPoint({ id: 'released', status: 'released', lotNumber: 'LOT-004' }),
  ];

  it('passes everything through for the all view', () => {
    expect(filterHoldPoints(register, 'all', '', reference)).toHaveLength(4);
  });

  it('filters by backend status', () => {
    expect(filterHoldPoints(register, 'notified', '', reference).map((hp) => hp.id)).toEqual([
      'notified-fresh',
      'notified-expired',
    ]);
  });

  it('derives the awaiting-release notice-expired view', () => {
    expect(filterHoldPoints(register, 'notice-expired', '', reference).map((hp) => hp.id)).toEqual([
      'notified-expired',
    ]);
  });

  it('searches lot number and description, case-insensitively', () => {
    expect(filterHoldPoints(register, 'all', 'lot-003', reference).map((hp) => hp.id)).toEqual([
      'notified-expired',
    ]);
    expect(filterHoldPoints(register, 'all', 'PROOF ROLL', reference).map((hp) => hp.id)).toEqual([
      'notified-expired',
    ]);
    expect(filterHoldPoints(register, 'all', '  LOT-001  ', reference).map((hp) => hp.id)).toEqual([
      'pending',
    ]);
  });

  it('combines search with the status view', () => {
    expect(filterHoldPoints(register, 'notified', 'LOT-002', reference).map((hp) => hp.id)).toEqual(
      ['notified-fresh'],
    );
    expect(filterHoldPoints(register, 'released', 'LOT-002', reference)).toHaveLength(0);
  });
});

describe('sortHoldPoints', () => {
  const register = [
    makeHoldPoint({
      id: 'b-2',
      lotNumber: 'LOT-B',
      sequenceNumber: 2,
      status: 'released',
      notificationSentAt: '2026-06-01T01:00:00.000Z',
      scheduledDate: '2026-06-03T00:00:00.000Z',
      releasedAt: '2026-06-04T00:00:00.000Z',
    }),
    makeHoldPoint({
      id: 'a-1',
      lotNumber: 'LOT-A',
      sequenceNumber: 1,
      status: 'notified',
      notificationSentAt: '2026-06-02T01:00:00.000Z',
      scheduledDate: '2026-06-06T00:00:00.000Z',
    }),
    makeHoldPoint({
      id: 'b-1',
      lotNumber: 'LOT-B',
      sequenceNumber: 1,
      status: 'pending',
    }),
  ];

  it('defaults to lot register order: lot number then sequence', () => {
    expect(sortHoldPoints(register, 'lot', 'asc').map((hp) => hp.id)).toEqual([
      'a-1',
      'b-1',
      'b-2',
    ]);
    expect(sortHoldPoints(register, 'lot', 'desc').map((hp) => hp.id)).toEqual([
      'b-2',
      'b-1',
      'a-1',
    ]);
  });

  it('sorts the notified column oldest-first for the chase ordering, never-notified last', () => {
    expect(sortHoldPoints(register, 'notified', 'asc').map((hp) => hp.id)).toEqual([
      'b-2',
      'a-1',
      'b-1',
    ]);
  });

  it('keeps missing dates last regardless of direction', () => {
    expect(sortHoldPoints(register, 'notified', 'desc').map((hp) => hp.id)).toEqual([
      'a-1',
      'b-2',
      'b-1',
    ]);
    expect(sortHoldPoints(register, 'released', 'asc').map((hp) => hp.id)).toEqual([
      'b-2',
      'a-1',
      'b-1',
    ]);
  });

  it('sorts by status with lot order as the tie-breaker, without mutating the input', () => {
    const input = [...register];

    expect(sortHoldPoints(input, 'status', 'asc').map((hp) => hp.id)).toEqual([
      'a-1',
      'b-1',
      'b-2',
    ]);
    expect(input.map((hp) => hp.id)).toEqual(['b-2', 'a-1', 'b-1']);
  });
});

describe('URL param parsing', () => {
  it('accepts known values and falls back safely', () => {
    expect(parseStatusFilterParam('notice-expired')).toBe('notice-expired');
    expect(parseStatusFilterParam('released')).toBe('released');
    expect(parseStatusFilterParam('bogus')).toBe('all');
    expect(parseStatusFilterParam(null)).toBe('all');

    expect(parseSortFieldParam('notified')).toBe('notified');
    expect(parseSortFieldParam('bogus')).toBe('lot');
    expect(parseSortFieldParam(null)).toBe('lot');

    expect(parseSortDirectionParam('desc')).toBe('desc');
    expect(parseSortDirectionParam('bogus')).toBe('asc');
    expect(parseSortDirectionParam(null)).toBe('asc');
  });
});
