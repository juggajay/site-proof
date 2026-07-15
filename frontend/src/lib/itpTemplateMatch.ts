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
