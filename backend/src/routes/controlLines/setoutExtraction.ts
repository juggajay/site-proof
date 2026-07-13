import multer from 'multer';
import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';
import { fetchWithTimeout } from '../../lib/fetchWithTimeout.js';
import { logWarn } from '../../lib/serverLogger.js';
import { isSupportedEpsg, listSupportedEpsg } from '../../lib/spatial/crs.js';
import {
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

export interface SetoutCandidate {
  coordinateSystem: string | null;
  points: SetoutPoint[];
  warnings: string[];
}

// Each coordinate is coerced from the model's (string|number) output; a row that
// fails this schema is dropped into `warnings` rather than aborting the whole set.
const rawPointSchema = z.object({
  chainage: z.coerce.number().finite(),
  easting: z.coerce.number().finite(),
  northing: z.coerce.number().finite(),
});

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
export function cleanSetoutCandidate(raw: unknown): SetoutCandidate {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const warnings: string[] = [];

  if (Array.isArray(root.warnings)) {
    for (const w of root.warnings) {
      if (typeof w === 'string' && w.trim()) warnings.push(w.trim());
    }
  }

  const coordinateSystem = normalizeEpsgGuess(root.coordinateSystem, warnings);

  const rawPoints = Array.isArray(root.points) ? root.points : [];
  const points: SetoutPoint[] = [];
  rawPoints.forEach((row, index) => {
    const parsed = rawPointSchema.safeParse(row);
    if (parsed.success) {
      points.push(parsed.data);
    } else {
      warnings.push(`Row ${index + 1} dropped: could not read numeric chainage/easting/northing.`);
    }
  });

  if (points.length < 2) {
    throw new AppError(
      400,
      `Could not extract at least 2 valid setout points (found ${points.length}). ` +
        'Check that the uploaded sheet shows a coordinate table, or enter the points manually.',
      'SETOUT_EXTRACTION_INSUFFICIENT',
      { found: points.length },
    );
  }

  points.sort((a, b) => a.chainage - b.chainage);

  if (points.length > MAX_SETOUT_POINTS) {
    warnings.push(
      `Extraction returned ${points.length} points; kept the first ${MAX_SETOUT_POINTS} by chainage.`,
    );
    points.length = MAX_SETOUT_POINTS;
  }

  return { coordinateSystem, points, warnings };
}

function buildSetoutPrompt(): string {
  return `You are reading a civil engineering "Geometric Setout Details" / control-line coordinate sheet.

Extract the survey control table into JSON. Return ONLY valid JSON with these exact keys:
- coordinateSystem: string or null. The projected coordinate system from the title block or notes, mapped to one of these EPSG codes: ${listSupportedEpsg().join(', ')}. Use the EPSG code string (e.g. "EPSG:7856"). GDA2020 MGA zone NN maps to EPSG:78(49-56), GDA94 MGA zone NN maps to EPSG:283(49-56). Return null if you cannot determine it.
- points: array of objects, each { "chainage": number, "easting": number, "northing": number }. One row per coordinate in the table, in table order.
- warnings: array of strings for anything ambiguous or unreadable.

Rules:
- Numbers only for chainage/easting/northing — no units, no commas, no "CH" prefix.
- Do NOT invent rows or coordinates that are not printed on the sheet.
- If a value is unreadable, omit that row and note it in warnings.`;
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
    response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
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
    });
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
