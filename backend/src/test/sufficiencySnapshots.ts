// Wave C1.2 test support — the `sufficiency` block a decision records for the
// F0.4b decision suites' fixture lots (spec §5.4.2).
//
// D14.3 CHANGED WHAT THIS IS. Those fixtures are NSW/TfNSW, and until this phase
// no NSW pack was registered (`tfnsw-r44.v1` was deregistered `[C1C-9]`), so the
// honest recorded answer was "no ruleset governs this lot". `tfnsw-q6.v1` now
// resolves for every NSW/TfNSW project, so the recorded answer moves one step
// down §7.1: a ruleset IS governing, and the lot's own activity does not fold to
// a canonical Level-2 slug, so no RULE matches and the cause is
// `activity_not_canonical`. Still `unknown`, still non-blocking, still no rules —
// what changed is that the snapshot now names the pack that was in force, which
// is the point of recording it.
//
// Written out literally rather than derived from `buildSufficiencySnapshotV1`:
// a fixture built by the function under test asserts nothing about that
// function. One copy, so the F0.4b suites' `toEqual` assertions stay exhaustive
// (no key can appear unnoticed) without four copies of the same literal.

import type { SufficiencySnapshotV1 } from '../lib/readiness/sufficiency/snapshot.js';

export const NSW_UNCLASSIFIED_SUFFICIENCY: SufficiencySnapshotV1 = {
  state: 'unknown',
  insufficientRules: 0,
  worstShortfall: 0,
  mode: 'warn',
  blocks: false,
  // Exactly the two declared keys. `SufficiencyEvaluation.ruleset` also carries
  // `scaleLabel` for the readiness prompts, and the snapshot builder deliberately
  // does NOT record it — display copy is not decision evidence (see `snapshot.ts`).
  ruleset: { id: 'tfnsw-q6.v1', status: 'confirmed' },
  unknownCauses: ['activity_not_canonical'],
  rules: [],
};
