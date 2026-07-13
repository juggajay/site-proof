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
