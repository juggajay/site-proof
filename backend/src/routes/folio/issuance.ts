// Wave D `D1b` — the issuance sequence, in one file
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.4.2, §7.2,
// §10.5; threat model T-1, T-2, T-3, T-7). **AT-142**, **AT-146**, **AT-152**.
//
// §4.4.2, STATED ONCE AND UNAMBIGUOUSLY — Rev 2 gave two contradictory
// orderings and this is the one:
//
//   1. SESSION TRANSACTION. Assemble the payload, resolve the §2.3 profile,
//      insert `FolioSnapshot`, insert `FolioIssueReservation` with the next
//      version under unique `[lotId, version]`. Commit. A losing concurrent
//      session takes a unique violation and RETRIES with the next version; it
//      never silently shares one.
//   2. OUTSIDE ANY TRANSACTION. Render from the snapshot, SHA over the bytes
//      the server produced, write with `upsert:false`/`wx` through the shared
//      path guard.
//   3. ISSUE TRANSACTION. Insert `FolioIssue` against the reservation, with the
//      audit row in the SAME transaction.
//
// WHY THE RESERVATION IS A ROW AND NOT AN OPEN TRANSACTION. Rendering and
// uploading are slow I/O; holding a database transaction across an
// object-storage write is how a connection pool dies under load.
//
// FAILURE IS NEVER PARTIALLY VISIBLE. A `FolioIssue` row exists only once its
// bytes are durable (**AT-146**). A failure at step 2 or 3 leaves an orphaned
// object and an unissued reservation, both of which the `D1c` sweeper collects
// (§10.5) — and the version they hold is NOT reused, because the next version
// is computed over the RESERVATION table, so a gap survives a sweep. A gap in a
// version sequence is harmless; reuse is not.

import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { AuditAction, writeAuditLogInTransaction } from '../../lib/auditLog.js';
import { renderFolioPdf } from '../../lib/handover/folioRenderer.js';
import { storeFolioArtifact } from '../../lib/handover/folioStorage.js';
import type { FolioSnapshotPayload } from '../../lib/handover/folioPayload.js';
import { prisma } from '../../lib/prisma.js';
import { assembleFolioPayload } from './assemble.js';

/**
 * How long a session's reservation and snapshot stay usable.
 *
 * The window between session creation and issue is one human action (T-2's
 * accepted staleness), so an hour is generous; past it the snapshot describes
 * a moment too old to present as new, and rendering is refused.
 */
export const FOLIO_SESSION_TTL_MS = 60 * 60 * 1000;

/**
 * T-3 bound 3: a rate limiter bounds RATE, not the standing total. A lot with
 * this many unexpired, unissued reservations refuses the next session.
 */
export const FOLIO_OUTSTANDING_RESERVATION_CAP = 5;

/** How many times a session retries after losing the `[lotId, version]` race. */
const VERSION_RACE_RETRIES = 5;

const UNIQUE_VIOLATION = 'P2002';

export interface FolioSessionResult {
  readonly folioIssueId: string;
  readonly snapshotId: string;
  readonly version: number;
  readonly expiresAt: Date;
  readonly evidenceRowCount: number;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION;
}

/**
 * Step 1 — the session transaction, with the version race handled by the
 * DATABASE rather than by application ordering (**AT-146**).
 */
export async function createFolioSession(params: {
  lotId: string;
  userId: string;
  userName: string;
  now: Date;
}): Promise<FolioSessionResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= VERSION_RACE_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const outstanding = await tx.folioIssueReservation.count({
          where: { lotId: params.lotId, expiresAt: { gt: params.now }, issue: { is: null } },
        });
        if (outstanding >= FOLIO_OUTSTANDING_RESERVATION_CAP) {
          throw new AppError(
            400,
            `This lot already has ${outstanding} folio sessions open and unissued. ` +
              'Issue or abandon one before starting another — each open session holds a folio version.',
            'FOLIO_RESERVATION_CAP_REACHED',
          );
        }

        // The next version is MAX over RESERVATIONS, not over issues: an
        // unissued or swept reservation must retire its version rather than
        // recycle it (§10.5).
        const highest = await tx.folioIssueReservation.aggregate({
          where: { lotId: params.lotId },
          _max: { version: true },
        });
        const version = (highest._max.version ?? 0) + 1;
        const folioIssueId = randomUUID();

        const assembled = await assembleFolioPayload(tx, {
          lotId: params.lotId,
          folioIssueId,
          version,
          compiledAt: params.now,
          compiledByName: params.userName,
        });

        const expiresAt = new Date(params.now.getTime() + FOLIO_SESSION_TTL_MS);
        const snapshot = await tx.folioSnapshot.create({
          data: {
            projectId: assembled.lot.projectId,
            lotId: assembled.lot.id,
            payload: assembled.payload as unknown as Prisma.InputJsonValue,
            payloadSchemaVersion: assembled.payload.schemaVersion,
            profileVersion: assembled.payload.profile.profileVersion,
            sourceRowRefs: assembled.sourceRowRefs as unknown as Prisma.InputJsonValue,
            createdById: params.userId,
            createdAt: params.now,
            expiresAt,
          },
          select: { id: true },
        });

        await tx.folioIssueReservation.create({
          data: {
            issueId: folioIssueId,
            projectId: assembled.lot.projectId,
            lotId: assembled.lot.id,
            snapshotId: snapshot.id,
            version,
            reservedById: params.userId,
            reservedAt: params.now,
            expiresAt,
          },
        });

        return {
          folioIssueId,
          snapshotId: snapshot.id,
          version,
          expiresAt,
          evidenceRowCount: assembled.payload.evidenceRowCount,
        };
      });
    } catch (error) {
      // Only the `[lotId, version]` race is retryable. Everything else — the
      // ceiling refusal, the cap, a missing lot — propagates unchanged.
      if (!isUniqueViolation(error)) throw error;
      lastError = error;
    }
  }

  throw new AppError(
    409,
    'Could not reserve a folio version for this lot after several attempts. Please try again.',
    'FOLIO_VERSION_RACE',
    { cause: String(lastError) },
  );
}

export interface FolioIssueResult {
  readonly id: string;
  readonly version: number;
  readonly sha256: string;
  readonly fileSize: number;
  readonly issuedAt: Date;
}

/**
 * Steps 2 and 3 — render, store, then insert.
 *
 * `reservation` is loaded and tenancy-checked by the caller (T-4). The render
 * reads `snapshot.payload` and NOTHING else (T-2): no database handle and no
 * clock reach `renderFolioPdf`.
 */
export async function issueFolio(params: {
  reservation: {
    issueId: string;
    projectId: string;
    lotId: string;
    snapshotId: string;
    version: number;
    expiresAt: Date;
  };
  payload: FolioSnapshotPayload;
  lot: { lotNumber: string; status: string; conformedAt: Date | null };
  userId: string;
  now: Date;
}): Promise<FolioIssueResult> {
  if (params.reservation.expiresAt <= params.now) {
    // T-2: an expired snapshot must not be renderable, or the staleness window
    // is unbounded and a folio can present months-old evidence as new.
    throw new AppError(
      400,
      'This folio session has expired. Start a new one so the folio compiles from current records.',
      'FOLIO_SESSION_EXPIRED',
    );
  }

  // Step 2 — outside any transaction, deliberately (T-6 mitigation 2).
  const pdfBuffer = await renderFolioPdf(params.payload);
  const stored = await storeFolioArtifact({
    projectId: params.reservation.projectId,
    lotId: params.reservation.lotId,
    folioIssueId: params.reservation.issueId,
    pdfBuffer,
  });

  // Step 3 — the row lands only now, and its audit event shares the
  // transaction: `writeAuditLogInTransaction` (`auditLog.ts:127`), NOT
  // `createAuditLog` (`:105`), which swallows failures and would hand an
  // attacker who can break the audit insert an un-audited issuance and a 2xx
  // (T-1). Rolling this back leaves NEITHER row (**AT-152**).
  return prisma.$transaction(async (tx) => {
    const issue = await tx.folioIssue.create({
      data: {
        id: params.reservation.issueId,
        projectId: params.reservation.projectId,
        lotId: params.reservation.lotId,
        snapshotId: params.reservation.snapshotId,
        reservationId: params.reservation.issueId,
        version: params.reservation.version,
        format: 'folio',
        fileUrl: stored.fileUrl,
        fileSize: BigInt(stored.fileSize),
        sha256: stored.sha256,
        issuedById: params.userId,
        issuedAt: params.now,
        compiledFrom: {
          schemaVersion: params.payload.schemaVersion,
          profileVersion: params.payload.profile.profileVersion,
          snapshotId: params.reservation.snapshotId,
          compiledAt: params.payload.folio.compiledAt,
          sourceRowRefs: await loadSourceRowRefs(tx, params.reservation.snapshotId),
        } as Prisma.InputJsonValue,
        lotStatusAtIssue: params.lot.status,
        conformedAtIssue: params.lot.conformedAt,
      },
      select: { id: true, version: true, sha256: true, issuedAt: true },
    });

    await writeAuditLogInTransaction(tx, {
      projectId: params.reservation.projectId,
      userId: params.userId,
      entityType: 'folio_issue',
      entityId: issue.id,
      action: AuditAction.FOLIO_ISSUED,
      changes: {
        lotNumber: params.lot.lotNumber,
        version: issue.version,
        sha256: issue.sha256,
        evidenceRowCount: params.payload.evidenceRowCount,
      },
    });

    return {
      id: issue.id,
      version: issue.version,
      sha256: issue.sha256,
      fileSize: stored.fileSize,
      issuedAt: issue.issuedAt,
    };
  });
}

async function loadSourceRowRefs(
  tx: Prisma.TransactionClient,
  snapshotId: string,
): Promise<Prisma.JsonValue> {
  const snapshot = await tx.folioSnapshot.findUniqueOrThrow({
    where: { id: snapshotId },
    select: { sourceRowRefs: true },
  });
  return snapshot.sourceRowRefs;
}
