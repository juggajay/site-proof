// Wave D `D1b` — the two folio routes that hang off a LOT
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §9).
//
//   POST /api/lots/:id/folio/sessions   create the snapshot + reservation
//   GET  /api/lots/:id/folios           the issued version list
//
// Both are THREE-segment paths, so they never collide with the read router's
// dynamic `/:id` — route order is load-bearing in this repo and this is the
// same shape `lots/geometryRoutes.ts` already uses.
//
// NO MULTER. Neither route mounts an upload handler and neither schema has a
// binary or base64 field, so there is no byte channel at all (**AT-143**,
// threat model T-8 point 4). That is a one-line review check and it belongs in
// a comment, because it is the kind of line that gets added later "just for
// attachments".
//
// IT LIVES UNDER `routes/lots/` RATHER THAN `routes/folio/` for one reason
// worth stating: `routeAuthCoverage.test.ts:30-49` treats `lots/` as
// parent-protected because `lots.ts:31` applies `requireAuth` to the whole
// router. A folio router sitting outside that prefix would have needed a new
// allow-list entry asserting the same thing in prose. The rest of the folio
// machinery — access, validation, assembly, issuance, the `/api/folios` routes
// — stays in `routes/folio/`.

import { Router } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { folioSessionRateLimiter } from '../../middleware/rateLimiter.js';
import { parseLotRouteParam } from './requestParsing.js';
import { requireFolioIssuerAccess, requireFolioProjectAccess } from '../folio/access.js';
import { createFolioSession } from '../folio/issuance.js';
import { folioSessionSchema, parseFolioBody } from '../folio/validation.js';

export const lotFolioRouter = Router();

async function loadLot(rawId: unknown) {
  const id = parseLotRouteParam(rawId, 'id');
  const lot = await prisma.lot.findUnique({
    where: { id },
    select: { id: true, projectId: true, lotNumber: true },
  });
  if (!lot) {
    throw AppError.notFound('Lot');
  }
  return lot;
}

// POST /api/lots/:id/folio/sessions — the server assembles EVERYTHING.
//
// The limiter runs before the handler and is keyed on `req.user.id`
// (threat model T-3). The global 1000/min/IP at `server.ts:116` is not a
// mitigation for version exhaustion: it permits 1000 burned versions and 1000
// full payload snapshots a minute, and it identifies an address rather than an
// actor.
lotFolioRouter.post(
  '/:id/folio/sessions',
  folioSessionRateLimiter,
  asyncHandler(async (req, res) => {
    // Strict body: a client-supplied `sha256` or `compiledFrom` is a 400 that
    // NAMES the field, never a silently stripped key and a 201 (**AT-124**).
    parseFolioBody(folioSessionSchema, req.body);

    const lot = await loadLot(req.params.id);
    const user = req.user!;
    await requireFolioIssuerAccess(lot.projectId, user);

    const session = await createFolioSession({
      lotId: lot.id,
      userId: user.id,
      userName: user.fullName || user.email,
      now: new Date(),
    });

    res.status(201).json({
      folioIssueId: session.folioIssueId,
      snapshotId: session.snapshotId,
      version: session.version,
      expiresAt: session.expiresAt.toISOString(),
      evidenceRowCount: session.evidenceRowCount,
    });
  }),
);

// GET /api/lots/:id/folios — the version list (§9).
lotFolioRouter.get(
  '/:id/folios',
  asyncHandler(async (req, res) => {
    const lot = await loadLot(req.params.id);
    await requireFolioProjectAccess(lot.projectId, req.user!);

    const folios = await prisma.folioIssue.findMany({
      where: { lotId: lot.id },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        issuedAt: true,
        sha256: true,
        fileSize: true,
        lotStatusAtIssue: true,
        issuedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    res.json({
      folios: folios.map((folio) => ({
        id: folio.id,
        version: folio.version,
        issuedAt: folio.issuedAt.toISOString(),
        sha256: folio.sha256,
        // BigInt does not survive `JSON.stringify`; the wire type is a number.
        fileSize: Number(folio.fileSize),
        lotStatusAtIssue: folio.lotStatusAtIssue,
        issuedBy: folio.issuedBy
          ? { id: folio.issuedBy.id, name: folio.issuedBy.fullName || folio.issuedBy.email }
          : null,
      })),
    });
  }),
);
