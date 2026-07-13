import { AppError } from '../AppError.js';
import {
  type ImportedAlignment,
  type ImportResult,
  type Segment,
  type Vec,
  segmentsToControlPoints,
} from './alignmentImport.js';

/**
 * Minimal ASCII DXF importer for control-line geometry.
 *
 * DXF is a stream of (group-code, value) line pairs. We read the ENTITIES section
 * and turn each LINE, ARC, LWPOLYLINE and old-style POLYLINE into a candidate
 * centreline (named from its layer). LWPOLYLINE/POLYLINE bulges become circular
 * arcs, densified the same way as LandXML curves. DXF has no chainage, so each
 * candidate starts at chainage 0.
 *
 * ponytail: hand-rolled over adding `dxf-parser` — we need four entity types and
 * bulge handling, ~200 lines, fully unit-tested, versus a dependency that parses
 * the whole DXF object model we do not use. Binary DXF is rejected, not decoded.
 */

interface Pair {
  code: number;
  value: string;
}

interface Vertex extends Vec {
  bulge: number;
}

function tokenize(text: string): Pair[] {
  const lines = text.split(/\r\n|\r|\n/);
  const pairs: Pair[] = [];
  // DXF pairs are two physical lines: a group code then its value.
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    if (!Number.isInteger(code)) continue; // tolerate stray blank lines
    pairs.push({ code, value: lines[i + 1] });
  }
  return pairs;
}

// Bulge (= tan(includedAngle/4)) between two vertices → circular-arc segment.
function arcFromBulge(p1: Vertex, p2: Vertex): Segment {
  const dx = p2.e - p1.e;
  const dy = p2.n - p1.n;
  const chord = Math.hypot(dx, dy);
  if (!(chord > 0)) {
    throw AppError.badRequest('Polyline has a zero-length bulge segment');
  }
  const theta = 4 * Math.atan(p1.bulge); // signed included angle
  const halfSin = Math.sin(theta / 2);
  if (Math.abs(halfSin) < 1e-12) {
    return { kind: 'line', start: { e: p1.e, n: p1.n }, end: { e: p2.e, n: p2.n } };
  }
  const radius = chord / 2 / halfSin; // signed
  const apothem = radius * Math.cos(theta / 2); // signed midpoint→centre distance
  const center: Vec = {
    e: (p1.e + p2.e) / 2 - (dy / chord) * apothem,
    n: (p1.n + p2.n) / 2 + (dx / chord) * apothem,
  };
  return {
    kind: 'arc',
    start: { e: p1.e, n: p1.n },
    end: { e: p2.e, n: p2.n },
    center,
    clockwise: p1.bulge < 0, // positive bulge = counterclockwise
  };
}

function verticesToSegments(vertices: Vertex[], closed: boolean): Segment[] {
  const ordered = closed ? [...vertices, vertices[0]] : vertices;
  const segments: Segment[] = [];
  for (let i = 0; i + 1 < ordered.length; i += 1) {
    const a = ordered[i];
    const b = ordered[i + 1];
    if (Math.abs(a.bulge) < 1e-12) {
      segments.push({ kind: 'line', start: { e: a.e, n: a.n }, end: { e: b.e, n: b.n } });
    } else {
      segments.push(arcFromBulge(a, b));
    }
  }
  return segments;
}

/** Read a single entity's group codes (in order) starting after its (0, TYPE) pair. */
function collectCodes(pairs: Pair[], start: number): { codes: Pair[]; next: number } {
  const codes: Pair[] = [];
  let i = start;
  while (i < pairs.length && pairs[i].code !== 0) {
    codes.push(pairs[i]);
    i += 1;
  }
  return { codes, next: i };
}

function lineSegments(codes: Pair[]): Segment[] {
  const get = (code: number) => codes.find((p) => p.code === code)?.value;
  const start: Vec = { e: Number(get(10)), n: Number(get(20)) };
  const end: Vec = { e: Number(get(11)), n: Number(get(21)) };
  if (![start.e, start.n, end.e, end.n].every(Number.isFinite)) {
    throw AppError.badRequest('LINE has non-numeric coordinates');
  }
  return [{ kind: 'line', start, end }];
}

function arcSegments(codes: Pair[]): Segment[] {
  const get = (code: number) => codes.find((p) => p.code === code)?.value;
  const center: Vec = { e: Number(get(10)), n: Number(get(20)) };
  const radius = Number(get(40));
  const startDeg = Number(get(50));
  const endDeg = Number(get(51));
  if (![center.e, center.n, radius, startDeg, endDeg].every(Number.isFinite) || radius <= 0) {
    throw AppError.badRequest('ARC has invalid centre/radius/angles');
  }
  const a0 = (startDeg * Math.PI) / 180;
  const a1 = (endDeg * Math.PI) / 180;
  return [
    {
      kind: 'arc',
      start: { e: center.e + radius * Math.cos(a0), n: center.n + radius * Math.sin(a0) },
      end: { e: center.e + radius * Math.cos(a1), n: center.n + radius * Math.sin(a1) },
      center,
      clockwise: false, // DXF ARC angles run counterclockwise
    },
  ];
}

function lwPolylineSegments(codes: Pair[]): { segments: Segment[]; closed: boolean } {
  const vertices: Vertex[] = [];
  let flags = 0;
  for (const { code, value } of codes) {
    if (code === 70) flags = Number(value);
    else if (code === 10) vertices.push({ e: Number(value), n: NaN, bulge: 0 });
    else if (code === 20 && vertices.length > 0) vertices[vertices.length - 1].n = Number(value);
    else if (code === 42 && vertices.length > 0)
      vertices[vertices.length - 1].bulge = Number(value);
  }
  if (vertices.length < 2 || !vertices.every((v) => Number.isFinite(v.e) && Number.isFinite(v.n))) {
    throw AppError.badRequest('LWPOLYLINE has fewer than 2 valid vertices');
  }
  const closed = (flags & 1) === 1;
  return { segments: verticesToSegments(vertices, closed), closed };
}

// Old-style POLYLINE: header (0,POLYLINE) then (0,VERTEX)* then (0,SEQEND).
function polylineSegments(
  pairs: Pair[],
  headerStart: number,
): { segments: Segment[]; next: number; layer: string | null } {
  const { codes: header, next } = collectCodes(pairs, headerStart);
  const flags = Number(header.find((p) => p.code === 70)?.value ?? 0);
  const vertices: Vertex[] = [];
  let i = next;
  while (i < pairs.length && pairs[i].code === 0 && pairs[i].value === 'VERTEX') {
    const { codes, next: after } = collectCodes(pairs, i + 1);
    const get = (code: number) => codes.find((p) => p.code === code)?.value;
    vertices.push({
      e: Number(get(10)),
      n: Number(get(20)),
      bulge: Number(get(42) ?? 0),
    });
    i = after;
  }
  if (i < pairs.length && pairs[i].code === 0 && pairs[i].value === 'SEQEND') {
    const { next: afterSeqEnd } = collectCodes(pairs, i + 1);
    i = afterSeqEnd;
  }
  if (vertices.length < 2 || !vertices.every((v) => Number.isFinite(v.e) && Number.isFinite(v.n))) {
    throw AppError.badRequest('POLYLINE has fewer than 2 valid vertices');
  }
  const closed = Number.isFinite(flags) && (flags & 1) === 1;
  return { segments: verticesToSegments(vertices, closed), next: i, layer: layerOf(header) };
}

function layerOf(codes: Pair[]): string | null {
  const layer = codes.find((p) => p.code === 8)?.value?.trim();
  return layer || null;
}

interface RawCandidate {
  name: string;
  segments: Segment[];
}

const SIMPLE_ENTITY_BUILDERS: Record<string, (codes: Pair[]) => Segment[]> = {
  LINE: lineSegments,
  ARC: arcSegments,
  LWPOLYLINE: (codes) => lwPolylineSegments(codes).segments,
};

// Run a build step, pushing a warning (not throwing) on a 400-level parse error.
function tryBuild(
  fallback: string,
  run: () => RawCandidate,
  warnings: string[],
): RawCandidate | null {
  try {
    return run();
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400) {
      warnings.push(`Skipped a ${fallback}: ${err.message}`);
      return null;
    }
    throw err;
  }
}

/** Walk the ENTITIES section, turning each supported entity into a raw candidate. */
function collectEntities(pairs: Pair[]): { raw: RawCandidate[]; warnings: string[] } {
  const raw: RawCandidate[] = [];
  const warnings: string[] = [];
  let inEntities = false;
  let i = 0;

  while (i < pairs.length) {
    const pair = pairs[i];
    if (pair.code !== 0) {
      i += 1;
      continue;
    }
    if (pair.value === 'SECTION') {
      inEntities = pairs[i + 1]?.code === 2 && pairs[i + 1]?.value === 'ENTITIES';
      i += 1;
      continue;
    }
    if (pair.value === 'ENDSEC') {
      inEntities = false;
      i += 1;
      continue;
    }
    if (!inEntities) {
      i += 1;
      continue;
    }

    if (pair.value === 'POLYLINE') {
      // Spans multiple 0-markers (VERTEX/SEQEND); polylineSegments returns the
      // index past the whole run.
      try {
        const { segments, next, layer } = polylineSegments(pairs, i + 1);
        raw.push({ name: layer ?? 'Polyline', segments });
        i = next;
      } catch (err) {
        if (err instanceof AppError && err.statusCode === 400) {
          warnings.push(`Skipped a Polyline: ${err.message}`);
          i += 1;
        } else {
          throw err;
        }
      }
      continue;
    }

    const { codes, next } = collectCodes(pairs, i + 1);
    const builder = SIMPLE_ENTITY_BUILDERS[pair.value];
    if (builder) {
      const fallback = pair.value === 'LINE' ? 'Line' : pair.value === 'ARC' ? 'Arc' : 'Polyline';
      const candidate = tryBuild(
        fallback,
        () => ({ name: layerOf(codes) ?? fallback, segments: builder(codes) }),
        warnings,
      );
      if (candidate) raw.push(candidate);
    }
    i = next;
  }

  return { raw, warnings };
}

/** Densify each candidate to control points, disambiguating duplicate names. */
function finaliseAlignments(raw: RawCandidate[], warnings: string[]): ImportedAlignment[] {
  const nameCounts = new Map<string, number>();
  const alignments: ImportedAlignment[] = [];
  for (const candidate of raw) {
    try {
      const points = segmentsToControlPoints(candidate.segments, 0);
      const seen = nameCounts.get(candidate.name) ?? 0;
      nameCounts.set(candidate.name, seen + 1);
      alignments.push({
        name: seen === 0 ? candidate.name : `${candidate.name} (${seen + 1})`,
        points,
      });
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 400) {
        warnings.push(`Skipped "${candidate.name}": ${err.message}`);
      } else {
        throw err;
      }
    }
  }
  return alignments;
}

export function parseDxf(text: string): ImportResult {
  if (text.startsWith('AutoCAD Binary DXF') || text.includes('\0')) {
    throw AppError.badRequest('Binary DXF is not supported — export an ASCII DXF and try again');
  }

  const { raw, warnings } = collectEntities(tokenize(text));
  if (raw.length === 0) {
    throw AppError.badRequest(
      warnings[0] ?? 'No LINE, ARC, LWPOLYLINE or POLYLINE entities found in this DXF',
    );
  }

  const alignments = finaliseAlignments(raw, warnings);
  if (alignments.length === 0) {
    throw AppError.badRequest(warnings[0] ?? 'No importable geometry in this DXF');
  }
  return { alignments, warnings };
}
