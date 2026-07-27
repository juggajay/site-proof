#!/usr/bin/env tsx
// Wave C2 Phase 3 — one-time backfill of `TestResult.sentToLabAt` from the
// TEST_RESULT_STATUS_CHANGED audit stream (spec §4.2).
//
// IDEMPOTENT: only rows with `sentToLabAt IS NULL` are written, and the source
// (the audit log) is never mutated. Re-running writes nothing the second time.
//
// EXPECT IT TO FIND NOTHING. `at_lab` was unreachable from every UI until Wave
// C2 Phase 2, so there is essentially no history to recover. See the honesty note
// in src/lib/sentToLabBackfill.ts. It exists so the audit stream is a working
// recovery path from here on, not because there is a backlog.
//
// Dry run:  npm run db:backfill-sent-to-lab
// Apply:    npm run db:backfill-sent-to-lab -- --write   (with CONFIRM_SENT_TO_LAB_BACKFILL)
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { AuditAction } from '../src/lib/auditLog.js';
import { planSentToLabBackfill } from '../src/lib/sentToLabBackfill.js';
import { requireDatabaseTargetConfirmation } from './lib/database-target.js';
import { runScript } from './lib/run-script.js';

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const projectArg = argv.find((arg) => arg.startsWith('--project='));
  return {
    write: argv.includes('--write'),
    projectId: projectArg?.slice('--project='.length) || undefined,
  };
}

async function main(): Promise<void> {
  const { write, projectId } = parseArgs(process.argv.slice(2));

  if (write) {
    requireDatabaseTargetConfirmation(
      'CONFIRM_SENT_TO_LAB_BACKFILL',
      'TestResult.sentToLabAt backfill (additive; only fills NULLs)',
    );
  }

  console.log(
    `sentToLabAt backfill mode: ${write ? 'apply' : 'check'}, project: ${projectId ?? 'all'}`,
  );

  const auditRows = await prisma.auditLog.findMany({
    where: {
      entityType: 'test_result',
      action: AuditAction.TEST_RESULT_STATUS_CHANGED,
      ...(projectId ? { projectId } : {}),
    },
    select: { entityId: true, changes: true, createdAt: true },
  });

  const plan = planSentToLabBackfill(auditRows);

  // Only rows that are still NULL are candidates — that is what makes a re-run a
  // no-op rather than a clock reset.
  const candidates = await prisma.testResult.findMany({
    where: { id: { in: [...plan.keys()] }, sentToLabAt: null },
    select: { id: true },
  });

  console.log(
    `[scan] audit rows=${auditRows.length} at_lab transitions=${plan.size} fillable=${candidates.length}`,
  );

  if (write) {
    for (const { id } of candidates) {
      await prisma.testResult.update({ where: { id }, data: { sentToLabAt: plan.get(id) } });
    }
    console.log(`[done] updated=${candidates.length}`);
    return;
  }

  console.log(`[done] would update=${candidates.length}`);
  console.log('Dry run only. Re-run with --write and CONFIRM_SENT_TO_LAB_BACKFILL to apply.');
}

runScript(main, () => prisma.$disconnect());
