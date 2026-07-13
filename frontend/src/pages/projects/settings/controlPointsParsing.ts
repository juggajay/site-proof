import { z } from 'zod';

/**
 * Parsing + validation for control-line points.
 *
 * Points are entered either row-by-row in the editable table or pasted in bulk
 * from Excel/CSV. Paste input tolerates a header row, blank lines, and either
 * comma- or tab-separated columns, in the order: chainage, easting, northing.
 */

export interface ControlPoint {
  chainage: number;
  easting: number;
  northing: number;
}

export interface ParsedPointRow {
  /** 1-based source line number in the pasted text (for error display). */
  line: number;
  raw: string;
  chainage: number | null;
  easting: number | null;
  northing: number | null;
  error: string | null;
}

export interface ParsedPointsResult {
  rows: ParsedPointRow[];
  /** Only the rows that parsed cleanly, as usable points. */
  points: ControlPoint[];
  /** True when every non-skipped row parsed without error. */
  ok: boolean;
}

const HEADER_TOKENS = new Set(['chainage', 'ch', 'easting', 'e', 'northing', 'n', 'x', 'y']);

function splitCells(line: string): string[] {
  // Tabs win when present (Excel copy); otherwise commas. Fall back to
  // whitespace runs so "100 500000 6250000" from a plain text list also parses.
  if (line.includes('\t')) return line.split('\t');
  if (line.includes(',')) return line.split(',');
  return line.trim().split(/\s+/);
}

function looksLikeHeader(cells: string[]): boolean {
  return cells.some((cell) => HEADER_TOKENS.has(cell.trim().toLowerCase()));
}

function parseNumber(cell: string | undefined): number | null {
  if (cell == null) return null;
  const trimmed = cell.trim().replace(/,/g, '');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function buildRow(line: number, raw: string, cells: string[]): ParsedPointRow {
  const chainage = parseNumber(cells[0]);
  const easting = parseNumber(cells[1]);
  const northing = parseNumber(cells[2]);

  let error: string | null = null;
  if (cells.filter((c) => c.trim() !== '').length < 3) {
    error = 'Needs 3 values: chainage, easting, northing';
  } else {
    const bad: string[] = [];
    if (chainage === null) bad.push('chainage');
    if (easting === null) bad.push('easting');
    if (northing === null) bad.push('northing');
    if (bad.length > 0) error = `Not a number: ${bad.join(', ')}`;
  }

  return { line, raw, chainage, easting, northing, error };
}

/**
 * Parse pasted CSV/TSV text into control-point rows. Blank lines and a leading
 * header row are skipped; every remaining line becomes a row with per-field
 * values or an error explaining what could not be parsed.
 */
export function parsePastedControlPoints(text: string): ParsedPointsResult {
  const rows: ParsedPointRow[] = [];
  let headerSkipped = false;

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const raw = rawLine.trim();
    if (raw === '') return; // skip blank lines entirely

    const cells = splitCells(rawLine);
    if (!headerSkipped && looksLikeHeader(cells)) {
      headerSkipped = true; // only the first header-looking line is a header
      return;
    }
    headerSkipped = true;

    rows.push(buildRow(index + 1, raw, cells));
  });

  const points: ControlPoint[] = rows
    .filter((r) => r.error === null)
    .map((r) => ({ chainage: r.chainage!, easting: r.easting!, northing: r.northing! }));

  return { rows, points, ok: rows.length > 0 && rows.every((r) => r.error === null) };
}

/**
 * Largest chainage gap (m) between consecutive points that we treat as "dense
 * enough" for lot generation to follow a curve. Beyond this, chainage+offset lots
 * chord-cut across bends (CivilPro documents the same failure mode), so the form
 * nudges the user to add intermediate points.
 */
export const SPARSE_CHAINAGE_GAP_M = 75;

/**
 * True when any consecutive pair of points (ordered by chainage) is more than
 * `maxGapM` apart. The generator follows the polyline through interior vertices,
 * so point density — not point count — is what keeps curved lots on-shape.
 */
export function hasSparseChainageGap(
  points: { chainage: number }[],
  maxGapM = SPARSE_CHAINAGE_GAP_M,
): boolean {
  const chainages = points
    .map((p) => p.chainage)
    .filter((c) => Number.isFinite(c))
    .sort((a, b) => a - b);
  for (let i = 1; i < chainages.length; i += 1) {
    if (chainages[i] - chainages[i - 1] > maxGapM) return true;
  }
  return false;
}

/**
 * Interpolate a grid position (easting/northing) at a chainage along a control
 * line, optionally offset perpendicular to the line. Mirrors the backend
 * `positionAtChainage` (linear between the two bracketing vertices). Offset is
 * signed metres with the same convention as the lot generator: positive = LEFT
 * of increasing chainage (tangent rotated +90°: (-ty, tx)).
 *
 * Returns null when there are fewer than 2 points or the chainage is outside the
 * line's range, so callers can surface a clear "out of range" message.
 */
interface GridPosition {
  easting: number;
  northing: number;
}

// Shift a centreline position perpendicular to the tangent (dx, dy). Positive
// offset = LEFT of increasing chainage (tangent rotated +90°: (-ty, tx)).
function applyOffset(centre: GridPosition, dx: number, dy: number, offset: number): GridPosition {
  const len = Math.hypot(dx, dy);
  if (offset === 0 || len === 0) return centre;
  const tx = dx / len;
  const ty = dy / len;
  return { easting: centre.easting - ty * offset, northing: centre.northing + tx * offset };
}

export function positionFromChainage(
  points: ControlPoint[],
  chainage: number,
  offset = 0,
): GridPosition | null {
  if (points.length < 2 || !Number.isFinite(chainage)) return null;
  const sorted = [...points].sort((a, b) => a.chainage - b.chainage);
  if (chainage < sorted[0].chainage || chainage > sorted[sorted.length - 1].chainage) return null;

  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (chainage < a.chainage || chainage > b.chainage) continue;
    const span = b.chainage - a.chainage;
    const t = span === 0 ? 0 : (chainage - a.chainage) / span;
    const centre: GridPosition = {
      easting: a.easting + t * (b.easting - a.easting),
      northing: a.northing + t * (b.northing - a.northing),
    };
    return applyOffset(centre, b.easting - a.easting, b.northing - a.northing, offset);
  }
  return null;
}

const finiteNumber = z.number().finite();

export const controlPointSchema = z.object({
  chainage: finiteNumber,
  easting: finiteNumber,
  northing: finiteNumber,
});

// Mirrors the backend `createControlLineSchema`: ≥2 points, ≤2000, finite.
export const controlLineFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  coordinateSystem: z.string().trim().min(1, 'Coordinate system is required').max(50),
  points: z.array(controlPointSchema).min(2, 'At least 2 points are required').max(2000),
});

export type ControlLineFormValues = z.infer<typeof controlLineFormSchema>;
