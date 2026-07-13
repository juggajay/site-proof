/**
 * Chainage coverage report (Phase 4b).
 *
 * One GET returns, per control line and work type, how much of the alignment is
 * lotted and conformed, plus the explicit gap ranges — with a WGS84 polygon per
 * gap so the map can hatch the uncovered ground. Read-only, internal-only.
 *
 * Mounted at `/api/projects`; self-protected via `router.use(requireAuth)`.
 *
 *   GET /:projectId/coverage
 *
 * Access: `requireInternalProjectAccess` — any internal project member (viewer
 * included) may read; subcontractors are excluded. Coverage is a whole-of-job QA
 * view, not a per-subbie surface.
 *
 * Semantics choices (documented for reviewers):
 * - Interval source: `chainage_offset` LotGeometry rows tied to the control line
 *   with non-null chainageStart/End, joined to their lot's status + activityType.
 * - "Conformed" = lot status `conformed` or `claimed` (claimed lots passed
 *   conformance). Conformed-over-unconformed precedence lives in coverage.ts.
 * - Gap polygons use constant ±6 m offsets — a visual indication of the gap on
 *   the map, NOT a legal footprint (the real lot width is unknown for a gap).
 * - `unmappedLotCount` = project lots with NO LotGeometry at all. They are
 *   invisible to coverage, so the UI must disclose them (no silent gaps). It is
 *   a PROJECT-WIDE count and lives at the top level of the response — attaching
 *   it per line made multi-line projects overstate exclusions on the PDF.
 * - One malformed control line degrades to an `{ id, name, error }` entry rather
 *   than 500-ing the whole report.
 */

import { Router } from 'express';
import type { Prisma } from '@prisma/client';

import { asyncHandler } from '../lib/asyncHandler.js';
import { prisma } from '../lib/prisma.js';
import { requireInternalProjectAccess } from '../lib/projectAccess.js';
import { computeChainageCoverage, type CoverageLot } from '../lib/spatial/coverage.js';
import { normaliseControlPoints, type ControlPoint } from '../lib/spatial/controlLineGeometry.js';
import { generateChainageOffsetPolygon } from '../lib/spatial/lotGeometry.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { parseProjectRouteParam } from './controlLines/validation.js';

const projectCoverageRouter = Router();

projectCoverageRouter.use(requireAuth);

// Lot statuses that count as conformed coverage.
const CONFORMED_STATUSES = new Set(['conformed', 'claimed']);

// Constant gap-polygon half-width (metres). Visual only — see file header.
const GAP_OFFSET_M = 6;

// Sentinel activity for the cross-activity aggregate group.
const ALL_WORK_TYPES = 'All work types';
const UNASSIGNED = 'Unassigned';

type LineGeometry = {
  lotId: string;
  chainageStart: Prisma.Decimal | null;
  chainageEnd: Prisma.Decimal | null;
  lot: { status: string; activityType: string | null };
};

interface CoverageGapOut {
  start: number;
  end: number;
  lengthM: number;
  polygonWgs84: unknown;
}

interface CoverageGroupOut {
  activityType: string;
  lotCount: number;
  percentLotted: number;
  percentConformed: number;
  coveredLengthM: number;
  conformedLengthM: number;
  gaps: CoverageGapOut[];
}

// Build one activity group: run the coverage engine, then turn each gap into a
// polygon along the control line. Gap chainages are inside the extent (which is
// the control line's own range), so the generator stays in range.
function buildGroup(
  activityType: string,
  geometries: LineGeometry[],
  extent: { start: number; end: number },
  points: ControlPoint[],
  epsg: string,
): CoverageGroupOut {
  const lots: CoverageLot[] = [];
  for (const g of geometries) {
    if (g.chainageStart == null || g.chainageEnd == null) continue;
    lots.push({
      chainageStart: Number(g.chainageStart),
      chainageEnd: Number(g.chainageEnd),
      conformed: CONFORMED_STATUSES.has(g.lot.status),
    });
  }

  const coverage = computeChainageCoverage(extent, lots);

  const gaps: CoverageGapOut[] = coverage.gaps.map((gap) => {
    const { feature } = generateChainageOffsetPolygon({
      points,
      epsg,
      chainageStart: gap.start,
      chainageEnd: gap.end,
      offsetLeft: GAP_OFFSET_M,
      offsetRight: GAP_OFFSET_M,
    });
    return { start: gap.start, end: gap.end, lengthM: gap.lengthM, polygonWgs84: feature };
  });

  return {
    activityType,
    // Distinct lots, not geometry rows — a lot with two segments is one lot.
    lotCount: new Set(geometries.map((g) => g.lotId)).size,
    percentLotted: coverage.percentLotted,
    percentConformed: coverage.percentConformed,
    coveredLengthM: coverage.coveredLengthM,
    conformedLengthM: coverage.conformedLengthM,
    gaps,
  };
}

projectCoverageRouter.get(
  '/:projectId/coverage',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireInternalProjectAccess(req.user!, projectId);

    const [controlLines, geometries, unmappedLotCount] = await Promise.all([
      prisma.controlLine.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, coordinateSystem: true, points: true },
      }),
      prisma.lotGeometry.findMany({
        where: {
          kind: 'chainage_offset',
          controlLineId: { not: null },
          chainageStart: { not: null },
          chainageEnd: { not: null },
          lot: { projectId },
        },
        select: {
          lotId: true,
          controlLineId: true,
          chainageStart: true,
          chainageEnd: true,
          lot: { select: { status: true, activityType: true } },
        },
      }),
      prisma.lot.count({ where: { projectId, geometries: { none: {} } } }),
    ]);

    const byLine = new Map<string, LineGeometry[]>();
    for (const g of geometries) {
      if (!g.controlLineId) continue;
      const list = byLine.get(g.controlLineId) ?? [];
      list.push(g);
      byLine.set(g.controlLineId, list);
    }

    const lines = controlLines.map((line) => {
      try {
        const points = normaliseControlPoints(line.points as unknown as ControlPoint[]);
        const epsg = line.coordinateSystem;
        const extentStart = points[0].chainage;
        const extentEnd = points[points.length - 1].chainage;
        const extent = { start: extentStart, end: extentEnd };

        const lineGeometries = byLine.get(line.id) ?? [];

        // Group by activityType (null -> "Unassigned"), plus an aggregate group.
        const groupsByActivity = new Map<string, LineGeometry[]>();
        for (const g of lineGeometries) {
          const activity = g.lot.activityType ?? UNASSIGNED;
          const list = groupsByActivity.get(activity) ?? [];
          list.push(g);
          groupsByActivity.set(activity, list);
        }

        const groups: CoverageGroupOut[] = [
          buildGroup(ALL_WORK_TYPES, lineGeometries, extent, points, epsg),
          ...[...groupsByActivity.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([activity, groupGeometries]) =>
              buildGroup(activity, groupGeometries, extent, points, epsg),
            ),
        ];

        return {
          id: line.id,
          name: line.name,
          extentStart: extent.start,
          extentEnd: extent.end,
          groups,
        };
      } catch (err) {
        return {
          id: line.id,
          name: line.name,
          error: err instanceof Error ? err.message : 'Could not compute coverage for this line',
        };
      }
    });

    res.json({ controlLines: lines, unmappedLotCount });
  }),
);

export { projectCoverageRouter };
