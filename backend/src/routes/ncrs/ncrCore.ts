// NCR CRUD: create, list, get, update, delete
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { type AuthUser } from '../../lib/auth.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { parsePagination, getPaginationMeta, getPrismaSkipTake } from '../../lib/pagination.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  activeSubcontractorCompanyWhere,
  requireSubcontractorPortalModuleAccess,
} from '../../lib/projectAccess.js';
import { canReadNcr, parseNcrRouteParam, requireActiveProjectUser } from './ncrAccess.js';
import { logError } from '../../lib/serverLogger.js';

const NCR_ID_MAX_LENGTH = 120;
const NCR_DESCRIPTION_MAX_LENGTH = 5000;
const NCR_CATEGORY_MAX_LENGTH = 120;
const NCR_SPECIFICATION_REFERENCE_MAX_LENGTH = 300;
const NCR_COMMENT_MAX_LENGTH = 5000;
const NCR_DATE_INPUT_MAX_LENGTH = 64;
const NCR_SUBCONTRACTOR_ROLES = new Set(['subcontractor', 'subcontractor_admin']);

function requiredTrimmedNcrString(fieldName: string, maxLength: number, requiredMessage: string) {
  return z
    .string({
      required_error: requiredMessage,
      invalid_type_error: requiredMessage,
    })
    .trim()
    .min(1, requiredMessage)
    .max(maxLength, `${fieldName} must be ${maxLength} characters or less`);
}

function optionalTrimmedNcrString(fieldName: string, maxLength: number) {
  return z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z
      .string({ invalid_type_error: `${fieldName} must be text` })
      .max(maxLength, `${fieldName} must be ${maxLength} characters or less`)
      .optional(),
  );
}

function nullableOptionalTrimmedNcrString(fieldName: string, maxLength: number) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return value;
      }

      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z
      .string({ invalid_type_error: `${fieldName} must be text` })
      .max(maxLength, `${fieldName} must be ${maxLength} characters or less`)
      .nullable()
      .optional(),
  );
}

// Zod schemas for request validation
const createNcrSchema = z.object({
  projectId: requiredTrimmedNcrString('Project ID', NCR_ID_MAX_LENGTH, 'Project ID is required'),
  description: requiredTrimmedNcrString(
    'Description',
    NCR_DESCRIPTION_MAX_LENGTH,
    'Description is required',
  ),
  specificationReference: optionalTrimmedNcrString(
    'Specification reference',
    NCR_SPECIFICATION_REFERENCE_MAX_LENGTH,
  ),
  category: requiredTrimmedNcrString('Category', NCR_CATEGORY_MAX_LENGTH, 'Category is required'),
  severity: z.enum(['minor', 'major']).optional(),
  responsibleUserId: optionalTrimmedNcrString('Responsible user ID', NCR_ID_MAX_LENGTH),
  dueDate: optionalTrimmedNcrString('dueDate', NCR_DATE_INPUT_MAX_LENGTH),
  lotIds: z
    .array(requiredTrimmedNcrString('Lot ID', NCR_ID_MAX_LENGTH, 'Lot ID is required'))
    .optional(),
});

const updateNcrSchema = z.object({
  responsibleUserId: nullableOptionalTrimmedNcrString('Responsible user ID', NCR_ID_MAX_LENGTH),
  comments: optionalTrimmedNcrString('Comments', NCR_COMMENT_MAX_LENGTH),
});

export const ncrCoreRouter = Router();
const NCR_NUMBER_RETRY_LIMIT = 5;
const NCR_NUMBER_PATTERN = /^NCR-(\d+)$/;
const MAX_NCR_QUERY_LENGTH = 200;
const NCR_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'raisedAt',
  'dueDate',
  'ncrNumber',
  'status',
  'severity',
  'category',
]);

function normalizeUniqueTargetField(value: string) {
  return value.replace(/_/g, '').toLowerCase();
}

function isUniqueConstraintOn(error: unknown, fields: string[]) {
  const candidate = error as { code?: unknown; meta?: { target?: unknown } };
  if (candidate?.code !== 'P2002') {
    return false;
  }

  const target = candidate.meta?.target;
  if (!Array.isArray(target)) {
    return false;
  }

  const normalizedTarget = target
    .filter((field): field is string => typeof field === 'string')
    .map(normalizeUniqueTargetField);
  return fields.every((field) => normalizedTarget.includes(normalizeUniqueTargetField(field)));
}

function getNextNcrNumber(existingNcrNumbers: Array<{ ncrNumber: string }>) {
  const highestSequence = existingNcrNumbers.reduce((highest, ncr) => {
    const match = NCR_NUMBER_PATTERN.exec(ncr.ncrNumber);
    if (!match) {
      return highest;
    }

    return Math.max(highest, Number(match[1]));
  }, 0);

  return `NCR-${String(highestSequence + 1).padStart(4, '0')}`;
}

function getOptionalQueryString(
  query: Request['query'],
  key: string,
  maxLength = MAX_NCR_QUERY_LENGTH,
): string | undefined {
  const value = query[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${key} query parameter must be a single value`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${key} query parameter must not be empty`);
  }
  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${key} query parameter must be ${maxLength} characters or less`);
  }
  return trimmed;
}

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

const DATE_COMPONENT_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;

function assertValidDateComponent(value: string, errorMessage: string) {
  const match = DATE_COMPONENT_INPUT_PATTERN.exec(value);
  if (!match) {
    throw AppError.badRequest(errorMessage);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw AppError.badRequest(errorMessage);
  }
}

function parseOptionalNcrDueDate(value?: string): Date | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  assertValidDateComponent(trimmed, 'dueDate must be a valid date');
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw AppError.badRequest('dueDate must be a valid date');
  }

  return parsed;
}

function parseNcrSortBy(sortBy?: string): keyof Prisma.NCROrderByWithRelationInput | undefined {
  if (!sortBy) {
    return undefined;
  }

  if (!NCR_SORT_FIELDS.has(sortBy)) {
    throw AppError.badRequest(`sortBy must be one of: ${[...NCR_SORT_FIELDS].join(', ')}`);
  }

  return sortBy as keyof Prisma.NCROrderByWithRelationInput;
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

    res.json({
      data: ncrs,
      pagination: getPaginationMeta(total, page, limit),
      ncrs, // Backward compatibility
    });
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

    res.json({ ncr });
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

    // Check project access
    const userDetails = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { roleInCompany: true },
    });

    if (NCR_SUBCONTRACTOR_ROLES.has(userDetails?.roleInCompany || '')) {
      throw AppError.forbidden('Access denied to this project');
    }

    const hasAccess = await prisma.projectUser.findFirst({
      where: {
        projectId,
        userId: user.userId,
        status: 'active',
      },
    });

    if (!hasAccess) {
      throw AppError.forbidden('Access denied to this project');
    }

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

    res.status(201).json({ ncr });
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

    res.json({ ncr: updatedNcr, message: 'NCR updated' });
  }),
);
