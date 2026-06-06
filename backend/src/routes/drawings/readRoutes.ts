import { Router, type Request, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { getPrismaSkipTake, parsePagination } from '../../lib/pagination.js';
import { buildCurrentDrawingSetResponse, buildDrawingListResponse } from './responses.js';
import {
  containsInsensitive,
  DRAWING_STATUSES,
  getOptionalQueryString,
  getOptionalStatusQuery,
  MAX_CURRENT_SET_DOWNLOAD_DRAWINGS,
  MAX_SEARCH_LENGTH,
  parseDrawingRouteParam,
} from './validation.js';
import { requireDrawingReadAccess } from './access.js';

const MAX_REVISION_LENGTH = 40;

export const drawingReadRoutes = Router();

// GET /api/drawings/:projectId - List drawings for a project
drawingReadRoutes.get(
  '/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseDrawingRouteParam(req.params.projectId, 'projectId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    await requireDrawingReadAccess(req.user!, projectId);

    const { page, limit } = parsePagination(req.query);
    const status = getOptionalStatusQuery(req.query);
    const search = getOptionalQueryString(req.query, 'search', MAX_SEARCH_LENGTH);
    const revision = getOptionalQueryString(req.query, 'revision', MAX_REVISION_LENGTH);
    const where: Prisma.DrawingWhereInput = { projectId };
    if (status) where.status = status;
    if (revision) where.revision = revision;
    if (search) {
      where.OR = [
        { drawingNumber: containsInsensitive(search) },
        { title: containsInsensitive(search) },
        { revision: containsInsensitive(search) },
      ];
    }

    const statusCountWhere = (
      drawingStatus: (typeof DRAWING_STATUSES)[number],
    ): Prisma.DrawingWhereInput => ({
      AND: [where, { status: drawingStatus }],
    });

    const [drawings, total, preliminary, forConstruction, asBuilt] = await prisma.$transaction([
      prisma.drawing.findMany({
        where,
        include: {
          document: {
            select: {
              id: true,
              filename: true,
              fileUrl: true,
              fileSize: true,
              mimeType: true,
              uploadedAt: true,
              uploadedBy: { select: { id: true, fullName: true, email: true } },
            },
          },
          supersededBy: { select: { id: true, drawingNumber: true, revision: true } },
          supersedes: { select: { id: true, drawingNumber: true, revision: true } },
        },
        orderBy: [{ drawingNumber: 'asc' }, { revision: 'desc' }],
        ...getPrismaSkipTake(page, limit),
      }),
      prisma.drawing.count({ where }),
      prisma.drawing.count({ where: statusCountWhere('preliminary') }),
      prisma.drawing.count({ where: statusCountWhere('for_construction') }),
      prisma.drawing.count({ where: statusCountWhere('as_built') }),
    ]);

    const stats = {
      total,
      preliminary,
      forConstruction,
      asBuilt,
    };

    res.json(buildDrawingListResponse(drawings, stats, page, limit));
  }),
);

// GET /api/drawings/:projectId/current-set - Get current (non-superseded) drawings for download
drawingReadRoutes.get(
  '/:projectId/current-set',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseDrawingRouteParam(req.params.projectId, 'projectId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    await requireDrawingReadAccess(req.user!, projectId);

    const currentSetWhere: Prisma.DrawingWhereInput = {
      projectId,
      supersededById: null, // Only current versions (not superseded)
    };
    const currentDrawingCount = await prisma.drawing.count({ where: currentSetWhere });
    if (currentDrawingCount > MAX_CURRENT_SET_DOWNLOAD_DRAWINGS) {
      throw AppError.badRequest(
        `Current drawing set exceeds the ${MAX_CURRENT_SET_DOWNLOAD_DRAWINGS} drawing download limit`,
      );
    }

    const currentDrawings = await prisma.drawing.findMany({
      where: currentSetWhere,
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
          },
        },
      },
      orderBy: [{ drawingNumber: 'asc' }, { revision: 'desc' }],
    });

    res.json(buildCurrentDrawingSetResponse(currentDrawings, currentDrawingCount));
  }),
);
