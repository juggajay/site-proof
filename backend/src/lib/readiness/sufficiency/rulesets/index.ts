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
import { VICROADS_204_V1 } from './vicroads-204.v1.js';
import { VICROADS_204_V2 } from './vicroads-204.v2.js';

/**
 * `[C1C-9]` **`tfnsw-r44.v1` is DEREGISTERED**, not deleted.
 *
 * `draft` means plausible-but-unconfirmed. It does NOT mean confirmed-wrong, and
 * we hold grade-A primary-source evidence that this pack is the latter:
 * `docs/research/c1-pack-confirmation-tfnsw-r44-2026-07-27.md` shows `n = 6` is
 * misattributed to R44 (which publishes no frequencies at all) and is wrong in
 * BOTH directions against Q6 Table Q6/L.1 — over-strict on a typical 3,000 m²
 * Selected Material Zone lot, under-strict at 102 % on a large one.
 *
 * Evaluating it, even tagged "unconfirmed edition", would put a known-wrong
 * requirement in front of NSW users: the exact confident-wrong-number defect
 * `[C1C-5]` and `[C1C-7]` exist to prevent. This supersedes §7.1 and §11's
 * "ships draft" FOR THIS PACK ONLY.
 *
 * The pack file and its tests stay — they pin the vocabulary and are the
 * starting point for the `tfnsw-q6.v1` re-author, which is blocked on a
 * lot-level *specified relative compaction* attribute (§16 D14).
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
export const SUFFICIENCY_RULESETS: readonly Ruleset[] = [VICROADS_204_V1, VICROADS_204_V2];
