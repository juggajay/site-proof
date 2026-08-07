import { describe, expect, it } from 'vitest';

import { createDraftLotIfcFixture } from './fixture.js';
import {
  decimalDegreesToIfcCompound,
  serializeDraftLotIfc,
  type DraftLotIfcInput,
} from './serializer.js';

function entityCount(ifc: string, type: string): number {
  return (ifc.match(new RegExp(`^#\\d+=${type}\\(`, 'gm')) ?? []).length;
}

function polylinePointRefs(ifc: string): string[] {
  const match = ifc.match(/^#\d+=IFCPOLYLINE\(\((#[\d]+(?:,#[\d]+)*)\)\);$/m);
  if (!match) throw new Error('IfcPolyline not found');
  return match[1].split(',');
}

function pointCoordinates(ifc: string, reference: string): [number, number] {
  const match = ifc.match(
    new RegExp(`^${reference}=IFCCARTESIANPOINT\\(\\(([-\\d.]+),([-\\d.]+)\\)\\);$`, 'm'),
  );
  if (!match) throw new Error(`2D point ${reference} not found`);
  return [Number(match[1]), Number(match[2])];
}

function emittedProfileArea(ifc: string): number {
  const refs = polylinePointRefs(ifc).slice(0, -1);
  const points = refs.map((reference) => pointCoordinates(ifc, reference));
  return (
    points.reduce((area, point, index) => {
      const next = points[(index + 1) % points.length];
      return area + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2
  );
}

describe('DRAFT lot IFC serializer', () => {
  it('emits the IFC2X3 Coordination View tree, proxy, reference-closed ring, and five psets', () => {
    const ifc = serializeDraftLotIfc(createDraftLotIfcFixture());

    expect(ifc).toContain('ISO-10303-21;');
    expect(ifc).toContain('ViewDefinition [CoordinationView_V2.0]');
    expect(ifc).toContain(
      'DRAFT - uncontrolled, lot-derived geometry, not an As Constructed survey',
    );
    expect(ifc).toContain("FILE_SCHEMA(('IFC2X3'));");
    for (const type of [
      'IFCPROJECT',
      'IFCSITE',
      'IFCBUILDING',
      'IFCBUILDINGSTOREY',
      'IFCBUILDINGELEMENTPROXY',
    ]) {
      expect(entityCount(ifc, type)).toBe(1);
    }
    expect(entityCount(ifc, 'IFCRELAGGREGATES')).toBe(3);
    expect(entityCount(ifc, 'IFCRELCONTAINEDINSPATIALSTRUCTURE')).toBe(1);
    expect(entityCount(ifc, 'IFCPROPERTYSET')).toBe(5);
    expect(ifc).toContain('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)');

    const refs = polylinePointRefs(ifc);
    expect(refs[refs.length - 1]).toBe(refs[0]);
    expect(refs.filter((reference) => reference === refs[0])).toHaveLength(2);
    const coordinatePairs = refs
      .slice(0, -1)
      .map((reference) => pointCoordinates(ifc, reference).join(','));
    expect(new Set(coordinatePairs).size).toBe(coordinatePairs.length);

    for (const name of ['Project', 'Design', 'Construction', 'Asset Management', 'CIVOS_QA']) {
      expect(ifc).toContain(`,'${name}',$,`);
    }
    for (const omitted of [
      'District',
      'AssetOwner',
      'RoadSectionID',
      'ModelCertifiedAsConstructedSurveyor',
      'UniqueObjectCode',
      'Tdist',
      'TdistStart',
      'TdistEnd',
      'ConformanceOverrideReason',
    ]) {
      expect(ifc).not.toContain(`'${omitted}'`);
    }
    expect(ifc).not.toContain('Seán');
    expect(Array.from(ifc).every((character) => character.charCodeAt(0) <= 0x7e)).toBe(true);
  });

  it('normalises clockwise input to counter-clockwise output', () => {
    const fixture = createDraftLotIfcFixture();
    fixture.gridRing = [...fixture.gridRing].reverse();
    expect(emittedProfileArea(serializeDraftLotIfc(fixture))).toBeGreaterThan(0);
  });

  it.each([
    {
      name: 'a self-intersecting bowtie',
      ring: [
        { easting: 500_000, northing: 6_900_000 },
        { easting: 500_010, northing: 6_900_010 },
        { easting: 500_010, northing: 6_900_000 },
        { easting: 500_000, northing: 6_900_010 },
      ],
    },
    {
      name: 'a two-vertex ring',
      ring: [
        { easting: 500_000, northing: 6_900_000 },
        { easting: 500_010, northing: 6_900_000 },
      ],
    },
  ])('rejects $name and names the lot', ({ ring }) => {
    const fixture = createDraftLotIfcFixture();
    fixture.gridRing = ring;
    expect(() => serializeDraftLotIfc(fixture)).toThrow(/LOT-042/);
  });

  it('truncates string property values to 255 characters with an ellipsis', () => {
    const fixture = createDraftLotIfcFixture();
    fixture.propertySets.civosQa.ConformedBy = 'x'.repeat(300);
    const ifc = serializeDraftLotIfc(fixture);
    expect(ifc).toContain(`${'x'.repeat(254)}\\X2\\2026\\X0\\`);
    expect(ifc).not.toContain('x'.repeat(255));
  });
});

describe('IFC compound latitude/longitude conversion', () => {
  it('keeps the sign consistent across non-zero components', () => {
    expect(decimalDegreesToIfcCompound(-27.5)).toEqual([-27, -30, 0, 0]);
  });

  it('round-trips a value to millionths of an arc-second', () => {
    const input = 153.123456789;
    const [degrees, minutes, seconds, millionths] = decimalDegreesToIfcCompound(input);
    const output = degrees + minutes / 60 + seconds / 3_600 + millionths / 3_600_000_000;
    expect(output).toBeCloseTo(input, 9);
  });
});

// Compile-time guard: the production entry point consumes a plain data object.
const _plainInput: DraftLotIfcInput = createDraftLotIfcFixture();
void _plainInput;
