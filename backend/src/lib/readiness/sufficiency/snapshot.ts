// Wave C1.2 — the `sufficiency` key every C1 decision snapshot carries
// (spec §5.4).
//
// AT `resultSchemaVersion: 1`, NOT 2 `[C1R-B3]`. The version integer is coupled
// to the requirement-set NAME (`requirements.test.ts` asserts
// `set.name.endsWith('.v' + set.version)`), so a bump would rewrite
// `lot_conformance.v1` -> `.v2` in the `requirement_set` column of a live
// IMMUTABLE table and split historical rows from new ones. Instead the key is
// OPTIONAL in the type and ALWAYS EMITTED by the builders: its absence is then
// exactly the pre-C1 discriminator the bump was going to provide, at zero DB
// cost. Rollback is "stop emitting it" — rows already written keep decoding,
// because the version never moved (§13).
//
// TWO shapes, and the split is the whole point `[C1R-B4]`:
//
//   * {@link SufficiencyAggregateV1} — FIXED WIDTH. No arrays, no ids, ~60
//     bytes whatever the rule count. This is what `claim_member` rows carry,
//     because `MEMBER_RESULT_MAX_BYTES` is 1 KB, today's worst case is 429
//     bytes, and `assertSnapshotSizes` THROWS 500 rather than truncating — so
//     an unbounded member payload would 500 an entire 5,000-member claim
//     create. §12 asserts this at 10,000 synthetic rules, not a realistic
//     count, because "realistic" is the wrong bound for that failure mode.
//   * {@link SufficiencySnapshotV1} — the aggregate PLUS the per-rule detail,
//     citations and regime basis. `lot_conformance` and `hold_point_release`
//     rows are single-entity and have the 64 KB budget, so they carry the lot.

import type { SufficiencyEvaluation } from './evaluate.js';
import type {
  FrequencyRegime,
  RuleCitation,
  RulesetStatus,
  SufficiencyMode,
  SufficiencyState,
  UnknownCause,
} from './types.js';

/**
 * FIXED WIDTH regardless of rule count (§5.4.3). Every field is a scalar; there
 * is no array and no id, so this cannot grow with `Ruleset.rules`.
 */
export type SufficiencyAggregateV1 = {
  /** Worst state across rules; `unknown` when nothing resolved. */
  state: SufficiencyState;
  /** How many rules were short. A COUNT — never the rule ids. */
  insufficientRules: number;
  /** `max(requiredCount - passingCount)` across short rules; 0 when none. */
  worstShortfall: number;
};

/**
 * {@link RuleCitation} as a MAPPED type, not the interface itself. An interface
 * gets no implicit index signature, so a payload embedding one is not assignable
 * to Prisma's `InputJsonValue` — the same reason every `*ResultV1` in
 * `requirements/` is a `type` alias rather than an `interface`.
 */
type CitationSnapshotV1 = { [K in keyof RuleCitation]: RuleCitation[K] };

/** One rule's verdict as persisted. Mutable arrays, so it assigns to `InputJsonValue`. */
export type SufficiencyRuleSnapshotV1 = {
  ruleId: string;
  testType: string;
  state: SufficiencyState;
  requiredCount: number | null;
  passingCount: number;
  pendingCount: number;
  failedCount: number;
  regime: FrequencyRegime | null;
  reducedFrequencyEligible?: boolean;
  regimeBasis?: { streamKey: string; lotIds: string[] };
  unknownCauses: UnknownCause[];
  citation: CitationSnapshotV1;
};

/**
 * The full block, for the two single-entity sets on the 64 KB budget.
 *
 * The fields past the aggregate are OPTIONAL because they are absent exactly
 * when sufficiency was not resolved on that path — a truthful "we did not
 * check", distinct from "we checked and found nothing".
 *
 * `ponytail:` `rules` is uncapped. At ~250 bytes a rule that is a ceiling of
 * roughly 250 rules against `RESULT_MAX_BYTES`; shipped packs carry one, and
 * rulesets are CODE reviewed in a PR diff, not tenant input. If a pack ever
 * approaches it, cap the array here and record the elided count — do not raise
 * the budget, because `assertSnapshotSizes` throwing is what keeps evidence
 * honest.
 */
export type SufficiencySnapshotV1 = SufficiencyAggregateV1 & {
  /** `Project.testSufficiencyMode` at decision time. */
  mode?: SufficiencyMode;
  /** True only at `mode: 'block'` on a CONFIRMED ruleset with a shortfall (§5.1.2). */
  blocks?: boolean;
  ruleset?: { id: string; status: RulesetStatus };
  /** Lot-level causes — set only when NO rule resolved (§7.1 rows 1-3). */
  unknownCauses?: UnknownCause[];
  rules?: SufficiencyRuleSnapshotV1[];
};

/** What every set emits when sufficiency was not resolved on that path. */
export const UNRESOLVED_SUFFICIENCY: SufficiencyAggregateV1 = {
  state: 'unknown',
  insufficientRules: 0,
  worstShortfall: 0,
};

export function buildSufficiencyAggregateV1(
  evaluation: SufficiencyEvaluation | null | undefined,
): SufficiencyAggregateV1 {
  if (!evaluation) return { ...UNRESOLVED_SUFFICIENCY };
  let insufficientRules = 0;
  let worstShortfall = 0;
  for (const rule of evaluation.rules) {
    if (rule.state !== 'insufficient' || rule.requiredCount === null) continue;
    insufficientRules += 1;
    worstShortfall = Math.max(worstShortfall, rule.requiredCount - rule.passingCount);
  }
  return { state: evaluation.state, insufficientRules, worstShortfall };
}

export function buildSufficiencySnapshotV1(
  evaluation: SufficiencyEvaluation | null | undefined,
): SufficiencySnapshotV1 {
  const aggregate = buildSufficiencyAggregateV1(evaluation);
  if (!evaluation) return aggregate;
  return {
    ...aggregate,
    mode: evaluation.mode,
    // D14.3: PICKED, not spread. `SufficiencyEvaluation.ruleset` gained
    // `scaleLabel` in D14.1 for the readiness prompts (§4.7), and spreading it
    // wrote that DISPLAY COPY into an immutable decision row it is not declared
    // on — invisible while every NSW project resolved no pack, and permanent the
    // moment one did. A snapshot records WHICH PACK GOVERNED and at what gate
    // strength; the word an authority uses for its scale is not decision
    // evidence, and freezing it would make a copy edit a schema change.
    ...(evaluation.ruleset
      ? { ruleset: { id: evaluation.ruleset.id, status: evaluation.ruleset.status } }
      : {}),
    blocks: evaluation.sufficiencyBlocks,
    unknownCauses: [...evaluation.unknownCauses],
    rules: evaluation.rules.map((rule) => ({
      ruleId: rule.ruleId,
      testType: rule.testType,
      state: rule.state,
      requiredCount: rule.requiredCount,
      passingCount: rule.passingCount,
      pendingCount: rule.pendingCount,
      failedCount: rule.failedCount,
      regime: rule.regime,
      ...(rule.reducedFrequencyEligible === undefined
        ? {}
        : { reducedFrequencyEligible: rule.reducedFrequencyEligible }),
      ...(rule.regimeBasis
        ? {
            regimeBasis: {
              streamKey: rule.regimeBasis.streamKey,
              lotIds: [...rule.regimeBasis.lotIds],
            },
          }
        : {}),
      unknownCauses: [...rule.unknownCauses],
      citation: rule.citation,
    })),
  };
}
