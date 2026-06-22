// NCR list route
import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { type AuthUser } from '../../lib/auth.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { parsePagination, getPrismaSkipTake } from '../../lib/pagination.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  activeSubcontractorCompanyWhere,
  getActiveSubcontractorPortalCompanyIdsForProject,
  isStandaloneSubcontractorPortalIdentity,
  isSubcontractorPortalRole,
  requireSubcontractorPortalModuleAccess,
} from '../../lib/projectAccess.js';
import { buildNcrListResponse } from './ncrCoreResponses.js';
import {
  getOptionalQueryString,
  parseNcrSeverityFilter,
  parseNcrSortBy,
  parseNcrStatusFilter,
} from './ncrCoreValidation.js';

export const ncrListRouter = Router();

// GET /api/ncrs - List all NCRs for user's projects
ncrListRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const requestedProjectId = getOptionalQueryString(req.query, 'projectId');
    const status = parseNcrStatusFilter(getOptionalQueryString(req.query, 'status'));
    const severity = parseNcrSeverityFilter(getOptionalQueryString(req.query, 'severity'));
    const lotId = getOptionalQueryString(req.query, 'lotId');
    const search = getOptionalQueryString(req.query, 'search');
    const { page, limit, sortBy, sortOrder } = parsePagination(req.query);
    const validatedSortBy = parseNcrSortBy(sortBy);
    const { skip, take } = getPrismaSkipTake(page, limit);

    // Get user details to check role
    const userDetails = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { roleInCompany: true, companyId: true },
    });
    const isSubcontractorRole = isSubcontractorPortalRole(userDetails?.roleInCompany);
    const isStandaloneSubcontractor = userDetails
      ? isStandaloneSubcontractorPortalIdentity(userDetails)
      : false;

    // Get projects the user has access to
    const [projectAccess, companyProjectAccess, subcontractorProjectAccess] = await Promise.all([
      isSubcontractorRole
        ? Promise.resolve([])
        : prisma.projectUser.findMany({
            where: { userId: user.userId, status: 'active' },
            select: { projectId: true, role: true },
          }),
      userDetails?.companyId &&
      !isSubcontractorRole &&
      (userDetails.roleInCompany === 'owner' || userDetails.roleInCompany === 'admin')
        ? prisma.project.findMany({
            where: { companyId: userDetails.companyId },
            select: { id: true },
          })
        : Promise.resolve([]),
      isStandaloneSubcontractor
        ? prisma.subcontractorUser.findMany({
            where: {
              userId: user.userId,
              subcontractorCompany: activeSubcontractorCompanyWhere(),
            },
            select: { subcontractorCompany: { select: { projectId: true } } },
          })
        : Promise.resolve([]),
    ]);

    const accessibleProjectIds = [
      ...new Set([
        ...projectAccess.map((p) => p.projectId),
        ...companyProjectAccess.map((p) => p.id),
        ...subcontractorProjectAccess.map((p) => p.subcontractorCompany.projectId),
      ]),
    ];

    // Build filter
    const where: Prisma.NCRWhereInput = {
      projectId: { in: accessibleProjectIds },
    };
    let scopedSubcontractorProjectIds = accessibleProjectIds;

    if (requestedProjectId) {
      if (!accessibleProjectIds.includes(requestedProjectId)) {
        throw AppError.forbidden('Access denied to this project');
      }
      if (isStandaloneSubcontractor) {
        await requireSubcontractorPortalModuleAccess({
          userId: user.userId,
          role: userDetails?.roleInCompany,
          projectId: requestedProjectId,
          module: 'ncrs',
        });
      }
      where.projectId = requestedProjectId;
      scopedSubcontractorProjectIds = [requestedProjectId];
    } else if (isStandaloneSubcontractor && userDetails) {
      const allowedProjectIds: string[] = [];
      for (const accessibleProjectId of accessibleProjectIds) {
        try {
          await requireSubcontractorPortalModuleAccess({
            userId: user.userId,
            role: userDetails.roleInCompany,
            projectId: accessibleProjectId,
            module: 'ncrs',
          });
          allowedProjectIds.push(accessibleProjectId);
        } catch (error) {
          if (!(error instanceof AppError) || error.statusCode !== 403) {
            throw error;
          }
        }
      }
      where.projectId = { in: allowedProjectIds };
      scopedSubcontractorProjectIds = allowedProjectIds;
    }

    if (status) {
      where.status = status;
    }

    if (severity) {
      where.severity = severity;
    }

    // Filter by lotId - find NCRs linked to this lot
    if (lotId) {
      where.ncrLots = {
        some: {
          lotId,
        },
      };
    }

    // Subcontractors can see NCRs linked to lots assigned to their company OR assigned to them as responsible party
    if (isStandaloneSubcontractor) {
      // Find all of the user's subcontractor companies in the current project scope.
      const subCompanyIds = [
        ...new Set(
          (
            await Promise.all(
              scopedSubcontractorProjectIds.map((scopedProjectId) =>
                getActiveSubcontractorPortalCompanyIdsForProject({
                  userId: user.userId,
                  projectId: scopedProjectId,
                  module: 'ncrs',
                }),
              ),
            )
          ).flat(),
        ),
      ];

      if (subCompanyIds.length > 0) {
        // Get lots assigned via LotSubcontractorAssignment (new model)
        const lotAssignments = await prisma.lotSubcontractorAssignment.findMany({
          where: {
            subcontractorCompanyId: { in: subCompanyIds },
            status: 'active',
            projectId: { in: scopedSubcontractorProjectIds },
          },
          select: { lotId: true },
        });
        const assignmentLotIds = lotAssignments.map((a) => a.lotId);

        // Get lots assigned via legacy field
        const legacyLots = await prisma.lot.findMany({
          where: {
            assignedSubcontractorId: { in: subCompanyIds },
            projectId: { in: scopedSubcontractorProjectIds },
          },
          select: { id: true },
        });
        const legacyLotIds = legacyLots.map((l) => l.id);

        // Combine both sets of lot IDs
        const allAssignedLotIds = [...new Set([...assignmentLotIds, ...legacyLotIds])];

        // Feature #212: Allow subcontractors to see NCRs where they are the responsible party
        // OR NCRs linked to their assigned lots
        where.OR = [
          { responsibleUserId: user.userId }, // NCRs assigned to this user
          { responsibleSubcontractorId: { in: subCompanyIds } },
          ...(allAssignedLotIds.length > 0
            ? [
                {
                  ncrLots: {
                    some: {
                      lotId: { in: allAssignedLotIds },
                    },
                  },
                },
              ]
            : []),
        ];

        // If no assigned lots, only show NCRs where they're responsible
        if (allAssignedLotIds.length === 0) {
          where.OR = [
            { responsibleUserId: user.userId },
            { responsibleSubcontractorId: { in: subCompanyIds } },
          ];
        }
      } else {
        // No subcontractor company found, but they may still be responsible for NCRs
        where.responsibleUserId = user.userId;
      }
    }

    const finalWhere: Prisma.NCRWhereInput = search
      ? {
          AND: [
            where,
            {
              OR: [
                { ncrNumber: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
                { severity: { contains: search, mode: 'insensitive' } },
                { status: { contains: search, mode: 'insensitive' } },
                { specificationReference: { contains: search, mode: 'insensitive' } },
                {
                  ncrLots: {
                    some: {
                      lot: {
                        OR: [
                          { lotNumber: { contains: search, mode: 'insensitive' } },
                          { description: { contains: search, mode: 'insensitive' } },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          ],
        }
      : where;

    const [ncrs, total] = await Promise.all([
      prisma.nCR.findMany({
        where: finalWhere,
        skip,
        take,
        include: {
          project: { select: { name: true, projectNumber: true } },
          raisedBy: { select: { fullName: true, email: true } },
          responsibleUser: { select: { id: true, fullName: true, email: true } },
          responsibleSubcontractor: { select: { id: true, companyName: true } },
          linkedTestResult: {
            select: {
              id: true,
              testType: true,
              testRequestNumber: true,
              passFail: true,
              status: true,
            },
          },
          ncrLots: {
            include: {
              lot: { select: { lotNumber: true, description: true } },
            },
          },
          qmApprovedBy: { select: { fullName: true, email: true } },
        },
        orderBy: validatedSortBy ? { [validatedSortBy]: sortOrder } : { createdAt: 'desc' },
      }),
      prisma.nCR.count({ where: finalWhere }),
    ]);

    res.json(buildNcrListResponse(ncrs, total, page, limit));
  }),
);
