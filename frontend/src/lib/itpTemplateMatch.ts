import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';
import { queryKeys } from './queryKeys';

// Mirror of the backend MatchResult (backend/src/lib/itpMatcher.ts). Deterministic
// W2-PR2 shape — no AI ranking or confidence numbers.
export type MatchTier = 'A' | 'B' | 'C';
export type ActivityMatchKind = 'exact' | 'family' | 'unclassified';

export interface MatchCandidate {
  id: string;
  name: string;
  scope: 'project' | 'global';
  stateSpec: string | null;
  matchKind: ActivityMatchKind;
  /** True for an Austroads national-baseline template offered as a gap-fill. */
  baseline?: boolean;
  checklistItemCount: number;
  holdPointCount: number;
}

export interface TemplateMatchResult {
  tier: MatchTier;
  /** Set only for Tier A (the single exact-slug match). */
  suggestedTemplateId: string | null;
  candidates: MatchCandidate[];
}

/**
 * Deterministic suggested-templates for a lot activity, scoped to the project.
 * Disabled until both projectId and activity are known.
 */
export function useTemplateMatch(projectId: string, activity: string | null | undefined) {
  const cleanedActivity = activity?.trim() ?? '';
  return useQuery({
    queryKey: queryKeys.itpTemplateMatch(projectId, cleanedActivity),
    queryFn: () =>
      apiFetch<TemplateMatchResult>(
        `/api/itp/templates/match?projectId=${encodeURIComponent(projectId)}&activity=${encodeURIComponent(cleanedActivity)}`,
      ),
    enabled: Boolean(projectId && cleanedActivity),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * A Tier-B match after AI ranking: the candidates are in the AI's order and a
 * `ranking` block carries the per-candidate reasons + overall note. Shape-
 * compatible with TemplateMatchResult so splitSuggestedTemplates works on it.
 */
export interface TemplateRankResult extends TemplateMatchResult {
  ranking?: { reasons: Record<string, string>; note: string };
}

/**
 * AI ranking of a Tier-B shortlist. Only enabled once the deterministic match
 * is Tier B AND AI is available (reuse useAiStatus) — Tier A/C never rank. On
 * any error/503 the query fails and the caller keeps the deterministic order,
 * so there is no error UI. `retry: false` keeps a failed AI call from hammering.
 */
export function useTemplateRank(
  projectId: string,
  activity: string | null | undefined,
  tier: MatchTier | undefined,
  aiConfigured: boolean,
  lotContext?: string,
) {
  const cleanedActivity = activity?.trim() ?? '';
  return useQuery({
    queryKey: queryKeys.itpTemplateRank(projectId, cleanedActivity),
    queryFn: () =>
      apiFetch<TemplateRankResult>('/api/itp/templates/rank', {
        method: 'POST',
        body: JSON.stringify({ projectId, activity: cleanedActivity, lotContext }),
      }),
    enabled: Boolean(projectId && cleanedActivity && tier === 'B' && aiConfigured),
    staleTime: 5 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    retry: false,
  });
}

/**
 * Effective match to render: prefer the AI-ranked result (Tier B, with reasons)
 * when it loaded; otherwise fall back to the deterministic match with no reasons.
 * This is the quiet-fallback boundary the surfaces lean on.
 */
export function resolveRankedMatch(
  match: TemplateMatchResult | undefined,
  rank: TemplateRankResult | undefined,
): {
  match: TemplateMatchResult | undefined;
  reasons: Record<string, string>;
  note: string | null;
} {
  if (rank && rank.tier === 'B') {
    return { match: rank, reasons: rank.ranking?.reasons ?? {}, note: rank.ranking?.note ?? null };
  }
  return { match, reasons: {}, note: null };
}

export interface SuggestedGrouping<T> {
  /** Candidate templates in the matcher's deterministic order. */
  suggested: T[];
  /** Everything else, original order preserved. */
  rest: T[];
}

/**
 * Split an already-fetched template option list into a "suggested" group (the
 * matcher's candidates, in order) and the rest. Tier C or no match → nothing
 * suggested, full list unchanged.
 */
export function splitSuggestedTemplates<T extends { id: string }>(
  options: T[],
  match: TemplateMatchResult | undefined,
): SuggestedGrouping<T> {
  if (!match || match.candidates.length === 0) {
    return { suggested: [], rest: options };
  }
  const order = new Map(match.candidates.map((c, i) => [c.id, i]));
  const suggested = options
    .filter((o) => order.has(o.id))
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  const rest = options.filter((o) => !order.has(o.id));
  return { suggested, rest };
}
