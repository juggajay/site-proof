/**
 * Lot read routes.
 *
 * Moved verbatim from backend/src/routes/lots.ts as part of the route-handler
 * relocation phase (engineering-health Workstream 1). These are the core
 * authenticated read/detail lot endpoints:
 *
 *   GET /                 (list lots for a project, paginated)
 *   GET /suggest-number   (suggested next lot number for a project)
 *   GET /:id              (single lot detail)
 *
 * Internal route order is load-bearing: the static `/suggest-number` MUST stay
 * before the dynamic `/:id` or it would be swallowed.
 *
 * Auth: lots.ts mounts this router immediately AFTER its route-wide
 * `lotsRouter.use(requireAuth)` (and before the mutation routes), exactly like
 * the diary/ and dockets/ child routers, so every route here is already
 * authenticated. Do NOT add a separate requireAuth here (it would run
 * authentication twice). routeAuthCoverage.test.ts treats the `lots/` prefix as
 * parent-protected for this reason.
 */

import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { getPaginationMeta, getPrismaSkipTake } from '../../lib/pagination.js';
import {
  activeSubcontractorCompanyWhere,
  checkProjectAccess,
  getEffectiveProjectRole,
} from '../../lib/projectAccess.js';
import { lotSortFields, MAX_ID_LENGTH, MAX_SEARCH_LENGTH } from './validation.js';
import {
  isSubcontractorUser,
  canViewLotBudget,
  requireSubcontractorLotPortalModules,
  requireProjectRole,
  getProjectSubcontractorCompanyId,
  requireLotReadAccess,
} from './access.js';
import {
  getRequiredQueryString,
  getOptionalQueryString,
  getOptionalBoundedQueryString,
  parseLotRouteParam,
  getOptionalLotPortalModule,
  parsePositiveIntQuery,
  parseLotStatusFilter,
} from './requestParsing.js';
import { LOT_CREATORS } from './roles.js';
import { resolveLotPrefix, resolveLotStartingNumber, suggestLotNumber } from './suggestNumber.js';
import { presentLotList } from './listPresentation.js';
import { shapeLotDetailResponse } from './detailPresentation.js';
import { buildLotListOrderBy, buildLotListSelect, buildLotListWhere } from './listQuery.js';
import {
  buildLotDetailEnvelope,
  buildLotListEnvelope,
  buildSuggestedLotNumberResponse,
} from './coreResponses.js';

export const lotReadRouter = Router();
const MAX_SUGGEST_NUMBER_LOT_SCAN_RESULTS = 10_000;

// GET /api/lots - List all lots for a project (paginated)
lotReadRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const projectId = getRequiredQueryString(req.query, 'projectId', MAX_ID_LENGTH);
    const status = getOptionalQueryString(req.query, 'status');
    const unclaimed = getOptionalQueryString(req.query, 'unclaimed');
    const includeITP = getOptionalQueryString(req.query, 'includeITP');
    const portalModule = getOptionalLotPortalModule(req.query);
    const sortBy = getOptionalQueryString(req.query, 'sortBy');
    const sortOrderParam = getOptionalQueryString(req.query, 'sortOrder');
    const search = getOptionalBoundedQueryString(req.query, 'search', MAX_SEARCH_LENGTH);

    if (unclaimed !== undefined && unclaimed !== 'true' && unclaimed !== 'false') {
      throw AppError.badRequest('unclaimed must be true or false');
    }

    if (includeITP !== undefined && includeITP !== 'true' && includeITP !== 'false') {
      throw AppError.badRequest('includeITP must be true or false');
    }

    if (sortBy !== undefined && !lotSortFields.includes(sortBy as (typeof lotSortFields)[number])) {
      throw AppError.badRequest(`sortBy must be one of: ${lotSortFields.join(', ')}`);
    }

    if (sortOrderParam !== undefined && sortOrderParam !== 'asc' && sortOrderParam !== 'desc') {
      throw AppError.badRequest('sortOrder must be asc or desc');
    }
    const sortOrder: Prisma.SortOrder = sortOrderParam ?? 'desc';

    // Parse pagination parameters
    const page = parsePositiveIntQuery(req.query, 'page', 1);
    const limit = parsePositiveIntQuery(req.query, 'limit', 20, 100);
    const { skip, take } = getPrismaSkipTake(page, limit);

    // Build where clause based on user role
    const whereClause: Prisma.LotWhereInput = { projectId };
    let subcontractorCompanyId: string | null = null;

    const hasProjectAccess = await checkProjectAccess(user.id, projectId);
    if (!hasProjectAccess) {
      throw AppError.forbidden('Access denied');
    }

    const effectiveProjectRole = isSubcontractorUser(user)
      ? null
      : await getEffectiveProjectRole(user, projectId, {
          excludeSubcontractorProjectMemberships: true,
          throwIfProjectMissing: true,
        });
    const canViewBudgetAmount = canViewLotBudget(effectiveProjectRole);

    await requireSubcontractorLotPortalModules(
      user,
      projectId,
      portalModule === 'itps' || includeITP === 'true' ? ['itps'] : [],
    );

    // Filter by status if provided
    if (status) {
      whereClause.status = parseLotStatusFilter(status);
    }

    // Filter for unclaimed lots (no claimedInId)
    if (unclaimed === 'true') {
      whereClause.claimedInId = null;
    }

    // Subcontractors can only see lots assigned to their company
    if (user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin') {
      // Find the user's subcontractor company for this project
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: {
          userId: user.id,
          subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
        },
        include: { subcontractorCompany: true },
      });

      if (subcontractorUser) {
        const subCompanyId = subcontractorUser.subcontractorCompanyId;
        subcontractorCompanyId = subCompanyId;

        // Include lots from both legacy field AND new assignment model
        whereClause.OR = [
          { assignedSubcontractorId: subCompanyId },
          {
            subcontractorAssignments: {
              some: {
                subcontractorCompanyId: subCompanyId,
                status: 'active',
                projectId,
              },
            },
          },
        ];
      } else {
        // No subcontractor company found - return empty result with pagination
        return res.json(buildLotListEnvelope([], getPaginationMeta(0, page, limit)));
      }
    }

    const finalWhereClause = buildLotListWhere(whereClause, search);
    const selectClause = buildLotListSelect(includeITP === 'true');

    // Determine sort field - default to lotNumber for lots
    const orderBy = buildLotListOrderBy(sortBy, sortOrder);

    // Execute count and findMany in parallel for efficiency
    const [lots, total] = await Promise.all([
      prisma.lot.findMany({
        where: finalWhereClause,
        select: selectClause,
        orderBy,
        skip,
        take,
      }),
      prisma.lot.count({ where: finalWhereClause }),
    ]);

    // Transform response to match frontend expectations
    // (budget visibility, subcontractor-assignment filtering, itpInstances shape)
    const transformedLots = presentLotList(lots, {
      canViewBudgetAmount,
      subcontractorCompanyId,
      includeITP: includeITP === 'true',
    });

    res.json(buildLotListEnvelope(transformedLots, getPaginationMeta(total, page, limit)));
  }),
);

// GET /api/lots/suggest-number - Get suggested next lot number for a project
lotReadRouter.get(
  '/suggest-number',
  asyncHandler(async (req, res) => {
    const projectId = getRequiredQueryString(req.query, 'projectId', MAX_ID_LENGTH);
    const user = req.user!;

    await requireProjectRole(
      projectId,
      user,
      LOT_CREATORS,
      'You do not have permission to create lots in this project.',
    );

    // Get project settings
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        lotPrefix: true,
        lotStartingNumber: true,
      },
    });

    if (!project) {
      throw AppError.notFound('Project');
    }

    const prefix = resolveLotPrefix(project.lotPrefix);
    const startingNumber = resolveLotStartingNumber(project.lotStartingNumber);

    // Find the highest existing lot number with this prefix
    const existingLots = await prisma.lot.findMany({
      where: {
        projectId,
        lotNumber: { startsWith: prefix },
      },
      select: { lotNumber: true },
      orderBy: { lotNumber: 'desc' },
      take: MAX_SUGGEST_NUMBER_LOT_SCAN_RESULTS,
    });

    const { suggestedNumber, nextNumber } = suggestLotNumber({
      prefix,
      startingNumber,
      existingLotNumbers: existingLots.map((lot) => lot.lotNumber),
    });

    res.json(buildSuggestedLotNumberResponse(suggestedNumber, prefix, nextNumber, startingNumber));
  }),
);

// GET /api/lots/:id - Get a single lot
lotReadRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseLotRouteParam(req.params.id, 'id');
    const user = req.user!;
    const portalModule = getOptionalLotPortalModule(req.query);

    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        lotNumber: true,
        description: true,
        status: true,
        activityType: true,
        budgetAmount: true,
        chainageStart: true,
        chainageEnd: true,
        offset: true,
        offsetCustom: true,
        layer: true,
        areaZone: true,
        projectId: true,
        assignedSubcontractorId: true,
        assignedSubcontractor: {
          select: {
            id: true,
            companyName: true,
          },
        },
        // Include subcontractor assignments with ITP permissions
        subcontractorAssignments: {
          where: { status: 'active' },
          select: {
            id: true,
            subcontractorCompanyId: true,
            canCompleteITP: true,
            itpRequiresVerification: true,
            subcontractorCompany: {
              select: { id: true, companyName: true },
            },
          },
        },
        createdAt: true,
        updatedAt: true,
        conformedAt: true,
        conformedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        _count: {
          select: {
            testResults: true,
            ncrLots: true,
            documents: true,
          },
        },
        itpInstance: {
          select: { id: true },
        },
      },
    });

    if (!lot) {
      throw AppError.notFound('Lot');
    }

    await requireLotReadAccess(lot, user);
    await requireSubcontractorLotPortalModules(
      user,
      lot.projectId,
      portalModule === 'itps' ? ['itps'] : [],
    );

    // Shape the response: strip internal fields and scope assignments for
    // subcontractor users (route owns resolving their company id via the DB).
    const isSubcontractor = isSubcontractorUser(user);
    const effectiveProjectRole = isSubcontractor
      ? null
      : await getEffectiveProjectRole(user, lot.projectId, {
          excludeSubcontractorProjectMemberships: true,
          throwIfProjectMissing: true,
        });
    const canViewBudgetAmount = canViewLotBudget(effectiveProjectRole);
    const subcontractorCompanyId = isSubcontractor
      ? await getProjectSubcontractorCompanyId(user.id, lot.projectId)
      : null;

    const lotResponse = shapeLotDetailResponse(lot, {
      isSubcontractor,
      subcontractorCompanyId,
      canViewBudgetAmount,
    });

    res.json(buildLotDetailEnvelope(lotResponse));
  }),
);
