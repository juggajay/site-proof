#!/usr/bin/env tsx
import 'dotenv/config';

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prisma } from '../src/lib/prisma.js';
import {
  buildSeederNameMap,
  computeRetagPlan,
  computeSeededRetagPlan,
  extractSeederTemplateTags,
} from '../src/lib/activityRetag.js';
import { resolveDatabaseTarget } from './lib/database-target.js';
import { runScript } from './lib/run-script.js';

// Operator-gated re-tag of existing ITPTemplate.activityType values onto the
// canonical Wave-2 taxonomy (W2-PR1). Deliberately conservative and dry-run by
// default: it only rewrites rows whose stored value folds to an EXACT canonical
// slug (e.g. 'earthworks' -> 'earthworks_general', 'concrete' -> structural_
// concrete, 'asphalt_prep' -> prime_primerseal). Family-level values
// ('drainage', 'structural', 'pavements', bare 'pavement', 'asphalt',
// 'road_furniture', 'environmental') and unclassifiable values are NEVER
// auto-rewritten — folding
// them needs the template name, which this script does not judge. Those are
// left for a name-driven pass / review. It never touches Lot.activityType.
//
// The --seeded mode covers what value-folding can't: seeded GLOBAL rows whose
// family-level value ('drainage' spans four slugs) is decided by their NAME —
// each seeder template name maps to exactly one canonical slug in its seeder
// file (re-tagged in #1496). Seeder files are parsed as text; running them
// would seed. Global rows only; rows already carrying a canonical slug are
// left alone.
//
// Usage (from backend/, with DATABASE_URL pointing at the target DB):
//   npm run retag:activities                     # dry run — prints the plan, writes nothing
//   npm run retag:activities -- --execute        # applies the exact-fold rewrites
//   npm run retag:activities -- --seeded         # dry run of the name-driven seeded pass
//   npm run retag:activities -- --seeded --execute

const SEEDERS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'seeds', 'itp-templates');

function loadSeederNameMap(): Map<string, string> {
  const files = readdirSync(SEEDERS_DIR).filter(
    (f) => f.startsWith('seed-itp-templates') && f.endsWith('.js'),
  );
  const tagsByFile = files.map((file) =>
    extractSeederTemplateTags(readFileSync(join(SEEDERS_DIR, file), 'utf8'), file),
  );
  return buildSeederNameMap(tagsByFile);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const seeded = args.includes('--seeded');
  const target = resolveDatabaseTarget(process.env); // throws if DATABASE_URL missing/invalid

  console.log(`ITPTemplate activity re-tag — target: ${target}`);
  console.log(`Pass: ${seeded ? 'SEEDED (name-driven, global rows)' : 'exact value folds'}`);
  console.log(`Mode: ${execute ? 'EXECUTE (writing)' : 'DRY RUN (no writes)'}\n`);

  const rows = await prisma.iTPTemplate.findMany({
    select: { id: true, name: true, projectId: true, activityType: true },
    orderBy: { name: 'asc' },
  });
  let plan;
  if (seeded) {
    const nameMap = loadSeederNameMap();
    console.log(`Seeder name map: ${nameMap.size} template names.\n`);
    plan = computeSeededRetagPlan(rows, nameMap);
  } else {
    plan = computeRetagPlan(rows);
  }

  if (plan.actions.length === 0) {
    console.log(`No exact-fold re-tags to apply. Scanned ${rows.length}, skipped ${plan.skipped}.`);
    return;
  }

  for (const a of plan.actions) {
    const scope = a.projectId ? `project:${a.projectId}` : 'global';
    console.log(`${a.id} | ${scope} | ${a.name} | ${a.from} -> ${a.to}`);
  }
  console.log(
    `\n${plan.actions.length} row(s) to re-tag · ${plan.skipped} left untouched (family/none/already-canonical).`,
  );

  if (!execute) {
    console.log('\nDry run only. Re-run with --execute to apply these re-tags.');
    return;
  }

  let updated = 0;
  for (const a of plan.actions) {
    // Guard on the old value so a concurrent change is never clobbered.
    const res = await prisma.iTPTemplate.updateMany({
      where: { id: a.id, activityType: a.from },
      data: { activityType: a.to },
    });
    updated += res.count;
  }
  console.log(`\nApplied ${updated} re-tag(s).`);
}

runScript(main, () => prisma.$disconnect());
