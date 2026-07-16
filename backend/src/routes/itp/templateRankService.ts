// W2-PR3: AI ranking of a Tier-B ITP template shortlist.
//
// The deterministic matcher (itpMatcher.ts) produces the real candidate set;
// this module only asks the model to ORDER that set and give a one-line reason
// per template. It never invents templates, never edits checklist items, and
// never returns confidence numbers — order + plain-English reasons only.
//
// TRUST BOUNDARY: `cleanRankResponse` is pure and is the whole trust boundary.
// The model may only reference candidate ids that were sent; unknown ids are
// dropped, omitted candidates are appended in the matcher's deterministic order,
// and reasons/note are coerced to strings and length-capped. Callers pass the
// server-computed candidates (never client-sent) so the id whitelist is real.

import { AppError } from '../../lib/AppError.js';
import { activityDisplayName, foldActivityValue } from '../../lib/activityTaxonomy.js';
import { fetchWithTimeout } from '../../lib/fetchWithTimeout.js';
import { logWarn } from '../../lib/serverLogger.js';
import type { MatchCandidate } from '../../lib/itpMatcher.js';
import {
  AI_EXTRACTION_TIMEOUT_MS,
  extractJsonObject,
  isAnthropicConfigured,
} from '../testResults/certificateExtraction.js';

const REASON_MAX_LENGTH = 200;
const NOTE_MAX_LENGTH = 240;
const LOT_CONTEXT_MAX_LENGTH = 1000;

export interface RankTierBInput {
  projectName: string;
  specificationSet: string | null;
  activityValue: string | null | undefined;
  lotContext?: string | null;
  candidates: MatchCandidate[];
}

export interface RankResult {
  /** Candidates in the AI's ranked order (best first), whitelist-cleaned. */
  candidates: MatchCandidate[];
  /** One plain-English reason per candidate id (only for ids that were sent). */
  reasons: Record<string, string>;
  /** One-line overall note for the reviewer. */
  note: string;
}

function cappedString(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

/**
 * The trust boundary. Reorder the server-computed candidates by the model's
 * `order`, keeping only ids that were actually sent (deduped), then append any
 * candidate the model omitted in its original deterministic order. Reasons are
 * kept only for known ids and length-capped; the note is capped.
 */
export function cleanRankResponse(raw: unknown, candidates: MatchCandidate[]): RankResult {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const byId = new Map(candidates.map((c) => [c.id, c]));

  const seen = new Set<string>();
  const ordered: MatchCandidate[] = [];
  const rawOrder = Array.isArray(root.order) ? root.order : [];
  for (const entry of rawOrder) {
    if (typeof entry !== 'string') continue;
    const candidate = byId.get(entry);
    if (!candidate || seen.has(entry)) continue;
    seen.add(entry);
    ordered.push(candidate);
  }
  // Anything the model dropped rejoins in the matcher's deterministic order, so
  // the shortlist is never silently truncated by a partial AI reply.
  for (const candidate of candidates) {
    if (!seen.has(candidate.id)) ordered.push(candidate);
  }

  const reasons: Record<string, string> = {};
  const rawReasons =
    root.reasons && typeof root.reasons === 'object'
      ? (root.reasons as Record<string, unknown>)
      : {};
  for (const candidate of candidates) {
    const reason = cappedString(rawReasons[candidate.id], REASON_MAX_LENGTH);
    if (reason) reasons[candidate.id] = reason;
  }

  return { candidates: ordered, reasons, note: cappedString(root.note, NOTE_MAX_LENGTH) };
}

function activityLabel(activityValue: string | null | undefined): string {
  const fold = foldActivityValue(activityValue);
  if (fold.confidence !== 'none') return activityDisplayName(fold.slug);
  const raw = (activityValue ?? '').trim();
  return raw || 'unspecified activity';
}

function buildRankPrompt(input: RankTierBInput): string {
  const lines = input.candidates.map((c) => {
    const kind = c.baseline ? `${c.matchKind} (Austroads baseline)` : c.matchKind;
    return `- id=${c.id} | name=${c.name} | ${c.scope} | spec=${c.stateSpec ?? 'n/a'} | match=${kind} | checklist items=${c.checklistItemCount}, hold points=${c.holdPointCount}`;
  });
  const context = input.lotContext?.trim()
    ? `\nLot description / notes: ${input.lotContext.trim().slice(0, LOT_CONTEXT_MAX_LENGTH)}`
    : '';

  return `You are helping a civil construction engineer pick the right ITP (Inspection & Test Plan) template for a lot. Rank the candidate templates from best to worst match for the lot's activity.

Lot activity: ${activityLabel(input.activityValue)}
Project: ${input.projectName} (specification set: ${input.specificationSet ?? 'n/a'})${context}

Candidates (rank ALL of these; use the exact id):
${lines.join('\n')}

Return ONLY valid JSON with these exact keys:
- order: array of candidate ids, best match first. Include every id above exactly once. Use ONLY ids from the list.
- reasons: object mapping each candidate id to one short plain-English sentence saying why it ranks where it does, citing the concrete signal (the activity/sub-activity in the template name, the material or layer, the spec, or project-vs-global).
- note: one short plain-English sentence summarising the shortlist for the reviewer.

Rules:
- Only use the candidate ids listed above. Never invent a template, an id, or a checklist item.
- A project-specific (job-approved) template generally outranks a global library default for the same activity.
- Ground every reason in the signals given. Do NOT claim to have read a drawing or any file.
- Keep each reason and the note to one short sentence. Do not output confidence numbers.`;
}

/**
 * Rank a Tier-B shortlist with one Anthropic call. Throws 503 (AI_UNAVAILABLE)
 * when AI is not configured and 502 (AI_REQUEST_FAILED) on any call/parse
 * failure — the caller lets these propagate so the frontend falls back to the
 * deterministic order silently. Only ever call this for a Tier-B result.
 */
export async function rankTierBCandidates(input: RankTierBInput): Promise<RankResult> {
  if (!isAnthropicConfigured()) {
    throw new AppError(503, 'AI ranking is not configured on this server.', 'AI_UNAVAILABLE');
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
          max_tokens: 1024,
          messages: [{ role: 'user', content: [{ type: 'text', text: buildRankPrompt(input) }] }],
        }),
      },
      AI_EXTRACTION_TIMEOUT_MS,
    );
  } catch (error) {
    logWarn('AI ITP ranking request failed:', error);
    throw new AppError(502, 'AI ranking failed.', 'AI_REQUEST_FAILED');
  }

  if (!response.ok) {
    logWarn(`AI ITP ranking returned status ${response.status}`);
    throw new AppError(502, 'AI ranking failed.', 'AI_REQUEST_FAILED');
  }

  const result = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const responseText = result.content?.find((block) => block.type === 'text')?.text || '';

  try {
    return cleanRankResponse(extractJsonObject(responseText), input.candidates);
  } catch (error) {
    logWarn('AI ITP ranking returned unparseable output:', error);
    throw new AppError(502, 'AI ranking returned an unreadable result.', 'AI_REQUEST_FAILED');
  }
}
