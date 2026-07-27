// Wave C1.1 — the pure half of the `Lot.activitySlug` backfill (spec §6).
//
// Lives under `src/` rather than beside the script because vitest globs
// `src/**/*.test.ts` only, and the fold rule is the one part of the backfill
// that can be silently wrong: a wrong slug changes frequency-stream membership
// (§16 D7) without any error.

import { activitySlugForWrite, foldActivityValue } from './activityTaxonomy.js';

export interface ActivitySlugCandidate {
  id: string;
  activityType: string;
  activitySlug: string | null;
}

/**
 * The batch's write plan: only the rows whose stored slug DISAGREES with the
 * fold, which is what makes a re-run a no-op (§13 "Recovery from a
 * mis-backfilled activitySlug").
 *
 * `byConfidence` is tallied in passing so the run can report how many lots
 * folded exact / family / none. A 'family' or 'none' fold yields NULL: a
 * family-level match is not a Level-2 slug, and such a lot is deliberately not a
 * frequency-stream member.
 */
export function planActivitySlugBatch(
  lots: readonly ActivitySlugCandidate[],
  byConfidence: Map<string, number>,
): { id: string; activitySlug: string | null }[] {
  const plan: { id: string; activitySlug: string | null }[] = [];
  for (const lot of lots) {
    const { confidence } = foldActivityValue(lot.activityType);
    byConfidence.set(confidence, (byConfidence.get(confidence) ?? 0) + 1);
    // Single-sourced with every write path, so the backfill and the writes can
    // never disagree about what a lot's slug should be.
    const activitySlug = activitySlugForWrite(lot.activityType);
    if (activitySlug !== lot.activitySlug) plan.push({ id: lot.id, activitySlug });
  }
  return plan;
}
