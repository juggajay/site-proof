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
import { TFNSW_R44_V1 } from './tfnsw-r44.v1.js';
import { VICROADS_204_V1 } from './vicroads-204.v1.js';

export const SUFFICIENCY_RULESETS: readonly Ruleset[] = [VICROADS_204_V1, TFNSW_R44_V1];
