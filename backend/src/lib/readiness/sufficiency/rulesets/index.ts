// The shipped sufficiency ruleset registry contents.
//
// EXPLICIT STATIC IMPORTS, deliberately NOT a dynamic manifest (spec §3.1
// layout note) — unlike the ITP template seeders, which are loaded dynamically
// through `backend/scripts/seeds/itp-templates/index.mjs` and are therefore
// declared `dynamicallyLoaded` in `.fallowrc.json`. A static list means the
// packs are type-checked, tree-shakeable and visible to fallow as real edges.
//
// NO TMR / DIT SA / MRWA pack, and no numbers from them: they are on the
// research appendix's standing never-assert list (§8.2).

import type { Ruleset } from '../types.js';
import { TFNSW_Q6_V1 } from './tfnsw-q6.v1.js';
import { VICROADS_204_V2 } from './vicroads-204.v2.js';

/**
 * D14.3 §5.5 — **`tfnsw-r44.v1` is DELETED**, superseding `[C1C-9]`'s
 * deregistration.
 *
 * It was kept, deregistered, for one stated job: *"they pin the vocabulary and
 * are the starting point for `tfnsw-q6.v1`"*. That job is finished the moment
 * `tfnsw-q6.v1` exists. Keeping a second, CONFIRMED-WRONG NSW pack in the tree
 * is a trap for the next agent — its `minCount: 6` is one cell of Q6 Table
 * Q6/L.1 misattributed to a document that publishes no frequencies at all. Git
 * history and `docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md`
 * preserve it; `tfnsw-q6.v1.ts`'s header carries its findings forward.
 */
/**
 * External review 2026-07-28 §4b — **`vicroads-204.v1` is DELETED**, superseding
 * D14.2 §6.5's "stays registered, frozen and `effectiveTo`-closed".
 *
 * §6.5 kept it for one stated job: C1.2 (#1594) writes `rules[].ruleId` into the
 * immutable `RequirementEvaluation` table, so `vicroads-204.v1/compaction-density`
 * had to keep resolving to the definition it was decided under. The review
 * verified that job is not being done and cannot be: `RequirementEvaluation` has
 * ZERO rows (`READINESS_SNAPSHOTS_ENABLED` is off), and nothing anywhere resolves
 * a `ruleId` back to a pack — the only two readers of this array are
 * `effectiveRulesets` and `resolveRuleset`, and BOTH filter the effective window,
 * which `.v1`'s `effectiveTo: '2026-07-27'` has been outside since that date. No
 * production caller passes a historical `at`, so the file was unreachable code
 * carrying a CONFIRMED grade-A provenance nobody could reach.
 *
 * Same treatment the tree already gave `tfnsw-r44.v1` (D14.3 §5.5). Git history
 * and `docs/research/c1-pack-confirmation-vicroads-204-2026-07-27.md` preserve
 * it, and `vicroads-204.v2.ts`'s header already carried every one of its findings
 * forward verbatim — including the Wyndham contamination, the reduced-figures
 * trap and the Scale A/B material-property ceiling.
 *
 * The day a pack revision genuinely needs its predecessor kept, the trigger is a
 * NON-EMPTY `RequirementEvaluation`, not the mere existence of the snapshot code.
 */
export const SUFFICIENCY_RULESETS: readonly Ruleset[] = [VICROADS_204_V2, TFNSW_Q6_V1];
