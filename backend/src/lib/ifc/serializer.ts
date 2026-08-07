import { AppError } from '../AppError.js';
import { localToWgs84 } from '../spatial/crs.js';
import { ifcGuid } from './guid.js';
import {
  DRAFT_LOT_PROPERTY_SETS,
  type DraftLotPropertyData,
  type DraftPropertyValue,
} from './propertySets.js';
import { DERIVED, E, I, L, NULL, R, S, StepWriter, T, type StepValue } from './step.js';

export interface DraftIfcGridPoint {
  easting: number;
  northing: number;
}

export interface DraftLotIfcInput {
  filename: string;
  exportedAt: string;
  authorName: string;
  project: {
    id: string;
    name: string;
    description?: string | null;
  };
  origin: {
    e: number;
    n: number;
    epsg: string;
  };
  lot: {
    id: string;
    lotNumber: string;
    description?: string | null;
  };
  gridRing: DraftIfcGridPoint[];
  propertySets: DraftLotPropertyData;
}

const STRING_PROPERTY_LIMIT = 255;
const GEOMETRY_DEPTH_METRES = 0.3;

function samePoint(a: DraftIfcGridPoint, b: DraftIfcGridPoint): boolean {
  return a.easting === b.easting && a.northing === b.northing;
}

function orientation(a: DraftIfcGridPoint, b: DraftIfcGridPoint, c: DraftIfcGridPoint): number {
  const cross =
    (b.easting - a.easting) * (c.northing - a.northing) -
    (b.northing - a.northing) * (c.easting - a.easting);
  return Math.abs(cross) < 1e-9 ? 0 : Math.sign(cross);
}

function onSegment(a: DraftIfcGridPoint, b: DraftIfcGridPoint, p: DraftIfcGridPoint): boolean {
  return (
    p.easting >= Math.min(a.easting, b.easting) - 1e-9 &&
    p.easting <= Math.max(a.easting, b.easting) + 1e-9 &&
    p.northing >= Math.min(a.northing, b.northing) - 1e-9 &&
    p.northing <= Math.max(a.northing, b.northing) + 1e-9
  );
}

function segmentsIntersect(
  a: DraftIfcGridPoint,
  b: DraftIfcGridPoint,
  c: DraftIfcGridPoint,
  d: DraftIfcGridPoint,
): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (abC !== abD && cdA !== cdB) return true;
  return (
    (abC === 0 && onSegment(a, b, c)) ||
    (abD === 0 && onSegment(a, b, d)) ||
    (cdA === 0 && onSegment(c, d, a)) ||
    (cdB === 0 && onSegment(c, d, b))
  );
}

function signedArea(ring: readonly DraftIfcGridPoint[]): number {
  let twiceArea = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    twiceArea += current.easting * next.northing - next.easting * current.northing;
  }
  return twiceArea / 2;
}

function invalidGeometry(lotNumber: string, reason: string): never {
  throw AppError.badRequest(`Invalid IFC geometry for lot ${lotNumber}: ${reason}`, {
    code: 'IFC_INVALID_GEOMETRY',
  });
}

/** Validate the export trust boundary and return one unclosed, CCW ring. */
export function validateAndNormaliseRing(
  input: readonly DraftIfcGridPoint[],
  lotNumber: string,
): DraftIfcGridPoint[] {
  const ring = input.map((point) => ({ ...point }));
  if (ring.length > 1 && samePoint(ring[0], ring[ring.length - 1])) ring.pop();

  for (const point of ring) {
    if (!Number.isFinite(point.easting) || !Number.isFinite(point.northing)) {
      invalidGeometry(lotNumber, 'every coordinate must be finite');
    }
  }

  const distinct = new Set(ring.map((point) => `${point.easting},${point.northing}`));
  if (distinct.size < 3) invalidGeometry(lotNumber, 'the ring needs at least 3 distinct vertices');
  if (distinct.size !== ring.length)
    invalidGeometry(lotNumber, 'the ring contains duplicate vertices');

  // ponytail: O(n²), lots are tens of vertices
  for (let first = 0; first < ring.length; first += 1) {
    const firstNext = (first + 1) % ring.length;
    for (let second = first + 1; second < ring.length; second += 1) {
      const secondNext = (second + 1) % ring.length;
      if (first === second || firstNext === second || secondNext === first) continue;
      if (segmentsIntersect(ring[first], ring[firstNext], ring[second], ring[secondNext])) {
        invalidGeometry(lotNumber, 'the ring self-intersects');
      }
    }
  }

  const area = signedArea(ring);
  if (Math.abs(area) < 1e-9) invalidGeometry(lotNumber, 'the ring has zero area');
  return area < 0 ? ring.reverse() : ring;
}

/** IFC2X3 compound angle: degrees, minutes, seconds, millionths of a second. */
export function decimalDegreesToIfcCompound(
  decimalDegrees: number,
): [number, number, number, number] {
  if (!Number.isFinite(decimalDegrees)) throw new Error('angle must be finite');
  const sign = decimalDegrees < 0 ? -1 : 1;
  const totalMillionths = Math.round(Math.abs(decimalDegrees) * 3_600 * 1_000_000);
  const degrees = Math.floor(totalMillionths / 3_600_000_000);
  let remainder = totalMillionths - degrees * 3_600_000_000;
  const minutes = Math.floor(remainder / 60_000_000);
  remainder -= minutes * 60_000_000;
  const seconds = Math.floor(remainder / 1_000_000);
  const millionths = remainder - seconds * 1_000_000;
  const signed = (part: number) => (part === 0 ? 0 : sign * part);
  return [signed(degrees), signed(minutes), signed(seconds), signed(millionths)];
}

function rootGuid(identityKey: string): StepValue {
  return S(ifcGuid(identityKey));
}

function relationKey(relType: string, parentKey: string, childKey: string): string {
  return `rel:${relType}:${parentKey}:${childKey}`;
}

function truncatePropertyString(input: string): string {
  const characters = Array.from(input);
  if (characters.length <= STRING_PROPERTY_LIMIT) return input;
  return `${characters.slice(0, STRING_PROPERTY_LIMIT - 1).join('')}…`;
}

function propertyNominalValue(input: DraftPropertyValue): StepValue | null {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input === 'string') return T('IFCLABEL', S(truncatePropertyString(input)));
  if (typeof input === 'boolean') return T('IFCBOOLEAN', E(input ? 'T' : 'F'));
  if (!Number.isFinite(input)) throw new Error(`non-finite IFC property value: ${input}`);
  return Number.isInteger(input) ? T('IFCINTEGER', I(input)) : T('IFCREAL', R(input));
}

function emitPropertySet(
  writer: StepWriter,
  ownerHistory: StepValue,
  product: StepValue,
  productKey: string,
  name: string,
  properties: readonly { name: string; value: DraftPropertyValue }[],
): void {
  const propertyRefs: StepValue[] = [];
  for (const property of properties) {
    const nominalValue = propertyNominalValue(property.value);
    if (!nominalValue) continue;
    propertyRefs.push(
      writer.entity('IFCPROPERTYSINGLEVALUE', [S(property.name), NULL, nominalValue, NULL]),
    );
  }

  const psetKey = `pset:${name}:${productKey}`;
  const pset = writer.entity('IFCPROPERTYSET', [
    rootGuid(psetKey),
    ownerHistory,
    S(name),
    NULL,
    L(propertyRefs),
  ]);
  writer.entity('IFCRELDEFINESBYPROPERTIES', [
    rootGuid(relationKey('defines', productKey, psetKey)),
    ownerHistory,
    NULL,
    NULL,
    L([product]),
    pset,
  ]);
}

/** Serialize one lot as an uncontrolled, DRAFT-grade IFC2X3 Coordination View file. */
export function serializeDraftLotIfc(input: DraftLotIfcInput): string {
  const ring = validateAndNormaliseRing(input.gridRing, input.lot.lotNumber);
  const exportedAt = new Date(input.exportedAt);
  if (Number.isNaN(exportedAt.getTime())) {
    throw AppError.badRequest(`Invalid IFC export timestamp for lot ${input.lot.lotNumber}`);
  }
  const writer = new StepWriter();

  const person = writer.entity('IFCPERSON', [
    NULL,
    NULL,
    S(input.authorName),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
  ]);
  const organisation = writer.entity('IFCORGANIZATION', [NULL, S('CIVOS'), NULL, NULL, NULL]);
  const personAndOrganisation = writer.entity('IFCPERSONANDORGANIZATION', [
    person,
    organisation,
    NULL,
  ]);
  const application = writer.entity('IFCAPPLICATION', [
    organisation,
    S('1.0'),
    S('CIVOS DRAFT IFC exporter'),
    S('CIVOS-IFC'),
  ]);
  const ownerHistory = writer.entity('IFCOWNERHISTORY', [
    personAndOrganisation,
    application,
    NULL,
    E('ADDED'),
    NULL,
    NULL,
    NULL,
    I(Math.floor(exportedAt.getTime() / 1_000)),
  ]);

  const units = writer.entity('IFCUNITASSIGNMENT', [
    L([
      writer.entity('IFCSIUNIT', [DERIVED, E('LENGTHUNIT'), NULL, E('METRE')]),
      writer.entity('IFCSIUNIT', [DERIVED, E('AREAUNIT'), NULL, E('SQUARE_METRE')]),
      writer.entity('IFCSIUNIT', [DERIVED, E('VOLUMEUNIT'), NULL, E('CUBIC_METRE')]),
      writer.entity('IFCSIUNIT', [DERIVED, E('PLANEANGLEUNIT'), NULL, E('RADIAN')]),
    ]),
  ]);

  const origin3d = writer.entity('IFCCARTESIANPOINT', [L([R(0), R(0), R(0)])]);
  const directionZ = writer.entity('IFCDIRECTION', [L([R(0), R(0), R(1)])]);
  const directionX = writer.entity('IFCDIRECTION', [L([R(1), R(0), R(0)])]);
  const identity3d = writer.entity('IFCAXIS2PLACEMENT3D', [origin3d, NULL, NULL]);
  const modelContext = writer.entity('IFCGEOMETRICREPRESENTATIONCONTEXT', [
    NULL,
    S('Model'),
    I(3),
    R(0.00001),
    identity3d,
    NULL,
  ]);
  const bodyContext = writer.entity('IFCGEOMETRICREPRESENTATIONSUBCONTEXT', [
    S('Body'),
    S('Model'),
    DERIVED,
    DERIVED,
    DERIVED,
    DERIVED,
    modelContext,
    NULL,
    E('MODEL_VIEW'),
    NULL,
  ]);

  const projectKey = `project:${input.project.id}`;
  const siteKey = `site:${input.project.id}`;
  const buildingKey = `building:${input.project.id}`;
  const storeyKey = `storey:${input.project.id}`;
  const productKey = `product:${input.lot.id}`;
  const project = writer.entity('IFCPROJECT', [
    rootGuid(projectKey),
    ownerHistory,
    S(input.project.name),
    S(input.project.description),
    NULL,
    S(input.project.name),
    S('Construction'),
    L([modelContext]),
    units,
  ]);

  const sitePlacement = writer.entity('IFCLOCALPLACEMENT', [NULL, identity3d]);
  const wgs84 = localToWgs84(input.origin.epsg, {
    easting: input.origin.e,
    northing: input.origin.n,
  });
  const site = writer.entity('IFCSITE', [
    rootGuid(siteKey),
    ownerHistory,
    S(`${input.project.name} Site`),
    NULL,
    NULL,
    sitePlacement,
    NULL,
    NULL,
    E('ELEMENT'),
    L(decimalDegreesToIfcCompound(wgs84.lat).map(I)),
    L(decimalDegreesToIfcCompound(wgs84.lng).map(I)),
    R(0),
    NULL,
    NULL,
  ]);
  const buildingPlacement = writer.entity('IFCLOCALPLACEMENT', [sitePlacement, identity3d]);
  const building = writer.entity('IFCBUILDING', [
    rootGuid(buildingKey),
    ownerHistory,
    S(`${input.project.name} DRAFT Model`),
    NULL,
    NULL,
    buildingPlacement,
    NULL,
    NULL,
    E('ELEMENT'),
    R(0),
    R(0),
    NULL,
  ]);
  const storeyPlacement = writer.entity('IFCLOCALPLACEMENT', [buildingPlacement, identity3d]);
  const storey = writer.entity('IFCBUILDINGSTOREY', [
    rootGuid(storeyKey),
    ownerHistory,
    S('DRAFT Lots'),
    NULL,
    NULL,
    storeyPlacement,
    NULL,
    S('Lot-derived geometry'),
    E('ELEMENT'),
    R(0),
  ]);

  for (const [parentKey, childKey, parent, child] of [
    [projectKey, siteKey, project, site],
    [siteKey, buildingKey, site, building],
    [buildingKey, storeyKey, building, storey],
  ] as const) {
    writer.entity('IFCRELAGGREGATES', [
      rootGuid(relationKey('aggregates', parentKey, childKey)),
      ownerHistory,
      NULL,
      NULL,
      parent,
      L([child]),
    ]);
  }

  const pointRefs = ring.map((point) =>
    writer.entity('IFCCARTESIANPOINT', [
      L([R(point.easting - input.origin.e), R(point.northing - input.origin.n)]),
    ]),
  );
  const polyline = writer.entity('IFCPOLYLINE', [L([...pointRefs, pointRefs[0]])]);
  const profile = writer.entity('IFCARBITRARYCLOSEDPROFILEDEF', [
    E('AREA'),
    S('Lot footprint'),
    polyline,
  ]);
  const solidPosition = writer.entity('IFCAXIS2PLACEMENT3D', [origin3d, directionZ, directionX]);
  const solid = writer.entity('IFCEXTRUDEDAREASOLID', [
    profile,
    solidPosition,
    directionZ,
    R(GEOMETRY_DEPTH_METRES),
  ]);
  const shapeRepresentation = writer.entity('IFCSHAPEREPRESENTATION', [
    bodyContext,
    S('Body'),
    S('SweptSolid'),
    L([solid]),
  ]);
  const productShape = writer.entity('IFCPRODUCTDEFINITIONSHAPE', [
    NULL,
    NULL,
    L([shapeRepresentation]),
  ]);
  const productPlacement = writer.entity('IFCLOCALPLACEMENT', [storeyPlacement, identity3d]);
  const product = writer.entity('IFCBUILDINGELEMENTPROXY', [
    rootGuid(productKey),
    ownerHistory,
    S(input.lot.lotNumber),
    S(input.lot.description),
    NULL,
    productPlacement,
    productShape,
    NULL,
    NULL,
  ]);
  writer.entity('IFCRELCONTAINEDINSPATIALSTRUCTURE', [
    rootGuid(relationKey('contained', storeyKey, productKey)),
    ownerHistory,
    NULL,
    NULL,
    L([product]),
    storey,
  ]);

  for (const definition of DRAFT_LOT_PROPERTY_SETS) {
    const source = input.propertySets[definition.source];
    emitPropertySet(
      writer,
      ownerHistory,
      product,
      productKey,
      definition.name,
      definition.properties.map((name) => ({ name, value: source[name] })),
    );
  }

  return writer.finish({
    filename: input.filename,
    timestamp: exportedAt.toISOString(),
    author: input.authorName,
    organisation: 'CIVOS',
  });
}
