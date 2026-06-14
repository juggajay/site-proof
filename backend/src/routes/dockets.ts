import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { sendNotificationIfEnabled } from './notifications.js';
import { parsePagination, getPaginationMeta, getPrismaSkipTake } from '../lib/pagination.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { activeSubcontractorCompanyWhere } from '../lib/projectAccess.js';
import {
  isDocketEntryEditable,
  isSubcontractorUser,
  requireDocketReadAccess,
  requireDocketSubcontractorAccess,
  requireProjectReadAccess,
} from './dockets/access.js';
import {
  DOCKET_SORT_FIELDS,
  createDocketSchema,
  updateDocketSchema,
  parseRequiredQueryString,
  parseDocketRouteParam,
  parseOptionalDocketStatus,
  parseDocketDate,
} from './dockets/validation.js';
import {
  buildDocketCreatedResponse,
  buildDocketUpdatedResponse,
} from './dockets/coreMutationResponses.js';
import { formatDocketDate, formatDocketNumber } from './dockets/formatting.js';
import {
  buildDocketDetailResponse,
  buildDocketListResponse,
  mapDocketListItem,
} from './dockets/presentation.js';
import { assertDocketSubmittable } from './dockets/submissionGuards.js';
import { buildDocketSubmittedNotifications } from './dockets/notifications.js';
import { buildDocketDiaryComparison } from './dockets/diaryComparison.js';
import { buildDocketSubmittedResponse } from './dockets/submissionResponse.js';
import { docketEntriesRouter } from './dockets/entries.js';
import { docketReviewRouter } from './dockets/review.js';
import type { Prisma } from '@prisma/client';

export const docketsRouter = Router();

// Apply authentication middleware to all docket routes
docketsRouter.use(requireAuth);

// GET /api/dockets - List dockets for a project
docketsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const projectId = parseRequiredQueryString(req.query.projectId, 'projectId');
    const status = parseOptionalDocketStatus(req.query.status);

    const projectReadScope = await requireProjectReadAccess(user, projectId);

    // Parse pagination parameters
    const { page, limit, sortBy, sortOrder } = parsePagination(req.query);
    if (sortBy && !DOCKET_SORT_FIELDS.has(sortBy)) {
      throw AppError.badRequest('Invalid sort field');
    }
    const { skip, take } = getPrismaSkipTake(page, limit);

    const whereClause: Prisma.DailyDocketWhereInput = { projectId };

    // Filter by status if provided
    if (status) {
      whereClause.status = status;
    }

    if (projectReadScope.subcontractorCompanyId) {
      whereClause.subcontractorCompanyId = projectReadScope.subcontractorCompanyId;
    }

    const [dockets, total] = await Promise.all([
      prisma.dailyDocket.findMany({
        where: whereClause,
        skip,
        take,
        include: {
          subcontractorCompany: {
            select: {
              id: true,
              companyName: true,
            },
          },
          labourEntries: {
            include: {
              employee: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          plantEntries: {
            include: {
              plant: {
                select: {
                  id: true,
                  type: true,
                  description: true,
                },
              },
            },
          },
        },
        orderBy: sortBy ? { [sortBy]: sortOrder } : { date: 'desc' },
      }),
      prisma.dailyDocket.count({ where: whereClause }),
    ]);

    // Format dockets for response
    const formattedDockets = dockets.map((docket) => mapDocketListItem(docket));

    res.json(buildDocketListResponse(formattedDockets, getPaginationMeta(total, page, limit)));
  }),
);

// POST /api/dockets - Create a new docket
docketsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Validate request body
    const parseResult = createDocketSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { projectId, date, labourHours, plantHours, notes } = parseResult.data;

    if (!isSubcontractorUser(user)) {
      throw AppError.forbidden('Only subcontractors can create dockets');
    }

    // Find user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: {
        userId: user.id,
        subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
      },
      include: {
        subcontractorCompany: {
          select: { projectId: true },
        },
      },
    });

    if (!subcontractorUser) {
      throw AppError.forbidden('Only subcontractors can create dockets');
    }

    const docketDate = parseDocketDate(date);
    const docket = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM subcontractor_companies
        WHERE id = ${subcontractorUser.subcontractorCompanyId}
        FOR UPDATE
      `;

      const existingDocket = await tx.dailyDocket.findFirst({
        where: {
          projectId,
          subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
          date: docketDate,
        },
        select: { id: true },
      });

      if (existingDocket) {
        throw AppError.conflict('A docket already exists for this subcontractor on this date');
      }

      return tx.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
          date: docketDate,
          status: 'draft',
          notes,
          totalLabourSubmitted: labourHours || 0,
          totalPlantSubmitted: plantHours || 0,
        },
        include: {
          subcontractorCompany: {
            select: {
              companyName: true,
            },
          },
        },
      });
    });

    res.status(201).json(buildDocketCreatedResponse(docket));
  }),
);

// GET /api/dockets/:id - Get single docket with full details (Feature #265)
docketsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
        labourEntries: {
          include: {
            employee: { select: { id: true, name: true, role: true, hourlyRate: true } },
            lotAllocations: {
              include: { lot: { select: { id: true, lotNumber: true } } },
            },
          },
          orderBy: { startTime: 'asc' },
        },
        plantEntries: {
          include: {
            plant: {
              select: {
                id: true,
                type: true,
                description: true,
                idRego: true,
                dryRate: true,
                wetRate: true,
              },
            },
          },
          orderBy: { hoursOperated: 'desc' },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketReadAccess(req.user!, docket);

    // Get foreman diary for the same date to compare (Feature #265 Step 3)
    const diary = await prisma.dailyDiary.findFirst({
      where: {
        projectId: docket.projectId,
        date: docket.date,
      },
      include: {
        personnel: {
          select: { id: true, name: true, company: true, role: true },
        },
        plant: {
          select: { id: true, description: true, idRego: true },
        },
        activities: {
          select: { id: true, description: true, lotId: true },
        },
        delays: {
          select: { id: true, delayType: true, durationHours: true, description: true },
        },
      },
    });

    // Feature #265 Steps 3-4 - Summarize the same-day foreman diary and flag
    // docket/diary discrepancies (pure comparison; see dockets/diaryComparison).
    const { foremanDiary, discrepancies } = buildDocketDiaryComparison(docket, diary);

    // Fetch project/user info separately since they're not relations on
    // DailyDocket; the three lookups are independent, so run them together.
    const [project, submittedBy, approvedBy] = await Promise.all([
      prisma.project.findUnique({
        where: { id: docket.projectId },
        select: { id: true, name: true },
      }),
      docket.submittedById
        ? prisma.user.findUnique({
            where: { id: docket.submittedById },
            select: { id: true, fullName: true, email: true },
          })
        : null,
      docket.approvedById
        ? prisma.user.findUnique({
            where: { id: docket.approvedById },
            select: { id: true, fullName: true, email: true },
          })
        : null,
    ]);

    res.json(
      buildDocketDetailResponse({
        docket,
        project,
        submittedBy,
        approvedBy,
        foremanDiary,
        discrepancies,
      }),
    );
  }),
);

// PATCH /api/dockets/:id - Update editable subcontractor docket metadata
docketsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    const parseResult = updateDocketSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { notes } = parseResult.data;
    if (notes === undefined) {
      throw AppError.badRequest('No fields to update');
    }

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }

    await requireDocketSubcontractorAccess(user, docket);

    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only update draft, queried, or rejected dockets');
    }

    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: { notes },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
      },
    });

    res.json(buildDocketUpdatedResponse(updatedDocket));
  }),
);

// POST /api/dockets/:id/submit - Submit a docket for approval
docketsRouter.post(
  '/:id/submit',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { companyName: true },
        },
        project: {
          select: { id: true, name: true },
        },
        labourEntries: {
          include: {
            lotAllocations: true,
          },
        },
        plantEntries: true,
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(user, docket);

    assertDocketSubmittable(docket);

    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: {
        status: 'pending_approval',
        submittedById: user.id,
        submittedAt: new Date(),
      },
    });

    await createAuditLog({
      projectId: docket.projectId,
      userId: user.id,
      entityType: 'daily_docket',
      entityId: docket.id,
      action: AuditAction.DOCKET_SUBMITTED,
      changes: {
        docketNumber: formatDocketNumber(docket.id),
        status: { from: docket.status, to: updatedDocket.status },
        subcontractorCompanyId: docket.subcontractorCompanyId,
        subcontractorCompanyName: docket.subcontractorCompany.companyName,
      },
      req,
    });

    // Feature #926 - Notify foremen and approvers about pending docket
    // Get all project users who can approve dockets (foreman, site_manager, project_manager, admin, owner)
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: docket.projectId,
        role: { in: ['owner', 'admin', 'project_manager', 'site_manager', 'foreman'] },
        status: 'active',
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    // Count total pending dockets for this project
    const pendingCount = await prisma.dailyDocket.count({
      where: {
        projectId: docket.projectId,
        status: 'pending_approval',
      },
    });

    // Create in-app notifications for approvers
    const docketNumber = formatDocketNumber(docket.id);
    const docketDate = formatDocketDate(docket.date);
    const subcontractorName = docket.subcontractorCompany.companyName;

    const { inApp: submittedInApp, email: submittedEmail } = buildDocketSubmittedNotifications({
      projectId: docket.projectId,
      projectName: docket.project.name,
      docketNumber,
      docketDate,
      subcontractorName,
      pendingCount,
    });

    const notificationsToCreate = projectUsers.map((pu) => ({
      userId: pu.userId,
      ...submittedInApp,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // Send email notifications to approvers (if configured)
    for (const pu of projectUsers) {
      try {
        await sendNotificationIfEnabled(pu.userId, 'enabled', submittedEmail);
      } catch {
        // Non-critical: don't fail the main request if email fails
      }
    }

    res.json(buildDocketSubmittedResponse(updatedDocket, projectUsers));
  }),
);

docketsRouter.use(docketReviewRouter);

docketsRouter.use(docketEntriesRouter);
