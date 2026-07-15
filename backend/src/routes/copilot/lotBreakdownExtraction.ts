import multer from 'multer';

import { AppError } from '../../lib/AppError.js';
import { fetchWithTimeout } from '../../lib/fetchWithTimeout.js';
import { logWarn } from '../../lib/serverLogger.js';
import {
  AI_EXTRACTION_TIMEOUT_MS,
  extractJsonObject,
  getCertificateContentBlock,
  isAnthropicConfigured,
} from '../testResults/certificateExtraction.js';
import type { ControlPoint } from '../../lib/spatial/controlLineGeometry.js';

// The bulk wizard's activity vocabulary (frontend bulkCreateLots.ts). Kept in
// sync here so the AI's free-text activity names can be mapped onto the same set
// the review UI's BulkActivityRows offers.
export const ACTIVITY_TYPES = [
  'Earthworks',
  'Pavement',
  'Drainage',
  'Concrete',
  'Structures',
  'Rail',
] as const;

const MAX_TOTAL_LOTS = 500;
const DEFAULT_INTERVAL_M = 100;
const DEFAULT_OFFSET_M = 5;
const MAX_ACTIVITIES = 20;

// Obvious synonyms → canonical activity. Anything unmatched is kept verbatim
// (with a warning) so a niche activity name printed on the sheet is not silently
// dropped.
const ACTIVITY_SYNONYMS: Record<string, (typeof ACTIVITY_TYPES)[number]> = {
  earthwork: 'Earthworks',
  earthworks: 'Earthworks',
  bulkearthworks: 'Earthworks',
  cutfill: 'Earthworks',
  subgrade: 'Earthworks',
  pavement: 'Pavement',
  paving: 'Pavement',
  asphalt: 'Pavement',
  seal: 'Pavement',
  basecourse: 'Pavement',
  drainage: 'Drainage',
  stormwater: 'Drainage',
  culvert: 'Drainage',
  pipework: 'Drainage',
  concrete: 'Concrete',
  kerb: 'Concrete',
  'kerb&channel': 'Concrete',
  footpath: 'Concrete',
  structure: 'Structures',
  structures: 'Structures',
  bridge: 'Structures',
  retainingwall: 'Structures',
  rail: 'Rail',
  track: 'Rail',
};

export const lotBreakdownUpload = multer({
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

export interface LotBreakdownActivity {
  activityType: string;
  /** ITP template is chosen by the human in review (Wave 2 automates it). */
  itpTemplateId?: string | null;
}

// The reviewed thin-lot breakdown candidate: chainage extent × interval ×
// activities, applied through the shared bulk lot generator.
export interface LotBreakdownCandidate {
  controlLineId: string;
  startChainage: number;
  endChainage: number;
  interval: number;
  lotPrefix: string;
  activities: LotBreakdownActivity[];
  offsetLeft: number;
  offsetRight: number;
}

export interface LotBreakdownExtraction {
  candidate: LotBreakdownCandidate;
  warnings: string[];
}

/** Chainage extent of a control line's ordered points, or null when unusable. */
export function controlLineExtent(points: ControlPoint[] | undefined): {
  min: number;
  max: number;
} | null {
  if (!points || points.length < 2) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.chainage)) return null;
    if (p.chainage < min) min = p.chainage;
    if (p.chainage > max) max = p.chainage;
  }
  return min < max ? { min, max } : null;
}

// A lot prefix from the project number (falling back to the control-line name):
// alphanumeric-and-dash, upper-cased, so generated lot numbers look hand-made.
export function deriveLotPrefix(projectNumber: string | null, controlLineName: string): string {
  const source = (projectNumber && projectNumber.trim()) || controlLineName || 'LOT';
  const cleaned = source
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20);
  return cleaned || 'LOT';
}

// Smallest interval ≥ `interval` that keeps intervalCount × activityCount within
// the 500-lot cap, so a candidate is never born already over the limit.
export function capInterval(extentLength: number, interval: number, activityCount: number): number {
  const maxIntervals = Math.max(1, Math.floor(MAX_TOTAL_LOTS / Math.max(1, activityCount)));
  const minInterval = extentLength / maxIntervals;
  return interval >= minInterval ? interval : Math.ceil(minInterval);
}

function mapActivityName(raw: string, warnings: string[]): string {
  const key = raw.toLowerCase().replace(/[^a-z0-9&]/g, '');
  const mapped = ACTIVITY_SYNONYMS[key];
  if (mapped) return mapped;
  const exact = ACTIVITY_TYPES.find((t) => t.toLowerCase() === raw.trim().toLowerCase());
  if (exact) return exact;
  warnings.push(`Kept "${raw.trim()}" as a custom activity — set its ITP template in review.`);
  return raw.trim().slice(0, 100);
}

function normalizeInterval(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return null;
}

// Map the model's free-text activity names onto the canonical vocabulary,
// deduped and capped. Empty → a single Earthworks default (with a warning).
function normalizeActivities(raw: unknown, warnings: string[]): LotBreakdownActivity[] {
  const rawActivities = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const activities: LotBreakdownActivity[] = [];
  for (const item of rawActivities) {
    const name = typeof item === 'string' ? item : null;
    if (!name || !name.trim()) continue;
    const activityType = mapActivityName(name, warnings);
    if (seen.has(activityType)) continue;
    seen.add(activityType);
    activities.push({ activityType });
    if (activities.length >= MAX_ACTIVITIES) break;
  }
  if (activities.length === 0) {
    activities.push({ activityType: 'Earthworks' });
    warnings.push('No activities could be read from the sheet — add them in review.');
  }
  return activities;
}

// Pure server-side validation of the model's JSON into a safe candidate. The
// control-line extent, prefix and offsets are supplied by the caller (server
// facts, never the model); the model only informs the activity list and interval.
export function cleanLotBreakdownCandidate(
  raw: unknown,
  base: {
    controlLineId: string;
    startChainage: number;
    endChainage: number;
    lotPrefix: string;
  },
): LotBreakdownExtraction {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const warnings: string[] = [];
  if (Array.isArray(root.warnings)) {
    for (const w of root.warnings) {
      if (typeof w === 'string' && w.trim()) warnings.push(w.trim());
    }
  }

  const activities = normalizeActivities(root.activities, warnings);

  const extentLength = base.endChainage - base.startChainage;
  const requested = normalizeInterval(root.interval) ?? DEFAULT_INTERVAL_M;
  const interval = capInterval(extentLength, requested, activities.length);
  if (interval !== requested) {
    warnings.push(
      `Interval raised to ${interval} m so the breakdown stays within ${MAX_TOTAL_LOTS} lots.`,
    );
  }

  return {
    candidate: {
      controlLineId: base.controlLineId,
      startChainage: base.startChainage,
      endChainage: base.endChainage,
      interval,
      lotPrefix: base.lotPrefix,
      activities,
      offsetLeft: DEFAULT_OFFSET_M,
      offsetRight: DEFAULT_OFFSET_M,
    },
    warnings,
  };
}

// The deterministic (no-file) candidate: the control line's full extent, one
// Earthworks activity, a 100 m interval capped to the 500-lot ceiling. Works
// with AI unconfigured — the user fleshes out activities in review.
export function buildDeterministicCandidate(base: {
  controlLineId: string;
  startChainage: number;
  endChainage: number;
  lotPrefix: string;
}): LotBreakdownExtraction {
  const extentLength = base.endChainage - base.startChainage;
  const interval = capInterval(extentLength, DEFAULT_INTERVAL_M, 1);
  const warnings = ['Derived from the control line only — add activities in review.'];
  if (interval !== DEFAULT_INTERVAL_M) {
    warnings.push(
      `Interval raised to ${interval} m so the breakdown stays within ${MAX_TOTAL_LOTS} lots.`,
    );
  }
  return {
    candidate: {
      controlLineId: base.controlLineId,
      startChainage: base.startChainage,
      endChainage: base.endChainage,
      interval,
      lotPrefix: base.lotPrefix,
      activities: [{ activityType: 'Earthworks' }],
      offsetLeft: DEFAULT_OFFSET_M,
      offsetRight: DEFAULT_OFFSET_M,
    },
    warnings,
  };
}

function buildLotBreakdownPrompt(): string {
  return `You are reading a civil engineering sheet (typical cross-sections, a pavement schedule, or a cover sheet) to work out which construction ACTIVITIES a road/rail corridor is built from.

Return ONLY valid JSON with these exact keys:
- activities: array of strings, the distinct construction activities present, in build order. Prefer these names where they fit: ${ACTIVITY_TYPES.join(', ')}. Keep a printed activity name verbatim if none of those fit.
- interval: number or null. A sensible lot length in metres if one is printed or implied (e.g. a typical bay/pour length); otherwise null.
- warnings: array of strings for anything ambiguous.

Rules:
- Do NOT invent activities that are not indicated on the sheet.
- Return an empty activities array if you cannot tell — do not guess.`;
}

// Calls Anthropic exactly as the sibling extractors do (same client, auth,
// content-block builder, model selection, long AI-extraction timeout) and
// returns the raw parsed JSON for cleanLotBreakdownCandidate to validate.
export async function extractLotBreakdownRawCandidate(file: Express.Multer.File): Promise<unknown> {
  if (!isAnthropicConfigured()) {
    throw new AppError(
      503,
      'AI reading is not configured on this server. Break the alignment into lots manually.',
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
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: [
                getCertificateContentBlock(file),
                { type: 'text', text: buildLotBreakdownPrompt() },
              ],
            },
          ],
        }),
      },
      AI_EXTRACTION_TIMEOUT_MS,
    );
  } catch (error) {
    logWarn('AI lot-breakdown extraction request failed:', error);
    throw new AppError(
      502,
      'AI reading failed. Try again or break the alignment into lots manually.',
      'AI_REQUEST_FAILED',
    );
  }

  if (!response.ok) {
    logWarn(`AI lot-breakdown extraction returned status ${response.status}`);
    throw new AppError(
      502,
      'AI reading failed. Try again or break the alignment into lots manually.',
      'AI_REQUEST_FAILED',
    );
  }

  const result = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const responseText = result.content?.find((block) => block.type === 'text')?.text || '';

  try {
    return extractJsonObject(responseText);
  } catch (error) {
    logWarn('AI lot-breakdown extraction returned unparseable output:', error);
    throw new AppError(
      502,
      'AI reading returned an unreadable result. Try again or break the alignment into lots manually.',
      'AI_REQUEST_FAILED',
    );
  }
}
