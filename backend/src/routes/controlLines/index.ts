import { Router } from 'express';
import type { ControlLine, Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import {
  requireInternalProjectAccess,
  requireProjectRoleExcludingSubcontractors,
} from '../../lib/projectAccess.js';
import { ROLES } from '../../lib/roles.js';
import { controlLineToWgs84, type ControlPoint } from '../../lib/spatial/controlLineGeometry.js';
import { generateChainageOffsetPolygon } from '../../lib/spatial/lotGeometry.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import {
  cleanSetoutCandidate,
  extractSetoutRawCandidate,
  setoutUpload,
} from './setoutExtraction.js';
import {
  backfillLotGeometriesSchema,
  createControlLineSchema,
  parseProjectRouteParam,
  updateControlLineSchema,
} from './validation.js';

// Control-line setup mirrors lot-setup permissions: owner/admin/project_manager
// may write; any internal project member may read (subcontractors excluded).
const WRITE_ROLES = [ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER] as const;
const WRITE_DENIED_MESSAGE = 'You do not have permission to manage control lines';

const controlLinesRouter = Router();

controlLinesRouter.use(requireAuth);

function mapControlLine(line: ControlLine) {
  return {
    id: line.id,
    projectId: line.projectId,
    name: line.name,
    coordinateSystem: line.coordinateSystem,
    points: line.points,
    geometryWgs84: line.geometryWgs84,
    createdById: line.createdById,
    createdAt: line.createdAt.toISOString(),
    updatedAt: line.updatedAt.toISOString(),
  };
}

// Derived WGS84 LineString cache; also validates the EPSG code + point set.
function deriveGeometry(coordinateSystem: string, points: ControlPoint[]) {
  return controlLineToWgs84(coordinateSystem, points) as unknown as object;
}

interface BackfillCandidate {
  id: string;
  lotNumber: string;
  chainageStart: unknown;
  chainageEnd: unknown;
}

interface BackfillArgs {
  points: ControlPoint[];
  epsg: string;
  controlLineId: string;
  offsetLeft: number;
  offsetRight: number;
}

// One backfilled lot geometry row. Generator range failures (throw AppError)
// bubble to the caller, which records them as skipped lots.
function buildBackfillRow(
  lot: BackfillCandidate,
  args: BackfillArgs,
): Prisma.LotGeometryCreateManyInput {
  const chainageStart = Number(lot.chainageStart);
  const chainageEnd = Number(lot.chainageEnd);
  const generated = generateChainageOffsetPolygon({
    points: args.points,
    epsg: args.epsg,
    chainageStart,
    chainageEnd,
    offsetLeft: args.offsetLeft,
    offsetRight: args.offsetRight,
  });
  return {
    lotId: lot.id,
    kind: 'chainage_offset',
    controlLineId: args.controlLineId,
    chainageStart,
    chainageEnd,
    offsetLeft: args.offsetLeft,
    offsetRight: args.offsetRight,
    geometryWgs84: generated.feature as unknown as Prisma.InputJsonValue,
    areaM2: generated.areaM2,
    lengthM: generated.lengthM,
  };
}

// Split candidate lots into insertable rows and skip records (out-of-range
// chainage etc.). A generator AppError skips just that lot; anything else throws.
function planBackfill(lots: BackfillCandidate[], args: BackfillArgs) {
  const rows: Prisma.LotGeometryCreateManyInput[] = [];
  const skipped: { lotId: string; lotNumber: string; reason: string }[] = [];
  for (const lot of lots) {
    try {
      rows.push(buildBackfillRow(lot, args));
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 400) {
        skipped.push({ lotId: lot.id, lotNumber: lot.lotNumber, reason: err.message });
        continue;
      }
      throw err;
    }
  }
  return { rows, skipped };
}

controlLinesRouter.get(
  '/:projectId/control-lines',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireInternalProjectAccess(req.user!, projectId);

    const controlLines = await prisma.controlLine.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ controlLines: controlLines.map(mapControlLine) });
  }),
);

controlLinesRouter.post(
  '/:projectId/control-lines',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireProjectRoleExcludingSubcontractors(
      projectId,
      req.user!,
      WRITE_ROLES,
      WRITE_DENIED_MESSAGE,
      { requireWritable: true },
    );

    const validation = createControlLineSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { name, coordinateSystem, points } = validation.data;
    const geometryWgs84 = deriveGeometry(coordinateSystem, points);

    const controlLine = await prisma.controlLine.create({
      data: {
        projectId,
        name,
        coordinateSystem,
        points,
        geometryWgs84,
        createdById: req.user!.userId,
      },
    });

    res.status(201).json({ controlLine: mapControlLine(controlLine) });
  }),
);

// AI setout-sheet import: upload a "Geometric Setout Details" PDF/image and get
// back a reviewed candidate (points + guessed EPSG). No DB write — the UI reviews
// and saves via POST /control-lines. Registered before /control-lines/:id so the
// literal `extract-points` suffix wins over the :id parameter route.
controlLinesRouter.post(
  '/:projectId/control-lines/extract-points',
  setoutUpload.single('file'),
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireProjectRoleExcludingSubcontractors(
      projectId,
      req.user!,
      WRITE_ROLES,
      WRITE_DENIED_MESSAGE,
      { requireWritable: true },
    );

    if (!req.file) {
      throw AppError.badRequest('No file uploaded');
    }

    const raw = await extractSetoutRawCandidate(req.file);
    const candidate = cleanSetoutCandidate(raw);

    res.json({ candidate });
  }),
);

// Backfill chainage_offset lot geometries for every chainaged lot in the project
// that does not already have one. Registered BEFORE the `/:id` routes: this is a
// more specific path, and keeping it first is defensive against route shadowing.
controlLinesRouter.post(
  '/:projectId/control-lines/:id/backfill-lot-geometries',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const id = parseProjectRouteParam(req.params.id, 'id');
    await requireProjectRoleExcludingSubcontractors(
      projectId,
      req.user!,
      WRITE_ROLES,
      WRITE_DENIED_MESSAGE,
      { requireWritable: true },
    );

    const validation = backfillLotGeometriesSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const offsetLeft = validation.data.offsetLeft ?? 0;
    const offsetRight = validation.data.offsetRight ?? 0;

    const controlLine = await prisma.controlLine.findFirst({
      where: { id, projectId },
      select: { id: true, coordinateSystem: true, points: true },
    });
    if (!controlLine) {
      throw AppError.notFound('Control line');
    }
    const points = controlLine.points as unknown as ControlPoint[];
    const epsg = controlLine.coordinateSystem;

    // The read-then-createMany below is only idempotent if runs are serialised:
    // two racing backfills (double-click, two tabs) would both pass the `none`
    // filter and insert duplicate footprints. A transaction-scoped advisory lock
    // keyed on the project serialises them without a schema constraint (which
    // would outlaw legitimate multi-segment lots on one control line).
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`backfill:${projectId}`}))`;

      // Chainaged lots with no existing chainage_offset geometry — the `none`
      // filter is what makes a second run a no-op (idempotent).
      const lots = await tx.lot.findMany({
        where: {
          projectId,
          chainageStart: { not: null },
          chainageEnd: { not: null },
          geometries: { none: { kind: 'chainage_offset' } },
        },
        select: { id: true, lotNumber: true, chainageStart: true, chainageEnd: true },
      });

      const { rows, skipped } = planBackfill(lots, {
        points,
        epsg,
        controlLineId: id,
        offsetLeft,
        offsetRight,
      });

      if (rows.length > 0) {
        await tx.lotGeometry.createMany({ data: rows });
      }

      return { created: rows.length, skipped };
    });

    res.json(result);
  }),
);

controlLinesRouter.get(
  '/:projectId/control-lines/:id',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const id = parseProjectRouteParam(req.params.id, 'id');
    await requireInternalProjectAccess(req.user!, projectId);

    const controlLine = await prisma.controlLine.findFirst({
      where: { id, projectId },
    });
    if (!controlLine) {
      throw AppError.notFound('Control line');
    }

    res.json({ controlLine: mapControlLine(controlLine) });
  }),
);

controlLinesRouter.patch(
  '/:projectId/control-lines/:id',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const id = parseProjectRouteParam(req.params.id, 'id');
    await requireProjectRoleExcludingSubcontractors(
      projectId,
      req.user!,
      WRITE_ROLES,
      WRITE_DENIED_MESSAGE,
      { requireWritable: true },
    );

    const validation = updateControlLineSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const existing = await prisma.controlLine.findFirst({
      where: { id, projectId },
    });
    if (!existing) {
      throw AppError.notFound('Control line');
    }

    // Prisma leaves a field unchanged when its value is `undefined`, so unset
    // fields pass through untouched. The WGS84 cache is always recomputed from
    // the merged inputs — cheap for a short LineString and always consistent.
    const data = validation.data;
    const nextCoordinateSystem = data.coordinateSystem ?? existing.coordinateSystem;
    const nextPoints = (data.points ?? existing.points) as unknown as ControlPoint[];

    const controlLine = await prisma.controlLine.update({
      where: { id },
      data: {
        name: data.name,
        coordinateSystem: data.coordinateSystem,
        points: data.points,
        geometryWgs84: deriveGeometry(nextCoordinateSystem, nextPoints),
      },
    });

    res.json({ controlLine: mapControlLine(controlLine) });
  }),
);

controlLinesRouter.delete(
  '/:projectId/control-lines/:id',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const id = parseProjectRouteParam(req.params.id, 'id');
    await requireProjectRoleExcludingSubcontractors(
      projectId,
      req.user!,
      WRITE_ROLES,
      WRITE_DENIED_MESSAGE,
      { requireWritable: true },
    );

    const existing = await prisma.controlLine.findFirst({
      where: { id, projectId },
      select: { id: true },
    });
    if (!existing) {
      throw AppError.notFound('Control line');
    }

    await prisma.controlLine.delete({ where: { id } });

    res.json({ success: true });
  }),
);

export { controlLinesRouter };
