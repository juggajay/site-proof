#!/usr/bin/env tsx
// Dry run:  npm run db:backfill-lot-status-events
// Apply:    npm run db:backfill-lot-status-events -- --write
//           (with CONFIRM_LOT_STATUS_EVENT_BACKFILL=<host>/<database>)
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

import { runLotStatusEventBackfill } from '../src/lib/lotStatusEventBackfill.js';
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
      'CONFIRM_LOT_STATUS_EVENT_BACKFILL',
      'lot status event ledger backfill (additive event creation from audit rows)',
    );
  }

  console.log(`Lot status event backfill mode: ${write ? 'apply' : 'check'}`);
  const result = await runLotStatusEventBackfill(prisma, { write });

  console.log(`[plan] audit rows scanned=${result.plan.auditRowsScanned}`);
  console.log(`[plan] events derivable=${result.plan.eventsDerivable}`);
  console.log(`[plan] already present=${result.plan.alreadyPresent}`);
  console.log(`[plan] missing-lot skips=${result.plan.missingLotSkips}`);
  console.log(
    `[plan] ${result.plan.toCreate} to create; sample lot ids=${sampleText(result.plan.sampleLotIds)}`,
  );

  if (write) {
    console.log(`[done] created=${result.created} skipped=${result.skippedDuringApply}`);
    return;
  }

  console.log('Dry run only. Re-run with --write and CONFIRM_LOT_STATUS_EVENT_BACKFILL to apply.');
}

runScript(main, () => prisma.$disconnect());
