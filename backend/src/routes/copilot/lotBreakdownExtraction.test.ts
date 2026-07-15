import { describe, expect, it } from 'vitest';

import {
  buildDeterministicCandidate,
  capInterval,
  cleanLotBreakdownCandidate,
  controlLineExtent,
  deriveLotPrefix,
} from './lotBreakdownExtraction.js';

const BASE = {
  controlLineId: 'cl-1',
  startChainage: 0,
  endChainage: 1000,
  lotPrefix: 'RD',
};

describe('controlLineExtent', () => {
  it('returns min/max chainage of ordered points', () => {
    expect(
      controlLineExtent([
        { chainage: 40, easting: 0, northing: 0 },
        { chainage: 10, easting: 0, northing: 0 },
      ]),
    ).toEqual({ min: 10, max: 40 });
  });

  it('returns null for <2 points or a zero-length extent', () => {
    expect(controlLineExtent([{ chainage: 0, easting: 0, northing: 0 }])).toBeNull();
    expect(
      controlLineExtent([
        { chainage: 5, easting: 0, northing: 0 },
        { chainage: 5, easting: 0, northing: 0 },
      ]),
    ).toBeNull();
  });
});

describe('deriveLotPrefix', () => {
  it('prefers the project number, upper-cased and dash-cleaned', () => {
    expect(deriveLotPrefix('mc-2024/road 5', 'MC01')).toBe('MC-2024-ROAD-5');
  });
  it('falls back to the control line name, then LOT', () => {
    expect(deriveLotPrefix(null, 'Main Road')).toBe('MAIN-ROAD');
    expect(deriveLotPrefix('', '')).toBe('LOT');
  });
});

describe('capInterval', () => {
  it('keeps the requested interval when it stays within the 500 cap', () => {
    expect(capInterval(1000, 100, 1)).toBe(100); // 10 lots
    expect(capInterval(1000, 100, 3)).toBe(100); // 30 lots
  });
  it('raises the interval when the cross product would exceed 500', () => {
    // 60000 / 100 = 600 intervals × 1 > 500 → must grow.
    expect(capInterval(60000, 100, 1)).toBeGreaterThan(100);
    expect(60000 / capInterval(60000, 100, 1)).toBeLessThanOrEqual(500);
    // 20000 / 100 = 200 intervals × 3 = 600 > 500 → grow so ×3 ≤ 500.
    const i = capInterval(20000, 100, 3);
    expect(Math.ceil(20000 / i) * 3).toBeLessThanOrEqual(500);
  });
});

describe('cleanLotBreakdownCandidate', () => {
  it('maps activity synonyms to the canonical vocabulary and dedupes', () => {
    const { candidate } = cleanLotBreakdownCandidate(
      { activities: ['bulk earthworks', 'Paving', 'earthwork'], interval: 50 },
      BASE,
    );
    expect(candidate.activities.map((a) => a.activityType)).toEqual(['Earthworks', 'Pavement']);
    expect(candidate.interval).toBe(50);
    expect(candidate.startChainage).toBe(0);
    expect(candidate.endChainage).toBe(1000);
    expect(candidate.lotPrefix).toBe('RD');
  });

  it('keeps an unknown activity verbatim and warns', () => {
    const { candidate, warnings } = cleanLotBreakdownCandidate(
      { activities: ['Landscaping'] },
      BASE,
    );
    expect(candidate.activities[0].activityType).toBe('Landscaping');
    expect(warnings.some((w) => w.includes('Landscaping'))).toBe(true);
  });

  it('defaults to one Earthworks activity when the model returns none', () => {
    const { candidate, warnings } = cleanLotBreakdownCandidate({ activities: [] }, BASE);
    expect(candidate.activities).toEqual([{ activityType: 'Earthworks' }]);
    expect(candidate.interval).toBe(100);
    expect(warnings.some((w) => w.toLowerCase().includes('no activities'))).toBe(true);
  });

  it('caps the interval so the cross product stays within 500 lots', () => {
    const { candidate, warnings } = cleanLotBreakdownCandidate(
      { activities: ['Earthworks', 'Pavement', 'Drainage'], interval: 10 },
      { ...BASE, endChainage: 20000 },
    );
    expect(Math.ceil(20000 / candidate.interval) * 3).toBeLessThanOrEqual(500);
    expect(warnings.some((w) => w.includes('within 500'))).toBe(true);
  });
});

describe('buildDeterministicCandidate', () => {
  it('proposes the full extent with one Earthworks activity at 100 m', () => {
    const { candidate, warnings } = buildDeterministicCandidate(BASE);
    expect(candidate).toMatchObject({
      controlLineId: 'cl-1',
      startChainage: 0,
      endChainage: 1000,
      interval: 100,
      activities: [{ activityType: 'Earthworks' }],
      offsetLeft: 5,
      offsetRight: 5,
    });
    expect(warnings[0]).toContain('control line only');
  });
});
