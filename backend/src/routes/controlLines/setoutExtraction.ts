import multer from 'multer';
import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';
import { fetchWithTimeout } from '../../lib/fetchWithTimeout.js';
import { logWarn } from '../../lib/serverLogger.js';
import { isSupportedEpsg, listSupportedEpsg } from '../../lib/spatial/crs.js';
import {
  AI_EXTRACTION_TIMEOUT_MS,
  extractJsonObject,
  getCertificateContentBlock,
  isAnthropicConfigured,
} from '../testResults/certificateExtraction.js';

// Upper bound on returned points, matching the ControlLine points cap so a
// candidate can be saved as-is via POST /control-lines.
const MAX_SETOUT_POINTS = 2000;

// Mirror the certificate uploader's limits/type gate, but always keep the file
// in memory: this endpoint never persists the upload, it only streams the buffer
// to the AI, so there is no reason to touch disk (and nothing to clean up).
export const setoutUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Prefix matches errorHandler's INVALID_FILE_TYPE branch → 400 (not 500).
      cb(new Error('Invalid file type: only PDF and image files are allowed'));
    }
  },
});

export interface SetoutPoint {
  chainage: number;
  easting: number;
  northing: number;
}

// One control line's worth of points. A sheet often carries several (one table
// per street/alignment), so extraction returns a list of these plus any
// document-level warnings.
export interface SetoutAlignment {
  name: string | null;
  coordinateSystem: string | null;
  points: SetoutPoint[];
  warnings: string[];
}

export interface SetoutCandidate {
  alignments: SetoutAlignment[];
  warnings: string[];
}

// Each coordinate is coerced from the model's (string|number) output; a row that
// fails this schema is dropped into `warnings` rather than aborting the whole set.
const rawPointSchema = z.object({
  chainage: z.coerce.number().finite(),
  easting: z.coerce.number().finite(),
  northing: z.coerce.number().finite(),
});

function collectStringWarnings(raw: unknown, into: string[]): void {
  if (!Array.isArray(raw)) return;
  for (const w of raw) {
    if (typeof w === 'string' && w.trim()) into.push(w.trim());
  }
}

function normalizeEpsgGuess(raw: unknown, warnings: string[]): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed || /^(null|unknown|unsure|n\/?a)$/i.test(trimmed)) {
    return null;
  }

  const match = trimmed.match(/EPSG:?\s*(\d{4,5})/i);
  const candidate = match ? `EPSG:${match[1]}` : trimmed;

  if (isSupportedEpsg(candidate)) {
    return candidate;
  }

  warnings.push(
    `Could not map coordinate system "${trimmed}" to a supported EPSG code; select it manually.`,
  );
  return null;
}

// Pure server-side validation/cleaning of the model's JSON. No I/O, no AI — this
// is the trust boundary that turns untrusted model output into a safe candidate.
//
// The model may return either the grouped shape ({ alignments: [...] }) or the
// old flat shape ({ points: [...] }); the flat shape is wrapped as one unnamed
// alignment so a prompt/model drift never 500s. Each alignment is cleaned
// independently: bad rows drop into that alignment's warnings, and an alignment
// with <2 valid points is dropped into document warnings rather than aborting
// the whole sheet. Only a sheet with NO surviving alignment 400s.
export function cleanSetoutCandidate(raw: unknown): SetoutCandidate {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const documentWarnings: string[] = [];
  collectStringWarnings(root.warnings, documentWarnings);

  // Sheet-wide CRS; an alignment without its own CRS falls back to this.
  const documentCrs = normalizeEpsgGuess(root.coordinateSystem, documentWarnings);

  const rawAlignments: unknown[] = Array.isArray(root.alignments)
    ? root.alignments
    : [{ name: null, coordinateSystem: null, points: root.points }];

  const alignments: SetoutAlignment[] = [];
  let totalPoints = 0;

  rawAlignments.forEach((rawAlignment, index) => {
    const a =
      rawAlignment && typeof rawAlignment === 'object'
        ? (rawAlignment as Record<string, unknown>)
        : {};
    const warnings: string[] = [];
    collectStringWarnings(a.warnings, warnings);

    const name = typeof a.name === 'string' && a.name.trim() ? a.name.trim() : null;
    const label = name ?? `Alignment ${index + 1}`;
    const coordinateSystem = normalizeEpsgGuess(a.coordinateSystem, warnings) ?? documentCrs;

    const rawPoints = Array.isArray(a.points) ? a.points : [];
    const points: SetoutPoint[] = [];
    rawPoints.forEach((row, rowIndex) => {
      const parsed = rawPointSchema.safeParse(row);
      if (parsed.success) {
        points.push(parsed.data);
      } else {
        warnings.push(
          `Row ${rowIndex + 1} dropped: could not read numeric chainage/easting/northing.`,
        );
      }
    });

    if (points.length < 2) {
      documentWarnings.push(
        `${label} skipped: only ${points.length} valid point${points.length === 1 ? '' : 's'} found (needs at least 2).`,
      );
      return;
    }

    points.sort((p, q) => p.chainage - q.chainage);

    // Total point cap across ALL alignments, so a huge sheet can never blow past
    // the ControlLine points ceiling. Trim the tail once the budget is spent.
    if (totalPoints + points.length > MAX_SETOUT_POINTS) {
      const keep = MAX_SETOUT_POINTS - totalPoints;
      if (keep < 2) {
        documentWarnings.push(
          `${label} skipped: the ${MAX_SETOUT_POINTS}-point total was already reached.`,
        );
        return;
      }
      warnings.push(
        `Kept the first ${keep} of ${points.length} points; the ${MAX_SETOUT_POINTS}-point total across all alignments was exceeded.`,
      );
      points.length = keep;
    }

    totalPoints += points.length;
    alignments.push({ name, coordinateSystem, points, warnings });
  });

  if (alignments.length === 0) {
    throw new AppError(
      400,
      'Could not extract any alignment with at least 2 valid setout points. ' +
        'Check that the uploaded sheet shows a coordinate table, or enter the points manually.',
      'SETOUT_EXTRACTION_INSUFFICIENT',
      { alignments: 0 },
    );
  }

  return { alignments, warnings: documentWarnings };
}

function buildSetoutPrompt(): string {
  return `You are reading a civil engineering "Geometric Setout Details" / control-line coordinate sheet.

A single sheet often contains setout tables for SEVERAL different alignments (one
per street, road, or control line). Group the coordinate rows by the alignment
they belong to — do not merge separate streets into one list.

Extract into JSON. Return ONLY valid JSON with these exact keys:
- coordinateSystem: string or null. The projected coordinate system for the WHOLE sheet, from the title block or notes, mapped to one of these EPSG codes: ${listSupportedEpsg().join(', ')}. Use the EPSG code string (e.g. "EPSG:7856"). GDA2020 MGA zone NN maps to EPSG:78(49-56), GDA94 MGA zone NN maps to EPSG:283(49-56). Return null if you cannot determine it.
- alignments: array of alignment objects. Each object has:
    - name: the printed alignment / street / control-line name if one is visible (e.g. "MC01", "Weinam Creek Rd"), otherwise null.
    - coordinateSystem: EPSG string for THIS alignment only if it differs from the sheet-wide one above; otherwise null.
    - points: array of { "chainage": number, "easting": number, "northing": number }, one row per coordinate in this alignment's table, in table order.
    - warnings: array of strings for anything ambiguous or unreadable in this alignment.
- warnings: array of strings for document-level issues.

How to group into alignments:
- Each labelled table / street heading is its own alignment.
- A chainage that RESETS to ~0 partway down the sheet is a strong signal that a new alignment begins — start a new alignment object there.
- If the sheet has a single table, return exactly one alignment.

Rules:
- Numbers only for chainage/easting/northing — no units, no commas, no "CH" prefix.
- Do NOT invent rows, alignments, or coordinates that are not printed on the sheet.
- If a value is unreadable, omit that row and note it in that alignment's warnings.`;
}

// Calls Anthropic exactly as the certificate extractor does (same client, auth,
// content-block builder, model selection) and returns the raw parsed JSON for
// cleanSetoutCandidate to validate. Throws (rather than the cert path's silent
// filename fallback) because a setout sheet has no useful filename heuristic.
export async function extractSetoutRawCandidate(file: Express.Multer.File): Promise<unknown> {
  if (!isAnthropicConfigured()) {
    throw new AppError(
      503,
      'AI setout extraction is not configured on this server. Enter the control points manually.',
      'AI_UNAVAILABLE',
    );
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
          // A dense setout sheet can run hundreds of rows (~18 output tokens
          // each); 4096 truncated the JSON mid-array on real sheets.
          max_tokens: 16384,
          messages: [
            {
              role: 'user',
              content: [
                getCertificateContentBlock(file),
                { type: 'text', text: buildSetoutPrompt() },
              ],
            },
          ],
        }),
      },
      AI_EXTRACTION_TIMEOUT_MS,
    );
  } catch (error) {
    logWarn('AI setout extraction request failed:', error);
    throw new AppError(
      502,
      'AI setout extraction failed. Try again or enter points manually.',
      'AI_REQUEST_FAILED',
    );
  }

  if (!response.ok) {
    logWarn(`AI setout extraction returned status ${response.status}`);
    throw new AppError(
      502,
      'AI setout extraction failed. Try again or enter points manually.',
      'AI_REQUEST_FAILED',
    );
  }

  const result = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const responseText = result.content?.find((block) => block.type === 'text')?.text || '';

  try {
    return extractJsonObject(responseText);
  } catch (error) {
    logWarn('AI setout extraction returned unparseable output:', error);
    throw new AppError(
      502,
      'AI setout extraction returned an unreadable result. Try again or enter points manually.',
      'AI_REQUEST_FAILED',
    );
  }
}
