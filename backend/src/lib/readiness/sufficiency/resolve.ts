// Wave C1 — per-path input resolution (spec §5.1.1, §4.1.1).
//
// The ONE DB-touching piece of the engine, and it runs per path and passes its
// result INTO the pure evaluator — the `releasedHoldPointItemIds` pattern already
// in `conformancePrerequisites.ts:494,557-582` [C1R-B1] [C1R-C5]. The pure gate
// stays sync and DB-free, so the M39 byte-identity guarantee between the single
// conform path and the batched claim path survives.
//
// The lot input stays a plain structural shape rather than a Prisma payload
// type, so both call paths (§4.1.1 Path A conformance, Path B readiness) and the
// unit tests feed it the same way.
//
// C1.1 binds the regime reader to Prisma via {@link prismaRegimeStreamFetcher}.
// Passing `null` instead is a first-class choice, not a stub: every rule then
// falls back to `full` (over-testing, the safe direction) and NO history read is
// issued. The conform DECISION path takes that option deliberately — it is how
// C1.1 satisfies §3.4.3's "outside the serializable transaction" requirement
// vacuously, and it is behaviour-neutral because no shipped pack carries reduced
// FIGURES, so the operative regime is 'full' either way (§3.4.1a [C1C-6]). The
// grouped per-stream batch read is C1.2 (spec §11).

import { resolveRuleset, rulesForLot, layerBucketFor } from './registry.js';
import {
  buildRegimeStreamQuery,
  deriveRegime,
  regimeLookback,
  resolveRegimeForRule,
  serializeStreamKey,
  type RegimeStreamEntry,
  type RegimeStreamFetcher,
  type RegimeStreamKey,
} from './regime.js';
import type { FrequencyRule } from './types.js';
import {
  QUANTITY_UNITS,
  SUFFICIENCY_MODES,
  type QuantityUnit,
  type ResolvedRegime,
  type ResolvedSufficiency,
  type SufficiencyMode,
} from './types.js';

/** Prisma `Decimal` columns arrive as Decimal instances, not numbers. */
type DecimalLike = number | string | { toString(): string } | null | undefined;

function toFiniteNumber(value: DecimalLike): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

function toQuantityUnit(value: string | null | undefined): QuantityUnit | null {
  const key = (value || '').trim().toLowerCase();
  return (QUANTITY_UNITS as readonly string[]).includes(key) ? (key as QuantityUnit) : null;
}

/**
 * `Project.testSufficiencyMode` is a defaulted String column (§6 — the codebase
 * uses defaulted strings, not Prisma enums). An unrecognised value falls back to
 * the column default `'warn'`, NEVER to `'block'`: a typo must not start gating
 * live production work.
 */
export function toSufficiencyMode(value: string | null | undefined): SufficiencyMode {
  const key = (value || '').trim().toLowerCase();
  return (SUFFICIENCY_MODES as readonly string[]).includes(key) ? (key as SufficiencyMode) : 'warn';
}

export interface SufficiencyProjectInput {
  state: string | null;
  specificationSet: string | null;
  testSufficiencyMode: string | null;
}

export interface SufficiencyGeometryInput {
  areaM2: DecimalLike;
}

export interface SufficiencyLotInput {
  id: string;
  projectId: string;
  /** Stored FOLDED slug; NULL when the fold yielded 'family' or 'none' (§6). */
  activitySlug: string | null;
  layer: string | null;
  areaZone: string | null;
  testScale: string | null;
  quantityValue: DecimalLike;
  quantityUnit: string | null;
  /** Drives the two-mode regime query (§3.4.3). */
  conformedAt: Date | string | null;
  project: SufficiencyProjectInput;
  geometries?: readonly SufficiencyGeometryInput[];
}

/**
 * Resolve ruleset + scale + quantity + regime for one lot.
 *
 * `fetchStream` is the regime reader, supplied by the caller so it can be issued
 * OUTSIDE the serializable decision transaction (§3.4.3 [C1R-B7]). Pass null to
 * resolve without any history read: every rule then falls back to `full`, the
 * over-testing (safe) direction. No shipped pack declares a `reduced` limb, so
 * today this issues ZERO additional queries either way (§12).
 */
export async function resolveSufficiency(
  lot: SufficiencyLotInput,
  fetchStream: RegimeStreamFetcher | null = null,
  now: Date = new Date(),
): Promise<ResolvedSufficiency> {
  const resolved = resolveSufficiencySync(lot, now);
  if (!fetchStream || !resolved.ruleset || !lot.activitySlug) return resolved;

  const regimeByRuleId = new Map<string, ResolvedRegime>();
  for (const rule of resolved.rules) {
    if (!rule.reduced && !rule.reducedFrequencyEligibility) continue;
    const layerBucket = layerBucketFor(rule, lot.layer);
    if (layerBucket === null) continue; // not a member of this rule's stream
    const regime = await resolveRegimeForRule(
      fetchStream,
      rule,
      {
        projectId: lot.projectId,
        rulesetId: resolved.ruleset.id,
        ruleId: rule.id,
        activitySlug: lot.activitySlug,
        layerBucket,
      },
      { id: lot.id, conformedAt: lot.conformedAt ?? null },
    );
    if (regime) regimeByRuleId.set(rule.id, regime);
  }
  return { ...resolved, regimeByRuleId };
}

/**
 * Wave C1.2 (spec §11 C1.2, §12). Resolve N lots with **one grouped regime
 * query per distinct stream** — never one per member.
 *
 * The naive batch is `resolveSufficiency` in a loop: a 5,000-lot claim-readiness
 * page would then fire 5,000 stream reads. Instead the (lot, rule) pairs are
 * grouped by stream key, ONE cursor-less read pulls that stream's conformed
 * lots in the total order, and each subject's own window is sliced out of it in
 * memory — an already-conformed subject takes the N entries strictly BEFORE
 * itself, an unconformed one takes the most recent N (§3.4.3's two modes,
 * served from one read).
 *
 * `ponytail:` the read is capped at {@link BATCH_REGIME_STREAM_TAKE} rows. A
 * subject deeper in its stream than that cap resolves to `full` — the
 * over-testing, safe direction — rather than issuing a per-lot query to chase
 * it. Raise the cap, or fall back to per-lot resolution, only if a real project
 * conforms more than that many lots into ONE activity/layer stream.
 *
 * Callers inside a serializable transaction must pass `null` `[C1R-B7]`: this
 * read covers exactly the range concurrent conforms write (§3.4.3). The claim
 * DECISION path does exactly that, which is why it adds ZERO regime queries.
 */
export const BATCH_REGIME_STREAM_TAKE = 5_000;

interface StreamGroup {
  key: RegimeStreamKey;
  rule: FrequencyRule;
  lookback: number;
  subjects: SufficiencyLotInput[];
}

/** The N entries immediately preceding `subjectId`, in DESC order; null when out of window. */
function precedingEntries(
  rowsDesc: readonly RegimeStreamEntry[],
  subjectId: string,
  lookback: number,
): readonly RegimeStreamEntry[] | null {
  const index = rowsDesc.findIndex((entry) => entry.id === subjectId);
  if (index === -1) return null;
  return rowsDesc.slice(index + 1, index + 1 + lookback);
}

export async function resolveSufficiencyBatch(
  lots: readonly SufficiencyLotInput[],
  fetchStream: RegimeStreamFetcher | null = null,
  now: Date = new Date(),
): Promise<Map<string, ResolvedSufficiency>> {
  const resolved = new Map<string, ResolvedSufficiency>();
  const regimes = new Map<string, Map<string, ResolvedRegime>>();
  for (const lot of lots) {
    resolved.set(lot.id, resolveSufficiencySync(lot, now));
    regimes.set(lot.id, new Map<string, ResolvedRegime>());
  }
  if (!fetchStream) return resolved;

  const streams = new Map<string, StreamGroup>();
  for (const lot of lots) {
    const base = resolved.get(lot.id)!;
    if (!base.ruleset || !lot.activitySlug) continue;
    for (const rule of base.rules) {
      const lookback = regimeLookback(rule);
      if (lookback === null) continue; // not regime-bearing: no query at all
      const layerBucket = layerBucketFor(rule, lot.layer);
      if (layerBucket === null) continue; // not a member of this rule's stream
      const key: RegimeStreamKey = {
        projectId: lot.projectId,
        rulesetId: base.ruleset.id,
        ruleId: rule.id,
        activitySlug: lot.activitySlug,
        layerBucket,
      };
      const serialized = serializeStreamKey(key);
      const group = streams.get(serialized) ?? { key, rule, lookback, subjects: [] };
      group.subjects.push(lot);
      streams.set(serialized, group);
    }
  }

  for (const group of streams.values()) {
    // Cursor-less by construction: one read serves every subject in the stream,
    // and each subject's cursor is applied in memory by `precedingEntries`.
    const rowsDesc = await fetchStream(
      buildRegimeStreamQuery(
        group.key,
        { id: '', conformedAt: null },
        BATCH_REGIME_STREAM_TAKE,
        group.rule.appliesTo.layerAliases,
      ),
    );
    for (const subject of group.subjects) {
      const windowDesc =
        subject.conformedAt === null
          ? rowsDesc.slice(0, group.lookback)
          : precedingEntries(rowsDesc, subject.id, group.lookback);
      if (windowDesc === null) continue; // out of window => `full`, the safe direction
      regimes
        .get(subject.id)!
        .set(group.rule.id, deriveRegime(group.rule, group.key, [...windowDesc].reverse()));
    }
  }

  for (const lot of lots) {
    resolved.set(lot.id, { ...resolved.get(lot.id)!, regimeByRuleId: regimes.get(lot.id)! });
  }
  return resolved;
}

/**
 * Everything except the frequency-stream read — registry lookup, scale and
 * quantity. Fully SYNCHRONOUS and DB-free.
 *
 * Split out because the batched claim path resolves 5,000 lots in one request
 * and takes no fetcher (§11 C1.2 owns the grouped read). Routing that through
 * the async wrapper cost 5,000 needless microtask turns inside the F0.5 Target 1
 * budget; calling this directly costs none.
 */
export function resolveSufficiencySync(
  lot: SufficiencyLotInput,
  now: Date = new Date(),
): ResolvedSufficiency {
  const mode = toSufficiencyMode(lot.project.testSufficiencyMode);
  const ruleset = resolveRuleset({
    state: lot.project.state,
    specSet: lot.project.specificationSet,
    at: now,
  });
  const rules = ruleset
    ? rulesForLot(ruleset, {
        activitySlug: lot.activitySlug,
        layer: lot.layer,
        areaZone: lot.areaZone,
      })
    : [];

  // Scale: an explicit lot value is never silently coerced — an unrecognised one
  // surfaces as `scale_not_recognised` in the evaluator rather than falling back
  // to the ruleset default (§10.1 "never silently coerced").
  const scale =
    lot.testScale && lot.testScale.trim()
      ? { value: lot.testScale.trim(), source: 'lot' as const }
      : ruleset?.defaultScale
        ? { value: ruleset.defaultScale, source: 'ruleset_default' as const }
        : { value: null, source: 'none' as const };

  // Quantity: the lot's own recorded quantity first; `LotGeometry.areaM2` is a
  // READ-TIME fallback, never copied into the lot (copying stales on the next
  // geometry edit — §6, D5). Several geometries sum to the lot's area.
  const lotQuantity = toFiniteNumber(lot.quantityValue);
  const lotUnit = toQuantityUnit(lot.quantityUnit);
  const geometryArea = (lot.geometries ?? []).reduce<number | null>((total, geometry) => {
    const area = toFiniteNumber(geometry.areaM2);
    if (area === null) return total;
    return (total ?? 0) + area;
  }, null);
  const quantity =
    lotQuantity !== null && lotQuantity > 0 && lotUnit
      ? { value: lotQuantity, unit: lotUnit, source: 'lot' as const }
      : geometryArea !== null && geometryArea > 0
        ? { value: geometryArea, unit: 'm2' as QuantityUnit, source: 'geometry' as const }
        : { value: null, unit: null, source: 'none' as const };

  return {
    mode,
    ruleset,
    rules,
    scale,
    quantity,
    areaZone: lot.areaZone,
    // Empty until a caller supplies a fetcher; every rule then reads `full`,
    // the over-testing (safe) direction.
    regimeByRuleId: new Map<string, ResolvedRegime>(),
    activityCanonical: lot.activitySlug !== null && lot.activitySlug.trim() !== '',
  };
}
