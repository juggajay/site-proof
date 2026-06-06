import { describe, expect, it } from 'vitest';
import type { HoldPoint } from './types';
import { buildHoldPointChartData, buildHoldPointStats } from './holdPointsPageData';

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
