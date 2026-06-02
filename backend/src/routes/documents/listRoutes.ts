import { Router, Request, Response } from 'express';
import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { checkProjectAccess } from '../../lib/projectAccess.js';
import { parsePagination, getPrismaSkipTake, getPaginationMeta } from '../../lib/pagination.js';
import { buildDocumentsListResponse } from '../documentResponses.js';

type AuthUser = NonNullable<Express.Request['user']>;

type CreateDocumentListRouterDependencies = {
  prisma: PrismaClient;
  maxCategoryLength: number;
  maxDocumentTypeLength: number;
  maxDocumentIdLength: number;
  maxSearchLength: number;
  parseDocumentRouteParam: (value: unknown, fieldName: string) => string;
  getOptionalQueryString: (
    query: Record<string, unknown>,
    fieldName: string,
    maxLength: number,
  ) => string | undefined;
  getOptionalDateQuery: (
    query: Record<string, unknown>,
    fieldName: string,
    endOfDay?: boolean,
  ) => Date | undefined;
  requireSubcontractorDocumentPortalAccess: (
    user: AuthUser,
    projectId: string,
    category?: string | null,
  ) => Promise<void>;
  applyDocumentReadScope: (
    user: AuthUser,
    projectId: string,
    where: Prisma.DocumentWhereInput,
  ) => Promise<void>;
  applyDocumentPortalCategoryScope: (
    user: AuthUser,
    projectId: string,
    where: Prisma.DocumentWhereInput,
  ) => Promise<void>;
};

export function createDocumentListRouter({
  prisma,
  maxCategoryLength,
  maxDocumentTypeLength,
  maxDocumentIdLength,
  maxSearchLength,
  parseDocumentRouteParam,
  getOptionalQueryString,
  getOptionalDateQuery,
  requireSubcontractorDocumentPortalAccess,
  applyDocumentReadScope,
  applyDocumentPortalCategoryScope,
}: CreateDocumentListRouterDependencies) {
  const listRouter = Router();

  listRouter.use(requireAuth);

  // GET /api/documents/:projectId - List documents for a project
  listRouter.get(
    '/:projectId',
    asyncHandler(async (req: Request, res: Response) => {
      const projectId = parseDocumentRouteParam(req.params.projectId, 'projectId');
      const user = req.user!;
      const userId = user.id;

      if (!userId) {
        throw AppError.unauthorized();
      }

      const hasAccess = await checkProjectAccess(userId, projectId);
      if (!hasAccess) {
        throw AppError.forbidden('Access denied');
      }

      const category = getOptionalQueryString(req.query, 'category', maxCategoryLength);
      const documentType = getOptionalQueryString(req.query, 'documentType', maxDocumentTypeLength);
      const lotId = getOptionalQueryString(req.query, 'lotId', maxDocumentIdLength);
      const search = getOptionalQueryString(req.query, 'search', maxSearchLength);
      const dateFrom = getOptionalDateQuery(req.query, 'dateFrom');
      const dateTo = getOptionalDateQuery(req.query, 'dateTo', true);

      const where: Prisma.DocumentWhereInput = { projectId };
      if (category) {
        await requireSubcontractorDocumentPortalAccess(user, projectId, category);
        where.category = category;
      }
      if (documentType) where.documentType = documentType;
      if (lotId) where.lotId = lotId;

      // Feature #249: Date range filtering
      if (dateFrom || dateTo) {
        where.uploadedAt = {};
        if (dateFrom) {
          where.uploadedAt.gte = dateFrom;
        }
        if (dateTo) {
          where.uploadedAt.lte = dateTo;
        }
      }

      // Push search filtering to database
      if (search) {
        where.OR = [
          { filename: { contains: search, mode: 'insensitive' } },
          { caption: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
          { documentType: { contains: search, mode: 'insensitive' } },
        ];
      }

      await applyDocumentReadScope(user, projectId, where);
      if (!category) {
        await applyDocumentPortalCategoryScope(user, projectId, where);
      }

      const pagination = parsePagination(req.query);
      const { skip, take } = getPrismaSkipTake(pagination.page, pagination.limit);

      const [documents, total] = await Promise.all([
        prisma.document.findMany({
          where,
          include: {
            lot: { select: { id: true, lotNumber: true, description: true } },
            uploadedBy: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { uploadedAt: 'desc' },
          skip,
          take,
        }),
        prisma.document.count({ where }),
      ]);

      // Group by category for convenience
      const categories: Record<string, number> = {};
      for (const doc of documents) {
        const cat = doc.category || 'Uncategorized';
        categories[cat] = (categories[cat] || 0) + 1;
      }

      res.json(
        buildDocumentsListResponse(
          documents,
          total,
          categories,
          getPaginationMeta(total, pagination.page, pagination.limit),
        ),
      );
    }),
  );

  return listRouter;
}
