// Wave C1 — the frequency-regime state machine (spec §3.4). COMPUTED, never
// stored: a stored regime goes stale the moment a past test is corrected to a
// verified fail, and every downstream lot would keep reporting the reduced
// required count until handover — the precise defect Wave C exists to prevent.
//
// Two things here, deliberately split:
//   * `buildRegimeStreamQuery` — PURE. The two-mode query contract of §3.4.3.
//   * `deriveRegime`           — PURE. The bounded fold + the length guard.
// The Prisma binding is a `RegimeStreamFetcher` the caller supplies. C1.0 ships
// no call site (spec §11) and no migration, so the columns this query names
// (`Lot.activitySlug`) do not exist in the Prisma client yet; C1.1 supplies the
// adapter when the migration lands.
//
// The read runs OUTSIDE the serializable decision transaction [C1R-B7]: it is a
// predicate read over exactly the range concurrent conforms write, so inside the
// transaction it would guarantee 40001/P2034 retries. F0's own precedent puts
// history-shaped reads outside (`qualityRoutes.ts:414-416`). The honest cost is
// one commit of staleness, bounded and self-healing on the next read.

import { testFailing, testPassing } from '../predicates.js';
import { testAttributesToRule } from './counts.js';
import {
  candidateCategories,
  createCategoryResolver,
  ruleCategoryOf,
  type CategoryResolver,
  type TestCategory,
} from './testCategories.js';
import type { FrequencyRule, FrequencyRegime, ResolvedRegime } from './types.js';

/**
 * Stream identity (§3.4.2): "work of the same type in the same project".
 * Subcontractor and material source are deliberately NOT in the key — the
 * authority regiments work type, not crew (§16 D7).
 */
export interface RegimeStreamKey {
  projectId: string;
  rulesetId: string;
  ruleId: string;
  /** Never null: a lot with no resolved slug is not a stream member at all. */
  activitySlug: string;
  /** The matched layer alias, or '*' for a layer-agnostic rule (§3.4.2). */
  layerBucket: string;
}

export function serializeStreamKey(key: RegimeStreamKey): string {
  return [key.projectId, key.rulesetId, key.ruleId, key.activitySlug, key.layerBucket].join('|');
}

export interface RegimeStreamTest {
  testType: string;
  passFail: string;
  status: string;
  /** Nested select on the regime path, so attribution needs no extra query. */
  itpChecklistItem?: { testType: string | null } | null;
}

/** One conformed lot in the stream. */
export interface RegimeStreamEntry {
  id: string;
  /**
   * NULL means the lot is not a stream member but IS inside this window, which
   * makes the window INCOMPLETE (§16 D7): `reduced` cannot be earned across a
   * history entry CIVOS cannot read, because that is exactly "treating unknown
   * as satisfied". Classify the lot and the stream heals on the next read.
   */
  activitySlug: string | null;
  conformedAt: Date | string | null;
  /** A force-conformed lot is NON-CONFORMING for regime purposes (§3.4.2). */
  conformanceOverriddenAt: Date | string | null;
  testResults: readonly RegimeStreamTest[];
}

interface LayerFilter {
  layer: { equals: string; mode: 'insensitive' };
}

interface StreamMemberFilter {
  activitySlug: string;
  OR?: LayerFilter[];
}

/**
 * Shaped for `prisma.lot.findMany`. Kept explicit (rather than
 * `Prisma.LotFindManyArgs`) because C1.0 lands before the migration that adds
 * `activitySlug`, so the generated client has no such field yet.
 */
export interface RegimeStreamQuery {
  where: {
    projectId: string;
    conformedAt: { not: null };
    OR: (StreamMemberFilter | { activitySlug: null })[];
  };
  orderBy: readonly ({ conformedAt: 'desc' } | { createdAt: 'desc' } | { id: 'desc' })[];
  take: number;
  cursor?: { id: string };
  skip?: number;
}

export type RegimeStreamFetcher = (
  query: RegimeStreamQuery,
) => Promise<readonly RegimeStreamEntry[]>;

/**
 * Stream order is `conformedAt ASC, createdAt ASC, id ASC` — a total order, so
 * the strictly-before cursor is well-defined. The query reads it DESCENDING and
 * the fold reverses, because "the N most recent" is what both modes want.
 */
const STREAM_ORDER_DESC = [
  { conformedAt: 'desc' },
  { createdAt: 'desc' },
  { id: 'desc' },
] as const satisfies RegimeStreamQuery['orderBy'];

export interface RegimeSubject {
  id: string;
  /** null => being conformed now (or not yet conformed): mode 1. */
  conformedAt: Date | string | null;
}

/**
 * The two-mode query contract (§3.4.3) [C1R-B7].
 *
 * | subject                     | query                                                  |
 * |-----------------------------|--------------------------------------------------------|
 * | `conformedAt IS NULL`       | no cursor, `take: N` — the most recent N               |
 * | `conformedAt IS NOT NULL`   | strictly-before compound cursor over the total order   |
 *
 * Rev 1 used "most recent N" for both, which is silently wrong for every
 * already-conformed lot (the commercial path): it returns today's last N lots,
 * not the N preceding that lot. A simple `lt` on `conformedAt` is also wrong —
 * it drops or duplicates entries whenever two lots share a `conformedAt` — hence
 * the compound cursor + `skip: 1` over the FULL total order.
 *
 * A NULL-`activitySlug` conformed lot is included in the window (never as a
 * member) so `deriveRegime` can see that the window is incomplete (§16 D7). One
 * query per stream, no second contamination probe.
 *
 * `ponytail:` a NULL-`layer` lot is silently excluded from a layer-discriminated
 * stream rather than treated as a contaminant — §16 D7 decides NULL layer as
 * "member of the layer-agnostic stream only" and says nothing about windows.
 */
export function buildRegimeStreamQuery(
  key: RegimeStreamKey,
  subject: RegimeSubject,
  take: number,
  layerAliases?: readonly string[],
): RegimeStreamQuery {
  const member: StreamMemberFilter = { activitySlug: key.activitySlug };
  if (layerAliases && layerAliases.length > 0) {
    member.OR = layerAliases.map((alias) => ({
      layer: { equals: alias, mode: 'insensitive' as const },
    }));
  }
  const query: RegimeStreamQuery = {
    where: {
      projectId: key.projectId,
      conformedAt: { not: null },
      OR: [member, { activitySlug: null }],
    },
    orderBy: STREAM_ORDER_DESC,
    take,
  };
  if (subject.conformedAt !== null) {
    query.cursor = { id: subject.id };
    query.skip = 1;
  }
  return query;
}

/**
 * §3.4.2 entry conformity — status-qualified on BOTH sides [C1R-B8].
 *
 * **THE SECOND PRODUCTION CALLER of the attribution rule** [F1C-B1] [C1C-20].
 * This is a NEGATIVE predicate: an entry conforms iff NO failing test attributes
 * to the rule. If attribution here were left comparing a raw string like
 * `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00` against the category `compaction`
 * it would still COMPILE, and it would be permanently false — so no failing test
 * could ever break a streak, so every conformed non-overridden lot would read
 * conforming, so a three-lot streak in which every lot failed six density tests
 * would report `reducedFrequencyEligible: true`. That value is user-visible and
 * D14 builds on it. It would ship green. AT-56b is the test that catches it.
 *
 * **D14 §6.4.1 `[D14X-4]` — ZERO TESTS IS NOT CONFORMANCE.** Until D14.1 this was
 * a purely NEGATIVE predicate, and `!some(...)` over an EMPTY `testResults` is
 * vacuously `true`: three conformed lots with no attributable test at all earned
 * the user *"Eligible to request reduced test frequency"*. `[C1C-6]` and the
 * VicRoads research both require the preceding lots to have achieved the
 * compaction requirement **on first testing**, and "we never tested it" is not an
 * achievement. The failure direction was under-testing. An entry now needs a
 * POSITIVE limb too — at least one attributable, verified, PASSING result.
 *
 * This depends on `[D14X-1]` test-type canonicalisation being real: attribution
 * runs through resolved categories, and if that seam matched nothing the positive
 * limb would fail everywhere and the regime would silently never reduce —
 * correct, but for the wrong reason. F1.2 landed that seam first, deliberately.
 *
 * "First testing" needs no separate ordering pass: condition 4 disqualifies an
 * entry carrying ANY attributable verified failure, whenever it occurred, so a
 * lot that failed and passed on retest is already non-conforming. `ponytail:` no
 * test-date column is fetched for an ordering that cannot change an outcome.
 */
export function streamEntryConforming(
  entry: RegimeStreamEntry,
  ruleCategory: TestCategory | null,
  resolve: CategoryResolver,
): boolean {
  if (entry.conformedAt === null) return false;
  if (entry.conformanceOverriddenAt !== null) return false;
  const attributable = entry.testResults.filter((test) =>
    testAttributesToRule(
      ruleCategory,
      candidateCategories(resolve(test.testType), resolve(test.itpChecklistItem?.testType ?? null)),
    ),
  );
  // 3. at least one attributable VERIFIED PASSING result — the D14 addition.
  if (!attributable.some(testPassing)) return false;
  // 4. no attributable verified failure — shipped, and now non-vacuous.
  return !attributable.some(testFailing);
}

/**
 * The bounded fold (§3.4.1).
 *
 *   Claim: regime is `reduced` iff the stream has AT LEAST N entries in the
 *   lookback window AND the last N are all conforming.
 *   Proof sketch: full → reduced requires N consecutive conforming entries. Any
 *   failure resets to full and discards accumulated credit, so re-entry requires
 *   N fresh consecutive conforming entries. ∎
 *
 * The LENGTH GUARD is part of the rule, not a footnote [C1R-B7]: without it
 * `[].every(...)` is vacuously true and the first lot of every project reads
 * `reduced`.
 *
 * `ponytail:` bounded N-row lookback, valid for `reset_on_any_failure` only. An
 * unknown `escalationShape` throws rather than being silently mis-evaluated —
 * `validateRuleset` rejects one in CI before it can ever reach here.
 *
 * @param tail the window in ASCENDING stream order (oldest first).
 * @param resolve the batch-scoped category resolver (F1 §4.6). Absent =>
 *   a fresh per-call one, which is behaviourally identical.
 */
export function deriveRegime(
  rule: FrequencyRule,
  key: RegimeStreamKey,
  tail: readonly RegimeStreamEntry[],
  resolve: CategoryResolver = createCategoryResolver(),
): ResolvedRegime {
  const trigger = regimeTrigger(rule);
  const streamKey = serializeStreamKey(key);
  const notMet = (): ResolvedRegime => ({
    regime: 'full' as FrequencyRegime,
    eligible: false,
    basisLotIds: [],
    streamKey,
  });
  if (!trigger) return notMet();
  if (trigger.escalationShape !== 'reset_on_any_failure') {
    throw new Error(
      `Unsupported sufficiency escalationShape '${String(trigger.escalationShape)}' on rule ${rule.id}`,
    );
  }
  const required = trigger.consecutiveConformingLots;
  // Incomplete window: an unclassified lot conformed inside it (§16 D7).
  if (tail.some((entry) => entry.activitySlug === null)) return notMet();
  // THE LENGTH GUARD. Fewer than N entries can never have earned a reduction.
  if (required < 1 || tail.length < required) return notMet();
  const window = tail.slice(-required);
  const ruleCategory = ruleCategoryOf(resolve, rule.testType);
  if (!window.every((entry) => streamEntryConforming(entry, ruleCategory, resolve))) {
    return notMet();
  }
  // The streak is met. [C1C-6] Whether that CHANGES the count is a separate
  // question: only a rule carrying reduced FIGURES can go operative. An
  // eligibility-only rule reports `eligible` at `regime: 'full'` — the authority
  // grants the right to ASK, not the reduction (§3.4.1a).
  return {
    regime: rule.reduced ? 'reduced' : 'full',
    eligible: true,
    basisLotIds: window.map((entry) => entry.id),
    streamKey,
  };
}

/**
 * The declaration that makes a rule regime-bearing: reduced FIGURES when the
 * authority publishes per-lot reduced counts, otherwise the eligibility-only
 * trigger `[C1C-6]`. A rule with neither has no regime concept and issues no
 * query at all.
 */
function regimeTrigger(
  rule: FrequencyRule,
): { consecutiveConformingLots: number; escalationShape: string } | null {
  return rule.reduced ?? rule.reducedFrequencyEligibility ?? null;
}

/**
 * How many stream entries this rule's regime looks back over, or null when the
 * rule is not regime-bearing and issues no query at all.
 *
 * Exported for the BATCHED resolver (C1.2), which needs the window length up
 * front to slice one grouped per-stream read into each subject's own tail —
 * `resolveRegimeForRule` reads it from the trigger it already has.
 */
export function regimeLookback(rule: FrequencyRule): number | null {
  return regimeTrigger(rule)?.consecutiveConformingLots ?? null;
}

/**
 * Resolve the regime for one rule: build the two-mode query, fetch, fold.
 * Returns null when the rule declares neither `reduced` nor
 * `reducedFrequencyEligibility` — no regime concept, and no query is issued.
 */
export async function resolveRegimeForRule(
  fetchStream: RegimeStreamFetcher,
  rule: FrequencyRule,
  key: RegimeStreamKey,
  subject: RegimeSubject,
  resolve: CategoryResolver = createCategoryResolver(),
): Promise<ResolvedRegime | null> {
  const trigger = regimeTrigger(rule);
  if (!trigger) return null;
  const query = buildRegimeStreamQuery(
    key,
    subject,
    trigger.consecutiveConformingLots,
    rule.appliesTo.layerAliases,
  );
  const rowsDesc = await fetchStream(query);
  return deriveRegime(rule, key, [...rowsDesc].reverse(), resolve);
}
