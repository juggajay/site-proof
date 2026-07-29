// Wave D `D1c.2` — the retention sweep §10.5 assigns to this phase
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §10.5, §4.6.2,
// §7.2, §7.3, §7.4). **AT-148**.
//
// §10.5 is explicit that this had no home: "`dataRetentionWorker.ts` handles NO
// ARTEFACTS AT ALL at this SHA … D1c.2 either extends it or ships its own; IT
// MAY NOT ASSUME ONE EXISTS." It ships its own pass and the existing
// `dataRetentionWorker` keeps its own policies — the two sweep different things
// on different cadences and merging them would couple an artefact deletion to a
// token expiry.
//
// THREE SWEEPS, and §10.5 names each:
//
//  1. **Expired export artefacts.** Past `expiresAt`: the OBJECT is removed and
//     the ROW SURVIVES with a null `fileUrl` — "a handover export that was
//     generated and has expired is a fact worth keeping" (**AT-148**).
//  2. **Superseded lease-keyed objects (§4.6.2).** A fenced-out worker's object
//     is written, unreachable, and removed here. Every object under an export's
//     prefix that is not the one the row points at is one of those.
//  3. **Expired folio snapshots and reservations (§7.2, §7.3).** A
//     `FolioSnapshot` with no issued folio, and a `FolioIssueReservation` whose
//     `FolioIssue` never landed, expire — AND THE VERSION IS NOT RECYCLED,
//     which is why the reservation row is deleted rather than reused.
//
// WHAT IS NOT SWEPT, deliberately: `FolioIssue` rows and their bytes. §10.5 —
// "a folio is the record."
//
// LEGAL HOLD IS CONSULTED ON EVERY DELETION, through `D1c.1`'s
// `filterHeldArtifactIds` — one query for the batch, the same "most recent row
// wins" rule as the single read, never a second copy of it here.

import { prisma } from '../prisma.js';
import { logInfo, logWarn } from '../serverLogger.js';
import {
  ARCHIVE_STORAGE_ROOT,
  archiveStorageKeyFromFileUrl,
  type ArchiveObjectStore,
} from './archiveObjectStore.js';
import { deleteOrphanedFolioObject } from './folioStorage.js';
import { filterHeldArtifactIds } from './legalHold.js';

type PrismaClientLike = typeof prisma;

/** How long a terminal export's storage prefix is left alone before orphan
 * hunting. Comfortably longer than the lease TTL, so a worker that is merely
 * slow is never mistaken for a dead one. */
export const ORPHAN_GRACE_MS = 15 * 60_000;

export interface SweepResult {
  readonly expiredArchives: number;
  readonly heldArchives: number;
  readonly orphanedObjects: number;
  readonly expiredSnapshots: number;
  readonly expiredReservations: number;
}

export async function sweepHandoverArtifacts(params: {
  store: ArchiveObjectStore;
  at?: Date;
  client?: PrismaClientLike;
  /** Bound per pass so one sweep cannot hold the connection all night. */
  batchSize?: number;
}): Promise<SweepResult> {
  const client = params.client ?? prisma;
  const at = params.at ?? new Date();
  const take = params.batchSize ?? 200;

  const expired = await sweepExpiredArchives(params.store, at, take, client);
  const orphanedObjects = await sweepOrphanedLeaseObjects(params.store, at, take, client);
  const { expiredSnapshots, expiredReservations } = await sweepFolioScratch(at, take, client);

  const result: SweepResult = {
    ...expired,
    orphanedObjects,
    expiredSnapshots,
    expiredReservations,
  };
  if (
    result.expiredArchives +
      result.orphanedObjects +
      result.expiredSnapshots +
      result.expiredReservations >
    0
  ) {
    logInfo('[Handover Export] Retention sweep', { ...result });
  }
  return result;
}

/** §10.5 + **AT-148**: object gone, `fileUrl` null, ROW SURVIVES. */
async function sweepExpiredArchives(
  store: ArchiveObjectStore,
  at: Date,
  take: number,
  client: PrismaClientLike,
): Promise<{ expiredArchives: number; heldArchives: number }> {
  const rows = await client.handoverExport.findMany({
    where: { expiresAt: { lte: at }, fileUrl: { not: null } },
    select: { id: true, projectId: true, fileUrl: true },
    take,
  });
  if (rows.length === 0) return { expiredArchives: 0, heldArchives: 0 };

  const held = await filterHeldArtifactIds(
    'handover_export',
    rows.map((row) => row.id),
    client,
  );

  let swept = 0;
  for (const row of rows) {
    // A hold REFUSES the sweep — the artefact keeps its bytes and its
    // `expiresAt` until the hold is released, and the next pass picks it up.
    if (held.has(row.id)) continue;

    const key = archiveStorageKeyFromFileUrl(row.fileUrl!, row.projectId, row.id);
    if (key) {
      try {
        await store.remove([key]);
      } catch (error) {
        logWarn('[Handover Export] Expired archive delete failed', { exportId: row.id, error });
        continue;
      }
    }

    await client.handoverExport.update({
      where: { id: row.id },
      data: { fileUrl: null, uploadState: undefined },
    });
    swept += 1;
  }

  return { expiredArchives: swept, heldArchives: held.size };
}

/**
 * §4.6.2's superseded objects.
 *
 * For every export that has reached a terminal state, list its prefix and
 * delete everything that is not the published object. That covers the
 * fenced-out worker's archive, a partial left by a worker that died before its
 * own cleanup ran, and a cancelled job's bytes.
 */
async function sweepOrphanedLeaseObjects(
  store: ArchiveObjectStore,
  at: Date,
  take: number,
  client: PrismaClientLike,
): Promise<number> {
  const cutoff = new Date(at.getTime() - ORPHAN_GRACE_MS);
  const rows = await client.handoverExport.findMany({
    where: {
      status: { in: ['complete', 'failed', 'cancelled'] },
      requestedAt: { lte: cutoff },
    },
    select: { id: true, projectId: true, fileUrl: true },
    orderBy: { requestedAt: 'desc' },
    take,
  });

  let removed = 0;
  for (const row of rows) {
    const published = row.fileUrl
      ? archiveStorageKeyFromFileUrl(row.fileUrl, row.projectId, row.id)
      : null;
    const prefix = `${ARCHIVE_STORAGE_ROOT}/${row.projectId}/${row.id}`;

    let keys: string[];
    try {
      keys = await store.list(prefix);
    } catch (error) {
      logWarn('[Handover Export] Orphan listing failed', { exportId: row.id, error });
      continue;
    }

    const orphans = keys.filter((key) => key !== published);
    if (orphans.length === 0) continue;

    try {
      await store.remove(orphans);
      removed += orphans.length;
    } catch (error) {
      logWarn('[Handover Export] Orphan delete failed', { exportId: row.id, error });
    }
  }

  return removed;
}

/**
 * §7.2 and §7.3: a `FolioSnapshot` with no folio issued against it before
 * `expiresAt`, and a `FolioIssueReservation` whose `FolioIssue` never landed.
 *
 * The reservation is DELETED, not reused — §7.2: "its version number is
 * retired, not recycled." The `[lotId, version]` unique constraint is what
 * makes that safe: the next session's insert simply fails on the retired number
 * and retries with the next one.
 */
async function sweepFolioScratch(
  at: Date,
  take: number,
  client: PrismaClientLike,
): Promise<{ expiredSnapshots: number; expiredReservations: number }> {
  const reservations = await client.folioIssueReservation.findMany({
    where: { expiresAt: { lte: at }, issue: { is: null } },
    select: { issueId: true, projectId: true, lotId: true },
    take,
  });
  if (reservations.length > 0) {
    // §4.4.2's orphan: the issuance wrote the object and then failed before the
    // `FolioIssue` row landed, so nothing points at those bytes. Removed BEFORE
    // the row, so a crash between the two leaves a reservation the next pass
    // retries rather than bytes nothing remembers.
    for (const reservation of reservations) {
      await deleteOrphanedFolioObject({
        projectId: reservation.projectId,
        lotId: reservation.lotId,
        folioIssueId: reservation.issueId,
      });
    }
    await client.folioIssueReservation.deleteMany({
      where: { issueId: { in: reservations.map((row) => row.issueId) } },
    });
  }

  const snapshots = await client.folioSnapshot.findMany({
    where: { expiresAt: { lte: at }, issues: { none: {} } },
    select: { id: true },
    take,
  });
  if (snapshots.length > 0) {
    await client.folioSnapshot.deleteMany({
      where: { id: { in: snapshots.map((row) => row.id) } },
    });
  }

  return { expiredSnapshots: snapshots.length, expiredReservations: reservations.length };
}
