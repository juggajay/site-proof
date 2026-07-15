import { AppError } from '../../lib/AppError.js';
import { fetchWithTimeout } from '../../lib/fetchWithTimeout.js';
import { isSupportedEpsg } from '../../lib/spatial/crs.js';
import { logWarn } from '../../lib/serverLogger.js';
import {
  AI_EXTRACTION_TIMEOUT_MS,
  extractJsonObject,
  getCertificateContentBlock,
  isAnthropicConfigured,
} from '../testResults/certificateExtraction.js';

export const PLAN_SHEETS_STAGE = 'plan_sheets';

// The AI only proposes marker positions; a registration needs at least two so
// the affine fit is solvable. Fewer usable points → the user registers manually.
const MIN_USABLE_POINTS = 2;
// A drawing has a handful of legible survey marks / grid crosses; cap the model
// so a hallucinated wall of rows can't blow up the payload.
const MAX_POINTS = 24;
const LABEL_MAX_LENGTH = 120;

// One printed coordinate the AI read off the raster: the verbatim easting/
// northing, a human label for WHERE it is, and an APPROXIMATE normalized position
// (0..1, x left→right, y top→bottom) the review UI seeds a draggable marker at.
export interface PlanSheetCandidatePoint {
  easting: number;
  northing: number;
  label: string | null;
  approxX: number | null;
  approxY: number | null;
}

export interface PlanSheetCandidate {
  /** CRS printed on the sheet, if the AI read a supported one; else null. */
  coordinateSystem: string | null;
  points: PlanSheetCandidatePoint[];
}

export interface PlanSheetExtraction {
  candidate: PlanSheetCandidate;
  warnings: string[];
}

function finiteOrNull(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Clamp a claimed normalized position into 0..1; null (drop to sheet centre in
// the UI) with a warning if it is off-sheet or unreadable — a wrong position is
// only a starting point the user drags, never a saved coordinate.
function normalizePosition(
  raw: unknown,
  axis: string,
  label: string,
  warnings: string[],
): number | null {
  const n = finiteOrNull(raw);
  if (n === null) return null;
  if (n < 0 || n > 1) {
    warnings.push(
      `Ignored an off-sheet ${axis} position for "${label}"; drag its marker into place.`,
    );
    return null;
  }
  return n;
}

function cleanLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, LABEL_MAX_LENGTH);
}

// Pure server-side validation of the model's JSON — the trust boundary that
// turns untrusted vision output into safe registration candidates. Verbatim
// easting/northing must be finite (a point without both is dropped); positions
// are best-effort. Throws 400 when fewer than two usable points survive.
export function cleanPlanSheetCandidate(raw: unknown): PlanSheetExtraction {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const warnings: string[] = [];

  if (Array.isArray(root.warnings)) {
    for (const w of root.warnings) {
      if (typeof w === 'string' && w.trim()) warnings.push(w.trim());
    }
  }

  const rawCrs = typeof root.coordinateSystem === 'string' ? root.coordinateSystem.trim() : '';
  let coordinateSystem: string | null = null;
  if (rawCrs) {
    // Sheets print the full label ("GDA2020 MGA Zone 56 (EPSG:7856)") and the
    // model often returns it verbatim — accept an embedded EPSG code, not just
    // a bare one.
    const embedded = rawCrs.match(/EPSG:\s*(\d{4,5})/i);
    const candidateCrs = isSupportedEpsg(rawCrs)
      ? rawCrs
      : embedded && isSupportedEpsg(`EPSG:${embedded[1]}`)
        ? `EPSG:${embedded[1]}`
        : null;
    if (candidateCrs) {
      coordinateSystem = candidateCrs;
    } else {
      warnings.push(
        `Could not match the printed coordinate system "${rawCrs}" — confirm the sheet's zone.`,
      );
    }
  }

  const rawPoints = Array.isArray(root.points) ? root.points.slice(0, MAX_POINTS) : [];
  const points: PlanSheetCandidatePoint[] = [];
  for (const entry of rawPoints) {
    if (!entry || typeof entry !== 'object') continue;
    const p = entry as Record<string, unknown>;
    const easting = finiteOrNull(p.easting);
    const northing = finiteOrNull(p.northing);
    const label = cleanLabel(p.label);
    if (easting === null || northing === null) {
      warnings.push(
        `Skipped "${label ?? 'a mark'}" — its printed easting/northing was unreadable.`,
      );
      continue;
    }
    points.push({
      easting,
      northing,
      label,
      approxX: normalizePosition(p.approxX, 'horizontal', label ?? 'a mark', warnings),
      approxY: normalizePosition(p.approxY, 'vertical', label ?? 'a mark', warnings),
    });
  }

  if (points.length < MIN_USABLE_POINTS) {
    throw new AppError(
      400,
      'Could not read two or more coordinate marks off this sheet. Register it manually by clicking known points.',
      'PLAN_SHEET_EXTRACTION_INSUFFICIENT',
    );
  }

  return { candidate: { coordinateSystem, points }, warnings };
}

function buildPlanSheetPrompt(): string {
  return `You are reading a civil engineering plan sheet (a raster image of a printed drawing) to help georeference it.

Find printed points whose real-world survey coordinates are legible on the sheet: coordinate grid line labels (grid crosses), corner coordinate tables in the title block, and survey/permanent marks with printed eastings and northings (MGA / map grid of Australia coordinates).

Return ONLY valid JSON with these exact keys:
- coordinateSystem: string or null. The printed coordinate system / MGA zone (e.g. "MGA94 Zone 56", "EPSG:7856") if legibly printed; otherwise null.
- points: array. For each printed coordinate you can read, an object with:
  - easting: number. The printed easting, verbatim (metres). No thousands separators.
  - northing: number. The printed northing, verbatim (metres).
  - label: string. A short description of WHERE this mark is (e.g. "grid cross near NW corner", "title-block corner table row 1", "SSM 12345 lower right").
  - approxX: number from 0 to 1. Approximate horizontal position of the mark on the sheet, 0 = left edge, 1 = right edge. Best effort.
  - approxY: number from 0 to 1. Approximate vertical position, 0 = top edge, 1 = bottom edge. Best effort.
- warnings: array of strings for anything ambiguous or unreadable.

Rules:
- Only include a point if its easting AND northing are legibly printed — do NOT invent coordinates.
- approxX/approxY are approximate; a human confirms exact positions afterwards.
- Prefer well-separated points spread across the sheet over clustered ones.`;
}

// Calls Anthropic exactly as the certificate/setout extractors do (same client,
// auth, content-block builder, model selection, long AI-extraction timeout) over
// the stored PNG raster, returning the raw parsed JSON for cleanPlanSheetCandidate.
export async function extractPlanSheetRawCandidate(png: Buffer): Promise<unknown> {
  if (!isAnthropicConfigured()) {
    throw new AppError(
      503,
      'AI reading is not configured on this server. Register the sheet manually.',
      'AI_UNAVAILABLE',
    );
  }

  // ponytail: getCertificateContentBlock only reads .buffer + .mimetype; the
  // stored sheet is always a re-encoded PNG, so a minimal shim reuses the shared
  // image content-block builder without a real multer upload.
  const contentBlock = getCertificateContentBlock({
    buffer: png,
    mimetype: 'image/png',
  } as Express.Multer.File);

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
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: [contentBlock, { type: 'text', text: buildPlanSheetPrompt() }],
            },
          ],
        }),
      },
      AI_EXTRACTION_TIMEOUT_MS,
    );
  } catch (error) {
    logWarn('AI plan-sheet extraction request failed:', error);
    throw new AppError(
      502,
      'AI reading failed. Try again or register the sheet manually.',
      'AI_REQUEST_FAILED',
    );
  }

  if (!response.ok) {
    logWarn(`AI plan-sheet extraction returned status ${response.status}`);
    throw new AppError(
      502,
      'AI reading failed. Try again or register the sheet manually.',
      'AI_REQUEST_FAILED',
    );
  }

  const result = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const responseText = result.content?.find((block) => block.type === 'text')?.text || '';

  try {
    return extractJsonObject(responseText);
  } catch (error) {
    logWarn('AI plan-sheet extraction returned unparseable output:', error);
    throw new AppError(
      502,
      'AI reading returned an unreadable result. Try again or register the sheet manually.',
      'AI_REQUEST_FAILED',
    );
  }
}
