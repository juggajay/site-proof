#!/usr/bin/env tsx
// Wave G G2 §2.2(d) — one-time backfill of `ITPInstance.templateSnapshot` for
// instances created before the snapshot shipped.
//
// WHY a script and not a migration: the snapshot is built by
// `buildTemplateSnapshot`, which lives in TypeScript and orders items by
// sequence number, so it cannot be expressed in the migration's `.sql`. Same
// reasoning as `backfill-lot-activity-slug.ts`.
//
// WHAT IT CLOSES: `getChecklistItemsForInstance` returns `instance.template
// ?.checklistItems ?? []` whenever `templateSnapshot` is null, so a pre-snapshot
// instance silently reads the CURRENT template — a historical-integrity hole,
// not a stability guarantee (spec §0.2 Finding 2).
//
// TWO RULES THIS SCRIPT WILL NOT BEND:
//
//  1. **It selects on `templateSnapshot IS NULL` only.** A stored snapshot that
//     fails to parse — corrupt JSON, or `checklistItems` not an array — reaches
//     the live-template fallback by a DIFFERENT route, and overwriting it would
//     destroy whatever evidence the malformed bytes still hold. Those rows are
//     left for a human and reported separately. [GR-A4]
//  2. **Every row it writes is stamped `backfilledAt`**, so a reconstructed
//     snapshot is never mistaken for a genuine assignment-time capture. An
//     instance whose template has since been DELETED is left null and renders
//     "template no longer available" rather than a fabricated snapshot.
//
// Dry run:  npm run db:backfill-itp-snapshots
// Apply:    npm run db:backfill-itp-snapshots -- --write   (with CONFIRM_ITP_SNAPSHOT_BACKFILL)
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import {
  buildTemplateSnapshot,
  parseTemplateSnapshot,
} from '../src/routes/itp/helpers/templateSnapshot.js';
import { requireDatabaseTargetConfirmation } from './lib/database-target.js';
import { runScript } from './lib/run-script.js';

const prisma = new PrismaClient();

const BATCH_SIZE = 500;

async function main(): Promise<void> {
  const write = process.argv.slice(2).includes('--write');
  if (write) {
    requireDatabaseTargetConfirmation(
      'CONFIRM_ITP_SNAPSHOT_BACKFILL',
      'ITPInstance.templateSnapshot backfill (additive; null snapshots only)',
    );
  }

  console.log(`ITP snapshot backfill mode: ${write ? 'apply' : 'check'}`);
  const startedAt = Date.now();
  const backfilledAt = new Date();

  let cursor: string | undefined;
  let scanned = 0;
  let written = 0;
  let templateMissing = 0;

  for (;;) {
    const instances = await prisma.iTPInstance.findMany({
      where: { templateSnapshot: null },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        template: {
          select: {
            id: true,
            name: true,
            description: true,
            activityType: true,
            specificationReference: true,
            stateSpec: true,
            authority: true,
            specEdition: true,
            checklistItems: { orderBy: { sequenceNumber: 'asc' } },
          },
        },
      },
    });
    if (instances.length === 0) break;
    cursor = instances[instances.length - 1].id;
    scanned += instances.length;

    for (const instance of instances) {
      if (!instance.template) {
        templateMissing += 1;
        continue;
      }

      const snapshot = JSON.stringify(
        buildTemplateSnapshot(instance.template, { snapshotAt: backfilledAt, backfilledAt }),
      );
      written += 1;
      if (write) {
        await prisma.iTPInstance.update({
          where: { id: instance.id },
          data: { templateSnapshot: snapshot },
        });
      }
    }

    console.log(`[progress] scanned=${scanned} writable=${written} noTemplate=${templateMissing}`);
    // Without --write the cursor is the only thing advancing, so the same page
    // would otherwise repeat forever once the filter stops shrinking.
    if (!write && instances.length < BATCH_SIZE) break;
  }

  // Reported, never rewritten: these already HAVE bytes, and the fallback they
  // reach is the pre-existing one.
  const malformed = await countMalformedSnapshots();

  console.log(
    `[done] scanned=${scanned} ${write ? 'backfilled' : 'would backfill'}=${written} ` +
      `templateDeleted=${templateMissing} malformedLeftAlone=${malformed} in ${Date.now() - startedAt}ms`,
  );
  if (malformed > 0) {
    console.log(
      `${malformed} instance(s) hold an unparseable snapshot. They are NOT touched — inspect them by hand.`,
    );
  }
  if (!write) {
    console.log('Dry run only. Re-run with --write and CONFIRM_ITP_SNAPSHOT_BACKFILL to apply.');
  }
}

async function countMalformedSnapshots(): Promise<number> {
  let cursor: string | undefined;
  let malformed = 0;
  for (;;) {
    const rows = await prisma.iTPInstance.findMany({
      where: { NOT: { templateSnapshot: null } },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
      select: { id: true, templateSnapshot: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    for (const row of rows) {
      if (!parseTemplateSnapshot(row.templateSnapshot)) malformed += 1;
    }
    if (rows.length < BATCH_SIZE) break;
  }
  return malformed;
}

runScript(main, () => prisma.$disconnect());
