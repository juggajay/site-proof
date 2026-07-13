/**
 * Lot status timeline (map time scrubber).
 *
 * One request returns every status-change event for a project's lots so the map
 * can recolour each polygon to its status on any past date. The backend ships
 * clean, sorted events; status-at-date replay happens client-side.
 *
 * Mounted at `/api/projects`; self-protected via `router.use(requireAuth)` (so
 * routeAuthCoverage treats it as authenticated).
 *
 *   GET /:projectId/lots/status-timeline
 *
 * Subcontractor scoping is IDENTICAL to the lots list / lot-geometries read
 * route and find-by-area (`projectLotGeometries.ts`, `spatialSearch.ts`): a
 * subbie only sees lots assigned to their company (legacy field OR an active
 * assignment). No matching subcontractor company => empty timeline.
 */

import { Router } from 'express';
import type { Prisma } from '@prisma/client';

import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { prisma } from '../lib/prisma.js';
import { checkProjectAccess } from '../lib/projectAccess.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { parseProjectRouteParam } from './controlLines/validation.js';
import {
  getProjectSubcontractorCompanyIds,
  requireSubcontractorLotPortalModules,
} from './lots/access.js';
import { buildStatusTimeline, lotStatusEventsFromAudit } from './lots/statusTimeline.js';

const lotStatusTimelineRouter = Router();

lotStatusTimelineRouter.use(requireAuth);

// Audit actions that carry a lot-status transition; used to filter the query so
// a huge audit trail does not load unrelated rows.
const LOT_STATUS_ACTIONS = ['lot_updated', 'lot_status_changed', 'lot_force_conformed'];

lotStatusTimelineRouter.get(
  '/:projectId/lots/status-timeline',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const user = req.user!;

    if (!(await checkProjectAccess(user.id, projectId))) {
      throw AppError.forbidden('Access denied');
    }
    await requireSubcontractorLotPortalModules(user, projectId);

    // Same subcontractor scoping as the lots list: legacy assignment field OR an
    // active assignment row. Empty company set => no visible lots.
    const lotWhere: Prisma.LotWhereInput = { projectId };
    if (user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin') {
      const subcontractorCompanyIds = await getProjectSubcontractorCompanyIds(user.id, projectId);
      if (subcontractorCompanyIds.length === 0) {
        return res.json({ earliest: null, lots: [] });
      }
      lotWhere.OR = [
        { assignedSubcontractorId: { in: subcontractorCompanyIds } },
        {
          subcontractorAssignments: {
            some: {
              subcontractorCompanyId: { in: subcontractorCompanyIds },
              status: 'active',
              projectId,
            },
          },
        },
      ];
    }

    const lots = await prisma.lot.findMany({
      where: lotWhere,
      select: { id: true, status: true, createdAt: true },
    });

    if (lots.length === 0) {
      return res.json({ earliest: null, lots: [] });
    }

    // Only status-change audit rows for the visible lots — filtered on
    // entityType/action and the scoped lot id set, selecting only needed columns.
    const auditRows = await prisma.auditLog.findMany({
      where: {
        projectId,
        entityType: 'lot',
        action: { in: LOT_STATUS_ACTIONS },
        entityId: { in: lots.map((l) => l.id) },
      },
      select: { entityId: true, action: true, changes: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const eventsByLot = lotStatusEventsFromAudit(auditRows);
    res.json(buildStatusTimeline(lots, eventsByLot));
  }),
);

export { lotStatusTimelineRouter };
