// Seed pack — TfNSW R44 (Earthworks), version 1. Spec §8.2, §8.1.
//
// STATUS: `draft`, and PERMANENTLY UNCONFIRMABLE until the research appendix's
// §H item 5 resolves the TfNSW standards-portal ANNOTATION RECORD to the current
// R44 document page and a human reads it [C1R-B11].
//
// EVIDENCE GRADE 'C', not 'A'. The appendix's grade for this row is verbatim
// "A (portal) / C (aetg)": the A attaches to the portal annotation record (which
// the appendix itself flags must be resolved to a real document page), and the
// NUMBERS come from the C-graded secondary page. §3.2's encoding rule is that a
// SPLIT grade is encoded at its WEAKEST limb — the grade of the source the
// numbers came from. Under §8.3's CI rule (`evidenceGrade === 'A'` required for
// `confirmed`) that makes this pack draft-forever, therefore non-blocking
// forever (§5.1.2), until §H item 5 lands. That is the correct outcome and it is
// claimed here rather than obscured.
//
// SCOPE: the n = 6 minimum SAMPLE COUNT only. No Characteristic Density Ratio
// (§16 D8) — CDR with k-values is a statistic over result VALUES, not a count of
// them, and needs C3's LIMS-grade data. A half-implemented statistical
// acceptance test produces confident wrong compliance answers.
//
// `specSet: 'tfnsw'` is the POST-normalization value: `normalizeSpecSet` folds
// the pre-2019 name 'rms' → 'tfnsw' (`itpMatcher.ts:74-76`), so the 9 live
// projects still carrying 'rms' resolve this pack.
//
// R44's count carries no scale dimension, so the ruleset declares a single scale
// key and defaults to it — a defensible default under §16 D6, which means these
// lots evaluate with no data entry at all.

import type { FrequencyRule, RulesetProvenance, Ruleset } from '../types.js';

const RULESET_ID = 'tfnsw-r44.v1';

const PROVENANCE: RulesetProvenance = {
  authority: 'TfNSW',
  document: 'R44 — Earthworks',
  // The clause is NOT pinned: the appendix's source is a portal annotation
  // record, not a clause of the published specification.
  clause: 'R44 (clause unpinned — appendix §H item 5)',
  edition: '',
  sourceUrl: '',
  evidenceGrade: 'C',
  checkedOn: '',
  revalidateBy: '',
};

const DENSITY_SAMPLE_COUNT: FrequencyRule = {
  id: `${RULESET_ID}/density-sample-count`,
  label: 'Minimum density test samples per lot',
  testType: 'compaction',
  appliesTo: {
    activitySlugs: ['earthworks_general', 'earthworks_subgrade_prep'],
  },
  minCountByScale: { standard: 6 },
  provenance: PROVENANCE,
};

export const TFNSW_R44_V1: Ruleset = {
  id: RULESET_ID,
  state: 'nsw',
  specSet: 'tfnsw',
  scaleKeys: ['standard'],
  defaultScale: 'standard',
  effectiveFrom: '2015-01-01',
  status: 'draft',
  rules: [DENSITY_SAMPLE_COUNT],
  provenance: PROVENANCE,
};
