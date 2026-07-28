// Wave C1 — the shipped test-frequency registry, as the UI sees it (spec §9.2,
// §9.4).
//
// The scale control is POPULATED from the registry rather than typed, so a user
// can only ever pick a scale the governing specification actually uses — the
// backend rejects anything else at the route, and this keeps the two in step
// without duplicating the key list in the frontend.

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';
import { queryKeys } from './queryKeys';

export interface SufficiencyRulesetRule {
  id: string;
  label: string;
  testType: string;
  clause: string;
  /** D14.3 §9.3: the Level-2 activity slugs this rule applies to. */
  activitySlugs: string[];
  /**
   * D14.5: this rule's counts come from one lot-area band list used whatever the
   * lot's scale, so no answer the user could give changes the number. Optional
   * because a payload cached from before the field shipped simply omits it —
   * absent reads as "not known to be scale-independent", which keeps today's
   * behaviour rather than hiding a control that is needed.
   */
  scaleIndependent?: boolean;
  /**
   * D14.5: this rule's REQUIRED COUNT is computed from the lot quantity (an area
   * band table, or a per-quantity limb), so the quantity is not merely recorded.
   * Optional for the same reason as {@link SufficiencyRulesetRule.scaleIndependent}
   * — absent keeps today's wording.
   */
  quantityDrivesCount?: boolean;
}

/**
 * D14.3 §9.3 `[D14R-R10]` — does any rule in this pack apply to the lot's
 * activity?
 *
 * The Testing card used to render whenever a ruleset resolved at all, which is
 * fine for VicRoads' Compaction Scale A/B/C and wrong for TfNSW Q6: a drainage
 * or kerb lot on an NSW project would be asked for a "Specified relative
 * compaction" band off an earthworks table that will never score it.
 *
 * A lot whose activity does not fold to a canonical Level-2 slug KEEPS the card:
 * it has no activity to mismatch, and hiding the control would hide the fix.
 */
export function rulesetAppliesToActivity(
  ruleset: SufficiencyRuleset,
  activitySlug: string | null,
): boolean {
  if (!activitySlug) return true;
  return ruleset.rules.some((rule) => rule.activitySlugs.includes(activitySlug));
}

/**
 * D14.5 — is the scale worth ASKING for on this lot?
 *
 * A pavement lot on `tfnsw-q6.v1` matches only rules keyed on lot area alone, so
 * the control's sentence ("Leaving the scale blank means CIVOS cannot check this
 * lot") is false and a band picked is inert. One rule that still reads the scale
 * is enough to keep the control — the same pack keys its earthworks rule by band.
 *
 * A lot with no canonical slug keeps the control, for the same reason
 * {@link rulesetAppliesToActivity} keeps the card: nothing has been ruled out.
 */
export function scaleAppliesToActivity(
  ruleset: SufficiencyRuleset,
  activitySlug: string | null,
): boolean {
  if (!activitySlug) return true;
  return ruleset.rules.some(
    (rule) => rule.activitySlugs.includes(activitySlug) && !rule.scaleIndependent,
  );
}

/**
 * D14.5 — does the quantity actually feed the count on this lot?
 *
 * The card's "it does not change this check today" was written when the only
 * shipped rule counted off the scale alone. It is false for a lot matching an
 * area-banded rule, where the lot area SELECTS the required count.
 *
 * A lot with no canonical slug keeps today's wording: nothing is known to match,
 * and such a lot evaluates `activity_not_canonical` anyway.
 */
export function quantityDrivesCountForActivity(
  ruleset: SufficiencyRuleset,
  activitySlug: string | null,
): boolean {
  if (!activitySlug) return false;
  return ruleset.rules.some(
    (rule) => rule.activitySlugs.includes(activitySlug) && rule.quantityDrivesCount,
  );
}

export interface SufficiencyRuleset {
  id: string;
  state: string;
  specSet: string;
  scaleKeys: string[];
  defaultScale: string | null;
  /** D14: the material classes this authority recognises. Null = it has none. */
  materialTypes: string[] | null;
  /**
   * D14: what the authority CALLS the thing `Lot.testScale` carries. Null = use
   * the default wording; VicRoads regiments by Compaction Scale A/B/C, TfNSW Q6
   * by specified relative compaction band.
   */
  scaleLabel: string | null;
  status: 'draft' | 'confirmed';
  authority: string;
  document: string;
  edition: string;
  rules: SufficiencyRulesetRule[];
}

/** Mirrors the backend `QUANTITY_UNITS` vocabulary. */
export const QUANTITY_UNIT_OPTIONS = [
  { value: 'm2', label: 'm²' },
  { value: 'm3', label: 'm³' },
  { value: 't', label: 'tonnes' },
  { value: 'm', label: 'metres' },
  { value: 'each', label: 'each' },
] as const;

/**
 * Shipped product data with no tenant content, so it is cached hard: the payload
 * only changes when a pack is added or corrected in a deploy.
 *
 * TanStack Query v4 — `cacheTime`, not v5's `gcTime`.
 */
export function useSufficiencyRulesets() {
  return useQuery({
    queryKey: queryKeys.sufficiencyRulesets(),
    queryFn: () => apiFetch<{ rulesets: SufficiencyRuleset[] }>('/api/test-sufficiency/rulesets'),
    staleTime: 60 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
  });
}

/**
 * The ruleset governing a project: case-insensitive state match plus the
 * `rms` → `tfnsw` spec-set fold. Returns null for every project whose authority
 * has no shipped pack — which is most of them, and is why the Testing fields are
 * hidden rather than shown empty.
 *
 * This is NOT a mirror of the backend's `resolveRuleset`, and deliberately does
 * not try to be. The EDITION choice — which of an authority's pack revisions
 * governs today — is made server-side: `GET /api/test-sufficiency/rulesets`
 * serves `effectiveRulesets()`, already filtered to the live window (D14.2
 * §6.5), so at most one pack per authority ever reaches this list and the
 * `find` below cannot pick a superseded one. The registry test
 * "NEVER two live packs for one authority" is what holds that invariant up; if
 * it ever fails, this function is one of the things that breaks, which is why
 * the assertion names this call site.
 */
export function resolveProjectRuleset(
  rulesets: SufficiencyRuleset[] | undefined,
  state: string | null | undefined,
  specificationSet: string | null | undefined,
): SufficiencyRuleset | null {
  const normalizedState = (state || '').trim().toLowerCase();
  const rawSpecSet = (specificationSet || '').trim().toLowerCase();
  const normalizedSpecSet = rawSpecSet === 'rms' ? 'tfnsw' : rawSpecSet;
  if (!normalizedState || !normalizedSpecSet) return null;
  return (
    (rulesets ?? []).find(
      (ruleset) =>
        ruleset.state.toLowerCase() === normalizedState &&
        ruleset.specSet.toLowerCase() === normalizedSpecSet,
    ) ?? null
  );
}
