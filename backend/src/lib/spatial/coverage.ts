/**
 * Chainage coverage engine (pure, DB-free).
 *
 * Given an extent (a control line's chainage range) and a set of lot intervals
 * along it, compute how much of the alignment is lotted, how much is conformed,
 * and where the gaps are. This is the maths behind the coverage report; the
 * route layer joins it to lot status/activity and turns gaps into polygons.
 *
 * Conformed-over-unconformed precedence: `conformedIntervals` is the merged
 * union of the CONFORMED lots only. A chainage range covered by both a conformed
 * and an unconformed lot therefore counts as conformed — the conformed lot
 * certifies that ground, so its conformance wins for coverage purposes.
 */

export interface CoverageExtent {
  start: number;
  end: number;
}

export interface CoverageLot {
  chainageStart: number;
  chainageEnd: number;
  conformed: boolean;
}

export interface CoverageInterval {
  start: number;
  end: number;
}

export interface CoverageGap {
  start: number;
  end: number;
  lengthM: number;
}

export interface CoverageResult {
  coveredIntervals: CoverageInterval[];
  conformedIntervals: CoverageInterval[];
  gaps: CoverageGap[];
  coveredLengthM: number;
  conformedLengthM: number;
  extentLengthM: number;
  percentLotted: number;
  percentConformed: number;
}

// A gap shorter than this (metres) is survey noise, not a real hole — don't report it.
const GAP_NOISE_FLOOR_M = 0.5;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  // +0 normalises -0 to 0 so rounded zeros read cleanly.
  return Math.round(value * factor) / factor + 0;
}

function isFinitePair(a: number, b: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b);
}

/**
 * Clamp lots to the extent, drop degenerate ones, and merge overlapping/touching
 * intervals into a sorted, disjoint union. Touching endpoints (a.end === b.start)
 * merge — abutting lots leave no gap.
 */
function mergedUnion(
  lots: CoverageLot[],
  extentStart: number,
  extentEnd: number,
): CoverageInterval[] {
  const clamped: CoverageInterval[] = [];
  for (const lot of lots) {
    if (!isFinitePair(lot.chainageStart, lot.chainageEnd)) continue;
    const lo = Math.min(lot.chainageStart, lot.chainageEnd);
    const hi = Math.max(lot.chainageStart, lot.chainageEnd);
    const start = Math.max(extentStart, lo);
    const end = Math.min(extentEnd, hi);
    if (end <= start) continue; // outside the extent or degenerate after clamp
    clamped.push({ start, end });
  }

  clamped.sort((a, b) => a.start - b.start);

  const merged: CoverageInterval[] = [];
  for (const interval of clamped) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

function totalLength(intervals: CoverageInterval[]): number {
  return intervals.reduce((sum, i) => sum + (i.end - i.start), 0);
}

/** Complement of the covered union within [extentStart, extentEnd]. */
function complement(
  covered: CoverageInterval[],
  extentStart: number,
  extentEnd: number,
): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  let cursor = extentStart;
  for (const interval of covered) {
    if (interval.start > cursor) {
      gaps.push({ start: cursor, end: interval.start, lengthM: interval.start - cursor });
    }
    cursor = Math.max(cursor, interval.end);
  }
  if (cursor < extentEnd) {
    gaps.push({ start: cursor, end: extentEnd, lengthM: extentEnd - cursor });
  }
  return gaps.filter((gap) => gap.lengthM >= GAP_NOISE_FLOOR_M);
}

function roundInterval(interval: CoverageInterval): CoverageInterval {
  return { start: round(interval.start, 1), end: round(interval.end, 1) };
}

function roundGap(gap: CoverageGap): CoverageGap {
  return {
    start: round(gap.start, 1),
    end: round(gap.end, 1),
    lengthM: round(gap.lengthM, 1),
  };
}

export function computeChainageCoverage(
  extent: CoverageExtent,
  lots: CoverageLot[],
): CoverageResult {
  const extentStart = Math.min(extent.start, extent.end);
  const extentEnd = Math.max(extent.start, extent.end);
  const extentLengthM = Math.max(0, extentEnd - extentStart);

  const covered = mergedUnion(lots, extentStart, extentEnd);
  const conformed = mergedUnion(
    lots.filter((lot) => lot.conformed),
    extentStart,
    extentEnd,
  );
  const gaps = complement(covered, extentStart, extentEnd);

  const coveredLengthM = totalLength(covered);
  const conformedLengthM = totalLength(conformed);

  const percentLotted = extentLengthM > 0 ? (coveredLengthM / extentLengthM) * 100 : 0;
  const percentConformed = extentLengthM > 0 ? (conformedLengthM / extentLengthM) * 100 : 0;

  return {
    coveredIntervals: covered.map(roundInterval),
    conformedIntervals: conformed.map(roundInterval),
    gaps: gaps.map(roundGap),
    coveredLengthM: round(coveredLengthM, 1),
    conformedLengthM: round(conformedLengthM, 1),
    extentLengthM: round(extentLengthM, 1),
    percentLotted: round(percentLotted, 1),
    percentConformed: round(percentConformed, 1),
  };
}
