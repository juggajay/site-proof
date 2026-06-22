import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { sendNotificationIfEnabled } from './notifications.js';
import { parsePagination, getPaginationMeta, getPrismaSkipTake } from '../lib/pagination.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { assertProjectAllowsWrite } from '../lib/projectAccess.js';
import {
  getLinkedSubcontractorCompanyIdsForProject,
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
import { lockDocketForEntryMutation } from './dockets/entryTotals.js';
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
    const requestedSubcontractorCompanyId =
      req.query.subcontractorCompanyId === undefined
        ? null
        : parseDocketRouteParam(req.query.subcontractorCompanyId, 'subcontractorCompanyId');

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

    if (requestedSubcontractorCompanyId) {
      if (
        projectReadScope.subcontractorCompanyIds &&
        !projectReadScope.subcontractorCompanyIds.includes(requestedSubcontractorCompanyId)
      ) {
        throw AppError.forbidden('Access denied');
      }
      whereClause.subcontractorCompanyId = requestedSubcontractorCompanyId;
    } else if (projectReadScope.subcontractorCompanyIds) {
      whereClause.subcontractorCompanyId = { in: projectReadScope.subcontractorCompanyIds };
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

    const { projectId, subcontractorCompanyId, date, labourHours, plantHours, notes } =
      parseResult.data;

    if (!isSubcontractorUser(user)) {
      throw AppError.forbidden('Only subcontractors can create dockets');
    }

    const linkedSubcontractorCompanyIds = await getLinkedSubcontractorCompanyIdsForProject(
      user.id,
      projectId,
    );

    if (linkedSubcontractorCompanyIds.length === 0) {
      throw AppError.forbidden('Only subcontractors can create dockets');
    }

    const selectedSubcontractorCompanyId =
      subcontractorCompanyId ?? linkedSubcontractorCompanyIds[0] ?? null;

    if (
      !selectedSubcontractorCompanyId ||
      !linkedSubcontractorCompanyIds.includes(selectedSubcontractorCompanyId)
    ) {
      throw AppError.forbidden('Selected subcontractor company is not linked to this project');
    }

    if (!subcontractorCompanyId && linkedSubcontractorCompanyIds.length > 1) {
      throw AppError.badRequest(
        'subcontractorCompanyId is required when your account is linked to multiple subcontractors for this project',
      );
    }

    await assertProjectAllowsWrite(projectId);

    const docketDate = parseDocketDate(date);
    const docket = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM subcontractor_companies
        WHERE id = ${selectedSubcontractorCompanyId}
        FOR UPDATE
      `;

      const existingDocket = await tx.dailyDocket.findFirst({
        where: {
          projectId,
          subcontractorCompanyId: selectedSubcontractorCompanyId,
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
          subcontractorCompanyId: selectedSubcontractorCompanyId,
          date: docketDate,
          status: 'draft',
          notes,
          // totalLabourSubmitted/totalPlantSubmitted are dollar costs, recomputed
          // from labour/plant entries (see refreshLabourSubmittedTotals). A new
          // docket has no entries, so they start at 0 — never seed them with the
          // submitted HOURS, which corrupts every downstream cost figure.
          totalLabourSubmitted: 0,
          totalPlantSubmitted: 0,
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

    res.status(201).json(
      buildDocketCreatedResponse({
        ...docket,
        labourHours: labourHours || 0,
        plantHours: plantHours || 0,
      }),
    );
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

    const canViewDiaryComparison = !isSubcontractorUser(req.user!);

    // Get foreman diary for the same date to compare (Feature #265 Step 3).
    // Subcontractor docket access is scoped to their own docket; it must not
    // expose head-contractor diary aggregates for the full project day.
    const diary = canViewDiaryComparison
      ? await prisma.dailyDiary.findFirst({
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
        })
      : null;

    const { foremanDiary, discrepancies } = canViewDiaryComparison
      ? buildDocketDiaryComparison(docket, diary)
      : {
          foremanDiary: null,
          discrepancies: [],
        };

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

    const updatedDocket = await prisma.$transaction(async (tx) => {
      const lockedDocket = await lockDocketForEntryMutation(tx, id);
      if (!lockedDocket) {
        throw AppError.notFound('Docket');
      }
      if (!isDocketEntryEditable(lockedDocket.status)) {
        throw AppError.badRequest('Can only update draft, queried, or rejected dockets');
      }

      return tx.dailyDocket.update({
        where: { id },
        data: { notes },
        include: {
          subcontractorCompany: {
            select: { id: true, companyName: true },
          },
        },
      });
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

    const accessDocket = await prisma.dailyDocket.findUnique({
      where: { id },
      select: {
        projectId: true,
        subcontractorCompanyId: true,
      },
    });

    if (!accessDocket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(user, accessDocket);

    const { docket, updatedDocket } = await prisma.$transaction(async (tx) => {
      await lockDocketForEntryMutation(tx, id);

      const docketForSubmit = await tx.dailyDocket.findUnique({
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

      if (!docketForSubmit) {
        throw AppError.notFound('Docket');
      }

      assertDocketSubmittable(docketForSubmit);

      const transition = await tx.dailyDocket.updateMany({
        where: { id, status: docketForSubmit.status },
        data: {
          status: 'pending_approval',
          submittedById: user.id,
          submittedAt: new Date(),
        },
      });

      if (transition.count !== 1) {
        throw AppError.badRequest('Only draft or rejected dockets can be submitted');
      }

      return {
        docket: docketForSubmit,
        updatedDocket: await tx.dailyDocket.findUniqueOrThrow({ where: { id } }),
      };
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
