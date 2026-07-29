// Wave D `D1c.1` — the export lease, its fencing token, and the CAS writes
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.6.2, §7.4,
// `[DR-B5]`, `[DR2-B7]`, `[DH-j]`). **AT-135**.
//
// THE INVARIANT THIS FILE EXISTS TO HOLD, and the one it deliberately does not.
//
// Rev 2 claimed a fenced-out worker "cannot upload". `[DR2-B7]` is right that
// no database predicate can enforce that: a stale worker holds an open HTTP
// connection to object storage, and a conditional `UPDATE` in Postgres cannot
// un-send those bytes. So the honest invariant, and the one **AT-135** asserts,
// is narrower and actually true:
//
//     A fenced-out worker cannot PUBLISH, cannot FINALIZE and cannot CANCEL.
//
// It may well finish uploading, and that is fine, because nothing can reach
// what it uploaded: every worker writes to a LEASE-TOKEN-SPECIFIC key
// (`leaseObjectKey` below), so two workers physically cannot collide, and
// publication is a separate cheap compare-and-swap on the export row. The
// loser's object is written, is unreachable, and is removed by the sweeper
// (§10.5) alongside expired artefacts.
//
// ponytail: uniquely-keyed writes plus one compare-and-swap is the standard
// answer, and it is smaller than any scheme that tries to abort an in-flight
// upload. Storage costs a sweep; correctness costs nothing.
//
// EVERY state write in this file goes through `updateMany` with `leaseToken` in
// the `where`, and returns `count === 1`. `update({ where: { id } })` is the bug
// this module exists to make impossible — it is unconditional, and it is what a
// fenced-out worker would otherwise use to publish over the live one.

import crypto from 'node:crypto';

import type { Prisma } from '@prisma/client';

import { prisma } from '../prisma.js';
import { assertSafeStorageId } from '../scheduledReports/artifacts.js';

/** §7.4's vocabulary. Zod-validated at the route; no Prisma enum (§7). */
export const HANDOVER_EXPORT_STATUSES = [
  'queued',
  'snapshotting',
  'processing',
  'complete',
  'failed',
  'cancelled',
] as const;
export type HandoverExportStatus = (typeof HANDOVER_EXPORT_STATUSES)[number];

/** Statuses a worker may claim. A finished job is never re-claimable. */
export const CLAIMABLE_STATUSES: readonly HandoverExportStatus[] = [
  'queued',
  'snapshotting',
  'processing',
];

/**
 * How long a claim survives without a heartbeat.
 *
 * Sized off measured behaviour rather than taste: the selected writer
 * (`archiver` 8.0.0, §4.5.2) stalls its own loop up to ~70 ms at the
 * central-directory write and 4.38 ms at p99, so a 60 s lease is ~850× the
 * worst measured stall. A lease shorter than the stall would have workers
 * fencing themselves out mid-archive.
 */
export const LEASE_TTL_MS = 60_000;

/** Renewal cadence for the worker loop `D1c.2` wires. A third of the TTL. */
export const HEARTBEAT_INTERVAL_MS = LEASE_TTL_MS / 3;

type PrismaClientLike = typeof prisma;

/**
 * `handover-exports/{projectId}/{exportId}/{leaseToken}.zip` — §4.6.2.
 *
 * PURE, and the token is IN the path. That is the entire fencing story on the
 * storage side: two workers holding different tokens for one export write to
 * two different objects, so neither can corrupt the other's bytes and only the
 * one that wins the CAS publish is ever pointed at.
 *
 * All three segments go through the SHARED `assertSafeStorageId` — imported,
 * never re-derived, because a second path regex is a second regex to get wrong
 * (the `folioStorage.ts` precedent, threat model T-5).
 */
export function leaseObjectKey(projectId: string, exportId: string, leaseToken: string): string {
  assertSafeStorageId(projectId, 'projectId');
  assertSafeStorageId(exportId, 'exportId');
  assertSafeStorageId(leaseToken, 'leaseToken');
  return `handover-exports/${projectId}/${exportId}/${leaseToken}.zip`;
}

export interface ExportLease {
  readonly exportId: string;
  readonly leaseOwner: string;
  readonly leaseToken: string;
  readonly leaseExpiresAt: Date;
}

/**
 * Claim an unleased or expired-lease job.
 *
 * A NEW token every claim. Reusing the previous token would let a worker that
 * was merely slow — not dead — resume and publish, which is the case the
 * fencing exists for.
 *
 * Returns `null` when another worker won the race, which is an ordinary
 * outcome, not an error.
 */
export async function claimExport(params: {
  exportId: string;
  leaseOwner: string;
  now?: Date;
  ttlMs?: number;
  client?: PrismaClientLike;
}): Promise<ExportLease | null> {
  const client = params.client ?? prisma;
  const now = params.now ?? new Date();
  const leaseToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + (params.ttlMs ?? LEASE_TTL_MS));

  const { count } = await client.handoverExport.updateMany({
    where: {
      id: params.exportId,
      status: { in: [...CLAIMABLE_STATUSES] },
      // Free, or the previous holder let it lapse. `OR` rather than a
      // `lte` alone: a never-claimed row has a null `leaseExpiresAt`, and
      // `{ lte: now }` does not match null in Postgres or in Prisma.
      OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
    },
    data: { leaseOwner: params.leaseOwner, leaseToken, leaseExpiresAt, heartbeatAt: now },
  });

  return count === 1
    ? { exportId: params.exportId, leaseOwner: params.leaseOwner, leaseToken, leaseExpiresAt }
    : null;
}

/**
 * THE fencing condition, in ONE place.
 *
 * Every state write a worker makes goes through here, so the `leaseToken`
 * predicate cannot be forgotten at a call site — which is precisely how a
 * fenced-out worker gets to publish over a live one. `updateMany` rather than
 * `update`, because the answer this returns is "did the predicate match?" and
 * `update` throws instead of answering it.
 */
async function fencedUpdate(
  client: PrismaClientLike,
  exportId: string,
  leaseToken: string,
  data: Prisma.HandoverExportUpdateManyMutationInput,
): Promise<boolean> {
  const { count } = await client.handoverExport.updateMany({
    where: { id: exportId, leaseToken },
    data,
  });
  return count === 1;
}

/** A terminal write releases the lease in the same statement, so a finished
 * job holds no lease and `claimExport`'s status filter agrees with it. */
const RELEASE_LEASE = {
  leaseOwner: null,
  leaseToken: null,
  leaseExpiresAt: null,
} as const;

/**
 * Renew. `false` means this worker has been fenced out and must stop — its
 * token no longer matches, so nothing it does from here can land.
 */
export function heartbeatExport(params: {
  exportId: string;
  leaseToken: string;
  processedMembers?: number;
  now?: Date;
  ttlMs?: number;
  client?: PrismaClientLike;
}): Promise<boolean> {
  const now = params.now ?? new Date();

  return fencedUpdate(params.client ?? prisma, params.exportId, params.leaseToken, {
    heartbeatAt: now,
    leaseExpiresAt: new Date(now.getTime() + (params.ttlMs ?? LEASE_TTL_MS)),
    ...(params.processedMembers === undefined ? {} : { processedMembers: params.processedMembers }),
  });
}

/**
 * THE publish (§4.6.2). Sets `fileUrl`, `sha256`, `fileSize` and
 * `status='complete'` **only if `leaseToken` still equals this worker's token**.
 */
export function publishExport(params: {
  exportId: string;
  leaseToken: string;
  fileUrl: string;
  sha256: string;
  fileSize: bigint;
  manifestSummary?: unknown;
  expiresAt?: Date | null;
  now?: Date;
  client?: PrismaClientLike;
}): Promise<boolean> {
  return fencedUpdate(params.client ?? prisma, params.exportId, params.leaseToken, {
    status: 'complete',
    fileUrl: params.fileUrl,
    sha256: params.sha256,
    fileSize: params.fileSize,
    completedAt: params.now ?? new Date(),
    expiresAt: params.expiresAt ?? null,
    ...(params.manifestSummary === undefined
      ? {}
      : { manifestSummary: params.manifestSummary as never }),
    ...RELEASE_LEASE,
  });
}

/** Finalize a failed attempt. Fenced by the same token as the publish. */
export function failExport(params: {
  exportId: string;
  leaseToken: string;
  reason: string;
  retryAt?: Date | null;
  client?: PrismaClientLike;
}): Promise<boolean> {
  const retryAt = params.retryAt ?? null;

  return fencedUpdate(params.client ?? prisma, params.exportId, params.leaseToken, {
    // A retryable failure goes back to `queued` so the claim scan finds it; a
    // terminal one is `failed` and is never re-claimed.
    status: retryAt ? 'queued' : 'failed',
    lastFailureReason: params.reason,
    failureCount: { increment: 1 },
    nextAttemptAt: retryAt,
    ...RELEASE_LEASE,
  });
}

/**
 * Cancel, fenced by the same CAS (§4.6.2: "Cancellation is fenced by the same
 * compare-and-swap"). A superseded worker cannot cancel the job the live worker
 * is running — that is the third clause of **AT-135**.
 */
export function cancelExport(params: {
  exportId: string;
  leaseToken: string;
  reason: string;
  client?: PrismaClientLike;
}): Promise<boolean> {
  return fencedUpdate(params.client ?? prisma, params.exportId, params.leaseToken, {
    status: 'cancelled',
    lastFailureReason: params.reason,
    ...RELEASE_LEASE,
  });
}
