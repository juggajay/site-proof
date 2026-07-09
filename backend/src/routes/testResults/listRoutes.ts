import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { getPaginationMeta, getPrismaSkipTake, parsePagination } from '../../lib/pagination.js';
import { requireSubcontractorPortalModuleAccess } from '../../lib/projectAccess.js';
import { prisma } from '../../lib/prisma.js';
import {
  getAssignedSubcontractorLotIds,
  getReadableProjectIds,
  isSubcontractorUser,
  requireProjectReadAccess,
  requireTestResultsPortalAccess,
} from './accessControl.js';
import { buildLaboratoriesResponse } from './laboratoryResponses.js';
import {
  buildEmptyTestResultsListResponse,
  buildTestResultsListResponse,
} from './listResponses.js';
import {
  MAX_SEARCH_LENGTH,
  MAX_TEST_ID_LENGTH,
  MAX_UPLOAD_PROJECT_ID_LENGTH,
  normalizeOptionalQueryString,
} from './validation.js';

export const listRoutes = Router();

// GET /api/test-results/laboratories - Get recent laboratory names for auto-population (Feature #470)
listRoutes.get(
  '/laboratories',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const projectId = normalizeOptionalQueryString(
      req.query.projectId,
      'projectId',
      MAX_UPLOAD_PROJECT_ID_LENGTH,
    );
    const search = normalizeOptionalQueryString(req.query.search, 'search', MAX_SEARCH_LENGTH);

    const whereClause: Prisma.TestResultWhereInput = {
      laboratoryName: { not: null },
    };

    if (projectId) {
      await requireProjectReadAccess(projectId, user);
      await requireTestResultsPortalAccess(projectId, user);
      whereClause.projectId = projectId;
      const assignedLotIds = await getAssignedSubcontractorLotIds(projectId, user);
      if (assignedLotIds !== null) {
        if (assignedLotIds.length === 0) {
          return res.json(buildLaboratoriesResponse([]));
        }
        whereClause.lotId = { in: assignedLotIds };
      }
    } else {
      let readableProjectIds = await getReadableProjectIds(user);
      if (readableProjectIds.length === 0) {
        return res.json(buildLaboratoriesResponse([]));
      }

      if (isSubcontractorUser(user)) {
        const portalEnabledProjectIds: string[] = [];
        for (const readableProjectId of readableProjectIds) {
          try {
            await requireTestResultsPortalAccess(readableProjectId, user);
            portalEnabledProjectIds.push(readableProjectId);
          } catch (error) {
            if (!(error instanceof AppError) || error.statusCode !== 403) {
              throw error;
            }
          }
        }

        readableProjectIds = portalEnabledProjectIds;
        if (readableProjectIds.length === 0) {
          return res.json(buildLaboratoriesResponse([]));
        }
      }

      whereClause.projectId = { in: readableProjectIds };
      if (isSubcontractorUser(user)) {
        const assignedLotIdSets = await Promise.all(
          readableProjectIds.map((readableProjectId) =>
            getAssignedSubcontractorLotIds(readableProjectId, user),
          ),
        );
        const assignedLotIds = [...new Set(assignedLotIdSets.flatMap((lotIds) => lotIds ?? []))];
        if (assignedLotIds.length === 0) {
          return res.json(buildLaboratoriesResponse([]));
        }
        whereClause.lotId = { in: assignedLotIds };
      }
    }

    if (search) {
      whereClause.laboratoryName = {
        not: null,
        contains: search,
        mode: 'insensitive',
      };
    }

    // Get distinct laboratory names, ordered by most recently used
    const recentLabs = await prisma.testResult.groupBy({
      by: ['laboratoryName'],
      where: whereClause,
      _max: {
        createdAt: true,
      },
      orderBy: {
        _max: {
          createdAt: 'desc',
        },
      },
      take: 20,
    });

    res.json(buildLaboratoriesResponse(recentLabs.map((lab) => lab.laboratoryName)));
  }),
);

// GET /api/test-results - List all test results for a project
listRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const projectId = normalizeOptionalQueryString(
      req.query.projectId,
      'projectId',
      MAX_UPLOAD_PROJECT_ID_LENGTH,
    );
    const lotId = normalizeOptionalQueryString(req.query.lotId, 'lotId', MAX_TEST_ID_LENGTH);
    const requestedSubcontractorCompanyId = normalizeOptionalQueryString(
      req.query.subcontractorCompanyId,
      'subcontractorCompanyId',
      MAX_TEST_ID_LENGTH,
    );
    const search = normalizeOptionalQueryString(req.query.search, 'search', MAX_SEARCH_LENGTH);

    if (!projectId) {
      throw AppError.badRequest('projectId query parameter is required');
    }

    await requireProjectReadAccess(projectId, user);
    await requireSubcontractorPortalModuleAccess({
      userId: user.id,
      role: user.roleInCompany,
      projectId,
      module: 'testResults',
    });

    // Build where clause
    const whereClause: Prisma.TestResultWhereInput = { projectId };

    // Filter by lot if provided
    if (lotId) {
      whereClause.lotId = lotId;
    }

    const assignedLotIds = await getAssignedSubcontractorLotIds(
      projectId,
      user,
      requestedSubcontractorCompanyId,
    );
    if (assignedLotIds !== null) {
      // Subcontractors can only see test results on their assigned lots.
      if (assignedLotIds.length === 0) {
        return res.json(buildEmptyTestResultsListResponse());
      }

      if (lotId) {
        if (!assignedLotIds.includes(lotId)) {
          return res.json(buildEmptyTestResultsListResponse());
        }
        whereClause.lotId = lotId;
      } else {
        whereClause.lotId = { in: assignedLotIds };
      }
    }

    const pagination = parsePagination(req.query);
    const { skip, take } = getPrismaSkipTake(pagination.page, pagination.limit);
    const finalWhereClause: Prisma.TestResultWhereInput = search
      ? {
          AND: [
            whereClause,
            {
              OR: [
                { testType: { contains: search, mode: 'insensitive' } },
                { testRequestNumber: { contains: search, mode: 'insensitive' } },
                { laboratoryName: { contains: search, mode: 'insensitive' } },
                { laboratoryReportNumber: { contains: search, mode: 'insensitive' } },
                { sampleLocation: { contains: search, mode: 'insensitive' } },
                { resultUnit: { contains: search, mode: 'insensitive' } },
                { status: { contains: search, mode: 'insensitive' } },
                {
                  lot: {
                    is: {
                      lotNumber: { contains: search, mode: 'insensitive' },
                    },
                  },
                },
              ],
            },
          ],
        }
      : whereClause;

    const [testResults, total] = await Promise.all([
      prisma.testResult.findMany({
        where: finalWhereClause,
        select: {
          id: true,
          testType: true,
          testRequestNumber: true,
          laboratoryName: true,
          laboratoryReportNumber: true,
          sampleDate: true,
          sampleLocation: true,
          testDate: true,
          resultDate: true,
          resultValue: true,
          resultUnit: true,
          specificationMin: true,
          specificationMax: true,
          testMethod: true,
          passFail: true,
          status: true,
          verifiedAt: true,
          verifiedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          lotId: true,
          lot: {
            select: {
              id: true,
              lotNumber: true,
            },
          },
          aiExtracted: true, // Feature #200
          certificateDocId: true, // Feature B2: lets the UI show attach vs replace + predict the verify gate
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.testResult.count({ where: finalWhereClause }),
    ]);

    res.json(
      buildTestResultsListResponse(
        testResults,
        getPaginationMeta(total, pagination.page, pagination.limit),
      ),
    );
  }),
);
