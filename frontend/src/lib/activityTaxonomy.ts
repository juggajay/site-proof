/**
 * Canonical construction-activity taxonomy — the single source of truth for
 * Wave 2 lot→ITP matching. This is the frontend mirror of
 * the backend source at `backend/src/lib/activityTaxonomy.ts` (same pattern as `roles.ts`); a
 * pinned-equality test on each side asserts the exact family + slug lists so
 * drift on either side breaks CI.
 *
 * Structure: 10 families (the foreman's dropdown groups) → 38 Level-2 activity
 * slugs (the template match key). Slugs and display names come verbatim from
 * `docs/research/wave2-itp-matching-taxonomy-spec-2026-07-15.md` §1 — they are
 * evidence-derived and founder-reviewed; do not editorialise them here.
 *
 * The spec §1 header says "38 slugs"; its table lists a 39th row,
 * `rail_trackwork`, expressly marked "(parked hedge)". Rail ships as a *family*
 * (kept below so legacy `Rail`/`rail` values still fold somewhere and a future
 * rail activity has a home) but carries no selectable Level-2 activity yet — so
 * the shipped canonical count is 38 and no foreman dropdown offers a "(parked
 * hedge)" option. Add the rail Level-2 slug(s) when that family is seeded.
 */

export type ActivityFamilySlug =
  | 'earthworks'
  | 'pavements'
  | 'surfacing'
  | 'drainage'
  | 'structures'
  | 'road_furniture'
  | 'environmental'
  | 'concrete_flatwork'
  | 'utilities'
  | 'rail';

export interface ActivityFamily {
  slug: ActivityFamilySlug;
  displayName: string;
}

export interface CanonicalActivity {
  slug: string;
  family: ActivityFamilySlug;
  displayName: string;
  /** Layer/material variants a lot may carry alongside the activity (informational). */
  layerVariants?: string[];
}

/** The 10 families, in spec order (also the foreman dropdown group order). */
export const ACTIVITY_FAMILIES: readonly ActivityFamily[] = [
  { slug: 'earthworks', displayName: 'Earthworks' },
  { slug: 'pavements', displayName: 'Pavements' },
  { slug: 'surfacing', displayName: 'Surfacing' },
  { slug: 'drainage', displayName: 'Drainage' },
  { slug: 'structures', displayName: 'Structures' },
  { slug: 'road_furniture', displayName: 'Road furniture' },
  { slug: 'environmental', displayName: 'Environmental' },
  { slug: 'concrete_flatwork', displayName: 'Concrete flatwork' },
  { slug: 'utilities', displayName: 'Utilities' },
  { slug: 'rail', displayName: 'Rail' },
] as const;

/** The 38 canonical activity slugs, in spec §1 table order. */
export const CANONICAL_ACTIVITIES: readonly CanonicalActivity[] = [
  {
    slug: 'earthworks_general',
    family: 'earthworks',
    displayName: 'Earthworks (general)',
    layerVariants: ['subgrade', 'fill', 'cut', 'select fill'],
  },
  {
    slug: 'earthworks_subgrade_prep',
    family: 'earthworks',
    displayName: 'Subgrade preparation',
    layerVariants: ['subgrade'],
  },
  {
    slug: 'geosynthetics',
    family: 'earthworks',
    displayName: 'Geosynthetics',
    layerVariants: ['separation', 'reinforcement'],
  },
  {
    slug: 'pavement_unbound',
    family: 'pavements',
    displayName: 'Unbound granular pavement',
    layerVariants: ['subbase', 'base'],
  },
  {
    slug: 'pavement_bound',
    family: 'pavements',
    displayName: 'Bound/stabilised pavement',
    layerVariants: ['CTB', 'in-situ', 'plant-mixed'],
  },
  {
    slug: 'pavement_concrete',
    family: 'pavements',
    displayName: 'Concrete pavement',
    layerVariants: ['base'],
  },
  {
    slug: 'pavement_stabilisation',
    family: 'pavements',
    displayName: 'In-situ stabilisation',
    layerVariants: ['lime', 'cement'],
  },
  {
    slug: 'asphalt_dga',
    family: 'surfacing',
    displayName: 'Dense graded asphalt',
    layerVariants: ['wearing', 'intermediate'],
  },
  {
    slug: 'asphalt_sma',
    family: 'surfacing',
    displayName: 'Stone mastic asphalt',
    layerVariants: ['wearing'],
  },
  {
    slug: 'asphalt_oga',
    family: 'surfacing',
    displayName: 'Open graded asphalt',
    layerVariants: ['wearing'],
  },
  {
    slug: 'asphalt_eme',
    family: 'surfacing',
    displayName: 'High-modulus asphalt (EME2)',
    layerVariants: ['intermediate'],
  },
  {
    slug: 'sprayed_seal',
    family: 'surfacing',
    displayName: 'Sprayed bituminous surfacing',
    layerVariants: ['seal', 'primerseal'],
  },
  {
    slug: 'prime_primerseal',
    family: 'surfacing',
    displayName: 'Prime & primerseal',
    layerVariants: ['prime'],
  },
  { slug: 'pipe_drainage', family: 'drainage', displayName: 'Pipe drainage (stormwater)' },
  { slug: 'drainage_pits', family: 'drainage', displayName: 'Pits & chambers' },
  { slug: 'culverts', family: 'drainage', displayName: 'Culverts (box/pipe)' },
  { slug: 'subsoil_drainage', family: 'drainage', displayName: 'Subsoil/subsurface drainage' },
  { slug: 'kerb_channel', family: 'drainage', displayName: 'Kerb & channel' },
  { slug: 'structural_concrete', family: 'structures', displayName: 'Structural concrete' },
  { slug: 'reinforcement', family: 'structures', displayName: 'Reinforcement placement' },
  {
    slug: 'piling',
    family: 'structures',
    displayName: 'Piling',
    layerVariants: ['bored', 'CFA', 'driven'],
  },
  { slug: 'structural_steelwork', family: 'structures', displayName: 'Structural steelwork' },
  { slug: 'bridge_bearings', family: 'structures', displayName: 'Bridge bearings' },
  { slug: 'precast_elements', family: 'structures', displayName: 'Precast concrete elements' },
  { slug: 'post_tensioning', family: 'structures', displayName: 'Post-tensioning' },
  {
    slug: 'reinforced_soil_walls',
    family: 'structures',
    displayName: 'Reinforced soil / MSE walls',
  },
  {
    slug: 'bridge_deck_waterproofing',
    family: 'structures',
    displayName: 'Bridge deck waterproofing',
  },
  { slug: 'wire_rope_barrier', family: 'road_furniture', displayName: 'Wire rope safety barrier' },
  { slug: 'w_beam_guardrail', family: 'road_furniture', displayName: 'W-beam guard fence' },
  {
    slug: 'concrete_barrier',
    family: 'road_furniture',
    displayName: 'Concrete road safety barrier',
  },
  { slug: 'pavement_marking', family: 'road_furniture', displayName: 'Pavement marking' },
  { slug: 'fencing_noise_walls', family: 'road_furniture', displayName: 'Fencing & noise walls' },
  {
    slug: 'erosion_sediment_control',
    family: 'environmental',
    displayName: 'Erosion & sediment control',
  },
  { slug: 'landscaping', family: 'environmental', displayName: 'Landscaping & revegetation' },
  {
    slug: 'footpaths_flatwork',
    family: 'concrete_flatwork',
    displayName: 'Footpaths & concrete flatwork',
  },
  {
    slug: 'water_reticulation',
    family: 'utilities',
    displayName: 'Water supply reticulation (WSA 03)',
  },
  {
    slug: 'sewer_reticulation',
    family: 'utilities',
    displayName: 'Sewer/pressure sewer (WSA 02/04/07)',
    layerVariants: ['gravity', 'pressure'],
  },
  { slug: 'conduit_trenching', family: 'utilities', displayName: 'Conduit & trenching' },
  // 'rail' family is deliberately parked (spec §1) — no selectable Level-2
  // activity ships in W2-PR1. See the module header.
] as const;

// ---------------------------------------------------------------------------
// Legacy value normalization (fold)
//
// Every value the 5 pre-Wave-2 vocabularies ever wrote maps somewhere:
//   - one-to-one legacy values → their slug, confidence 'exact'
//   - family-level legacy values (span >1 slug) → the family slug, 'family'
//   - retired/unclassifiable app values ('Concrete', 'General', 'Other') → 'none'
// Case matters for exactly one pair: seeder lowercase 'concrete' is structural
// concrete (austroads), while app Title-Case 'Concrete' is the retired material.
// So the lookup is case-sensitive first, then case-insensitive for everything
// whose lowercase form is unambiguous.
// ---------------------------------------------------------------------------

export type FoldConfidence = 'exact' | 'family' | 'none';

export interface FoldResult {
  slug: string;
  confidence: FoldConfidence;
}

const NONE: FoldResult = { slug: '', confidence: 'none' };

const LEGACY_FOLD: Record<string, FoldResult> = {
  // App-level Title-Case values (lot + template forms)
  Earthworks: { slug: 'earthworks_general', confidence: 'exact' },
  Landscaping: { slug: 'landscaping', confidence: 'exact' },
  Pavement: { slug: 'pavements', confidence: 'family' },
  Drainage: { slug: 'drainage', confidence: 'family' },
  Structures: { slug: 'structures', confidence: 'family' },
  Utilities: { slug: 'utilities', confidence: 'family' },
  Services: { slug: 'utilities', confidence: 'family' }, // synonym, collapse
  Rail: { slug: 'rail', confidence: 'family' },
  Concrete: NONE, // retired: a material, not an activity
  General: NONE,
  Other: NONE,
  // Seeder lowercase values
  earthworks: { slug: 'earthworks_general', confidence: 'exact' },
  landscaping: { slug: 'landscaping', confidence: 'exact' },
  asphalt_prep: { slug: 'prime_primerseal', confidence: 'exact' },
  concrete: { slug: 'structural_concrete', confidence: 'exact' }, // austroads seeder
  // Austroads bare 'pavement' spans BOTH the unbound-granular and the
  // cement-stabilised templates (see the seeder), so the value alone cannot
  // decide a Level-2 slug — family only. (The spec §1 line mapping it to
  // pavement_unbound predates the second template and is contradicted by the
  // seeder re-tag table.)
  pavement: { slug: 'pavements', confidence: 'family' },
  pavements: { slug: 'pavements', confidence: 'family' },
  drainage: { slug: 'drainage', confidence: 'family' },
  asphalt: { slug: 'surfacing', confidence: 'family' },
  structural: { slug: 'structures', confidence: 'family' },
  structures: { slug: 'structures', confidence: 'family' },
  environmental: { slug: 'environmental', confidence: 'family' },
  road_furniture: { slug: 'road_furniture', confidence: 'family' },
  rail: { slug: 'rail', confidence: 'family' },
};

const CANONICAL_SLUG_SET = new Set<string>(CANONICAL_ACTIVITIES.map((a) => a.slug));

// Case-insensitive legacy index. Keys whose lowercase form is claimed by two
// different results (only 'concrete'/'Concrete') resolve to null here and stay
// reachable solely through the case-sensitive lookup above.
const LEGACY_FOLD_CI: Map<string, FoldResult | null> = (() => {
  const map = new Map<string, FoldResult | null>();
  for (const [key, value] of Object.entries(LEGACY_FOLD)) {
    const lower = key.toLowerCase();
    const existing = map.get(lower);
    if (existing === undefined && !map.has(lower)) {
      map.set(lower, value);
    } else if (
      !existing ||
      existing.slug !== value.slug ||
      existing.confidence !== value.confidence
    ) {
      map.set(lower, null);
    }
  }
  return map;
})();

/**
 * Normalize any historical activity value to a canonical result. See the map
 * above for the rules. Whitespace- and (mostly) case-insensitive.
 */
export function foldActivityValue(raw: string | null | undefined): FoldResult {
  if (!raw) return NONE;
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) return NONE;
  const lower = cleaned.toLowerCase();
  if (CANONICAL_SLUG_SET.has(lower)) return { slug: lower, confidence: 'exact' };
  const exact = LEGACY_FOLD[cleaned];
  if (exact) return exact;
  const ci = LEGACY_FOLD_CI.get(lower);
  if (ci) return ci;
  return NONE;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isCanonicalActivitySlug(slug: string): boolean {
  return CANONICAL_SLUG_SET.has(slug);
}

/** Display name for a canonical slug; returns the input unchanged if unknown. */
export function activityDisplayName(slug: string): string {
  return CANONICAL_ACTIVITIES.find((a) => a.slug === slug)?.displayName ?? slug;
}

export interface ActivityFamilyGroup {
  slug: ActivityFamilySlug;
  displayName: string;
  activities: CanonicalActivity[];
}

/** Canonical activities grouped by family, in spec order — for grouped pickers. */
export function activitiesByFamily(): ActivityFamilyGroup[] {
  return ACTIVITY_FAMILIES.map((family) => ({
    slug: family.slug,
    displayName: family.displayName,
    activities: CANONICAL_ACTIVITIES.filter((a) => a.family === family.slug),
  }));
}

/**
 * User-facing label for a stored activity value: canonical slugs render as
 * their display name; legacy/free-text values pass through verbatim so existing
 * lots never show a blank or a lie.
 */
export function formatActivityLabel(value: string | null | undefined): string {
  if (!value) return '';
  return CANONICAL_ACTIVITIES.find((a) => a.slug === value)?.displayName ?? value;
}
