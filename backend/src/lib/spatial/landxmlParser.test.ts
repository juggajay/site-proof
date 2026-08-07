import { describe, expect, it } from 'vitest';

import { parseLandXml } from './landxmlParser.js';

// Note: LandXML point lists are "northing easting" (Y then X).
const LINE_AND_CURVE = `<?xml version="1.0"?>
<LandXML>
  <Alignments>
    <Alignment name="MC01" staStart="1000" length="115.708">
      <CoordGeom>
        <Line>
          <Start>6250000 500000</Start>
          <End>6250000 500100</End>
        </Line>
        <Curve rot="ccw" radius="10">
          <Start>6250000 500100</Start>
          <Center>6250010 500100</Center>
          <End>6250010 500110</End>
        </Curve>
      </CoordGeom>
    </Alignment>
  </Alignments>
</LandXML>`;

describe('parseLandXml', () => {
  it('parses Line + Curve, honouring northing-easting order and staStart chainage', () => {
    const { alignments, warnings } = parseLandXml(LINE_AND_CURVE);
    expect(warnings).toEqual([]);
    expect(alignments).toHaveLength(1);
    const line = alignments[0];
    expect(line.name).toBe('MC01');

    // First point: easting=500000, northing=6250000 (order swapped from file).
    expect(line.points[0]).toEqual({ chainage: 1000, easting: 500000, northing: 6250000 });
    // Straight 100 m run lands the shared vertex at chainage 1100.
    const atCurveStart = line.points.find((p) => p.chainage === 1100)!;
    expect(atCurveStart).toMatchObject({ easting: 500100, northing: 6250000 });
    // Quarter arc (R=10) adds ~15.708 m; final vertex at the curve End.
    const last = line.points[line.points.length - 1];
    expect(last.easting).toBeCloseTo(500110, 4);
    expect(last.northing).toBeCloseTo(6250010, 4);
    expect(last.chainage).toBeCloseTo(1100 + (10 * Math.PI) / 2, 3);
  });

  it('rejects an alignment with a Spiral but still imports the good ones', () => {
    const withSpiral = LINE_AND_CURVE.replace(
      '</Alignments>',
      `<Alignment name="Ramp" staStart="0">
         <CoordGeom>
           <Spiral rot="ccw" length="30" radiusEnd="50" spiType="clothoid">
             <Start>0 0</Start><PI>0 10</PI><End>10 10</End>
           </Spiral>
         </CoordGeom>
       </Alignment></Alignments>`,
    );
    const { alignments, warnings } = parseLandXml(withSpiral);
    expect(alignments.map((a) => a.name)).toEqual(['MC01']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Ramp/);
    expect(warnings[0]).toMatch(/Spiral/);
  });

  it('throws on XML with no alignments', () => {
    expect(() => parseLandXml('<LandXML><Units/></LandXML>')).toThrow(/No <Alignment>/);
  });

  it('throws on non-XML input', () => {
    expect(() => parseLandXml('not xml at all')).toThrow();
  });

  it('rejects a file declaring imperial units', () => {
    const fx = LINE_AND_CURVE.replace(
      '<LandXML>',
      '<LandXML><Units><Imperial linearUnit="foot" areaUnit="squareFoot"/></Units>',
    );
    expect(() => parseLandXml(fx)).toThrow(/imperial|foot/i);
  });

  it('accepts an explicit metric declaration', () => {
    const fx = LINE_AND_CURVE.replace(
      '<LandXML>',
      '<LandXML><Units><Metric linearUnit="meter"/></Units>',
    );
    const { alignments, warnings } = parseLandXml(fx);
    expect(alignments).toHaveLength(1);
    expect(warnings).toEqual([]);
  });

  it('rejects a Metric declaration in non-metre units', () => {
    const fx = LINE_AND_CURVE.replace(
      '<LandXML>',
      '<LandXML><Units><Metric linearUnit="foot"/></Units>',
    );
    expect(() => parseLandXml(fx)).toThrow(/foot/);
  });

  it('rejects truncated (non-well-formed) XML', () => {
    const fx = LINE_AND_CURVE.slice(0, LINE_AND_CURVE.indexOf('<Curve'));
    expect(() => parseLandXml(fx)).toThrow(/not valid XML/);
  });

  it('skips an alignment whose declared length disagrees with its geometry', () => {
    const fx = LINE_AND_CURVE.replace(
      '</Alignments>',
      `<Alignment name="Short" staStart="0" length="500">
         <CoordGeom>
           <Line>
             <Start>0 0</Start>
             <End>0 100</End>
           </Line>
         </CoordGeom>
       </Alignment></Alignments>`,
    );
    const { alignments, warnings } = parseLandXml(fx);
    expect(alignments.map((a) => a.name)).toEqual(['MC01']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/declares length/);
  });

  it('accepts an alignment with no declared length', () => {
    const fx = LINE_AND_CURVE.replace(' length="115.708"', '');
    const { alignments, warnings } = parseLandXml(fx);
    expect(alignments).toHaveLength(1);
    expect(warnings).toEqual([]);
  });
});
