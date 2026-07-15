import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_FAMILIES,
  CANONICAL_ACTIVITIES,
  activitiesByFamily,
  activityDisplayName,
  foldActivityValue,
  formatActivityLabel,
  isCanonicalActivitySlug,
} from './activityTaxonomy';

// ---------------------------------------------------------------------------
// PINNED EQUALITY — this literal list is duplicated verbatim in the frontend
// mirror's test. Either module drifting from these arrays breaks CI on that
// side. Update both sides (and the spec) together, on purpose.
// ---------------------------------------------------------------------------

const PINNED_FAMILY_SLUGS = [
  'earthworks',
  'pavements',
  'surfacing',
  'drainage',
  'structures',
  'road_furniture',
  'environmental',
  'concrete_flatwork',
  'utilities',
  'rail',
];

const PINNED_SLUGS = [
  'earthworks_general',
  'earthworks_subgrade_prep',
  'geosynthetics',
  'pavement_unbound',
  'pavement_bound',
  'pavement_concrete',
  'pavement_stabilisation',
  'asphalt_dga',
  'asphalt_sma',
  'asphalt_oga',
  'asphalt_eme',
  'sprayed_seal',
  'prime_primerseal',
  'pipe_drainage',
  'drainage_pits',
  'culverts',
  'subsoil_drainage',
  'kerb_channel',
  'structural_concrete',
  'reinforcement',
  'piling',
  'structural_steelwork',
  'bridge_bearings',
  'precast_elements',
  'post_tensioning',
  'reinforced_soil_walls',
  'bridge_deck_waterproofing',
  'wire_rope_barrier',
  'w_beam_guardrail',
  'concrete_barrier',
  'pavement_marking',
  'fencing_noise_walls',
  'erosion_sediment_control',
  'landscaping',
  'footpaths_flatwork',
  'water_reticulation',
  'sewer_reticulation',
  'conduit_trenching',
];

const PINNED_DISPLAY_NAMES = [
  'Earthworks (general)',
  'Subgrade preparation',
  'Geosynthetics',
  'Unbound granular pavement',
  'Bound/stabilised pavement',
  'Concrete pavement',
  'In-situ stabilisation',
  'Dense graded asphalt',
  'Stone mastic asphalt',
  'Open graded asphalt',
  'High-modulus asphalt (EME2)',
  'Sprayed bituminous surfacing',
  'Prime & primerseal',
  'Pipe drainage (stormwater)',
  'Pits & chambers',
  'Culverts (box/pipe)',
  'Subsoil/subsurface drainage',
  'Kerb & channel',
  'Structural concrete',
  'Reinforcement placement',
  'Piling',
  'Structural steelwork',
  'Bridge bearings',
  'Precast concrete elements',
  'Post-tensioning',
  'Reinforced soil / MSE walls',
  'Bridge deck waterproofing',
  'Wire rope safety barrier',
  'W-beam guard fence',
  'Concrete road safety barrier',
  'Pavement marking',
  'Fencing & noise walls',
  'Erosion & sediment control',
  'Landscaping & revegetation',
  'Footpaths & concrete flatwork',
  'Water supply reticulation (WSA 03)',
  'Sewer/pressure sewer (WSA 02/04/07)',
  'Conduit & trenching',
];

describe('activity taxonomy — pinned equality', () => {
  it('has the exact 10 families in spec order', () => {
    expect(ACTIVITY_FAMILIES.map((f) => f.slug)).toEqual(PINNED_FAMILY_SLUGS);
  });

  it('has the exact 38 activity slugs in spec order', () => {
    expect(CANONICAL_ACTIVITIES.map((a) => a.slug)).toEqual(PINNED_SLUGS);
  });

  it('has the exact 38 display names in spec order', () => {
    expect(CANONICAL_ACTIVITIES.map((a) => a.displayName)).toEqual(PINNED_DISPLAY_NAMES);
  });

  it('assigns every activity to one of the 10 families', () => {
    for (const activity of CANONICAL_ACTIVITIES) {
      expect(PINNED_FAMILY_SLUGS).toContain(activity.family);
    }
  });

  it('has unique slugs', () => {
    expect(new Set(PINNED_SLUGS).size).toBe(PINNED_SLUGS.length);
  });
});

// ---------------------------------------------------------------------------
// FOLD — exhaustive over every legacy value in spec §1's mapping table.
// ---------------------------------------------------------------------------

describe('foldActivityValue — exact one-to-one legacy values', () => {
  const exact: [string, string][] = [
    ['Earthworks', 'earthworks_general'],
    ['earthworks', 'earthworks_general'],
    ['Landscaping', 'landscaping'],
    ['landscaping', 'landscaping'],
    ['asphalt_prep', 'prime_primerseal'],
    ['pavement_unbound', 'pavement_unbound'],
    ['pavement_bound', 'pavement_bound'],
    ['pavement_concrete', 'pavement_concrete'],
    ['concrete', 'structural_concrete'], // austroads seeder (lowercase)
    ['pavement', 'pavement_unbound'], // austroads bare
  ];
  it.each(exact)('%s → %s (exact)', (raw, slug) => {
    expect(foldActivityValue(raw)).toEqual({ slug, confidence: 'exact' });
  });
});

describe('foldActivityValue — family-level legacy values', () => {
  const family: [string, string][] = [
    ['Pavement', 'pavements'],
    ['pavements', 'pavements'],
    ['Drainage', 'drainage'],
    ['drainage', 'drainage'],
    ['Structures', 'structures'],
    ['structures', 'structures'],
    ['structural', 'structures'],
    ['asphalt', 'surfacing'],
    ['environmental', 'environmental'],
    ['road_furniture', 'road_furniture'],
    ['Utilities', 'utilities'],
    ['Services', 'utilities'],
    ['Rail', 'rail'],
    ['rail', 'rail'],
  ];
  it.each(family)('%s → %s (family)', (raw, slug) => {
    expect(foldActivityValue(raw)).toEqual({ slug, confidence: 'family' });
  });
});

describe('foldActivityValue — retired / unclassifiable', () => {
  const none = ['Concrete', 'General', 'Other', '', '   ', 'totally unknown junk'];
  it.each(none)('%s → none', (raw) => {
    expect(foldActivityValue(raw)).toEqual({ slug: '', confidence: 'none' });
  });

  it('treats null/undefined as none', () => {
    expect(foldActivityValue(null)).toEqual({ slug: '', confidence: 'none' });
    expect(foldActivityValue(undefined)).toEqual({ slug: '', confidence: 'none' });
  });

  it('keeps retired app-level "Concrete" (material) distinct from seeder "concrete" (structural)', () => {
    expect(foldActivityValue('Concrete').confidence).toBe('none');
    expect(foldActivityValue('concrete')).toEqual({
      slug: 'structural_concrete',
      confidence: 'exact',
    });
  });
});

describe('foldActivityValue — every canonical slug folds to itself', () => {
  it.each(PINNED_SLUGS)('%s → %s (exact)', (slug) => {
    expect(foldActivityValue(slug)).toEqual({ slug, confidence: 'exact' });
  });
});

describe('foldActivityValue — whitespace and case tolerance', () => {
  it('trims and collapses whitespace', () => {
    expect(foldActivityValue('  Earthworks  ')).toEqual({
      slug: 'earthworks_general',
      confidence: 'exact',
    });
  });

  it('is case-insensitive for unambiguous values', () => {
    expect(foldActivityValue('EARTHWORKS')).toEqual({
      slug: 'earthworks_general',
      confidence: 'exact',
    });
    expect(foldActivityValue('PAVEMENT_UNBOUND')).toEqual({
      slug: 'pavement_unbound',
      confidence: 'exact',
    });
  });
});

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

describe('taxonomy helpers', () => {
  it('isCanonicalActivitySlug distinguishes slugs from families and legacy', () => {
    expect(isCanonicalActivitySlug('culverts')).toBe(true);
    expect(isCanonicalActivitySlug('pavements')).toBe(false); // family, not a slug
    expect(isCanonicalActivitySlug('Pavement')).toBe(false); // legacy
  });

  it('activityDisplayName maps slugs and passes unknowns through', () => {
    expect(activityDisplayName('culverts')).toBe('Culverts (box/pipe)');
    expect(activityDisplayName('Earthworks')).toBe('Earthworks');
  });

  it('activitiesByFamily groups all 38 in family order', () => {
    const groups = activitiesByFamily();
    expect(groups.map((g) => g.slug)).toEqual(PINNED_FAMILY_SLUGS);
    expect(groups.reduce((n, g) => n + g.activities.length, 0)).toBe(PINNED_SLUGS.length);
    expect(groups.find((g) => g.slug === 'drainage')?.activities.length).toBe(5);
    // rail family is parked — present as a group, but no selectable activity.
    expect(groups.find((g) => g.slug === 'rail')?.activities.length).toBe(0);
  });

  it('formatActivityLabel renders slugs and keeps legacy verbatim', () => {
    expect(formatActivityLabel('culverts')).toBe('Culverts (box/pipe)');
    expect(formatActivityLabel('Earthworks')).toBe('Earthworks');
    expect(formatActivityLabel('')).toBe('');
    expect(formatActivityLabel(null)).toBe('');
  });
});
