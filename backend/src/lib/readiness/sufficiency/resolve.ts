// Wave C1 — per-path input resolution (spec §5.1.1, §4.1.1).
//
// The ONE DB-touching piece of the engine, and it runs per path and passes its
// result INTO the pure evaluator — the `releasedHoldPointItemIds` pattern already
// in `conformancePrerequisites.ts:494,557-582` [C1R-B1] [C1R-C5]. The pure gate
// stays sync and DB-free, so the M39 byte-identity guarantee between the single
// conform path and the batched claim path survives.
//
// C1.0 ships this with NO call site (spec §11 C1.0), and the lot input is a plain
// structural shape rather than a Prisma payload type because the migration that
// adds `Lot.activitySlug` / `testScale` / `quantityValue` / `quantityUnit` and
// `Project.testSufficiencyMode` is C1.1. C1.1 adds the exact `select`/`include`
// extensions of §4.1.1 and binds them here.

import { resolveRuleset, rulesForLot, layerBucketFor } from './registry.js';
import { resolveRegimeForRule, type RegimeStreamFetcher } from './regime.js';
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

  const regimeByRuleId = new Map<string, ResolvedRegime>();
  if (ruleset && fetchStream && lot.activitySlug) {
    for (const rule of rules) {
      if (!rule.reduced) continue;
      const layerBucket = layerBucketFor(rule, lot.layer);
      if (layerBucket === null) continue; // not a member of this rule's stream
      const resolved = await resolveRegimeForRule(
        fetchStream,
        rule,
        {
          projectId: lot.projectId,
          rulesetId: ruleset.id,
          ruleId: rule.id,
          activitySlug: lot.activitySlug,
          layerBucket,
        },
        { id: lot.id, conformedAt: lot.conformedAt ?? null },
      );
      if (resolved) regimeByRuleId.set(rule.id, resolved);
    }
  }

  return {
    mode,
    ruleset,
    rules,
    scale,
    quantity,
    areaZone: lot.areaZone,
    regimeByRuleId,
    activityCanonical: lot.activitySlug !== null && lot.activitySlug.trim() !== '',
  };
}
