// Wave D `D1b` — the folio routes mounted at `/api/folios`
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §9, §10.2).
//
//   POST /api/folios/:folioIssueId/issue     render, store, insert
//   GET  /api/folios/:folioIssueId/download  ownership-checked, SHA-verified
//
// THERE IS NO `PUT /api/folios/:id/bytes`, and no route anywhere accepts folio
// bytes — `[DH-i]`, `[DR2-B4]`. **AT-143** asserts that ABSENCE rather than the
// correctness of a check, because a check on arbitrary rendered content is what
// `[DR2-B4]` deleted: a malicious PDF can carry every expected string and still
// alter everything else.

import { Router } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import { isFolioPayloadSchemaCurrent } from '../../lib/handover/folioPayload.js';
import { FOLIO_PAYLOAD_SCHEMA_VERSION } from '../../lib/handover/revisionTokens.js';
import { loadFolioArtifactBuffer } from '../../lib/handover/folioStorage.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { requireFolioIssuerAccess, requireFolioProjectAccess } from './access.js';
import { issueFolio } from './issuance.js';
import { folioIssueSchema, parseFolioBody } from './validation.js';

export const foliosRouter = Router();

foliosRouter.use(requireAuth);

function parseFolioId(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw AppError.badRequest('folioIssueId is required');
  }
  return raw;
}

// POST /api/folios/:folioIssueId/issue — steps 2 and 3 of §4.4.2.
//
// "Takes no body containing document content of any kind" (§9): the body must
// be empty, and a server-owned field is a NAMED 400 (**AT-124**).
foliosRouter.post(
  '/:folioIssueId/issue',
  asyncHandler(async (req, res) => {
    parseFolioBody(folioIssueSchema, req.body);
    const folioIssueId = parseFolioId(req.params.folioIssueId);
    const user = req.user!;

    const reservation = await prisma.folioIssueReservation.findUnique({
      where: { issueId: folioIssueId },
      select: {
        issueId: true,
        projectId: true,
        lotId: true,
        snapshotId: true,
        version: true,
        expiresAt: true,
        snapshot: { select: { payload: true, expiresAt: true } },
        lot: { select: { lotNumber: true, status: true, conformedAt: true, projectId: true } },
        issue: { select: { id: true } },
      },
    });
    if (!reservation) {
      throw AppError.notFound('Folio session');
    }

    // T-4's second hop: the guard runs against the RESERVATION's own project,
    // and the lot's project is re-checked against it. A `findUnique` by id
    // followed by a permission check on a different row's project is the bug
    // this exists to name.
    await requireFolioIssuerAccess(reservation.projectId, user);
    if (reservation.lot.projectId !== reservation.projectId) {
      throw AppError.notFound('Folio session');
    }

    if (reservation.issue) {
      throw new AppError(409, 'This folio has already been issued.', 'FOLIO_ALREADY_ISSUED');
    }

    // **AT-180**. A snapshot written before a payload-shape change carries an
    // older `schemaVersion` and is missing keys this build's renderer reads.
    // The cast on the line below is unchecked by TypeScript, so the check has
    // to be here: refuse with a reason, and NEVER read a v1 payload as v2. The
    // session is cheap to redo — the snapshot is one human action old — which
    // is why this is a refusal rather than a migration.
    const snapshotPayload = reservation.snapshot.payload;
    if (!isFolioPayloadSchemaCurrent(snapshotPayload)) {
      throw new AppError(
        409,
        'This folio session was prepared against an older folio format and cannot be ' +
          'issued. Start a new session so the folio compiles from the current records.',
        'FOLIO_PAYLOAD_SCHEMA_STALE',
        {
          expectedSchemaVersion: FOLIO_PAYLOAD_SCHEMA_VERSION,
          snapshotSchemaVersion:
            (snapshotPayload as { schemaVersion?: unknown } | null)?.schemaVersion ?? null,
        },
      );
    }

    const result = await issueFolio({
      reservation: {
        issueId: reservation.issueId,
        projectId: reservation.projectId,
        lotId: reservation.lotId,
        snapshotId: reservation.snapshotId,
        version: reservation.version,
        expiresAt: reservation.expiresAt,
      },
      payload: snapshotPayload,
      lot: reservation.lot,
      userId: user.id,
      now: new Date(),
    });

    res.status(201).json({
      id: result.id,
      version: result.version,
      sha256: result.sha256,
      fileSize: result.fileSize,
      issuedAt: result.issuedAt.toISOString(),
    });
  }),
);

// GET /api/folios/:folioIssueId/download — §10.2: an authenticated app request,
// ownership-checked at the storage-path level, `no-store`. No public link, no
// Supabase signed URL, no email attachment.
foliosRouter.get(
  '/:folioIssueId/download',
  asyncHandler(async (req, res) => {
    const folioIssueId = parseFolioId(req.params.folioIssueId);
    const user = req.user!;

    const issue = await prisma.folioIssue.findUnique({
      where: { id: folioIssueId },
      select: {
        id: true,
        projectId: true,
        lotId: true,
        version: true,
        fileUrl: true,
        sha256: true,
        lot: { select: { lotNumber: true, projectId: true } },
      },
    });
    if (!issue) {
      throw AppError.notFound('Folio');
    }

    await requireFolioProjectAccess(issue.projectId, user);
    if (issue.lot.projectId !== issue.projectId) {
      throw AppError.notFound('Folio');
    }

    // **AT-125**: the SHA is verified BEFORE anything is sent, so an object
    // mutated out of band errors rather than serving.
    const buffer = await loadFolioArtifactBuffer(issue);

    await createAuditLog({
      projectId: issue.projectId,
      userId: user.id,
      entityType: 'folio_issue',
      entityId: issue.id,
      action: AuditAction.FOLIO_DOWNLOADED,
      changes: { lotNumber: issue.lot.lotNumber, version: issue.version },
      req,
    });

    const filename = `folio-${issue.lot.lotNumber}-v${issue.version}.pdf`.replace(
      /[^A-Za-z0-9._-]/g,
      '_',
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.send(buffer);
  }),
);
