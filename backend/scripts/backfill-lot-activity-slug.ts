#!/usr/bin/env tsx
// Wave C1.1 — one-time backfill of `Lot.activitySlug` from `Lot.activityType`
// (spec §6). The fold lives in TypeScript (`activityTaxonomy.foldActivityValue`,
// many-to-one through LEGACY_FOLD and a CASE-INSENSITIVE LEGACY_FOLD_CI), so it
// cannot be expressed in SQL — hence a script rather than a data step inside the
// migration's `.sql`.
//
// IDEMPOTENT: it derives from `activityType`, which it never writes. Re-running
// after a mis-fold simply recomputes (§13 "Recovery from a mis-backfilled
// activitySlug"). Only rows whose current slug DISAGREES with the fold are
// written, so a second run updates nothing.
//
// Lots whose fold yields 'family' or 'none' keep NULL — they are not frequency-
// stream members (§16 D7), and a NULL inside another lot's lookback window makes
// that window incomplete rather than silently skipped.
//
// Dry run:  npm run db:backfill-activity-slug
// Apply:    npm run db:backfill-activity-slug -- --write   (with CONFIRM_ACTIVITY_SLUG_BACKFILL)
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { planActivitySlugBatch } from '../src/lib/activitySlugBackfill.js';
import { requireDatabaseTargetConfirmation } from './lib/database-target.js';
import { runScript } from './lib/run-script.js';

const prisma = new PrismaClient();

// Batched so a 5,000-lot project (the reference dataset, §12) completes inside
// the migration window without loading every lot at once.
const BATCH_SIZE = 1000;

async function main(): Promise<void> {
  const write = process.argv.slice(2).includes('--write');
  if (write) {
    requireDatabaseTargetConfirmation(
      'CONFIRM_ACTIVITY_SLUG_BACKFILL',
      'Lot.activitySlug backfill (additive classification; re-runnable)',
    );
  }

  console.log(`Lot.activitySlug backfill mode: ${write ? 'apply' : 'check'}`);
  const startedAt = Date.now();
  let cursor: string | undefined;
  let scanned = 0;
  let changed = 0;
  const byConfidence = new Map<string, number>();

  for (;;) {
    const lots = await prisma.lot.findMany({
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
      select: { id: true, activityType: true, activitySlug: true },
    });
    if (lots.length === 0) break;
    cursor = lots[lots.length - 1].id;
    scanned += lots.length;

    const plan = planActivitySlugBatch(lots, byConfidence);
    changed += plan.length;
    if (write) {
      for (const row of plan) {
        await prisma.lot.update({
          where: { id: row.id },
          data: { activitySlug: row.activitySlug },
        });
      }
    }
    console.log(`[progress] scanned=${scanned} changed=${changed}`);
  }

  const folds = [...byConfidence.entries()].map(([key, count]) => `${key}=${count}`).join(', ');
  console.log(
    `[done] scanned=${scanned} ${write ? 'updated' : 'would update'}=${changed} folds: ${folds || 'none'} in ${Date.now() - startedAt}ms`,
  );
  if (!write) {
    console.log('Dry run only. Re-run with --write and CONFIRM_ACTIVITY_SLUG_BACKFILL to apply.');
  }
}

runScript(main, () => prisma.$disconnect());
