#!/usr/bin/env tsx
// Wave F1.1 — the READ-ONLY production test-type classifier (spec §7).
//
// Reports how much of the live test-type vocabulary the alias registry
// (`src/lib/readiness/sufficiency/testCategories.ts`) actually covers, so a
// reviewer can see that the shipped entries are the right entries and a future
// pack author can size their alias work in one command.
//
// READ-ONLY, and structurally so: it issues two `groupBy` reads and nothing
// else. There is no `--write`, no `--execute`, no update, no delete. Because it
// cannot write, `requireDatabaseTargetConfirmation` (which is invoked only under
// `--write` everywhere it is used) does not apply; instead the target
// host/dbname is PRINTED as the first line of output, so the operator and the PR
// reader both know which database the report describes [F1C-C3].
//
// Idempotent by construction — it is a SELECT.
//
// It logs values and row counts. It logs NO tenant identifiers, no lot ids and
// no project names: a test type is product vocabulary, not tenant content.
//
//   npm exec tsx scripts/classify-test-types.ts
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import {
  LAB_REFERENCE,
  classifyTestType,
} from '../src/lib/readiness/sufficiency/testCategories.js';
import { resolveDatabaseTarget } from './lib/database-target.js';
import { runScript } from './lib/run-script.js';

const prisma = new PrismaClient();

const UNKNOWN_SAMPLE_LIMIT = 30;

interface Row {
  value: string | null;
  rows: number;
}

/** One report bucket per resolution kind — `unknown` is the label a null resolution prints under. */
function verdictOf(value: string | null): string {
  const { resolution, conflict } = classifyTestType(value);
  if (conflict) return 'conflict';
  if (resolution === null) return 'unknown';
  if (resolution === LAB_REFERENCE) return 'lab_reference';
  return `category:${resolution}`;
}

function report(label: string, rows: readonly Row[]): void {
  const byVerdict = new Map<string, number>();
  let totalRows = 0;

  console.log(`\n=== ${label} — ${rows.length} distinct values ===`);
  for (const row of rows) {
    totalRows += row.rows;
    const verdict = verdictOf(row.value);
    byVerdict.set(verdict, (byVerdict.get(verdict) ?? 0) + row.rows);
    console.log(
      `  ${String(row.rows).padStart(7)}  ${verdict.padEnd(20)}  ${JSON.stringify(row.value)}`,
    );
  }

  const summary = [...byVerdict.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([verdict, count]) => `${verdict}=${count}`)
    .join(' ');
  console.log(`  summary (rows, total ${totalRows}): ${summary}`);

  const topUnknown = rows
    .filter((row) => verdictOf(row.value) === 'unknown')
    .sort((a, b) => b.rows - a.rows)
    .slice(0, UNKNOWN_SAMPLE_LIMIT);
  console.log(`  top ${topUnknown.length} unknown values by row count:`);
  for (const row of topUnknown) {
    console.log(`    ${String(row.rows).padStart(7)}  ${JSON.stringify(row.value)}`);
  }
}

async function main(): Promise<void> {
  console.log(`database target: ${resolveDatabaseTarget(process.env)}`);
  console.log('mode: READ-ONLY (two GROUP BY reads; this script has no write path)');

  const testResults = await prisma.testResult.groupBy({
    by: ['testType'],
    _count: { _all: true },
  });
  report(
    'test_results.test_type',
    testResults
      .map((row) => ({ value: row.testType, rows: row._count._all }))
      .sort((a, b) => b.rows - a.rows),
  );

  const checklistItems = await prisma.iTPChecklistItem.groupBy({
    by: ['testType'],
    _count: { _all: true },
  });
  report(
    'itp_checklist_items.test_type',
    checklistItems
      .map((row) => ({ value: row.testType, rows: row._count._all }))
      .sort((a, b) => b.rows - a.rows),
  );
}

runScript(main, async () => {
  await prisma.$disconnect();
});
