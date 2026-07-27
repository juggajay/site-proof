// Wave C1.2 test support — the `sufficiency` block a decision records on a
// project that resolves NO ruleset (spec §5.4.2).
//
// Which is every project without a shipped authority pack, and every fixture in
// the F0.4b decision suites: they are NSW/TfNSW, and `tfnsw-r44.v1` is
// DEREGISTERED `[C1C-9]`. So the decision still emits the key — that is the
// point of "always emitted", since its ABSENCE is what marks a pre-C1 row — and
// it says, honestly, "no ruleset governs this lot".
//
// Written out literally rather than derived from `buildSufficiencySnapshotV1`:
// a fixture built by the function under test asserts nothing about that
// function. One copy, so the F0.4b suites' `toEqual` assertions stay exhaustive
// (no key can appear unnoticed) without four copies of the same literal.

import type { SufficiencySnapshotV1 } from '../lib/readiness/sufficiency/snapshot.js';

export const NO_RULESET_SUFFICIENCY: SufficiencySnapshotV1 = {
  state: 'unknown',
  insufficientRules: 0,
  worstShortfall: 0,
  mode: 'warn',
  blocks: false,
  unknownCauses: ['no_ruleset_for_project'],
  rules: [],
};
