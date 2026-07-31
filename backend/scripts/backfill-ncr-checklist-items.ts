#!/usr/bin/env tsx
// Wave G G5 §5.3 — one-time backfill of `NCR.itpChecklistItemId` for NCRs
// raised from a failed ITP item before the column existed.
//
// WHY a script and not a migration: the id lives inside free text
// (`[itp-item:<uuid>]`, or the older `(Item ID: <uuid>)`), and resolving it
// means parsing that text and then checking the item still exists. Neither is
// expressible in the migration's `.sql`, and the same reasoning that made
// `backfill-itp-snapshots.ts` a script applies here.
//
// THE RULE IT WILL NOT BEND: **never guess.** A row is written only when
//
//   (a) a full UUID parses out of the notes, and
//   (b) an `ITPChecklistItem` with that id still exists.
//
// Everything else — no marker, a marker whose item was deleted, an NCR raised
// outside the failed-ITP path — is left null and counted in the report.
// Description matching is not attempted at any point: two items with the same
// words are not evidence of the same requirement (spec §5.3).
//
// Rows that ALREADY carry `itpChecklistItemId` are never touched, so a re-run is
// idempotent and cannot overwrite a link written at creation time.
//
// Dry run:  npm run db:backfill-ncr-checklist-items
// Apply:    npm run db:backfill-ncr-checklist-items -- --write
//           (with CONFIRM_NCR_CHECKLIST_ITEM_BACKFILL=<host>/<database>)
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

import { parseChecklistItemIdFromRectificationNotes } from '../src/routes/itp/instances/ncrLinks.js';
import { requireDatabaseTargetConfirmation } from './lib/database-target.js';
import { runScript } from './lib/run-script.js';

const prisma = new PrismaClient();

const BATCH_SIZE = 500;

async function main(): Promise<void> {
  const write = process.argv.slice(2).includes('--write');
  if (write) {
    requireDatabaseTargetConfirmation(
      'CONFIRM_NCR_CHECKLIST_ITEM_BACKFILL',
      'NCR.itpChecklistItemId backfill (additive; only rows where the column is null)',
    );
  }

  console.log(`NCR checklist-item backfill mode: ${write ? 'apply' : 'check'}`);
  const startedAt = Date.now();

  let cursor: string | undefined;
  let scanned = 0;
  let noMarker = 0;
  let itemDeleted = 0;
  let written = 0;

  for (;;) {
    const ncrs = await prisma.nCR.findMany({
      where: { itpChecklistItemId: null },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
      select: { id: true, rectificationNotes: true },
    });
    if (ncrs.length === 0) break;
    cursor = ncrs[ncrs.length - 1].id;
    scanned += ncrs.length;

    const parsed = new Map<string, string>();
    for (const ncr of ncrs) {
      const itemId = parseChecklistItemIdFromRectificationNotes(ncr.rectificationNotes);
      if (!itemId) {
        noMarker += 1;
        continue;
      }
      parsed.set(ncr.id, itemId);
    }

    // One existence check per batch, not one per row.
    const candidateItemIds = [...new Set(parsed.values())];
    const existing = candidateItemIds.length
      ? await prisma.iTPChecklistItem.findMany({
          where: { id: { in: candidateItemIds } },
          select: { id: true },
        })
      : [];
    const liveItemIds = new Set(existing.map((item) => item.id));

    for (const [ncrId, itemId] of parsed) {
      if (!liveItemIds.has(itemId)) {
        itemDeleted += 1;
        continue;
      }
      written += 1;
      if (write) {
        await prisma.nCR.update({
          where: { id: ncrId },
          data: { itpChecklistItemId: itemId },
        });
      }
    }

    console.log(
      `[progress] scanned=${scanned} linkable=${written} noMarker=${noMarker} itemDeleted=${itemDeleted}`,
    );
    // Without --write nothing leaves the filter, so the cursor is the only thing
    // advancing and the last page would otherwise repeat forever.
    if (!write && ncrs.length < BATCH_SIZE) break;
  }

  console.log(
    `[done] scanned=${scanned} ${write ? 'linked' : 'would link'}=${written} ` +
      `noMarker=${noMarker} itemDeleted=${itemDeleted} in ${Date.now() - startedAt}ms`,
  );
  if (!write) {
    console.log(
      'Dry run only. Re-run with --write and CONFIRM_NCR_CHECKLIST_ITEM_BACKFILL to apply.',
    );
  }
}

runScript(main, () => prisma.$disconnect());
