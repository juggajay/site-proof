/**
 * Project lot-geometries read route.
 *
 * One request returns every stored lot footprint for a project (joined with the
 * lot's identity) so the basemap map view renders all lots without an N+1 over
 * `GET /api/lots/:lotId/geometries`.
 *
 * Mounted at `/api/projects`; self-protected via `router.use(requireAuth)` (so
 * routeAuthCoverage treats it as authenticated).
 *
 *   GET /:projectId/lot-geometries
 *
 * Access mirrors the project lots list (`routes/lots/readRoutes.ts`) exactly:
 * any internal project member sees all lots; a subcontractor is scoped to the
 * lots assigned to their company (legacy `assignedSubcontractorId` OR an active
 * assignment). No matching subcontractor company => empty list.
 */

import { Router } from 'express';
import type { LotGeometry, Prisma } from '@prisma/client';

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

const projectLotGeometriesRouter = Router();

projectLotGeometriesRouter.use(requireAuth);

export type GeometryWithLot = LotGeometry & {
  lot: { id: string; lotNumber: string; status: string; activityType: string | null };
};

function toNumber(value: Prisma.Decimal | null): number | null {
  return value != null ? Number(value) : null;
}

export function mapGeometry(g: GeometryWithLot) {
  return {
    id: g.id,
    lotId: g.lotId,
    lotNumber: g.lot.lotNumber,
    status: g.lot.status,
    activityType: g.lot.activityType,
    kind: g.kind,
    controlLineId: g.controlLineId,
    geometryWgs84: g.geometryWgs84,
    areaM2: toNumber(g.areaM2),
    lengthM: toNumber(g.lengthM),
    chainageStart: toNumber(g.chainageStart),
    chainageEnd: toNumber(g.chainageEnd),
  };
}

projectLotGeometriesRouter.get(
  '/:projectId/lot-geometries',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const user = req.user!;

    if (!(await checkProjectAccess(user.id, projectId))) {
      throw AppError.forbidden('Access denied');
    }
    await requireSubcontractorLotPortalModules(user, projectId);

    const lotWhere: Prisma.LotWhereInput = { projectId };

    // Same subcontractor scoping as the lots list: legacy assignment field OR an
    // active assignment row. Empty company set => no visible lots.
    if (user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin') {
      const subcontractorCompanyIds = await getProjectSubcontractorCompanyIds(user.id, projectId);
      if (subcontractorCompanyIds.length === 0) {
        return res.json({ geometries: [] });
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

    const geometries = await prisma.lotGeometry.findMany({
      where: { lot: lotWhere },
      orderBy: { createdAt: 'asc' },
      include: {
        lot: { select: { id: true, lotNumber: true, status: true, activityType: true } },
      },
    });

    res.json({ geometries: geometries.map(mapGeometry) });
  }),
);

export { projectLotGeometriesRouter };
