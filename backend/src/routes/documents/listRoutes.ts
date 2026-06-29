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
    requestedSubcontractorCompanyId?: string | null,
  ) => Promise<void>;
  applyDocumentPortalCategoryScope: (
    user: AuthUser,
    projectId: string,
    where: Prisma.DocumentWhereInput,
    requestedSubcontractorCompanyId?: string | null,
  ) => Promise<void>;
};

const UNCATEGORIZED_DOCUMENT_CATEGORY = 'uncategorized';

type DocumentCategoryGroup = {
  category: string | null;
  _count: number | { _all?: number | null } | null;
};

function getDocumentCategoryGroupCount(group: DocumentCategoryGroup): number {
  if (typeof group._count === 'number') {
    return group._count;
  }

  return group._count?._all ?? 0;
}

export function buildDocumentCategoryCounts(
  categoryGroups: DocumentCategoryGroup[],
): Record<string, number> {
  const categories: Record<string, number> = {};
  for (const group of categoryGroups) {
    const category = group.category || 'Uncategorized';
    const count = getDocumentCategoryGroupCount(group);
    if (count > 0) {
      categories[category] = (categories[category] || 0) + count;
    }
  }
  return categories;
}

export function applyDocumentCategoryFilter(
  where: Prisma.DocumentWhereInput,
  category: string,
): void {
  where.category =
    category.trim().toLowerCase() === UNCATEGORIZED_DOCUMENT_CATEGORY ? null : category;
}

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
      const requestedSubcontractorCompanyId = getOptionalQueryString(
        req.query,
        'subcontractorCompanyId',
        maxDocumentIdLength,
      );
      const search = getOptionalQueryString(req.query, 'search', maxSearchLength);
      const dateFrom = getOptionalDateQuery(req.query, 'dateFrom');
      const dateTo = getOptionalDateQuery(req.query, 'dateTo', true);

      const where: Prisma.DocumentWhereInput = { projectId };
      if (category) {
        await requireSubcontractorDocumentPortalAccess(user, projectId, category);
        applyDocumentCategoryFilter(where, category);
      }
      if (documentType) where.documentType = documentType;
      if (lotId) where.lotId = lotId;
      if (getOptionalQueryString(req.query, 'favourite', 16) === 'true') {
        where.isFavourite = true;
      }

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

      await applyDocumentReadScope(user, projectId, where, requestedSubcontractorCompanyId);
      if (!category) {
        await applyDocumentPortalCategoryScope(
          user,
          projectId,
          where,
          requestedSubcontractorCompanyId,
        );
      }

      const pagination = parsePagination(req.query);
      const { skip, take } = getPrismaSkipTake(pagination.page, pagination.limit);

      const [documents, total, categoryGroups] = await Promise.all([
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
        prisma.document.groupBy({
          by: ['category'],
          where,
          _count: { _all: true },
        }),
      ]);

      const categories = buildDocumentCategoryCounts(categoryGroups);

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
