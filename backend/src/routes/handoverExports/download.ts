// Wave D `D1c.2` — the STREAMED download, and the user-facing cancel
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.7.4, §4.7.5,
// §9, §10.2, §10.5; `[DH-g]`). **AT-132**, **AT-148**.
//
// STREAMED, AND THAT IS THE POINT (§4.7.4).
// `sendScheduledReportArtifactFile:380-395` buffers a whole file into memory —
// defensible at 200 KB, an outage at 8 GiB. So this path pipes. `[DH-g]`: the
// scheduled-report path is LEFT ALONE, not refactored, and nothing here imports
// it.
//
// SHA-VERIFIED, WITH THE EXACT PROPERTY STATED. The folio path buffers and
// verifies BEFORE sending (`folioStorage.ts:167`), which an 8 GiB archive
// cannot afford. So the hash is computed over the stream AND THE LAST 64 KiB
// ARE WITHHELD until it matches — see `createTailWithheldVerifier`. The
// guarantee that gives is precise and provable: **a mutated archive is never
// delivered as an openable archive**, because the withheld tail is where the
// ZIP central directory lives. Verifying only at flush, with every byte already
// sent, would be a log line rather than a guarantee.
//
// THE DOWNLOAD IS A REQUEST, NOT THE WORKER'S JOB (§4.7.7) — it is served by
// the API process, which is why this file lives beside the other routes.
//
// §10.2: an authenticated app request, ownership-checked AT THE STORAGE PATH
// LEVEL, `no-store`. No public link, no Supabase signed URL, no email
// attachment.

import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

import { Router } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import {
  archiveStorageKeyFromFileUrl,
  resolveArchiveObjectStore,
} from '../../lib/handover/archiveObjectStore.js';
import { requestExportCancellation } from '../../lib/handover/exportLease.js';
import { isOnHold } from '../../lib/handover/legalHold.js';
import { prisma } from '../../lib/prisma.js';
import { logError } from '../../lib/serverLogger.js';
import { requireHandoverProjectAccess } from './access.js';

/** §9: "Download a handover export — the requester, plus `owner`/`admin`/
 * `project_manager` on that project." A route-local const, the same shape and
 * for the same reason as `HANDOVER_EXPORT_REQUESTERS` (`access.ts:27`): a
 * hierarchy check widens the moment a role is inserted into `ROLE_HIERARCHY`. */
export const HANDOVER_EXPORT_DOWNLOADERS = ['owner', 'admin', 'project_manager'];

/**
 * How much of the archive's tail is withheld until the hash checks out.
 *
 * A ZIP's End Of Central Directory record lives in the last 22 bytes plus up to
 * 64 KiB of comment, and the central directory itself sits immediately before
 * it. Withhold 64 KiB and a failed verification can only ever deliver a file
 * with NO central directory — which every reader refuses to open. That is the
 * property, stated exactly.
 */
export const VERIFY_TAIL_BYTES = 64 * 1024;

/**
 * Stream the object through, hashing as it goes, and HOLD BACK THE TAIL until
 * the digest matches.
 *
 * WHY NOT BUFFER-AND-VERIFY. The folio path hashes the whole object before it
 * sends a byte (`folioStorage.ts:167`) and §4.7.4 forbids that here: the
 * shipped buffer-and-send is "defensible at 200 KB, an outage at 8 GiB".
 *
 * WHY NOT VERIFY-AT-FLUSH ALONE. Erroring after the last byte has already gone
 * out is not a guarantee — the client already has a complete, well-formed file.
 * `D1c.0` measured the bill as ~100% network, so re-reading the object once to
 * hash it and again to send it would double the most expensive leg.
 *
 * So the honest, cheap property is the one above: **a mutated archive is never
 * delivered as an openable archive.** The transfer ends short, the client sees
 * a broken download, and the server logs the mismatch.
 */
export function createTailWithheldVerifier(expectedSha256: string, exportId: string): Transform {
  const hash = crypto.createHash('sha256');
  let tail = Buffer.alloc(0);

  return new Transform({
    transform(chunk, _encoding, callback) {
      const buffer = chunk as Buffer;
      hash.update(buffer);

      const pending = Buffer.concat([tail, buffer]);
      if (pending.length <= VERIFY_TAIL_BYTES) {
        tail = pending;
        callback();
        return;
      }
      const releasable = pending.subarray(0, pending.length - VERIFY_TAIL_BYTES);
      tail = pending.subarray(pending.length - VERIFY_TAIL_BYTES);
      callback(null, releasable);
    },
    flush(callback) {
      if (hash.digest('hex') === expectedSha256) {
        callback(null, tail);
        return;
      }
      callback(new Error(`Handover export ${exportId} failed checksum verification`));
    },
  });
}

export function registerHandoverExportDownloadRoutes(router: Router): void {
  // GET /api/handover-exports/:id/download
  //
  // ROUTE ORDER: this file is registered AFTER `/:id` is declared in
  // `index.ts`, and that is safe because `/:id/download` has one more segment
  // than `/:id` — Express matches on segment count first, so there is no
  // specific-before-`/:id` hazard here. The cancel route below is a POST and
  // shares no method with any `/:id` GET.
  router.get(
    '/:id/download',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      if (!id) throw AppError.badRequest('id is required');
      const user = req.user!;

      const row = await prisma.handoverExport.findUnique({
        where: { id },
        select: {
          id: true,
          projectId: true,
          status: true,
          fileUrl: true,
          fileSize: true,
          sha256: true,
          requestedById: true,
          expiresAt: true,
          project: { select: { name: true } },
        },
      });
      if (!row) throw AppError.notFound('Handover export');

      // §10.1: the guard runs against the ROW's own project, never a
      // client-supplied one (**AT-132**).
      const role = await requireHandoverProjectAccess(row.projectId, user);
      // `actualRole` is never consulted here — the role that matters is the
      // caller's role ON THIS PROJECT, which the guard returned.
      if (row.requestedById !== user.id && !HANDOVER_EXPORT_DOWNLOADERS.includes(role)) {
        throw AppError.forbidden(
          'Only the requester, or an owner, admin or project manager on this project, can download a handover export',
        );
      }

      if (row.status !== 'complete' || !row.fileUrl || !row.sha256) {
        throw new AppError(
          400,
          'This handover export has no archive to download yet.',
          'HANDOVER_EXPORT_NOT_READY',
          { status: row.status },
        );
      }

      // §10.5: expiry is consulted on READ as well as by the sweeper, because
      // the sweep runs on a cadence and an expired artefact must not be
      // downloadable in the window between the two.
      if (
        row.expiresAt &&
        row.expiresAt.getTime() <= Date.now() &&
        !(await isOnHold('handover_export', row.id))
      ) {
        throw AppError.notFound('Handover export archive');
      }

      const key = archiveStorageKeyFromFileUrl(row.fileUrl, row.projectId, row.id);
      if (!key) {
        // A `fileUrl` that does not resolve inside this export's own prefix is
        // either tampered with or from another project. Either way it is a 404,
        // not a redirect (§10.2).
        logError('[Handover Export] Stored fileUrl outside its own prefix', { exportId: row.id });
        throw AppError.notFound('Handover export archive');
      }

      const source = await resolveArchiveObjectStore().get(key);

      await createAuditLog({
        projectId: row.projectId,
        userId: user.id,
        entityType: 'handover_export',
        entityId: row.id,
        action: AuditAction.HANDOVER_EXPORT_DOWNLOADED,
        req,
      });

      const filename = `handover-export-${row.id}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      if (row.fileSize !== null) res.setHeader('Content-Length', row.fileSize.toString());

      try {
        await pipeline(source, createTailWithheldVerifier(row.sha256, row.id), res);
      } catch (error) {
        logError('[Handover Export] Download stream failed', { exportId: row.id, error });
        res.destroy();
      }
    }),
  );

  // POST /api/handover-exports/:id/cancel — §4.7.5's user-facing cancel.
  //
  // The CAS lands only while the job is still claimable and RELEASES THE LEASE,
  // which is how a worker on another host finds out: its next heartbeat's token
  // predicate stops matching, the assembly aborts, and it removes its own
  // lease-keyed object. One `UPDATE`, no channel between the processes.
  router.post(
    '/:id/cancel',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      if (!id) throw AppError.badRequest('id is required');
      const user = req.user!;

      const row = await prisma.handoverExport.findUnique({
        where: { id },
        select: { id: true, projectId: true, status: true, requestedById: true },
      });
      if (!row) throw AppError.notFound('Handover export');

      const role = await requireHandoverProjectAccess(row.projectId, user);
      if (row.requestedById !== user.id && !HANDOVER_EXPORT_DOWNLOADERS.includes(role)) {
        throw AppError.forbidden('You cannot cancel this handover export');
      }

      const cancelled = await requestExportCancellation({
        exportId: row.id,
        reason: 'Cancelled by the requester',
      });
      if (!cancelled) {
        throw new AppError(
          400,
          'This handover export has already finished.',
          'HANDOVER_EXPORT_NOT_CANCELLABLE',
          { status: row.status },
        );
      }

      res.json({ id: row.id, status: 'cancelled' });
    }),
  );
}
