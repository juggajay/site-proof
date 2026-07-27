// Wave C1 — the ruleset registry (spec §3.1, §3.2) and the §8.3 step-4 currency
// check, which is the runnable guard that survives sessions: an expired or
// under-provenanced `confirmed` pack FAILS CI rather than quietly shipping
// authority numbers nobody has read.

import { isCanonicalActivitySlug } from '../../activityTaxonomy.js';
import { normalizeSpecSet } from '../../itpMatcher.js';
import { SUFFICIENCY_RULESETS } from './rulesets/index.js';
import { ESCALATION_SHAPES, QUANTITY_UNITS, type FrequencyRule, type Ruleset } from './types.js';

export { SUFFICIENCY_RULESETS };

/**
 * §8.4 legal boundary: a rule label is a short FACTUAL label, never a quotation
 * of specification prose, and the rule type has no free-prose field — there is
 * nowhere for a copied clause to live. The cap is the CI teeth on that.
 */
export const RULE_LABEL_MAX_LENGTH = 80;

function normalizeKey(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T|$)/.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * A date-only `checkedOn` parses at UTC midnight, so an author in AEST who
 * records "today" is up to ~14 hours ahead of a UTC CI clock. One day of grace
 * catches a genuinely future date (the thing worth rejecting) without failing a
 * pack confirmed this morning on the other side of the dateline.
 */
const CHECKED_ON_FUTURE_GRACE_MS = 24 * 60 * 60 * 1000;

export interface RulesetLookup {
  /** `Project.state`, matched case-insensitively. */
  state: string | null;
  /** `Project.specificationSet`, folded through `normalizeSpecSet`. */
  specSet: string | null;
  /** Evaluation date; defaults to now. */
  at?: Date;
}

/**
 * Resolve the governing ruleset for a project. Returns null for every project
 * whose authority has no shipped pack — including every national-baseline spec
 * set (`itpMatcher.ts:96` austroads / aus-spec / ipwea / wsa / national), which
 * therefore reads `unknown`, never `insufficient` (§7.1 row 1).
 *
 * Spec-set folding REUSES `normalizeSpecSet` (rms → tfnsw) rather than
 * re-implementing it [C1R-C7].
 */
export function resolveRuleset(lookup: RulesetLookup): Ruleset | null {
  const state = normalizeKey(lookup.state);
  const specSet = normalizeSpecSet(lookup.specSet ?? null);
  if (!state || !specSet) return null;
  const at = (lookup.at ?? new Date()).getTime();
  const candidates = SUFFICIENCY_RULESETS.filter(
    (ruleset) =>
      normalizeKey(ruleset.state) === state &&
      normalizeKey(ruleset.specSet) === specSet &&
      Date.parse(ruleset.effectiveFrom) <= at &&
      (ruleset.effectiveTo === undefined || Date.parse(ruleset.effectiveTo) > at),
  );
  if (candidates.length === 0) return null;
  // Newest effective edition wins; `id` breaks a same-day tie deterministically.
  return candidates.reduce((best, ruleset) => {
    const delta = Date.parse(ruleset.effectiveFrom) - Date.parse(best.effectiveFrom);
    if (delta > 0) return ruleset;
    if (delta === 0 && ruleset.id > best.id) return ruleset;
    return best;
  });
}

export interface LotRuleLookup {
  /** NULL when the activity fold yielded 'family' or 'none' — matches nothing. */
  activitySlug: string | null;
  layer: string | null;
  areaZone: string | null;
}

function aliasMatches(aliases: readonly string[] | undefined, value: string | null): boolean {
  if (!aliases || aliases.length === 0) return true; // unqualified rule
  const needle = normalizeKey(value);
  if (!needle) return false;
  return aliases.some((alias) => normalizeKey(alias) === needle);
}

/** The subset of a ruleset's rules that applies to one lot (§3.2 `appliesTo`). */
export function rulesForLot(ruleset: Ruleset, lot: LotRuleLookup): FrequencyRule[] {
  if (!lot.activitySlug) return [];
  return ruleset.rules.filter(
    (rule) =>
      rule.appliesTo.activitySlugs.includes(lot.activitySlug as string) &&
      aliasMatches(rule.appliesTo.layerAliases, lot.layer) &&
      aliasMatches(rule.appliesTo.areaZoneAliases, lot.areaZone),
  );
}

/**
 * The `layerBucket` limb of the frequency-stream key (§3.4.2): the matched alias
 * for a layer-discriminated rule, the constant '*' for a layer-agnostic one. A
 * lot with a NULL layer is a member of the layer-agnostic stream ONLY (§16 D7).
 */
export function layerBucketFor(rule: FrequencyRule, layer: string | null): string | null {
  const aliases = rule.appliesTo.layerAliases;
  if (!aliases || aliases.length === 0) return '*';
  const needle = normalizeKey(layer);
  const matched = aliases.find((alias) => normalizeKey(alias) === needle);
  return matched ? normalizeKey(matched) : null;
}

function validateRule(ruleset: Ruleset, rule: FrequencyRule, now: Date, problems: string[]): void {
  const where = `${ruleset.id} rule ${rule.id}`;
  if (!rule.id.startsWith(`${ruleset.id}/`)) {
    problems.push(
      `${where}: rule id must be prefixed '${ruleset.id}/' so snapshots stay resolvable`,
    );
  }
  if (!rule.label.trim()) problems.push(`${where}: empty label`);
  if (rule.label.length > RULE_LABEL_MAX_LENGTH) {
    problems.push(
      `${where}: label is ${rule.label.length} chars, over the ${RULE_LABEL_MAX_LENGTH}-char cap (§8.4)`,
    );
  }
  if (!rule.testType.trim()) problems.push(`${where}: empty testType`);
  if (rule.appliesTo.activitySlugs.length === 0) {
    problems.push(`${where}: appliesTo.activitySlugs is empty — the rule can never match`);
  }
  for (const slug of rule.appliesTo.activitySlugs) {
    if (!isCanonicalActivitySlug(slug)) {
      problems.push(`${where}: '${slug}' is not a canonical Level-2 activity slug`);
    }
  }

  const checkCounts = (counts: Readonly<Record<string, number>>, label: string): void => {
    for (const scaleKey of ruleset.scaleKeys) {
      const count = counts[scaleKey];
      if (count === undefined) {
        problems.push(`${where}: ${label} declares no count for scale '${scaleKey}'`);
      } else if (!Number.isInteger(count) || count < 1) {
        problems.push(`${where}: ${label}['${scaleKey}'] must be an integer >= 1, got ${count}`);
      }
    }
    for (const scaleKey of Object.keys(counts)) {
      if (!ruleset.scaleKeys.includes(scaleKey)) {
        problems.push(`${where}: ${label} declares scale '${scaleKey}' outside ruleset.scaleKeys`);
      }
    }
  };
  checkCounts(rule.minCountByScale, 'minCountByScale');

  const checkPerQuantity = (
    perQuantity: { unit: string; every: number } | undefined,
    label: string,
  ): void => {
    if (!perQuantity) return;
    if (!(QUANTITY_UNITS as readonly string[]).includes(perQuantity.unit)) {
      problems.push(`${where}: ${label}.unit '${perQuantity.unit}' is not a QuantityUnit`);
    }
    if (!(perQuantity.every > 0)) {
      problems.push(`${where}: ${label}.every must be > 0, got ${perQuantity.every}`);
    }
  };
  checkPerQuantity(rule.perQuantity, 'perQuantity');

  for (const cap of rule.maxLotSize ?? []) {
    if (!(QUANTITY_UNITS as readonly string[]).includes(cap.unit)) {
      problems.push(`${where}: maxLotSize.unit '${cap.unit}' is not a QuantityUnit`);
    }
    if (!(cap.value > 0)) problems.push(`${where}: maxLotSize.value must be > 0`);
    // D14 §4.1: an EMPTY alias list reads as "unqualified on this dimension", so
    // declaring one by mistake silently widens the cap to every lot — the wrong
    // direction for a control whose whole point is to be material-scoped.
    if (cap.materialAliases && cap.materialAliases.length === 0) {
      problems.push(
        `${where}: maxLotSize.materialAliases is empty — omit the limb to leave the cap unqualified`,
      );
    }
    for (const alias of cap.materialAliases ?? []) {
      if (!alias.trim()) problems.push(`${where}: maxLotSize.materialAliases contains a blank`);
    }
  }

  if (rule.reduced) {
    // [C1R-B8] — the vacuum this closes: a guessed reduced count on an
    // unconfirmed edition emits a confident wrong required count.
    if (ruleset.status === 'draft') {
      problems.push(
        `${where}: a draft ruleset must not declare a 'reduced' limb — reduced counts require a CONFIRMED edition (§8.3)`,
      );
    }
    if (!(ESCALATION_SHAPES as readonly string[]).includes(rule.reduced.escalationShape)) {
      problems.push(
        `${where}: unsupported escalationShape '${rule.reduced.escalationShape}' — the registry rejects an unknown shape rather than mis-evaluating it (§3.4.1)`,
      );
    }
    if (
      !Number.isInteger(rule.reduced.consecutiveConformingLots) ||
      rule.reduced.consecutiveConformingLots < 1
    ) {
      problems.push(`${where}: reduced.consecutiveConformingLots must be an integer >= 1`);
    }
    checkCounts(rule.reduced.minCountByScale, 'reduced.minCountByScale');
    checkPerQuantity(rule.reduced.perQuantity, 'reduced.perQuantity');
  }

  // [C1C-6] The eligibility-only trigger: a streak the engine COMPUTES and
  // REPORTS but may never apply. Legal on a draft ruleset (unlike `reduced`)
  // precisely because it changes no count.
  const eligibility = rule.reducedFrequencyEligibility;
  if (eligibility) {
    if (rule.reduced) {
      problems.push(
        `${where}: declare either 'reduced' (figures) or 'reducedFrequencyEligibility' (trigger only), not both`,
      );
    }
    if (!(ESCALATION_SHAPES as readonly string[]).includes(eligibility.escalationShape)) {
      problems.push(
        `${where}: unsupported reducedFrequencyEligibility.escalationShape '${eligibility.escalationShape}'`,
      );
    }
    if (
      !Number.isInteger(eligibility.consecutiveConformingLots) ||
      eligibility.consecutiveConformingLots < 1
    ) {
      problems.push(
        `${where}: reducedFrequencyEligibility.consecutiveConformingLots must be an integer >= 1`,
      );
    }
    if (!eligibility.clause.trim()) {
      problems.push(
        `${where}: reducedFrequencyEligibility.clause is empty — the regime is a DIFFERENT clause from the count (§3.2)`,
      );
    }
  }

  validateProvenance(`${where} provenance`, rule.provenance, ruleset, now, problems);
}

function validateProvenance(
  where: string,
  provenance: Ruleset['provenance'],
  ruleset: Ruleset,
  now: Date,
  problems: string[],
): void {
  for (const field of ['authority', 'document', 'clause'] as const) {
    if (!provenance[field].trim()) problems.push(`${where}: ${field} is empty`);
  }
  if (ruleset.status !== 'confirmed') return;

  // §8.3 step 4 — a CONFIRMED ruleset carries a complete, current, A-graded source.
  for (const field of ['edition', 'sourceUrl'] as const) {
    if (!provenance[field].trim()) {
      problems.push(`${where}: confirmed ruleset requires a non-empty ${field} (§8.3)`);
    }
  }
  if (provenance.pdfPage === undefined) {
    problems.push(`${where}: confirmed ruleset requires pdfPage (§8.3)`);
  }
  if (provenance.evidenceGrade !== 'A') {
    problems.push(
      `${where}: confirmed ruleset requires evidenceGrade 'A', got '${provenance.evidenceGrade}' — a split grade is encoded at its WEAKEST limb [C1R-B11]`,
    );
  }

  // The dates are STRICT ISO, and the expiry check is unconditional once they
  // parse (external review F12). Requiring only "non-empty" and then gating the
  // expiry check on `isIsoDate` meant a malformed value — `revalidateBy:
  // '2027-7-27'`, `checkedOn: 'yesterday'` — validated forever: non-empty, so
  // no complaint, and never ISO, so never expired. A confirmed pack that can
  // never expire is precisely what §8.3 step 4 exists to prevent, and it is the
  // pattern the ruleset-level `effectiveFrom`/`effectiveTo` checks already use.
  const checkedOn = isIsoDate(provenance.checkedOn) ? Date.parse(provenance.checkedOn) : null;
  const revalidateBy = isIsoDate(provenance.revalidateBy)
    ? Date.parse(provenance.revalidateBy)
    : null;
  if (checkedOn === null) {
    problems.push(
      `${where}: confirmed ruleset requires an ISO checkedOn date, got '${provenance.checkedOn}' (§8.3)`,
    );
  } else if (checkedOn > now.getTime() + CHECKED_ON_FUTURE_GRACE_MS) {
    problems.push(
      `${where}: checkedOn ${provenance.checkedOn} is in the future — a human cannot have read the source yet (§8.3)`,
    );
  }
  if (revalidateBy === null) {
    problems.push(
      `${where}: confirmed ruleset requires an ISO revalidateBy date, got '${provenance.revalidateBy}' (§8.3)`,
    );
  } else {
    if (checkedOn !== null && revalidateBy <= checkedOn) {
      problems.push(
        `${where}: revalidateBy ${provenance.revalidateBy} must be after checkedOn ${provenance.checkedOn}`,
      );
    }
    if (revalidateBy <= now.getTime()) {
      problems.push(
        `${where}: confirmed ruleset expired — revalidateBy ${provenance.revalidateBy} is in the past (§8.3 step 4)`,
      );
    }
  }
}

/**
 * Registration + currency validation. Returns the list of problems; empty means
 * the ruleset is registrable. Run over every shipped pack by
 * `registry.test.ts`, so a defective pack cannot land (§8.3 step 4, §14 AT-17).
 */
export function validateRuleset(ruleset: Ruleset, now: Date = new Date()): string[] {
  const problems: string[] = [];
  if (!ruleset.id.trim()) problems.push('ruleset id is empty');
  if (normalizeKey(ruleset.state) !== ruleset.state) {
    problems.push(`${ruleset.id}: state must be stored lower-case ('${ruleset.state}')`);
  }
  if (normalizeSpecSet(ruleset.specSet) !== ruleset.specSet) {
    problems.push(
      `${ruleset.id}: specSet must be pre-normalized through normalizeSpecSet ('${ruleset.specSet}')`,
    );
  }
  if (ruleset.scaleKeys.length === 0) problems.push(`${ruleset.id}: scaleKeys is empty`);
  if (ruleset.defaultScale !== undefined && !ruleset.scaleKeys.includes(ruleset.defaultScale)) {
    problems.push(`${ruleset.id}: defaultScale '${ruleset.defaultScale}' is not in scaleKeys`);
  }
  // D14 §4.2. `materialTypes` is the route-level whitelist as well as the form's
  // option list, so an empty or blank-bearing declaration would either reject
  // every value or admit a blank one.
  if (ruleset.materialTypes !== undefined) {
    if (ruleset.materialTypes.length === 0) {
      problems.push(
        `${ruleset.id}: materialTypes is empty — omit it when the authority has no material classification`,
      );
    }
    for (const materialType of ruleset.materialTypes) {
      if (!materialType.trim()) problems.push(`${ruleset.id}: materialTypes contains a blank`);
    }
  }
  if (ruleset.scaleLabel !== undefined && !ruleset.scaleLabel.trim()) {
    problems.push(`${ruleset.id}: scaleLabel is blank — omit it to use the default wording`);
  }
  if (!isIsoDate(ruleset.effectiveFrom)) {
    problems.push(`${ruleset.id}: effectiveFrom '${ruleset.effectiveFrom}' is not an ISO date`);
  }
  if (ruleset.effectiveTo !== undefined) {
    if (!isIsoDate(ruleset.effectiveTo)) {
      problems.push(`${ruleset.id}: effectiveTo '${ruleset.effectiveTo}' is not an ISO date`);
    } else if (Date.parse(ruleset.effectiveTo) <= Date.parse(ruleset.effectiveFrom)) {
      problems.push(`${ruleset.id}: effectiveTo must be after effectiveFrom`);
    }
  }
  if (ruleset.rules.length === 0) problems.push(`${ruleset.id}: no rules`);

  const seen = new Set<string>();
  for (const rule of ruleset.rules) {
    if (seen.has(rule.id)) problems.push(`${ruleset.id}: duplicate rule id '${rule.id}'`);
    seen.add(rule.id);
    validateRule(ruleset, rule, now, problems);
  }

  validateProvenance(`${ruleset.id} provenance`, ruleset.provenance, ruleset, now, problems);
  return problems;
}
