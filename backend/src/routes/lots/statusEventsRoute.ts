// Wave 2 (lot inspector) — the lot's status history as the LotStatusEvent
// ledger records it (#1800 + backfill).
//
//   GET /api/lots/:id/status-events
//
// This deliberately does NOT reuse the audit-derived project timeline
// (`routes/lotStatusTimeline.ts` -> `lots/statusTimeline.ts`): that read
// reconstructs transitions from AuditLog rows and provably misses every
// NCR-driven flip (five write sites never wrote audit rows). The ledger is the
// complete record, so the inspector's history strip reads it directly.
//
// TWO-segment path, so it never collides with the read router's dynamic `/:id`
// — same reasoning as `geometryRoutes.ts` / `folioRoutes.ts`. Mounted in
// `lots.ts` under the router-wide `requireAuth` (routeAuthCoverage treats
// `lots/` as parent-protected).
//
// Access is the SAME rule as GET /:projectId/lots/status-timeline: project
// access required, and a subcontractor caller must have the lot visible under
// the legacy-field-OR-active-assignment rule — an unassigned lot answers 404,
// never 403, so existence is not confirmed.

import { Router } from 'express';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { checkProjectAccess } from '../../lib/projectAccess.js';
import {
  hasAssignedSubcontractorLotAccess,
  isSubcontractorUser,
  requireSubcontractorLotPortalModules,
} from './access.js';
import { parseLotRouteParam } from './requestParsing.js';

export const lotStatusEventsRouter = Router();

lotStatusEventsRouter.get(
  '/:id/status-events',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;

    const lot = await prisma.lot.findUnique({
      where: { id },
      select: { id: true, projectId: true },
    });
    if (!lot) {
      throw AppError.notFound('Lot');
    }

    if (!(await checkProjectAccess(user.id, lot.projectId))) {
      throw AppError.forbidden('Access denied');
    }

    if (isSubcontractorUser(user)) {
      await requireSubcontractorLotPortalModules(user, lot.projectId);
      if (!(await hasAssignedSubcontractorLotAccess(user, lot.projectId, lot.id))) {
        throw AppError.notFound('Lot');
      }
    }

    // The (lotId, effectiveAt) index from #1800 serves this directly.
    const events = await prisma.lotStatusEvent.findMany({
      where: { lotId: id },
      orderBy: { effectiveAt: 'asc' },
      select: {
        fromStatus: true,
        toStatus: true,
        effectiveAt: true,
        recordedAt: true,
        source: true,
      },
    });

    res.json({
      events: events.map((event) => ({
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        effectiveAt: event.effectiveAt.toISOString(),
        recordedAt: event.recordedAt.toISOString(),
        source: event.source,
      })),
    });
  }),
);
