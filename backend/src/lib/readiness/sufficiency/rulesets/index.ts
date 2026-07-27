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
import { VICROADS_204_V1 } from './vicroads-204.v1.js';
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
 * D14.2 §6.5 — `vicroads-204.v1` stays REGISTERED, not deleted, and is closed
 * with `effectiveTo`.
 *
 * C1.2 (#1594) writes `rules[].ruleId` into the immutable `RequirementEvaluation`
 * table, so `vicroads-204.v1/compaction-density` is referenced by decision
 * evidence that must keep resolving to the definition it was decided under. The
 * pack revision is therefore a NEW FILE, not an edit; `resolveRuleset` picks the
 * newest effective one, so every live VIC project reads `.v2` from 2026-07-27
 * and nothing reads `.v1` again. Both are still validated by CI.
 *
 * Two ids, ONE authority. This is not "two VIC packs" in the shadowing sense the
 * spec warns about for NSW — the date windows abut, so exactly one is live at
 * any instant.
 */
export const SUFFICIENCY_RULESETS: readonly Ruleset[] = [
  VICROADS_204_V1,
  VICROADS_204_V2,
  TFNSW_Q6_V1,
];
