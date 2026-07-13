import { describe, expect, it } from 'vitest';

import { AppError } from '../../lib/AppError.js';
import { cleanSetoutCandidate } from './setoutExtraction.js';

describe('cleanSetoutCandidate', () => {
  it('cleans a well-formed candidate, coercing string numbers and sorting by chainage', () => {
    const candidate = cleanSetoutCandidate({
      coordinateSystem: 'EPSG:7856',
      points: [
        { chainage: 100, easting: '500100', northing: 6000000 },
        { chainage: '0', easting: 500000, northing: '6000000' },
      ],
    });

    expect(candidate.coordinateSystem).toBe('EPSG:7856');
    expect(candidate.points).toEqual([
      { chainage: 0, easting: 500000, northing: 6000000 },
      { chainage: 100, easting: 500100, northing: 6000000 },
    ]);
    expect(candidate.warnings).toEqual([]);
  });

  it('maps a descriptive EPSG guess and drops non-numeric rows into warnings', () => {
    const candidate = cleanSetoutCandidate({
      coordinateSystem: 'EPSG: 7855 (GDA2020 MGA55)',
      points: [
        { chainage: 0, easting: 300000, northing: 5800000 },
        { chainage: 'CH twenty', easting: 'n/a', northing: 5800000 },
        { chainage: 40, easting: 300040, northing: 5800000 },
      ],
    });

    expect(candidate.coordinateSystem).toBe('EPSG:7855');
    expect(candidate.points).toHaveLength(2);
    expect(candidate.warnings).toHaveLength(1);
    expect(candidate.warnings[0]).toMatch(/Row 2 dropped/);
  });

  it('nulls an unsupported EPSG guess and records a warning', () => {
    const candidate = cleanSetoutCandidate({
      coordinateSystem: 'EPSG:9999',
      points: [
        { chainage: 0, easting: 1, northing: 2 },
        { chainage: 1, easting: 3, northing: 4 },
      ],
    });

    expect(candidate.coordinateSystem).toBeNull();
    expect(candidate.warnings.some((w) => w.includes('EPSG:9999'))).toBe(true);
  });

  it('leaves coordinateSystem null without warning when the model was unsure', () => {
    const candidate = cleanSetoutCandidate({
      coordinateSystem: null,
      points: [
        { chainage: 0, easting: 1, northing: 2 },
        { chainage: 1, easting: 3, northing: 4 },
      ],
    });

    expect(candidate.coordinateSystem).toBeNull();
    expect(candidate.warnings).toEqual([]);
  });

  it('rejects a candidate with fewer than 2 valid points', () => {
    expect(() =>
      cleanSetoutCandidate({
        coordinateSystem: 'EPSG:7856',
        points: [{ chainage: 0, easting: 1, northing: 2 }],
      }),
    ).toThrow(AppError);

    try {
      cleanSetoutCandidate({ points: [{ chainage: 'x', easting: 'y', northing: 'z' }] });
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).details).toMatchObject({ found: 0 });
    }
  });

  it('caps output at 2000 points and warns', () => {
    const points = Array.from({ length: 2100 }, (_, i) => ({
      chainage: 2100 - i,
      easting: i,
      northing: i,
    }));
    const candidate = cleanSetoutCandidate({ coordinateSystem: 'EPSG:7856', points });

    expect(candidate.points).toHaveLength(2000);
    // sorted ascending: first kept point is the lowest chainage
    expect(candidate.points[0].chainage).toBe(1);
    expect(candidate.warnings.some((w) => w.includes('2100'))).toBe(true);
  });

  it('passes through model-supplied warnings and tolerates a garbage root', () => {
    const candidate = cleanSetoutCandidate({
      coordinateSystem: 'EPSG:7856',
      points: [
        { chainage: 0, easting: 1, northing: 2 },
        { chainage: 1, easting: 3, northing: 4 },
      ],
      warnings: ['title block partly obscured'],
    });
    expect(candidate.warnings).toContain('title block partly obscured');

    expect(() => cleanSetoutCandidate('not-an-object')).toThrow(AppError);
    expect(() => cleanSetoutCandidate(null)).toThrow(AppError);
  });
});
