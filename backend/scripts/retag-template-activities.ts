#!/usr/bin/env tsx
import 'dotenv/config';

import { prisma } from '../src/lib/prisma.js';
import { computeRetagPlan } from '../src/lib/activityRetag.js';
import { resolveDatabaseTarget } from './lib/database-target.js';
import { runScript } from './lib/run-script.js';

// Operator-gated re-tag of existing ITPTemplate.activityType values onto the
// canonical Wave-2 taxonomy (W2-PR1). Deliberately conservative and dry-run by
// default: it only rewrites rows whose stored value folds to an EXACT canonical
// slug (e.g. 'earthworks' -> 'earthworks_general', 'concrete' -> structural_
// concrete, 'asphalt_prep' -> prime_primerseal). Family-level values
// ('drainage', 'structural', 'pavements', 'asphalt', 'road_furniture',
// 'environmental') and unclassifiable values are NEVER auto-rewritten — folding
// them needs the template name, which this script does not judge. Those are
// left for a name-driven pass / review. It never touches Lot.activityType.
//
// Usage (from backend/, with DATABASE_URL pointing at the target DB):
//   npm run retag:activities                # dry run — prints the plan, writes nothing
//   npm run retag:activities -- --execute   # applies the exact-fold rewrites

async function main(): Promise<void> {
  const execute = process.argv.slice(2).includes('--execute');
  const target = resolveDatabaseTarget(process.env); // throws if DATABASE_URL missing/invalid

  console.log(`ITPTemplate activity re-tag — target: ${target}`);
  console.log(`Mode: ${execute ? 'EXECUTE (writing)' : 'DRY RUN (no writes)'}\n`);

  const rows = await prisma.iTPTemplate.findMany({
    select: { id: true, name: true, projectId: true, activityType: true },
    orderBy: { name: 'asc' },
  });
  const plan = computeRetagPlan(rows);

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
    console.log('\nDry run only. Re-run with --execute to apply these exact-fold re-tags.');
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
