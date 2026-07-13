import { describe, expect, it } from 'vitest';

import { computeChainageCoverage, type CoverageLot } from './coverage.js';

const EXTENT = { start: 0, end: 100 };

function lot(chainageStart: number, chainageEnd: number, conformed = false): CoverageLot {
  return { chainageStart, chainageEnd, conformed };
}

describe('computeChainageCoverage', () => {
  it('reports full coverage with no gaps', () => {
    const result = computeChainageCoverage(EXTENT, [lot(0, 100)]);
    expect(result.gaps).toEqual([]);
    expect(result.coveredLengthM).toBe(100);
    expect(result.percentLotted).toBe(100);
    expect(result.coveredIntervals).toEqual([{ start: 0, end: 100 }]);
  });

  it('finds a single middle gap', () => {
    const result = computeChainageCoverage(EXTENT, [lot(0, 40), lot(60, 100)]);
    expect(result.gaps).toEqual([{ start: 40, end: 60, lengthM: 20 }]);
    expect(result.coveredLengthM).toBe(80);
    expect(result.percentLotted).toBe(80);
  });

  it('merges overlapping lots into one covered interval', () => {
    const result = computeChainageCoverage(EXTENT, [lot(0, 60), lot(40, 100)]);
    expect(result.coveredIntervals).toEqual([{ start: 0, end: 100 }]);
    expect(result.coveredLengthM).toBe(100);
    expect(result.gaps).toEqual([]);
  });

  it('merges lots that touch at an endpoint (no phantom gap)', () => {
    const result = computeChainageCoverage(EXTENT, [lot(0, 50), lot(50, 100)]);
    expect(result.coveredIntervals).toEqual([{ start: 0, end: 100 }]);
    expect(result.gaps).toEqual([]);
  });

  it('counts a range as conformed when any conformed lot covers it (precedence)', () => {
    // 0–60 unconformed, 40–100 conformed. Covered union is 0–100; conformed
    // union is 40–100 — the conformed lot certifies the 40–60 overlap.
    const result = computeChainageCoverage(EXTENT, [lot(0, 60, false), lot(40, 100, true)]);
    expect(result.coveredIntervals).toEqual([{ start: 0, end: 100 }]);
    expect(result.conformedIntervals).toEqual([{ start: 40, end: 100 }]);
    expect(result.conformedLengthM).toBe(60);
    expect(result.percentConformed).toBe(60);
    expect(result.percentLotted).toBe(100);
  });

  it('ignores a sub-0.5 m gap as survey noise', () => {
    // A 0.3 m sliver between 40.0 and 40.3 is dropped from the gap list.
    const result = computeChainageCoverage(EXTENT, [lot(0, 40), lot(40.3, 100)]);
    expect(result.gaps).toEqual([]);
  });

  it('reports a gap of exactly 0.5 m (at the noise floor)', () => {
    const result = computeChainageCoverage(EXTENT, [lot(0, 40), lot(40.5, 100)]);
    expect(result.gaps).toEqual([{ start: 40, end: 40.5, lengthM: 0.5 }]);
  });

  it('clamps a lot that overhangs the extent', () => {
    const result = computeChainageCoverage(EXTENT, [lot(-20, 120)]);
    expect(result.coveredIntervals).toEqual([{ start: 0, end: 100 }]);
    expect(result.coveredLengthM).toBe(100);
  });

  it('drops a lot entirely outside the extent', () => {
    const result = computeChainageCoverage(EXTENT, [lot(200, 300)]);
    expect(result.coveredLengthM).toBe(0);
    expect(result.gaps).toEqual([{ start: 0, end: 100, lengthM: 100 }]);
  });

  it('drops a degenerate (zero-length) lot', () => {
    const result = computeChainageCoverage(EXTENT, [lot(50, 50)]);
    expect(result.coveredLengthM).toBe(0);
    expect(result.gaps).toEqual([{ start: 0, end: 100, lengthM: 100 }]);
  });

  it('normalises a reversed lot interval', () => {
    const result = computeChainageCoverage(EXTENT, [lot(80, 20)]);
    expect(result.coveredIntervals).toEqual([{ start: 20, end: 80 }]);
  });

  it('returns one full-extent gap when there are no lots', () => {
    const result = computeChainageCoverage(EXTENT, []);
    expect(result.gaps).toEqual([{ start: 0, end: 100, lengthM: 100 }]);
    expect(result.percentLotted).toBe(0);
    expect(result.percentConformed).toBe(0);
  });

  it('rounds endpoints to 0.1 m and percentages to 1 dp', () => {
    const result = computeChainageCoverage({ start: 0, end: 300 }, [
      lot(0, 100.04),
      lot(200.07, 300),
    ]);
    // 100.04 -> 100.0, 200.07 -> 200.1
    expect(result.coveredIntervals).toEqual([
      { start: 0, end: 100 },
      { start: 200.1, end: 300 },
    ]);
    // covered = 100.04 + 99.93 = 199.97 / 300 = 66.656% -> 66.7
    expect(result.percentLotted).toBe(66.7);
  });

  it('handles a degenerate extent without dividing by zero', () => {
    const result = computeChainageCoverage({ start: 50, end: 50 }, [lot(0, 100)]);
    expect(result.extentLengthM).toBe(0);
    expect(result.percentLotted).toBe(0);
    expect(result.gaps).toEqual([]);
  });

  it('normalises a reversed extent', () => {
    const result = computeChainageCoverage({ start: 100, end: 0 }, [lot(0, 40)]);
    expect(result.extentLengthM).toBe(100);
    expect(result.gaps).toEqual([{ start: 40, end: 100, lengthM: 60 }]);
  });
});
