import { describe, expect, it } from 'vitest';

import { parseDxf } from './dxfParser.js';

// Build DXF (group-code, value) line pairs from an array.
function dxf(pairs: [number, string | number][]): string {
  return pairs.map(([code, value]) => `${code}\n${value}`).join('\n');
}

// LWPOLYLINE on layer ROAD_CL: line (0,0)->(100,0), then a bulge=1 semicircle
// (100,0)->(100,100). The semicircle centre is (100,50) and it bulges to e≈150.
const LWPOLYLINE = dxf([
  [0, 'SECTION'],
  [2, 'ENTITIES'],
  [0, 'LWPOLYLINE'],
  [8, 'ROAD_CL'],
  [90, 3],
  [70, 0],
  [10, 0],
  [20, 0],
  [10, 100],
  [20, 0],
  [42, 1],
  [10, 100],
  [20, 100],
  [0, 'ENDSEC'],
  [0, 'EOF'],
]);

describe('parseDxf', () => {
  it('parses an LWPOLYLINE with a bulge into a densified centreline', () => {
    const { alignments, warnings } = parseDxf(LWPOLYLINE);
    expect(warnings).toEqual([]);
    expect(alignments).toHaveLength(1);
    const cl = alignments[0];
    expect(cl.name).toBe('ROAD_CL');
    // DXF has no chainage → starts at 0 at the first vertex.
    expect(cl.points[0]).toEqual({ chainage: 0, easting: 0, northing: 0 });
    // The semicircle bulges out to e≈150 (centre (100,50), R=50).
    const apex = cl.points.find((p) => p.easting > 145);
    expect(apex).toBeDefined();
    expect(apex!.easting).toBeCloseTo(150, 3);
    expect(apex!.northing).toBeCloseTo(50, 3);
    // Ends at the last vertex, chainage = 100 (line) + 50π (semicircle).
    const last = cl.points[cl.points.length - 1];
    expect(last.easting).toBeCloseTo(100, 6);
    expect(last.northing).toBeCloseTo(100, 6);
    expect(last.chainage).toBeCloseTo(100 + 50 * Math.PI, 2);
  });

  it('parses standalone LINE and ARC entities as separate candidates', () => {
    const text = dxf([
      [0, 'SECTION'],
      [2, 'ENTITIES'],
      [0, 'LINE'],
      [8, 'KERB'],
      [10, 0],
      [20, 0],
      [11, 30],
      [21, 40],
      [0, 'ARC'],
      [8, 'BEND'],
      [10, 0],
      [20, 0],
      [40, 10],
      [50, 0],
      [51, 90],
      [0, 'ENDSEC'],
      [0, 'EOF'],
    ]);
    const { alignments } = parseDxf(text);
    expect(alignments.map((a) => a.name)).toEqual(['KERB', 'BEND']);
    // LINE: (0,0)->(30,40), length 50.
    const kerb = alignments[0];
    expect(kerb.points).toEqual([
      { chainage: 0, easting: 0, northing: 0 },
      { chainage: 50, easting: 30, northing: 40 },
    ]);
    // ARC: R=10, 0°→90° CCW starts at (10,0), ends at (0,10).
    const bend = alignments[1];
    expect(bend.points[0]).toEqual({ chainage: 0, easting: 10, northing: 0 });
    const bendEnd = bend.points[bend.points.length - 1];
    expect(bendEnd.easting).toBeCloseTo(0, 6);
    expect(bendEnd.northing).toBeCloseTo(10, 6);
  });

  it('disambiguates duplicate layer names', () => {
    const text = dxf([
      [0, 'SECTION'],
      [2, 'ENTITIES'],
      [0, 'LINE'],
      [8, 'CL'],
      [10, 0],
      [20, 0],
      [11, 10],
      [21, 0],
      [0, 'LINE'],
      [8, 'CL'],
      [10, 0],
      [20, 0],
      [11, 0],
      [21, 10],
      [0, 'ENDSEC'],
      [0, 'EOF'],
    ]);
    const { alignments } = parseDxf(text);
    expect(alignments.map((a) => a.name)).toEqual(['CL', 'CL (2)']);
  });

  it('rejects binary DXF', () => {
    expect(() => parseDxf('AutoCAD Binary DXF\r\n\x00\x00')).toThrow(/Binary DXF/);
  });

  it('throws when no supported entities exist', () => {
    const text = dxf([
      [0, 'SECTION'],
      [2, 'ENTITIES'],
      [0, 'CIRCLE'],
      [8, 'X'],
      [10, 0],
      [20, 0],
      [40, 5],
      [0, 'ENDSEC'],
      [0, 'EOF'],
    ]);
    expect(() => parseDxf(text)).toThrow(/No LINE, ARC/);
  });
});
