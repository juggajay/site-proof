#!/usr/bin/env tsx
// Dry run:  npm run db:backfill-hp-decision-rounds
// Apply:    npm run db:backfill-hp-decision-rounds -- --write
//           (with CONFIRM_HP_DECISION_ROUND_BACKFILL=<host>/<database>)
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

import { runHpDecisionRoundBackfill } from '../src/lib/hpDecisionRoundBackfill.js';
import { requireDatabaseTargetConfirmation } from './lib/database-target.js';
import { runScript } from './lib/run-script.js';

const prisma = new PrismaClient();

function sampleText(ids: string[]): string {
  return ids.length > 0 ? ids.join(', ') : '(none)';
}

async function main(): Promise<void> {
  const write = process.argv.slice(2).includes('--write');

  if (write) {
    requireDatabaseTargetConfirmation(
      'CONFIRM_HP_DECISION_ROUND_BACKFILL',
      'hold-point decision round backfill (additive round creation and authority-class repair)',
    );
  }

  console.log(`HP decision round backfill mode: ${write ? 'apply' : 'check'}`);
  const result = await runHpDecisionRoundBackfill(prisma, { write });

  for (const statusPlan of result.plan.statusPlans) {
    console.log(
      `[plan:${statusPlan.status}] ${statusPlan.count} ${statusPlan.action === 'backfill' ? 'to backfill' : 'skipped'}; sample HP ids=${sampleText(statusPlan.sampleHoldPointIds)}`,
    );
  }
  console.log(
    `[plan:authority-class] ${result.plan.classRemediationCount} to change; sample HP ids=${sampleText(result.plan.classRemediationSampleHoldPointIds)}`,
  );
  console.log(
    `[plan] ${result.plan.totalToBackfill} to backfill; live tokens to bind=${result.plan.liveTokenBindingCount}`,
  );

  if (write) {
    console.log(
      `[done] created=${result.created} authority classes changed=${result.classRemediated} tokens bound=${result.tokensBound} skipped=${result.skippedDuringApply}`,
    );
    return;
  }

  console.log('Dry run only. Re-run with --write and CONFIRM_HP_DECISION_ROUND_BACKFILL to apply.');
}

runScript(main, () => prisma.$disconnect());
