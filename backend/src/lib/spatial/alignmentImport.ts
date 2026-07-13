import { AppError } from '../AppError.js';
import type { ControlPoint } from './controlLineGeometry.js';

/**
 * Shared geometry for importing survey alignments (control lines) from CAD/survey
 * exchange files (LandXML, DXF). The file parsers turn their native geometry into
 * an ordered list of {@link Segment}s (straight lines and circular arcs); this
 * module walks those segments into densified {@link ControlPoint}s with running
 * chainage, matching what the manual control-line editor produces.
 *
 * Curves are cut into chords with a bounded mid-ordinate (sagitta) deviation, so
 * the downstream footprint generator — which walks interior vertices — follows
 * the curve. Chainage is accumulated from true segment length (arc length for
 * curves), not chord length, so it stays correct regardless of densification.
 */

/** Local grid coordinate (metres) in the alignment's MGA zone. */
export interface Vec {
  e: number;
  n: number;
}

export type Segment =
  | { kind: 'line'; start: Vec; end: Vec }
  | { kind: 'arc'; start: Vec; end: Vec; center: Vec; clockwise: boolean };

export interface ImportedAlignment {
  name: string;
  points: ControlPoint[];
}

export interface ImportResult {
  alignments: ImportedAlignment[];
  /** Per-alignment rejections and other non-fatal notes, surfaced in the UI. */
  warnings: string[];
}

// Max chord mid-ordinate (sagitta) deviation when densifying arcs, metres. 2 m
// keeps generated lot footprints visually on the curve at survey scale.
const MAX_MID_ORDINATE_M = 2;

// Matches the ControlLine points cap (createControlLineSchema / setout import).
// An alignment that densifies past this is rejected, not silently truncated —
// dropping interior vertices would distort the geometry.
export const MAX_IMPORT_POINTS = 2000;

// Chainage must strictly increase (the control-line validator rejects duplicate
// chainages); vertices closer than this along-line are treated as coincident.
const MIN_CHAINAGE_STEP_M = 1e-6;

function dist(a: Vec, b: Vec): number {
  return Math.hypot(b.e - a.e, b.n - a.n);
}

/**
 * Points along an arc from `start` to `end` about `center`, EXCLUDING the start
 * vertex (the caller has already emitted it) and INCLUDING the end vertex. Each
 * returned point carries the arc length from `start`, so chainage stays true.
 */
function densifyArc(seg: Extract<Segment, { kind: 'arc' }>): { point: Vec; along: number }[] {
  const { center, start, end, clockwise } = seg;
  const radius = dist(center, start);
  if (!(radius > 0)) {
    throw AppError.badRequest('Arc has zero radius (start equals centre)');
  }

  const startAngle = Math.atan2(start.n - center.n, start.e - center.e);
  const endAngle = Math.atan2(end.n - center.n, end.e - center.e);

  // Sweep magnitude in (0, 2π]. LandXML gives direction (rot); DXF bulge sign
  // and arc angles are normalised to a direction by the caller.
  let sweep = clockwise ? startAngle - endAngle : endAngle - startAngle;
  const TWO_PI = Math.PI * 2;
  sweep = ((sweep % TWO_PI) + TWO_PI) % TWO_PI;
  if (sweep < MIN_CHAINAGE_STEP_M) {
    // start≈end going forward → treat as a full circle would be ambiguous; a
    // real alignment arc never closes on itself, so this is a degenerate/bad arc.
    throw AppError.badRequest('Arc start and end coincide');
  }

  // Chord subtends angle θ where sagitta = R(1 - cos(θ/2)) ≤ tol.
  const ratio = 1 - MAX_MID_ORDINATE_M / radius;
  const thetaMax = ratio <= -1 ? Math.PI : 2 * Math.acos(Math.max(-1, ratio));
  const steps = Math.max(1, Math.ceil(sweep / thetaMax));

  const sign = clockwise ? -1 : 1;
  const arcPerStep = (radius * sweep) / steps;
  const out: { point: Vec; along: number }[] = [];
  for (let i = 1; i <= steps; i += 1) {
    const angle = startAngle + sign * (sweep * (i / steps));
    out.push({
      point: { e: center.e + radius * Math.cos(angle), n: center.n + radius * Math.sin(angle) },
      along: arcPerStep * i,
    });
  }
  return out;
}

/**
 * Ordered segments → control points with running chainage from `staStart`.
 * Segments must connect head-to-tail (each segment's start ≈ the previous end).
 */
export function segmentsToControlPoints(segments: Segment[], staStart: number): ControlPoint[] {
  if (segments.length === 0) {
    throw AppError.badRequest('Alignment has no geometry');
  }

  const points: ControlPoint[] = [];
  let chainage = staStart;
  const first = segments[0].start;
  points.push({ chainage, easting: first.e, northing: first.n });

  const pushVertex = (v: Vec, along: number) => {
    const next = chainage + along;
    if (next - chainage < MIN_CHAINAGE_STEP_M) return; // skip zero-length step
    chainage = next;
    points.push({ chainage, easting: v.e, northing: v.n });
  };

  for (const seg of segments) {
    if (seg.kind === 'line') {
      pushVertex(seg.end, dist(seg.start, seg.end));
    } else {
      let prevAlong = 0;
      for (const { point, along } of densifyArc(seg)) {
        pushVertex(point, along - prevAlong);
        prevAlong = along;
      }
    }
  }

  if (points.length < 2) {
    throw AppError.badRequest('Alignment collapsed to a single point');
  }
  if (points.length > MAX_IMPORT_POINTS) {
    throw AppError.badRequest(
      `Alignment densified to ${points.length} points (max ${MAX_IMPORT_POINTS}); ` +
        'simplify the alignment or split it into shorter runs',
    );
  }
  return points;
}

export interface AlignmentSummary {
  name: string;
  points: ControlPoint[];
  pointCount: number;
  chainageStart: number;
  chainageEnd: number;
  lengthM: number;
  bbox: { minE: number; minN: number; maxE: number; maxN: number };
}

/** Preview summary for one importable alignment (points included for the create call). */
export function summariseAlignment(alignment: ImportedAlignment): AlignmentSummary {
  const { points } = alignment;
  let minE = Infinity;
  let minN = Infinity;
  let maxE = -Infinity;
  let maxN = -Infinity;
  for (const p of points) {
    if (p.easting < minE) minE = p.easting;
    if (p.easting > maxE) maxE = p.easting;
    if (p.northing < minN) minN = p.northing;
    if (p.northing > maxN) maxN = p.northing;
  }
  const chainageStart = points[0].chainage;
  const chainageEnd = points[points.length - 1].chainage;
  return {
    name: alignment.name,
    points,
    pointCount: points.length,
    chainageStart,
    chainageEnd,
    lengthM: chainageEnd - chainageStart,
    bbox: { minE, minN, maxE, maxN },
  };
}
