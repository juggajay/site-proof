/**
 * Lot geometry routes.
 *
 * Turns a lot's chainage window (against a project control line) into a stored
 * WGS84 footprint the map views render. Mounted under lotsRouter, which applies
 * requireAuth route-wide — do NOT add a separate requireAuth here (routeAuth
 * coverage treats the `lots/` prefix as parent-protected).
 *
 *   GET    /:lotId/geometries                 (list a lot's geometries)
 *   POST   /:lotId/geometries                 (generate + store one)
 *   DELETE /:lotId/geometries/:geometryId     (scoped delete)
 */

import { Router } from 'express';
import type { LotGeometry } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import {
  generateChainageOffsetPolygon,
  generateChainagePoint,
} from '../../lib/spatial/lotGeometry.js';
import type { ControlPoint } from '../../lib/spatial/controlLineGeometry.js';
import { requireProjectRole, requireLotReadAccess } from './access.js';
import { parseLotRouteParam } from './requestParsing.js';
import { LOT_EDITORS } from './updateFields.js';

export const lotGeometryRouter = Router();

const WRITE_DENIED_MESSAGE = 'You do not have permission to manage lot geometry';

const createGeometrySchema = z.object({
  kind: z.enum(['chainage_offset', 'point']),
  controlLineId: z.string().trim().min(1).max(120),
  chainageStart: z.number().finite(),
  chainageEnd: z.number().finite().optional(),
  offsetLeft: z.number().finite().min(0).max(1000).optional(),
  offsetRight: z.number().finite().min(0).max(1000).optional(),
});

function toNumber(value: Prisma.Decimal | null): number | null {
  return value != null ? Number(value) : null;
}

function mapGeometry(g: LotGeometry) {
  return {
    id: g.id,
    lotId: g.lotId,
    kind: g.kind,
    controlLineId: g.controlLineId,
    chainageStart: toNumber(g.chainageStart),
    chainageEnd: toNumber(g.chainageEnd),
    offsetLeft: toNumber(g.offsetLeft),
    offsetRight: toNumber(g.offsetRight),
    geometryWgs84: g.geometryWgs84,
    areaM2: toNumber(g.areaM2),
    lengthM: toNumber(g.lengthM),
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

async function loadLotOr404(lotId: string) {
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    select: { id: true, projectId: true },
  });
  if (!lot) {
    throw AppError.notFound('Lot');
  }
  return lot;
}

type CreateGeometryInput = z.infer<typeof createGeometrySchema>;

// Dispatch to the right generator and normalise the persisted chainage/offset
// fields (null for a point). Generator range failures throw AppError → 400.
function buildGeometryFields(points: ControlPoint[], epsg: string, input: CreateGeometryInput) {
  if (input.kind === 'chainage_offset') {
    if (input.chainageEnd === undefined) {
      throw AppError.badRequest('chainageEnd is required for a chainage_offset geometry');
    }
    const offsetLeft = input.offsetLeft ?? 0;
    const offsetRight = input.offsetRight ?? 0;
    const generated = generateChainageOffsetPolygon({
      points,
      epsg,
      chainageStart: input.chainageStart,
      chainageEnd: input.chainageEnd,
      offsetLeft,
      offsetRight,
    });
    return { generated, chainageEnd: input.chainageEnd, offsetLeft, offsetRight };
  }
  const generated = generateChainagePoint({ points, epsg, chainage: input.chainageStart });
  return { generated, chainageEnd: null, offsetLeft: null, offsetRight: null };
}

lotGeometryRouter.get(
  '/:lotId/geometries',
  asyncHandler(async (req, res) => {
    const lotId = parseLotRouteParam(req.params.lotId, 'lotId');
    const lot = await loadLotOr404(lotId);
    await requireLotReadAccess(lot, req.user!, 'You do not have access to this lot');

    const geometries = await prisma.lotGeometry.findMany({
      where: { lotId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ geometries: geometries.map(mapGeometry) });
  }),
);

lotGeometryRouter.post(
  '/:lotId/geometries',
  asyncHandler(async (req, res) => {
    const lotId = parseLotRouteParam(req.params.lotId, 'lotId');
    const lot = await loadLotOr404(lotId);
    await requireProjectRole(lot.projectId, req.user!, LOT_EDITORS, WRITE_DENIED_MESSAGE, {
      requireWritable: true,
    });

    const validation = createGeometrySchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }
    const { kind, controlLineId, chainageStart } = validation.data;

    const controlLine = await prisma.controlLine.findUnique({
      where: { id: controlLineId },
      select: { id: true, projectId: true, coordinateSystem: true, points: true },
    });
    if (!controlLine) {
      throw AppError.notFound('Control line');
    }
    if (controlLine.projectId !== lot.projectId) {
      throw AppError.badRequest('Control line does not belong to this lot’s project');
    }

    const points = controlLine.points as unknown as ControlPoint[];
    const fields = buildGeometryFields(points, controlLine.coordinateSystem, validation.data);

    const created = await prisma.lotGeometry.create({
      data: {
        lotId,
        kind,
        controlLineId,
        chainageStart,
        chainageEnd: fields.chainageEnd,
        offsetLeft: fields.offsetLeft,
        offsetRight: fields.offsetRight,
        geometryWgs84: fields.generated.feature as unknown as Prisma.InputJsonValue,
        areaM2: fields.generated.areaM2,
        lengthM: fields.generated.lengthM,
      },
    });

    res.status(201).json({ geometry: mapGeometry(created) });
  }),
);

lotGeometryRouter.delete(
  '/:lotId/geometries/:geometryId',
  asyncHandler(async (req, res) => {
    const lotId = parseLotRouteParam(req.params.lotId, 'lotId');
    const geometryId = parseLotRouteParam(req.params.geometryId, 'geometryId');
    const lot = await loadLotOr404(lotId);
    await requireProjectRole(lot.projectId, req.user!, LOT_EDITORS, WRITE_DENIED_MESSAGE, {
      requireWritable: true,
    });

    const existing = await prisma.lotGeometry.findFirst({
      where: { id: geometryId, lotId },
      select: { id: true },
    });
    if (!existing) {
      throw AppError.notFound('Lot geometry');
    }

    await prisma.lotGeometry.delete({ where: { id: geometryId } });

    res.json({ success: true });
  }),
);
