// Wave D `D1c.2` — one job, end to end: claim, assemble, upload, publish
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.5.3, §4.6.2,
// §4.6.3, §4.7.5, §4.7.7, §10.3, §10.5). **AT-126** … **AT-130**, **AT-135**.
//
// THE SHAPE, and every step is one of the spec's:
//
//   claim (D1c.1's `claimExport`, a NEW fencing token)
//     → status `processing`, fenced
//     → read the FROZEN LEDGER — never re-enumerate (§4.6.3)
//     → stream members through `archiver` into the LEASE-TOKEN-KEYED object
//     → heartbeat on a tick; a `false` heartbeat means fenced out or cancelled,
//       and the assembly aborts
//     → COMPARE-AND-SWAP publish (§4.6.2)
//
// A FENCED-OUT WORKER CANNOT PUBLISH — **AT-135** — and when its CAS fails it
// REMOVES ITS OWN OBJECT rather than leaving it for the sweeper. Nothing points
// at it either way; removing it in-band is one call and saves a sweep.
//
// THE OUTPUT CAP IS TERMINAL. A job that trips it does not retry: the ledger is
// frozen, so the next attempt would produce the same bytes and trip the same
// cap. It fails with a stated reason and the requester narrows the scope
// (§4.7.6).

import { prisma } from '../prisma.js';
import { logError, logInfo, logWarn } from '../serverLogger.js';
import type { ArchiveObjectStore, MultipartProgress } from './archiveObjectStore.js';
import { AssemblyAbortedError, assembleArchive, OutputCapExceededError } from './exportAssembly.js';
import {
  claimExport,
  failExport,
  heartbeatExport,
  leaseObjectKey,
  publishExport,
  recordUploadState,
  setExportStatus,
} from './exportLease.js';
import {
  loadMemberMetadata,
  readLedger,
  readMemberObject,
  readScopeLotFolioStatus,
} from './exportMemberSources.js';
import { EFFECTIVE_OUTPUT_CAP_BYTES } from './exportPreflight.js';

type PrismaClientLike = typeof prisma;

/**
 * How often the worker touches the database while assembling.
 *
 * TIGHTER THAN THE LEASE CADENCE ON PURPOSE. `HEARTBEAT_INTERVAL_MS` (20 s) is
 * what the LEASE needs to stay alive; the heartbeat is also the only channel
 * through which a cancellation reaches a running job, and §4.5.1 fixture 4
 * requires cancellation observed within 5 s. So the tick is the tighter of the
 * two requirements — it satisfies the 20 s renewal a fortiori, at the cost of
 * one cheap conditional `UPDATE` every five seconds per running job.
 */
export const WORKER_TICK_MS = 5_000;

/**
 * Retention TTL for a completed archive, in days.
 *
 * **THIS NUMBER IS NOT ENGINEERING'S.** §10.5 says "default conservative" and
 * §17.4 records the actual default as still open — a Jay/product number,
 * because longer retention is linear storage cost against the add-on's COGS
 * line (§16.1 J9). `D1c.0` had to model *something* to price the storage leg
 * and modelled 30 days as a declared assumption; this is that assumption, wired
 * as a default and overridable by env so setting it does not need a deploy.
 */
export const DEFAULT_EXPORT_TTL_DAYS = 30;

export function readExportTtlDays(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(env.HANDOVER_EXPORT_TTL_DAYS);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_EXPORT_TTL_DAYS;
}

export type ExportRunOutcome =
  | 'published'
  | 'failed'
  | 'not_claimed'
  | 'fenced_out'
  | 'cancelled'
  | 'gone';

export interface RunExportJobParams {
  readonly exportId: string;
  readonly leaseOwner: string;
  readonly store: ArchiveObjectStore;
  readonly client?: PrismaClientLike;
  readonly now?: () => Date;
  /** Injectable so the abort path can be exercised at kilobyte scale — the same
   * cap, a different number. Defaults to §4.5.3's 8 GiB. */
  readonly outputCapBytes?: number;
  readonly tickMs?: number;
  readonly civosVersion?: string;
  readonly ttlDays?: number;
}

/** Non-retryable failures: re-running the same frozen ledger reproduces them. */
function isTerminal(error: unknown): boolean {
  return error instanceof OutputCapExceededError;
}

export async function runExportJob(params: RunExportJobParams): Promise<ExportRunOutcome> {
  const client = params.client ?? prisma;
  const now = params.now ?? (() => new Date());
  const tickMs = params.tickMs ?? WORKER_TICK_MS;
  const outputCapBytes = params.outputCapBytes ?? EFFECTIVE_OUTPUT_CAP_BYTES;

  const lease = await claimExport({ exportId: params.exportId, leaseOwner: params.leaseOwner });
  if (!lease) return 'not_claimed';

  const row = await client.handoverExport.findUnique({
    where: { id: params.exportId },
    select: {
      id: true,
      projectId: true,
      scope: true,
      snapshotCutoffAt: true,
      requestedById: true,
      failureCount: true,
    },
  });
  if (!row) {
    // Deleted between the claim and the read. Nothing to fail, nothing to
    // publish, and the lease died with the row's cascade.
    return 'gone';
  }

  const objectKey = leaseObjectKey(row.projectId, row.id, lease.leaseToken);

  if (
    !(await setExportStatus({
      exportId: row.id,
      leaseToken: lease.leaseToken,
      status: 'processing',
    }))
  ) {
    return 'fenced_out';
  }

  let lastTick = now().getTime();

  try {
    const members = await readLedger(row.id, client);
    const metadata = await loadMemberMetadata(members, client);
    const lots = await readScopeLotFolioStatus(row.id, client);

    const result = await assembleArchive({
      members,
      metadata,
      summary: {
        exportId: row.id,
        projectId: row.projectId,
        scope: row.scope,
        generatedAt: now(),
        generatedBy: row.requestedById,
        civosVersion: params.civosVersion ?? resolveCivosVersion(),
        snapshotCutoffAt: row.snapshotCutoffAt,
        lots,
        // Project access in this product is project-wide
        // (`requireInternalProjectAccess`), so a requester who can request an
        // export can read every lot in it and this count is structurally zero.
        // The FIELD ships anyway: **AT-133**'s shape is "aggregate count only",
        // and a manifest that omits the field entirely would have to grow one
        // the day lot-level access exists.
        unauthorizedExclusionCount: 0,
      },
      readObject: (locator) => readMemberObject(locator, client),
      outputCapBytes,
      // §4.7.3 determinism: the FREEZE's instant, not the run's.
      entryDate: row.snapshotCutoffAt ?? new Date(0),
      sink: (body) =>
        params.store.put(objectKey, body, multipartStateRecorder(row.id, lease.leaseToken, client)),
      onMemberProcessed: async (processed) => {
        const at = now().getTime();
        if (at - lastTick < tickMs && processed < members.length) return true;
        lastTick = at;
        // `false` here is BOTH "fenced out" and "cancelled" — the user-facing
        // cancel releases the lease, so the token predicate stops matching.
        return heartbeatExport({
          exportId: row.id,
          leaseToken: lease.leaseToken,
          processedMembers: processed,
          client,
        });
      },
    });

    const ttlDays = params.ttlDays ?? readExportTtlDays();
    const published = await publishExport({
      exportId: row.id,
      leaseToken: lease.leaseToken,
      fileUrl: result.fileUrl,
      sha256: result.sha256,
      fileSize: result.outputBytes,
      manifestSummary: {
        memberCount: members.length,
        writtenCount: result.writtenCount,
        omissions: result.omissions,
        unauthorizedExclusionCount: 0,
        contentDigest: result.contentDigest,
        lotsWithoutFolio: lots.filter((lot) => lot.folio === 'none').length,
      },
      expiresAt: new Date(now().getTime() + ttlDays * 24 * 60 * 60 * 1000),
      now: now(),
      client,
    });

    if (!published) {
      // **AT-135**: the CAS is the whole invariant. This worker finished, and
      // it still cannot publish — so its object is unreachable and it removes
      // it rather than leaving a paid-for orphan.
      logWarn('[Handover Export] Publish rejected — fenced out', { exportId: row.id });
      await removeQuietly(params.store, objectKey);
      return 'fenced_out';
    }

    await markMembersWritten(row.id, client);
    logInfo('[Handover Export] Published', {
      exportId: row.id,
      members: result.writtenCount,
      omissions: result.omissions.length,
      bytes: result.outputBytes.toString(),
    });
    return 'published';
  } catch (error) {
    return finishFailedRun({
      error,
      exportId: row.id,
      leaseToken: lease.leaseToken,
      failureCount: row.failureCount,
      objectKey,
      store: params.store,
      at: now(),
      client,
    });
  }
}

/**
 * Everything that happens when a run does not publish.
 *
 * The partial object goes FIRST, before any status write: §4.5.3 requires the
 * partial removed, and a crash between the two should leave storage clean
 * rather than a row that says `failed` next to bytes nobody can see.
 */
async function finishFailedRun(params: {
  error: unknown;
  exportId: string;
  leaseToken: string;
  failureCount: number;
  objectKey: string;
  store: ArchiveObjectStore;
  at: Date;
  client: PrismaClientLike;
}): Promise<ExportRunOutcome> {
  await removeQuietly(params.store, params.objectKey);

  if (params.error instanceof AssemblyAbortedError) {
    // The job was cancelled or taken. Neither is this worker's to record — the
    // CAS that fenced it already wrote the status.
    logInfo('[Handover Export] Aborted', {
      exportId: params.exportId,
      reason: params.error.message,
    });
    return 'cancelled';
  }

  const reason = params.error instanceof Error ? params.error.message : String(params.error);
  logError('[Handover Export] Job failed', { exportId: params.exportId, reason });

  const retryAt =
    isTerminal(params.error) || params.failureCount >= 2
      ? null
      : nextAttempt(params.at, params.failureCount);
  await failExport({
    exportId: params.exportId,
    leaseToken: params.leaseToken,
    reason,
    retryAt,
    client: params.client,
  });
  return 'failed';
}

/**
 * Persist S3 multipart state as the upload progresses (§4.6.3, §7.4).
 *
 * FIRE AND FORGET, deliberately. This is transport-layer bookkeeping — the ZIP
 * is always rebuilt from the frozen ledger — so a failed bookkeeping write must
 * not fail the archive that is otherwise going fine. It is also fenced like
 * every other state write, so a stale worker's bookkeeping simply lands nowhere.
 */
function multipartStateRecorder(
  exportId: string,
  leaseToken: string,
  client: PrismaClientLike,
): (progress: MultipartProgress) => void {
  return (progress) => {
    void recordUploadState({
      exportId,
      leaseToken,
      uploadState: {
        key: progress.key,
        uploadId: progress.uploadId,
        parts: progress.parts,
        loadedBytes: progress.loadedBytes,
      },
      client,
    }).catch(() => undefined);
  };
}

/** Exponential-ish backoff, bounded: 1 min, then 5 min, then terminal. */
function nextAttempt(at: Date, failureCount: number): Date {
  const minutes = failureCount === 0 ? 1 : 5;
  return new Date(at.getTime() + minutes * 60_000);
}

async function removeQuietly(store: ArchiveObjectStore, key: string): Promise<void> {
  try {
    await store.remove([key]);
  } catch (error) {
    logWarn('[Handover Export] Partial object removal failed', { key, error });
  }
}

/** Members that made it into the archive are `written`; the ones that did not
 * were already recorded as omissions in the manifest. */
async function markMembersWritten(exportId: string, client: PrismaClientLike): Promise<void> {
  await client.handoverExportMember.updateMany({
    where: { exportId, state: 'pending' },
    data: { state: 'written' },
  });
}

function resolveCivosVersion(): string {
  return (
    process.env.SENTRY_RELEASE?.trim() ||
    process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
    process.env.SOURCE_VERSION?.trim() ||
    'development'
  );
}

/**
 * The next job to run, or `null`.
 *
 * `queued` first, oldest first, then jobs whose lease has LAPSED — a worker
 * that died mid-archive leaves a `processing` row with an expired lease, and
 * §4.6.3's restart semantics are exactly "claim it again and rebuild from the
 * frozen ledger".
 */
export async function findNextExportJob(
  at: Date,
  client: PrismaClientLike = prisma,
): Promise<string | null> {
  const row = await client.handoverExport.findFirst({
    where: {
      status: { in: ['queued', 'snapshotting', 'processing'] },
      OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: at } }],
      AND: [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: at } }] }],
    },
    orderBy: { requestedAt: 'asc' },
    select: { id: true },
  });
  return row?.id ?? null;
}
