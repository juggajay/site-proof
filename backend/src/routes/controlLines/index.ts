import { Router } from 'express';
import type { ControlLine } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import {
  requireInternalProjectAccess,
  requireProjectRoleExcludingSubcontractors,
} from '../../lib/projectAccess.js';
import { ROLES } from '../../lib/roles.js';
import { controlLineToWgs84, type ControlPoint } from '../../lib/spatial/controlLineGeometry.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import {
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
