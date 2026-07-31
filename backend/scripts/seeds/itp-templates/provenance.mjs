/**
 * Wave G G2 (`docs/plans/wave-g-execution-spec-2026-07-31.md` §2.2(a)) — the
 * authority / spec-edition / issue-date metadata the seeders have always
 * asserted in their header comments and never persisted.
 *
 * **The one rule: NEVER FABRICATE.** Every `specEdition`, `specIssuedOn`,
 * `effectiveFrom` and `reviewDueOn` below is copied from the header comment of
 * the seeder file named in its `source` field, and each entry cites that file
 * and line. A template whose seeder header states no edition gets NO entry here
 * and persists nulls — a null edition is an honest "the file does not say", a
 * guessed one is a false provenance claim on a compliance record.
 *
 * G2 persists what the seeders assert and records where it came from. It does
 * **not** upgrade any claim's evidence grade: the edition strings were verified
 * against primary sources at seeding time, not re-verified here (spec §2.2(a)
 * `[VERIFY BEFORE BUILD]`). Revalidation stays with the evidence appendix.
 *
 * `authority` is the exception, and deliberately so: it is derived from
 * `stateSpec` through {@link AUTHORITY_BY_STATE_SPEC} rather than restated 152
 * times. The mapping is a naming fact (MRTS is TMR's specification series), not
 * a claim about any edition.
 */

/**
 * `ITPTemplate.stateSpec` -> the publishing authority.
 *
 * The eight values in the shipped library, counted across the seeders:
 * AUS-SPEC 1, Austroads 6, DIT 43, MRTS 45, MRWA 15, TfNSW 26, VicRoads 45,
 * WSA 2.
 */
export const AUTHORITY_BY_STATE_SPEC = {
  'AUS-SPEC': 'NATSPEC',
  Austroads: 'Austroads',
  DIT: 'DIT',
  MRTS: 'TMR',
  MRWA: 'MRWA',
  TfNSW: 'TfNSW',
  VicRoads: 'VicRoads',
  WSA: 'WSA',
};

/**
 * Per-template provenance, keyed `${stateSpec}::${name}` (template names repeat
 * across jurisdictions, so the key carries both).
 *
 * Shape — every field optional, omitted means null:
 *   specEdition   string, as published, never normalised ('04/10134', 'March 2025')
 *   specIssuedOn  'YYYY-MM-DD'
 *   effectiveFrom 'YYYY-MM-DD'
 *   reviewDueOn   'YYYY-MM-DD'
 *   changeSummary string
 *   annexureWarning boolean — §2.2(b), true when the named specification is one
 *                   that carries project-specific annexures
 *   source        'seed-itp-templates-x.js:LINE' — the header comment this came from
 */
export const TEMPLATE_PROVENANCE = {
  // --- WA / Main Roads WA -------------------------------------------------
  // MRWA is the only jurisdiction whose seeder headers state an edition number
  // AND an issue date for every specification, which makes all ten WA templates
  // fully attributed.
  'MRWA::Earthworks (MRWA Spec 302)': {
    specEdition: '04/10099-03',
    specIssuedOn: '2024-06-28',
    source: 'seed-itp-templates-wa-earthworks.js:5',
  },
  'MRWA::Crushed Rock Base Pavement (MRWA Spec 501)': {
    specEdition: '04/10110-05',
    specIssuedOn: '2023-05-10',
    source: 'seed-itp-templates-wa-pavements.js:6',
  },
  'MRWA::Concrete for Structures (MRWA Spec 820)': {
    specEdition: '04/10134',
    specIssuedOn: '2025-08-29',
    source: 'seed-itp-templates-wa-structures.js:7',
  },
  'MRWA::Steel Reinforcement (MRWA Spec 822)': {
    specEdition: '04/10136',
    specIssuedOn: '2023-06-21',
    source: 'seed-itp-templates-wa-structures.js:8',
  },
  'MRWA::Sub-Soil Drains (MRWA Spec 403)': {
    specEdition: '04/10103',
    specIssuedOn: '2021-11-16',
    source: 'seed-itp-templates-wa-drainage.js:6',
  },
  'MRWA::Culverts (MRWA Spec 404)': {
    specEdition: '05/6181-003',
    specIssuedOn: '2025-11-18',
    source: 'seed-itp-templates-wa-drainage.js:7',
  },
  'MRWA::Drainage Structures (MRWA Spec 405)': {
    specEdition: '04/10105',
    specIssuedOn: '2021-08-06',
    source: 'seed-itp-templates-wa-drainage.js:8',
  },
  'MRWA::Kerbing (MRWA Spec 407)': {
    specEdition: '05/2755',
    specIssuedOn: '2021-02-23',
    source: 'seed-itp-templates-wa-drainage.js:9',
  },
  // The Spec 503 header names Annexure 503C as a document the project supplies —
  // the one place in the library where a seeder comment states an annexure
  // dependency outright, so it is the only place §2.2(b)'s flag is set.
  'MRWA::Sprayed Bituminous Surfacing (MRWA Spec 503)': {
    specEdition: '04/10111',
    specIssuedOn: '2018-02-05',
    annexureWarning: true,
    source: 'seed-itp-templates-wa-surfacing.js:6,19',
  },
  'MRWA::Prime and Primerseal (MRWA Spec 503)': {
    specEdition: '04/10111',
    specIssuedOn: '2018-02-05',
    annexureWarning: true,
    source: 'seed-itp-templates-wa-surfacing.js:6,19',
  },

  // --- NSW / TfNSW ---------------------------------------------------------
  // Six of the seven NSW seeders name their specifications without an edition.
  // Only R44 carries one, and it is stated as an edition/revision pair rather
  // than a date — recorded verbatim, with no issue date invented for it.
  'TfNSW::Earthworks': {
    specEdition: 'Ed 6 / Rev 0',
    source: 'seed-itp-templates-nsw.js:19',
  },

  // --- QLD / TMR -----------------------------------------------------------
  // TMR headers state a month-and-year for the specification and nothing finer,
  // so the month goes in `specEdition` verbatim and `specIssuedOn` stays null.
  // A day would be a fabrication.
  'MRTS::Earthworks': {
    specEdition: 'March 2025',
    source: 'seed-itp-templates-qld-earthworks.js:8',
  },
  'MRTS::Concrete Pavement Base (QLD MRTS40)': {
    specEdition: 'May 2026',
    source: 'seed-itp-templates-qld-pavements.js:7',
  },

  // --- SA / DIT ------------------------------------------------------------
  // One DIT seeder states a document version and date; the other eight name
  // their specifications by code only.
  'DIT::Sprayed Bituminous Surfacing (DIT RD-BP-D2)': {
    specEdition: 'Document Version 1',
    specIssuedOn: '2024-09-30',
    source: 'seed-itp-templates-sa-seals.js:6',
  },
  'DIT::Prime and Initial Seal (DIT RD-BP-D2)': {
    specEdition: 'Document Version 1',
    specIssuedOn: '2024-09-30',
    source: 'seed-itp-templates-sa-seals.js:6',
  },

  // --- VIC / VicRoads ------------------------------------------------------
  // The asphalt header carries editions for two of its seven templates. The
  // other five, and every other VicRoads seeder, name a section number only.
  'VicRoads::Dense Graded Asphalt DGA (VIC)': {
    specEdition: 'v17',
    specIssuedOn: '2023-07-14',
    source: 'seed-itp-templates-vic-asphalt.js:19',
  },
  'VicRoads::Open Graded Asphalt OGA (VIC)': {
    specEdition: 'SS 417:6.0 Oct 2025',
    source: 'seed-itp-templates-vic-asphalt.js:5',
  },

  // --- National baselines --------------------------------------------------
  // AUS-SPEC 0282's header states a NATSPEC base and a council adoption
  // revision. The adoption revision is the dated one, so it is what lands.
  'AUS-SPEC::Concrete Flatwork — Footpaths and Cycleways (AUS-SPEC 0282)': {
    specEdition: 'NATSPEC base Oct 2020; MidCoast Council NSW adoption Rev 0',
    specIssuedOn: '2020-12-14',
    source: 'seed-itp-templates-national-flatwork.js:11',
  },
  // WSA 02/03 are PAYWALLED and deliberately not reproduced — the seeder's own
  // honesty model says acceptance numbers are agency-localised and every project
  // must apply its water agency's supplement. That is an annexure dependency in
  // all but name, and the header states it outright, so the flag is set with no
  // edition claimed for a document the seeder never read.
  'WSA::Water Supply Reticulation (WSA 03)': {
    annexureWarning: true,
    source: 'seed-itp-templates-national-utilities.js:12',
  },
  'WSA::Gravity Sewer Reticulation (WSA 02)': {
    annexureWarning: true,
    source: 'seed-itp-templates-national-utilities.js:12',
  },
};

/**
 * The provenance columns for one template. Unknown template -> authority only,
 * everything else null.
 */
export function provenanceFor(name, stateSpec) {
  const entry = TEMPLATE_PROVENANCE[`${stateSpec}::${name}`] ?? {};
  return {
    authority: AUTHORITY_BY_STATE_SPEC[stateSpec] ?? null,
    specEdition: entry.specEdition ?? null,
    specIssuedOn: toDate(entry.specIssuedOn),
    effectiveFrom: toDate(entry.effectiveFrom),
    reviewDueOn: toDate(entry.reviewDueOn),
    changeSummary: entry.changeSummary ?? null,
    annexureWarning: entry.annexureWarning ?? false,
  };
}

function toDate(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid provenance date "${value}" — expected YYYY-MM-DD.`);
  }
  return parsed;
}
