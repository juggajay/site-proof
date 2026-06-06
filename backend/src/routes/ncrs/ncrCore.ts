// NCR CRUD: create, list, get, update, delete
import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { type AuthUser } from '../../lib/auth.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { parsePagination, getPrismaSkipTake } from '../../lib/pagination.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import {
  activeSubcontractorCompanyWhere,
  requireSubcontractorPortalModuleAccess,
} from '../../lib/projectAccess.js';
import {
  canReadNcr,
  NCR_CREATE_ROLES,
  parseNcrRouteParam,
  requireActiveProjectUser,
} from './ncrAccess.js';
import { logError } from '../../lib/serverLogger.js';
import {
  buildNcrListResponse,
  buildNcrResponse,
  buildNcrUpdatedResponse,
} from './ncrCoreResponses.js';
import {
  createNcrSchema,
  getNextNcrNumber,
  getOptionalQueryString,
  isUniqueConstraintOn,
  parseNcrSortBy,
  parseOptionalNcrDueDate,
  updateNcrSchema,
} from './ncrCoreValidation.js';

export const ncrCoreRouter = Router();
const NCR_NUMBER_RETRY_LIMIT = 5;

async function requireNcrLotsInProject(projectId: string, lotIds: string[]): Promise<string[]> {
  const uniqueLotIds = [...new Set(lotIds)];
  if (uniqueLotIds.length === 0) {
    return uniqueLotIds;
  }

  const matchingLots = await prisma.lot.findMany({
    where: {
      projectId,
      id: { in: uniqueLotIds },
    },
    select: { id: true },
  });

  if (matchingLots.length !== uniqueLotIds.length) {
    throw AppError.badRequest('All NCR lots must belong to the NCR project');
  }

  return uniqueLotIds;
}

async function requireActiveResponsibleUser(
  projectId: string,
  responsibleUserId?: string | null,
): Promise<void> {
  if (!responsibleUserId) {
    return;
  }

  const responsibleProjectUser = await prisma.projectUser.findFirst({
    where: {
      projectId,
      userId: responsibleUserId,
      status: 'active',
    },
    select: { userId: true },
  });

  if (!responsibleProjectUser) {
    throw AppError.badRequest('Responsible user must be an active member of this project');
  }
}

// GET /api/ncrs - List all NCRs for user's projects
ncrCoreRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const requestedProjectId = getOptionalQueryString(req.query, 'projectId');
    const status = getOptionalQueryString(req.query, 'status');
    const severity = getOptionalQueryString(req.query, 'severity');
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

    // Get projects the user has access to
    const [projectAccess, companyProjectAccess, subcontractorProjectAccess] = await Promise.all([
      prisma.projectUser.findMany({
        where: { userId: user.userId, status: 'active' },
        select: { projectId: true, role: true },
      }),
      userDetails?.companyId &&
      (userDetails.roleInCompany === 'owner' || userDetails.roleInCompany === 'admin')
        ? prisma.project.findMany({
            where: { companyId: userDetails.companyId },
            select: { id: true },
          })
        : Promise.resolve([]),
      userDetails?.roleInCompany === 'subcontractor' ||
      userDetails?.roleInCompany === 'subcontractor_admin'
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

    if (requestedProjectId) {
      if (!accessibleProjectIds.includes(requestedProjectId)) {
        throw AppError.forbidden('Access denied to this project');
      }
      await requireSubcontractorPortalModuleAccess({
        userId: user.userId,
        role: userDetails?.roleInCompany,
        projectId: requestedProjectId,
        module: 'ncrs',
      });
      where.projectId = requestedProjectId;
    } else if (
      userDetails?.roleInCompany === 'subcontractor' ||
      userDetails?.roleInCompany === 'subcontractor_admin'
    ) {
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
    }

    if (status) {
      where.status = status as string;
    }

    if (severity) {
      where.severity = severity as string;
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
    if (
      userDetails?.roleInCompany === 'subcontractor' ||
      userDetails?.roleInCompany === 'subcontractor_admin'
    ) {
      // Find the user's subcontractor company
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: {
          userId: user.userId,
          subcontractorCompany: activeSubcontractorCompanyWhere(
            requestedProjectId ? { projectId: requestedProjectId } : {},
          ),
        },
        include: { subcontractorCompany: true },
      });

      if (subcontractorUser) {
        const subCompanyId = subcontractorUser.subcontractorCompanyId;

        // Get lots assigned via LotSubcontractorAssignment (new model)
        const lotAssignments = await prisma.lotSubcontractorAssignment.findMany({
          where: {
            subcontractorCompanyId: subCompanyId,
            status: 'active',
            ...(requestedProjectId ? { projectId: requestedProjectId } : {}),
          },
          select: { lotId: true },
        });
        const assignmentLotIds = lotAssignments.map((a) => a.lotId);

        // Get lots assigned via legacy field
        const legacyLots = await prisma.lot.findMany({
          where: {
            assignedSubcontractorId: subCompanyId,
            ...(requestedProjectId ? { projectId: requestedProjectId } : {}),
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
          { responsibleSubcontractorId: subCompanyId },
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
            { responsibleSubcontractorId: subCompanyId },
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
          responsibleUser: { select: { fullName: true, email: true } },
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

// GET /api/ncrs/:id - Get single NCR
ncrCoreRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        project: { select: { name: true, projectNumber: true } },
        raisedBy: { select: { fullName: true, email: true } },
        responsibleUser: { select: { fullName: true, email: true } },
        verifiedBy: { select: { fullName: true, email: true } },
        closedBy: { select: { fullName: true, email: true } },
        qmApprovedBy: { select: { fullName: true, email: true } },
        ncrLots: {
          include: {
            lot: { select: { id: true, lotNumber: true, description: true } },
          },
        },
        ncrEvidence: {
          include: {
            document: { select: { id: true, filename: true, fileUrl: true } },
          },
        },
      },
    });

    if (!ncr) {
      throw AppError.notFound('NCR not found');
    }

    if (!(await canReadNcr(ncr, user))) {
      throw AppError.forbidden('Access denied');
    }

    res.json(buildNcrResponse(ncr));
  }),
);

// POST /api/ncrs - Create new NCR
ncrCoreRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = createNcrSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const user = req.user as AuthUser;
    const {
      projectId,
      description,
      specificationReference,
      category,
      severity,
      responsibleUserId,
      dueDate,
      lotIds,
    } = validation.data;

    await requireActiveProjectUser(
      projectId,
      user,
      'You do not have permission to create NCRs for this project',
      NCR_CREATE_ROLES,
    );

    const ncrLotIds = await requireNcrLotsInProject(projectId, lotIds || []);
    await requireActiveResponsibleUser(projectId, responsibleUserId);
    const parsedDueDate = parseOptionalNcrDueDate(dueDate);

    // Major NCRs require QM approval to close and client notification
    const isMajor = severity === 'major';

    let ncr:
      | Prisma.NCRGetPayload<{
          include: {
            project: { select: { name: true } };
            raisedBy: { select: { fullName: true; email: true } };
            ncrLots: { include: { lot: { select: { lotNumber: true } } } };
          };
        }>
      | undefined;

    for (let attempt = 1; attempt <= NCR_NUMBER_RETRY_LIMIT; attempt += 1) {
      try {
        ncr = await prisma.$transaction(async (tx) => {
          const existingNcrNumbers = await tx.nCR.findMany({
            where: {
              projectId,
              ncrNumber: { startsWith: 'NCR-' },
            },
            select: { ncrNumber: true },
          });
          const ncrNumber = getNextNcrNumber(existingNcrNumbers);

          const createdNcr = await tx.nCR.create({
            data: {
              projectId,
              ncrNumber,
              description,
              specificationReference,
              category,
              severity: severity || 'minor',
              qmApprovalRequired: isMajor,
              clientNotificationRequired: isMajor, // Feature #213: Major NCRs require client notification
              raisedById: user.userId,
              responsibleUserId,
              dueDate: parsedDueDate,
              ncrLots: ncrLotIds.length
                ? {
                    create: ncrLotIds.map((lotId: string) => ({
                      lotId,
                    })),
                  }
                : undefined,
            },
            include: {
              project: { select: { name: true } },
              raisedBy: { select: { fullName: true, email: true } },
              ncrLots: {
                include: {
                  lot: { select: { lotNumber: true } },
                },
              },
            },
          });

          // Update affected lots status in the same transaction as the NCR record.
          if (ncrLotIds.length) {
            await tx.lot.updateMany({
              where: { id: { in: ncrLotIds }, projectId },
              data: { status: 'ncr_raised' },
            });
          }

          return createdNcr;
        });
        break;
      } catch (error) {
        if (
          attempt < NCR_NUMBER_RETRY_LIMIT &&
          isUniqueConstraintOn(error, ['projectId', 'ncrNumber'])
        ) {
          continue;
        }
        throw error;
      }
    }

    if (!ncr) {
      throw AppError.conflict('Could not allocate an NCR number. Please try again.');
    }

    await createAuditLog({
      projectId,
      userId: user.userId,
      entityType: 'ncr',
      entityId: ncr.id,
      action: AuditAction.NCR_CREATED,
      changes: {
        ncrNumber: ncr.ncrNumber,
        status: ncr.status,
        severity: ncr.severity,
        category: ncr.category,
        lotIds: ncrLotIds,
      },
      req,
    });

    // Feature #212: Notify responsible party when assigned to NCR
    if (responsibleUserId && responsibleUserId !== user.userId) {
      const raisedByUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { fullName: true, email: true },
      });
      const raisedByName = raisedByUser?.fullName || raisedByUser?.email || 'Someone';

      await prisma.notification.create({
        data: {
          userId: responsibleUserId,
          projectId,
          type: 'ncr_assigned',
          title: `NCR Assigned to You`,
          message: `${raisedByName} assigned ${ncr.ncrNumber} to you: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
          linkUrl: `/projects/${projectId}/ncr`,
        },
      });
    }

    // Notify head contractor users when a subcontractor raises an NCR
    // Check if the user is a subcontractor
    const raisedByUserInfo = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { roleInCompany: true, fullName: true, email: true },
    });

    if (
      raisedByUserInfo &&
      ['subcontractor', 'subcontractor_admin'].includes(raisedByUserInfo.roleInCompany || '')
    ) {
      // Get head contractor users (project managers, quality managers, admins) on this project
      const headContractorUsers = await prisma.projectUser.findMany({
        where: {
          projectId,
          role: { in: ['project_manager', 'quality_manager', 'admin', 'owner', 'site_manager'] },
          status: 'active',
        },
        select: { userId: true },
      });

      // Create notifications for head contractor users
      if (headContractorUsers.length > 0) {
        const raisedByName =
          raisedByUserInfo.fullName || raisedByUserInfo.email || 'A subcontractor';
        const lotNumbers = ncr.ncrLots.map((nl) => nl.lot.lotNumber).join(', ') || 'No lots';

        await prisma.notification.createMany({
          data: headContractorUsers.map((pu) => ({
            userId: pu.userId,
            projectId,
            type: 'ncr_raised',
            title: `NCR Raised by Subcontractor`,
            message: `${raisedByName} raised ${ncr.ncrNumber} for ${lotNumbers}: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
            linkUrl: `/projects/${projectId}/ncr`,
          })),
        });
      }
    }

    res.status(201).json(buildNcrResponse(ncr));
  }),
);

// Feature #636: PATCH /api/ncrs/:id - Update NCR (including redirect to different responsible party)
ncrCoreRouter.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = updateNcrSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    // Note: user authenticated via requireAuth middleware
    const id = parseNcrRouteParam(req.params.id, 'id');
    const { responsibleUserId, comments } = validation.data;

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        project: true,
        responsibleUser: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!ncr) {
      throw AppError.notFound('NCR not found');
    }

    const user = req.user as AuthUser;
    await requireActiveProjectUser(
      ncr.projectId,
      user,
      'Only Project Managers, Quality Managers, Site Managers, or Admins can update NCR assignments',
      ['quality_manager', 'admin', 'owner', 'project_manager', 'site_manager'],
    );

    // Build update data
    const updateData: Prisma.NCRUncheckedUpdateInput = {};

    // If responsibleUserId is being changed (redirect)
    if (responsibleUserId !== undefined && responsibleUserId !== ncr.responsibleUserId) {
      await requireActiveResponsibleUser(ncr.projectId, responsibleUserId);

      updateData.responsibleUserId = responsibleUserId || null;

      // If redirecting to a new user, create a notification
      if (responsibleUserId) {
        try {
          await prisma.notification.create({
            data: {
              userId: responsibleUserId,
              projectId: ncr.projectId,
              type: 'ncr_redirect',
              title: 'NCR Redirected to You',
              message: `NCR #${ncr.ncrNumber} "${ncr.description.substring(0, 50)}..." has been redirected to you for response`,
              linkUrl: `/projects/${ncr.projectId}/ncr`,
            },
          });
        } catch (notifError) {
          logError('Failed to create redirect notification:', notifError);
        }
      }
    }

    // If comments are provided, add them as revision comments
    if (comments) {
      updateData.qmReviewComments = comments;
    }

    if (Object.keys(updateData).length === 0) {
      throw AppError.badRequest('No fields to update');
    }

    const updatedNcr = await prisma.nCR.update({
      where: { id },
      data: updateData,
      include: {
        responsibleUser: { select: { id: true, fullName: true, email: true } },
        raisedBy: { select: { id: true, fullName: true, email: true } },
        ncrLots: {
          include: {
            lot: { select: { id: true, lotNumber: true } },
          },
        },
      },
    });

    res.json(buildNcrUpdatedResponse(updatedNcr));
  }),
);
