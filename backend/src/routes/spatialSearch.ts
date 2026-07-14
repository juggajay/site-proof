/**
 * Find-by-area spatial search (Phase 4a).
 *
 * One POST returns everything inside a map-drawn box for a project: lots whose
 * geometry intersects the box, GPS-tagged photos within the box, and the test
 * results for those intersecting lots.
 *
 * Mounted at `/api/projects`; self-protected via `router.use(requireAuth)`.
 *
 *   POST /:projectId/spatial-search   body { bounds: {west,south,east,north} }
 *
 * Subcontractor scoping is IDENTICAL to the lots list / lot-geometries read
 * route (`routes/lots/readRoutes.ts`, `projectLotGeometries.ts`): a subbie only
 * sees lots assigned to their company (legacy field OR an active assignment),
 * and therefore only those lots' geometries, test results, and photos. Photos
 * not linked to any lot are visible to internal roles only.
 */

import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { prisma } from '../lib/prisma.js';
import { checkProjectAccess } from '../lib/projectAccess.js';
import { featureIntersectsBounds, type SearchBounds } from '../lib/spatial/spatialSearch.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { parseProjectRouteParam } from './controlLines/validation.js';
import { mapGeometry } from './projectLotGeometries.js';
import {
  getProjectSubcontractorCompanyIds,
  requireSubcontractorLotPortalModules,
} from './lots/access.js';

const spatialSearchRouter = Router();

spatialSearchRouter.use(requireAuth);

const RESULT_CAP = 500;

const lng = z.number().finite().min(-180).max(180);
const lat = z.number().finite().min(-90).max(90);

const searchBodySchema = z.object({
  bounds: z
    .object({ west: lng, south: lat, east: lng, north: lat })
    .refine((b) => b.west < b.east, { message: 'west must be less than east' })
    .refine((b) => b.south < b.north, { message: 'south must be less than north' }),
  // Photos-only mode: the map's Photos layer refetches on every pan and reads
  // only `.photos`. This skips the geometry scan + intersection + test-result
  // load, returning empty arrays for those collections (shape unchanged). Absent
  // => full find-by-area behaviour for the draw-a-box search.
  only: z.literal('photos').optional(),
});

function cap<T>(items: T[]): { items: T[]; truncated: boolean } {
  return { items: items.slice(0, RESULT_CAP), truncated: items.length > RESULT_CAP };
}

spatialSearchRouter.post(
  '/:projectId/spatial-search',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const user = req.user!;

    const parsed = searchBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.fromZodError(parsed.error);
    }
    const bounds: SearchBounds = parsed.data.bounds;
    const photosOnly = parsed.data.only === 'photos';

    if (!(await checkProjectAccess(user.id, projectId))) {
      throw AppError.forbidden('Access denied');
    }
    await requireSubcontractorLotPortalModules(user, projectId);

    const isSubcontractor =
      user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin';

    // Same subcontractor scoping as the lots list: legacy assignment field OR an
    // active assignment row. Empty company set => nothing visible.
    const lotWhere: Prisma.LotWhereInput = { projectId };
    let visibleLotIds: Set<string> | null = null; // null = internal (all lots)
    if (isSubcontractor) {
      const subcontractorCompanyIds = await getProjectSubcontractorCompanyIds(user.id, projectId);
      if (subcontractorCompanyIds.length === 0) {
        return res.json({
          lots: [],
          lotsTruncated: false,
          photos: [],
          photosTruncated: false,
          testResults: [],
          testResultsTruncated: false,
        });
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
      const visibleLots = await prisma.lot.findMany({ where: lotWhere, select: { id: true } });
      visibleLotIds = new Set(visibleLots.map((l) => l.id));
    }

    // Lots: load the project's (scoped) geometries and keep those whose Feature
    // intersects the box. One row per lot (first intersecting geometry wins).
    // Photos-only mode skips this scan entirely — with no geometries the
    // intersection loop and the test-result guard below yield empty arrays, so
    // the response shape is unchanged for the map's Photos layer.
    const geometries = photosOnly
      ? []
      : await prisma.lotGeometry.findMany({
          where: { lot: lotWhere },
          orderBy: { createdAt: 'asc' },
          include: {
            lot: { select: { id: true, lotNumber: true, status: true, activityType: true } },
          },
        });

    const seenLotIds = new Set<string>();
    const intersectingLots: ReturnType<typeof mapGeometry>[] = [];
    for (const g of geometries) {
      if (!featureIntersectsBounds(g.geometryWgs84, bounds)) continue;
      if (seenLotIds.has(g.lotId)) continue;
      seenLotIds.add(g.lotId);
      intersectingLots.push(mapGeometry(g));
    }
    const lotsResult = cap(intersectingLots);

    // Photos: project photo documents with GPS inside the box. GPS range filter
    // runs in the DB; subbie scoping (lot must be visible; unlinked photos are
    // internal-only) is applied in app.
    // Bounded server-side with `take` (CAP + 1 so cap() can still detect
    // truncation from the one extra row); the app-side subbie filter + cap()
    // below stay as a belt (a scoped subbie may see fewer than RESULT_CAP).
    const photoRows = await prisma.document.findMany({
      where: {
        projectId,
        documentType: 'photo',
        gpsLatitude: { gte: bounds.south, lte: bounds.north },
        gpsLongitude: { gte: bounds.west, lte: bounds.east },
      },
      orderBy: { captureTimestamp: 'desc' },
      take: RESULT_CAP + 1,
      select: {
        id: true,
        filename: true,
        caption: true,
        captureTimestamp: true,
        lotId: true,
        gpsLatitude: true,
        gpsLongitude: true,
      },
    });
    const visiblePhotos = photoRows.filter((p) => {
      if (!isSubcontractor) return true;
      return p.lotId != null && visibleLotIds!.has(p.lotId);
    });
    const photosResult = cap(visiblePhotos);

    // Test results: for the intersecting lots only (already scoped via lotWhere).
    const intersectingLotIds = intersectingLots.map((l) => l.lotId);
    const testResultRows =
      intersectingLotIds.length === 0
        ? []
        : await prisma.testResult.findMany({
            where: { projectId, lotId: { in: intersectingLotIds } },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              status: true,
              lotId: true,
              testType: true,
              testRequestNumber: true,
            },
          });
    const lotNumberById = new Map(intersectingLots.map((l) => [l.lotId, l.lotNumber]));
    const testResults = testResultRows.map((t) => ({
      ...t,
      lotNumber: t.lotId ? (lotNumberById.get(t.lotId) ?? null) : null,
    }));
    const testResultsResult = cap(testResults);

    res.json({
      lots: lotsResult.items,
      lotsTruncated: lotsResult.truncated,
      photos: photosResult.items,
      photosTruncated: photosResult.truncated,
      testResults: testResultsResult.items,
      testResultsTruncated: testResultsResult.truncated,
    });
  }),
);

export { spatialSearchRouter };
