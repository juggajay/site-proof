import { describe, expect, it } from 'vitest';

import { type Segment, segmentsToControlPoints, summariseAlignment } from './alignmentImport.js';

describe('segmentsToControlPoints', () => {
  it('accumulates chainage along a straight line from staStart', () => {
    const points = segmentsToControlPoints(
      [{ kind: 'line', start: { e: 0, n: 0 }, end: { e: 100, n: 0 } }],
      1000,
    );
    expect(points).toEqual([
      { chainage: 1000, easting: 0, northing: 0 },
      { chainage: 1100, easting: 100, northing: 0 },
    ]);
  });

  it('densifies a CCW quarter arc into chords with true arc-length chainage', () => {
    // Centre (0,0), radius 10, from (10,0) CCW to (0,10): sweep π/2, length 5π.
    const arc: Segment = {
      kind: 'arc',
      start: { e: 10, n: 0 },
      end: { e: 0, n: 10 },
      center: { e: 0, n: 0 },
      clockwise: false,
    };
    const points = segmentsToControlPoints([arc], 0);
    // sagitta ≤ 2 m at R=10 ⇒ 2 chords ⇒ 3 points.
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ chainage: 0, easting: 10, northing: 0 });
    expect(points[1].easting).toBeCloseTo(7.0711, 3);
    expect(points[1].northing).toBeCloseTo(7.0711, 3);
    expect(points[2].easting).toBeCloseTo(0, 6);
    expect(points[2].northing).toBeCloseTo(10, 6);
    expect(points[2].chainage).toBeCloseTo((10 * Math.PI) / 2, 6);
  });

  it('rejects a pathological arc before it allocates millions of chords', () => {
    // Huge radius + near-full sweep would demand >100k chords; must be rejected
    // loudly up front, not silently coarsened and not left to exhaust memory
    // before the downstream point cap.
    const R = 1e10;
    const arc: Segment = {
      kind: 'arc',
      start: { e: R, n: 0 },
      end: { e: R * Math.cos(-0.001), n: R * Math.sin(-0.001) },
      center: { e: 0, n: 0 },
      clockwise: false,
    };
    expect(() => segmentsToControlPoints([arc], 0)).toThrow(/too finely divided|implausible/i);
  });

  it('rejects an alignment that exceeds the point cap', () => {
    // 2001 unit line segments ⇒ 2002 points, past MAX_IMPORT_POINTS (2000).
    const segments: Segment[] = [];
    for (let i = 0; i < 2001; i += 1) {
      segments.push({ kind: 'line', start: { e: i, n: 0 }, end: { e: i + 1, n: 0 } });
    }
    expect(() => segmentsToControlPoints(segments, 0)).toThrow(/max 2000/);
  });
});

describe('summariseAlignment', () => {
  it('reports chainage range, length and bbox', () => {
    const summary = summariseAlignment({
      name: 'MC01',
      points: [
        { chainage: 100, easting: 10, northing: 20 },
        { chainage: 250, easting: 40, northing: 5 },
      ],
    });
    expect(summary.pointCount).toBe(2);
    expect(summary.chainageStart).toBe(100);
    expect(summary.chainageEnd).toBe(250);
    expect(summary.lengthM).toBe(150);
    expect(summary.bbox).toEqual({ minE: 10, minN: 5, maxE: 40, maxN: 20 });
  });
});
