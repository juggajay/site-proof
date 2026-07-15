import { describe, expect, it } from 'vitest';

import { AppError } from '../../lib/AppError.js';
import { cleanPlanSheetCandidate } from './planSheetExtraction.js';

// EPSG:7856 (MGA2020 Zone 56) is in the supported preset set used across the app.
const SUPPORTED_CRS = 'EPSG:7856';

describe('cleanPlanSheetCandidate', () => {
  it('keeps points with finite coordinates and a supported CRS', () => {
    const { candidate, warnings } = cleanPlanSheetCandidate({
      coordinateSystem: SUPPORTED_CRS,
      points: [
        {
          easting: 331000.5,
          northing: 6250000.25,
          label: 'NW grid cross',
          approxX: 0.1,
          approxY: 0.1,
        },
        { easting: 331200, northing: 6249800, label: 'SE mark', approxX: 0.9, approxY: 0.9 },
      ],
    });
    expect(candidate.coordinateSystem).toBe(SUPPORTED_CRS);
    expect(candidate.points).toHaveLength(2);
    expect(candidate.points[0]).toMatchObject({ easting: 331000.5, approxX: 0.1 });
    expect(warnings).toEqual([]);
  });

  it('nulls an unsupported CRS with a warning but keeps the points', () => {
    const { candidate, warnings } = cleanPlanSheetCandidate({
      coordinateSystem: 'MGA Zone 99',
      points: [
        { easting: 1, northing: 2, approxX: 0.2, approxY: 0.2 },
        { easting: 3, northing: 4, approxX: 0.8, approxY: 0.8 },
      ],
    });
    expect(candidate.coordinateSystem).toBeNull();
    expect(candidate.points).toHaveLength(2);
    expect(warnings.join(' ')).toMatch(/coordinate system/i);
  });

  it('clamps off-sheet positions to null with a warning', () => {
    const { candidate, warnings } = cleanPlanSheetCandidate({
      points: [
        { easting: 1, northing: 2, label: 'A', approxX: 1.4, approxY: -0.2 },
        { easting: 3, northing: 4, label: 'B', approxX: 0.5, approxY: 0.5 },
      ],
    });
    expect(candidate.points[0].approxX).toBeNull();
    expect(candidate.points[0].approxY).toBeNull();
    expect(candidate.points[1].approxX).toBe(0.5);
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('drops points missing a finite easting or northing', () => {
    const { candidate, warnings } = cleanPlanSheetCandidate({
      points: [
        { easting: 1, northing: 2, approxX: 0.1, approxY: 0.1 },
        { easting: 'n/a', northing: 4, label: 'bad', approxX: 0.5, approxY: 0.5 },
        { easting: 5, northing: 6, approxX: 0.9, approxY: 0.9 },
      ],
    });
    expect(candidate.points).toHaveLength(2);
    expect(warnings.join(' ')).toMatch(/unreadable/i);
  });

  it('throws PLAN_SHEET_EXTRACTION_INSUFFICIENT with fewer than two usable points', () => {
    try {
      cleanPlanSheetCandidate({
        points: [{ easting: 1, northing: 2, approxX: 0.1, approxY: 0.1 }],
      });
      throw new Error('expected cleanPlanSheetCandidate to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).code).toBe('PLAN_SHEET_EXTRACTION_INSUFFICIENT');
    }
  });

  it('tolerates a non-object payload by failing the point-count gate', () => {
    expect(() => cleanPlanSheetCandidate(null)).toThrow(AppError);
    expect(() => cleanPlanSheetCandidate({ points: 'not-an-array' })).toThrow(AppError);
  });
});
