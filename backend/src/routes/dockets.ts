import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { sendNotificationIfEnabled } from './notifications.js';
import { parsePagination, getPaginationMeta, getPrismaSkipTake } from '../lib/pagination.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { createAuditLog, AuditAction } from '../lib/auditLog.js';
import { activeSubcontractorCompanyWhere } from '../lib/projectAccess.js';
import { requireEditableDiaryForWrite } from './diary/diaryAccess.js';
import {
  DOCKET_APPROVERS,
  isDocketEntryEditable,
  isSubcontractorUser,
  requireApprovedDocketResource,
  requireDocketApproverAccess,
  requireDocketReadAccess,
  requireDocketSubcontractorAccess,
  requireLotAllocationsInProject,
  requireProjectReadAccess,
} from './dockets/access.js';
import {
  DOCKET_SORT_FIELDS,
  createDocketSchema,
  updateDocketSchema,
  approveDocketSchema,
  rejectDocketSchema,
  queryDocketSchema,
  respondDocketSchema,
  addLabourEntrySchema,
  updateLabourEntrySchema,
  addPlantEntrySchema,
  updatePlantEntrySchema,
  parseRequiredQueryString,
  parseDocketRouteParam,
  parseOptionalDocketStatus,
  parseDocketDate,
} from './dockets/validation.js';
import {
  lockDocketForEntryMutation,
  refreshLabourSubmittedTotals,
  refreshPlantSubmittedTotals,
} from './dockets/entryTotals.js';
import {
  formatDocketDate,
  formatDocketNumber,
  formatDocketUserName,
} from './dockets/formatting.js';
import {
  mapDocketLabourEntry,
  mapDocketPlantEntry,
  sumDocketLabourTotals,
  sumDocketPlantTotals,
} from './dockets/presentation.js';
import {
  buildDocketApprovedNotifications,
  buildDocketQueriedNotifications,
  buildDocketQueryResponseNotification,
  buildDocketRejectedNotifications,
  buildDocketSubmittedNotifications,
} from './dockets/notifications.js';
import { buildDocketDiaryComparison } from './dockets/diaryComparison.js';
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
    const formattedDockets = dockets.map((docket) => ({
      id: docket.id,
      docketNumber: formatDocketNumber(docket.id),
      subcontractor: docket.subcontractorCompany.companyName,
      subcontractorId: docket.subcontractorCompany.id,
      date: formatDocketDate(docket.date),
      status: docket.status,
      notes: docket.notes,
      labourHours: docket.labourEntries.reduce(
        (sum, entry) => sum + (Number(entry.submittedHours) || 0),
        0,
      ),
      plantHours: docket.plantEntries.reduce(
        (sum, entry) => sum + (Number(entry.hoursOperated) || 0),
        0,
      ),
      totalLabourSubmitted: Number(docket.totalLabourSubmitted) || 0,
      totalLabourApproved: Number(docket.totalLabourApproved) || 0,
      totalPlantSubmitted: Number(docket.totalPlantSubmitted) || 0,
      totalPlantApproved: Number(docket.totalPlantApproved) || 0,
      submittedAt: docket.submittedAt,
      approvedAt: docket.approvedAt,
      foremanNotes: docket.foremanNotes,
    }));

    res.json({
      data: formattedDockets,
      pagination: getPaginationMeta(total, page, limit),
      dockets: formattedDockets, // Backward compatibility
    });
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

    const docket = await prisma.dailyDocket.create({
      data: {
        projectId,
        subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
        date: parseDocketDate(date),
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

    res.status(201).json({
      docket: {
        id: docket.id,
        docketNumber: formatDocketNumber(docket.id),
        subcontractor: docket.subcontractorCompany.companyName,
        date: formatDocketDate(docket.date),
        status: docket.status,
        labourHours: Number(docket.totalLabourSubmitted) || 0,
        plantHours: Number(docket.totalPlantSubmitted) || 0,
        notes: docket.notes,
      },
    });
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

    // Format labour entries
    const labourEntries = docket.labourEntries.map((entry) => mapDocketLabourEntry(entry));

    // Format plant entries
    const plantEntries = docket.plantEntries.map((entry) => mapDocketPlantEntry(entry));

    // Fetch project info separately since it's not a relation on DailyDocket
    const project = await prisma.project.findUnique({
      where: { id: docket.projectId },
      select: { id: true, name: true },
    });

    // Fetch submittedBy and approvedBy user info separately
    const submittedBy = docket.submittedById
      ? await prisma.user.findUnique({
          where: { id: docket.submittedById },
          select: { id: true, fullName: true, email: true },
        })
      : null;

    const approvedBy = docket.approvedById
      ? await prisma.user.findUnique({
          where: { id: docket.approvedById },
          select: { id: true, fullName: true, email: true },
        })
      : null;

    res.json({
      docket: {
        id: docket.id,
        docketNumber: formatDocketNumber(docket.id),
        date: formatDocketDate(docket.date),
        status: docket.status,
        projectId: docket.projectId,
        project,
        subcontractor: docket.subcontractorCompany,
        notes: docket.notes,
        foremanNotes: docket.foremanNotes,
        adjustmentReason: docket.adjustmentReason,
        submittedAt: docket.submittedAt,
        submittedById: docket.submittedById,
        submittedBy,
        approvedAt: docket.approvedAt,
        approvedById: docket.approvedById,
        approvedBy,
        totalLabourSubmitted: Number(docket.totalLabourSubmitted) || 0,
        totalLabourApproved: Number(docket.totalLabourApproved) || 0,
        totalPlantSubmitted: Number(docket.totalPlantSubmitted) || 0,
        totalPlantApproved: Number(docket.totalPlantApproved) || 0,
        labourEntries,
        plantEntries,
      },
      foremanDiary,
      discrepancies: discrepancies.length > 0 ? discrepancies : null,
    });
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

    res.json({
      docket: {
        id: updatedDocket.id,
        docketNumber: formatDocketNumber(updatedDocket.id),
        date: formatDocketDate(updatedDocket.date),
        status: updatedDocket.status,
        notes: updatedDocket.notes,
        foremanNotes: updatedDocket.foremanNotes,
        subcontractor: updatedDocket.subcontractorCompany,
      },
    });
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

    if (!['draft', 'rejected'].includes(docket.status)) {
      throw AppError.badRequest('Only draft or rejected dockets can be submitted');
    }

    // Feature #891: Require at least one entry before submission
    const hasLabourEntries = docket.labourEntries && docket.labourEntries.length > 0;
    const hasPlantEntries = docket.plantEntries && docket.plantEntries.length > 0;
    if (!hasLabourEntries && !hasPlantEntries) {
      throw new AppError(
        400,
        'At least one labour or plant entry is required before submitting the docket.',
        'ENTRY_REQUIRED',
      );
    }

    // Feature #890: Require lot selection for docket submission
    // Check if docket has labour entries that need lot allocation
    if (docket.labourEntries.length > 0) {
      const hasAnyLotAllocation = docket.labourEntries.some(
        (entry) => entry.lotAllocations && entry.lotAllocations.length > 0,
      );
      if (!hasAnyLotAllocation) {
        throw new AppError(
          400,
          'At least one labour entry must be allocated to a lot before submitting the docket.',
          'LOT_REQUIRED',
        );
      }
    }

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

    res.json({
      message: 'Docket submitted for approval',
      docket: {
        id: updatedDocket.id,
        status: updatedDocket.status,
        submittedAt: updatedDocket.submittedAt,
      },
      notifiedUsers: projectUsers.map((pu) => ({
        email: pu.user.email,
        fullName: pu.user.fullName,
      })),
    });
  }),
);

// POST /api/dockets/:id/approve - Approve a docket
docketsRouter.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const parseResult = approveDocketSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { foremanNotes, adjustmentReason, adjustedLabourHours, adjustedPlantHours } =
      parseResult.data;

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketApproverAccess(user, docket.projectId);

    if (docket.status !== 'pending_approval') {
      throw AppError.badRequest('Only pending dockets can be approved');
    }

    // Use adjusted values if provided, otherwise copy submitted values
    const labourApproved =
      adjustedLabourHours !== undefined ? adjustedLabourHours : docket.totalLabourSubmitted;
    const plantApproved =
      adjustedPlantHours !== undefined ? adjustedPlantHours : docket.totalPlantSubmitted;

    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: {
        status: 'approved',
        approvedById: user.id,
        approvedAt: new Date(),
        foremanNotes,
        adjustmentReason,
        totalLabourApproved: labourApproved,
        totalPlantApproved: plantApproved,
      },
      include: {
        subcontractorCompany: {
          select: {
            companyName: true,
          },
        },
      },
    });

    await createAuditLog({
      projectId: docket.projectId,
      userId: user.id,
      entityType: 'daily_docket',
      entityId: docket.id,
      action: AuditAction.DOCKET_APPROVED,
      changes: {
        docketNumber: formatDocketNumber(docket.id),
        status: { from: docket.status, to: updatedDocket.status },
        foremanNotes,
        adjustmentReason,
        approvedTotals: {
          labourHours: labourApproved,
          plantHours: plantApproved,
        },
      },
      req,
    });

    // === DIARY AUTO-POPULATION ===
    // When a docket is approved, write its labour and plant data into the daily diary
    try {
      await prisma.$transaction(async (tx) => {
        // Find or create diary for this date
        let diary = await tx.dailyDiary.findUnique({
          where: { projectId_date: { projectId: docket.projectId, date: docket.date } },
        });

        if (!diary) {
          diary = await tx.dailyDiary.create({
            data: {
              projectId: docket.projectId,
              date: docket.date,
              status: 'draft',
            },
          });
        }

        await requireEditableDiaryForWrite(tx, user, diary.id);

        // Fetch full docket with labour and plant entries
        const fullDocket = await tx.dailyDocket.findUnique({
          where: { id: docket.id },
          include: {
            labourEntries: {
              include: {
                employee: { select: { name: true, role: true } },
                lotAllocations: true,
              },
            },
            plantEntries: {
              include: {
                plant: { select: { type: true, description: true, idRego: true } },
                lotAllocations: true,
              },
            },
            subcontractorCompany: { select: { companyName: true } },
          },
        });

        if (fullDocket) {
          // Write personnel records from labour entries
          for (const entry of fullDocket.labourEntries) {
            await tx.diaryPersonnel.create({
              data: {
                diaryId: diary.id,
                name: entry.employee.name,
                role: entry.employee.role || undefined,
                company: fullDocket.subcontractorCompany.companyName,
                hours: entry.approvedHours || entry.submittedHours || undefined,
                startTime: entry.startTime || undefined,
                finishTime: entry.finishTime || undefined,
                source: 'docket',
                docketId: docket.id,
                lotId: entry.lotAllocations[0]?.lotId || undefined,
              },
            });
          }

          // Write plant records from plant entries
          for (const entry of fullDocket.plantEntries) {
            await tx.diaryPlant.create({
              data: {
                diaryId: diary.id,
                description: entry.plant.description || entry.plant.type,
                idRego: entry.plant.idRego || undefined,
                company: fullDocket.subcontractorCompany.companyName,
                hoursOperated: entry.hoursOperated || undefined,
                source: 'docket',
                docketId: docket.id,
                lotId: entry.lotAllocations[0]?.lotId || undefined,
              },
            });
          }
        }
      });
    } catch {
      // Don't fail the approval if diary population fails
    }
    // === END DIARY AUTO-POPULATION ===

    // Feature #927 - Notify subcontractor users about docket approval
    const docketNumber = formatDocketNumber(docket.id);
    const docketDate = formatDocketDate(docket.date);
    const approverName = formatDocketUserName(user);

    // Get all subcontractor users linked to this subcontractor company
    const subcontractorUserLinks = await prisma.subcontractorUser.findMany({
      where: {
        subcontractorCompanyId: docket.subcontractorCompanyId,
      },
    });

    // Get user details for these subcontractor users
    const subcontractorUserIds = subcontractorUserLinks.map((su) => su.userId);
    const subcontractorUsers =
      subcontractorUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: subcontractorUserIds } },
            select: { id: true, email: true, fullName: true },
          })
        : [];

    // Create notifications for subcontractor users
    const { inApp: approvedInApp, email: approvedEmail } = buildDocketApprovedNotifications({
      projectId: docket.projectId,
      projectName: docket.project.name,
      docketNumber,
      docketDate,
      approverName,
      foremanNotes,
      adjustmentReason,
    });

    const notificationsToCreate = subcontractorUsers.map((su) => ({
      userId: su.id,
      ...approvedInApp,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // Send email notifications to subcontractor users
    for (const su of subcontractorUsers) {
      try {
        await sendNotificationIfEnabled(su.id, 'enabled', approvedEmail);
      } catch {
        // Non-critical: don't fail the main request if email fails
      }
    }

    res.json({
      message: 'Docket approved successfully',
      docket: {
        id: updatedDocket.id,
        docketNumber: formatDocketNumber(updatedDocket.id),
        subcontractor: updatedDocket.subcontractorCompany.companyName,
        status: updatedDocket.status,
        approvedAt: updatedDocket.approvedAt,
      },
      notifiedUsers: subcontractorUsers.map((su) => ({
        email: su.email,
        fullName: su.fullName,
      })),
    });
  }),
);

// POST /api/dockets/:id/reject - Reject a docket
docketsRouter.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const parseResult = rejectDocketSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { reason } = parseResult.data;

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketApproverAccess(user, docket.projectId);

    if (docket.status !== 'pending_approval') {
      throw AppError.badRequest('Only pending dockets can be rejected');
    }

    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: {
        status: 'rejected',
        approvedById: user.id,
        approvedAt: new Date(),
        foremanNotes: reason,
      },
    });

    await createAuditLog({
      projectId: docket.projectId,
      userId: user.id,
      entityType: 'daily_docket',
      entityId: docket.id,
      action: AuditAction.DOCKET_REJECTED,
      changes: {
        docketNumber: formatDocketNumber(docket.id),
        status: { from: docket.status, to: updatedDocket.status },
        reason,
      },
      req,
    });

    // Feature #928 - Notify subcontractor users about docket rejection
    const docketNumber = formatDocketNumber(docket.id);
    const docketDate = formatDocketDate(docket.date);
    const rejectorName = formatDocketUserName(user);

    // Get all subcontractor users linked to this subcontractor company
    const subcontractorUserLinks = await prisma.subcontractorUser.findMany({
      where: {
        subcontractorCompanyId: docket.subcontractorCompanyId,
      },
    });

    // Get user details for these subcontractor users
    const subcontractorUserIds = subcontractorUserLinks.map((su) => su.userId);
    const subcontractorUsers =
      subcontractorUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: subcontractorUserIds } },
            select: { id: true, email: true, fullName: true },
          })
        : [];

    // Create notifications for subcontractor users
    const { inApp: rejectedInApp, email: rejectedEmail } = buildDocketRejectedNotifications({
      projectId: docket.projectId,
      projectName: docket.project.name,
      docketNumber,
      docketDate,
      rejectorName,
      reason,
    });

    const notificationsToCreate = subcontractorUsers.map((su) => ({
      userId: su.id,
      ...rejectedInApp,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // Send email notifications to subcontractor users
    for (const su of subcontractorUsers) {
      try {
        await sendNotificationIfEnabled(su.id, 'enabled', rejectedEmail);
      } catch {
        // Non-critical: don't fail the main request if email fails
      }
    }

    res.json({
      message: 'Docket rejected',
      docket: {
        id: updatedDocket.id,
        status: updatedDocket.status,
      },
      notifiedUsers: subcontractorUsers.map((su) => ({
        email: su.email,
        fullName: su.fullName,
      })),
    });
  }),
);

// POST /api/dockets/:id/query - Query a docket (Feature #268)
docketsRouter.post(
  '/:id/query',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const parseResult = queryDocketSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(
        parseResult.error.errors[0]?.message || 'Questions/issues are required',
      );
    }

    const { questions } = parseResult.data;

    if (questions.trim() === '') {
      throw AppError.badRequest('Questions/issues are required');
    }

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketApproverAccess(user, docket.projectId);

    if (docket.status !== 'pending_approval') {
      throw AppError.badRequest('Only pending dockets can be queried');
    }

    // Step 5 - Update status to 'queried'
    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: {
        status: 'queried',
        foremanNotes: questions, // Store the query in foreman notes
      },
    });

    await createAuditLog({
      projectId: docket.projectId,
      userId: user.id,
      entityType: 'daily_docket',
      entityId: docket.id,
      action: AuditAction.DOCKET_QUERIED,
      changes: {
        docketNumber: formatDocketNumber(docket.id),
        status: { from: docket.status, to: updatedDocket.status },
        questionLength: questions.length,
      },
      req,
    });

    // Step 6 - Notify subcontractor users
    const docketNumber = formatDocketNumber(docket.id);
    const docketDate = formatDocketDate(docket.date);
    const querierName = formatDocketUserName(user);

    // Get all subcontractor users linked to this subcontractor company
    const subcontractorUserLinks = await prisma.subcontractorUser.findMany({
      where: {
        subcontractorCompanyId: docket.subcontractorCompanyId,
      },
    });

    const subcontractorUserIds = subcontractorUserLinks.map((su) => su.userId);
    const subcontractorUsers =
      subcontractorUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: subcontractorUserIds } },
            select: { id: true, email: true, fullName: true },
          })
        : [];

    // Create notifications for subcontractor users
    const { inApp: queriedInApp, email: queriedEmail } = buildDocketQueriedNotifications({
      projectId: docket.projectId,
      projectName: docket.project.name,
      docketNumber,
      docketDate,
      querierName,
      questions,
    });

    const notificationsToCreate = subcontractorUsers.map((su) => ({
      userId: su.id,
      ...queriedInApp,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // Send email notifications to subcontractor users
    for (const su of subcontractorUsers) {
      try {
        await sendNotificationIfEnabled(su.id, 'enabled', queriedEmail);
      } catch {
        // Non-critical: don't fail the main request if email fails
      }
    }

    res.json({
      message: 'Docket queried successfully',
      docket: {
        id: updatedDocket.id,
        status: updatedDocket.status,
      },
      notifiedUsers: subcontractorUsers.map((su) => ({
        email: su.email,
        fullName: su.fullName,
      })),
    });
  }),
);

// POST /api/dockets/:id/respond - Respond to a docket query (Feature #268 Step 7)
docketsRouter.post(
  '/:id/respond',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    // Validate request body
    const parseResult = respondDocketSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Response is required');
    }

    const { response } = parseResult.data;

    if (response.trim() === '') {
      throw AppError.badRequest('Response is required');
    }

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(user, docket);

    if (docket.status !== 'queried') {
      throw AppError.badRequest('Only queried dockets can be responded to');
    }

    // Update status back to pending_approval and append response to notes
    const existingNotes = docket.notes || '';
    const newNotes = existingNotes
      ? `${existingNotes}\n\n--- Response to Query ---\n${response}`
      : `--- Response to Query ---\n${response}`;

    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: {
        status: 'pending_approval', // Back to pending for re-review
        notes: newNotes,
      },
    });

    await createAuditLog({
      projectId: docket.projectId,
      userId: user.id,
      entityType: 'daily_docket',
      entityId: docket.id,
      action: AuditAction.DOCKET_QUERY_RESPONDED,
      changes: {
        docketNumber: formatDocketNumber(docket.id),
        status: { from: docket.status, to: updatedDocket.status },
        responseLength: response.length,
      },
      req,
    });

    // Notify project approvers about the response
    const docketNumber = formatDocketNumber(docket.id);
    const docketDate = formatDocketDate(docket.date);
    const responderName = formatDocketUserName(user);

    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: docket.projectId,
        role: { in: DOCKET_APPROVERS },
        status: 'active',
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });

    const { inApp: queryResponseInApp } = buildDocketQueryResponseNotification({
      projectId: docket.projectId,
      docketNumber,
      docketDate,
      responderName,
      response,
    });

    const notificationsToCreate = projectUsers.map((pu) => ({
      userId: pu.userId,
      ...queryResponseInApp,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    res.json({
      message: 'Query response submitted',
      docket: {
        id: updatedDocket.id,
        status: updatedDocket.status,
      },
    });
  }),
);

// ============================================================================
// Feature #261 - Labour Entry Management
// ============================================================================

// GET /api/dockets/:id/labour - Get labour entries for a docket
docketsRouter.get(
  '/:id/labour',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        labourEntries: {
          include: {
            employee: {
              select: { id: true, name: true, role: true, hourlyRate: true },
            },
            lotAllocations: {
              include: {
                lot: { select: { id: true, lotNumber: true } },
              },
            },
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketReadAccess(req.user!, docket);

    // Format labour entries
    const labourEntries = docket.labourEntries.map((entry) =>
      mapDocketLabourEntry(entry, { includeAdjustmentReason: true }),
    );

    res.json({
      labourEntries,
      totals: sumDocketLabourTotals(labourEntries),
    });
  }),
);

// POST /api/dockets/:id/labour - Add a labour entry to a docket
docketsRouter.post(
  '/:id/labour',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');

    // Validate request body
    const parseResult = addLabourEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { employeeId, startTime, finishTime, lotAllocations } = parseResult.data;

    // Get docket
    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: { select: { id: true } },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);

    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }
    await requireLotAllocationsInProject(
      docket.projectId,
      docket.subcontractorCompanyId,
      lotAllocations,
    );

    // Get employee from roster
    const employee = await prisma.employeeRoster.findFirst({
      where: {
        id: employeeId,
        subcontractorCompanyId: docket.subcontractorCompanyId,
      },
    });

    if (!employee) {
      throw AppError.notFound('Employee in roster');
    }
    requireApprovedDocketResource(employee.status, 'Employee');

    // Calculate hours from start/finish time
    let hours = 0;
    if (startTime && finishTime) {
      const [startH, startM] = startTime.split(':').map(Number);
      const [finishH, finishM] = finishTime.split(':').map(Number);
      hours = finishH + finishM / 60 - (startH + startM / 60);
      if (hours < 0) hours += 24; // Handle overnight shifts
    }

    // Calculate cost
    const hourlyRate = Number(employee.hourlyRate) || 0;
    const cost = hours * hourlyRate;

    const { entry, totals } = await prisma.$transaction(async (tx) => {
      await lockDocketForEntryMutation(tx, id);

      const created = await tx.docketLabour.create({
        data: {
          docketId: id,
          employeeId,
          startTime,
          finishTime,
          submittedHours: hours,
          hourlyRate,
          submittedCost: cost,
          lotAllocations: lotAllocations?.length
            ? {
                create: lotAllocations.map((alloc: { lotId: string; hours: number }) => ({
                  lotId: alloc.lotId,
                  hours: alloc.hours,
                })),
              }
            : undefined,
        },
        include: {
          employee: {
            select: { id: true, name: true, role: true, hourlyRate: true },
          },
          lotAllocations: {
            include: {
              lot: { select: { id: true, lotNumber: true } },
            },
          },
        },
      });

      return {
        entry: created,
        totals: await refreshLabourSubmittedTotals(tx, id),
      };
    });

    res.status(201).json({
      labourEntry: {
        id: entry.id,
        employee: {
          id: entry.employee.id,
          name: entry.employee.name,
          role: entry.employee.role,
          hourlyRate: Number(entry.employee.hourlyRate) || 0,
        },
        startTime: entry.startTime,
        finishTime: entry.finishTime,
        submittedHours: Number(entry.submittedHours) || 0,
        hourlyRate: Number(entry.hourlyRate) || 0,
        submittedCost: Number(entry.submittedCost) || 0,
        lotAllocations: entry.lotAllocations.map((alloc) => ({
          lotId: alloc.lotId,
          lotNumber: alloc.lot.lotNumber,
          hours: Number(alloc.hours) || 0,
        })),
      },
      runningTotal: {
        hours: totals.hours,
        cost: totals.cost,
      },
    });
  }),
);

// PUT /api/dockets/:id/labour/:entryId - Update a labour entry
docketsRouter.put(
  '/:id/labour/:entryId',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const entryId = parseDocketRouteParam(req.params.entryId, 'entryId');

    // Validate request body
    const parseResult = updateLabourEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { startTime, finishTime, lotAllocations } = parseResult.data;

    const entry = await prisma.docketLabour.findFirst({
      where: { id: entryId, docketId: id },
      include: {
        employee: { select: { hourlyRate: true, status: true } },
      },
    });

    if (!entry) {
      throw AppError.notFound('Labour entry');
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } });
    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);
    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }
    requireApprovedDocketResource(entry.employee.status, 'Employee');
    await requireLotAllocationsInProject(
      docket.projectId,
      docket.subcontractorCompanyId,
      lotAllocations,
    );

    // Recalculate hours
    let hours = Number(entry.submittedHours) || 0;
    if (startTime && finishTime) {
      const [startH, startM] = startTime.split(':').map(Number);
      const [finishH, finishM] = finishTime.split(':').map(Number);
      hours = finishH + finishM / 60 - (startH + startM / 60);
      if (hours < 0) hours += 24;
    }

    const hourlyRate = Number(entry.hourlyRate) || Number(entry.employee.hourlyRate) || 0;
    const cost = hours * hourlyRate;

    const updated = await prisma.$transaction(async (tx) => {
      await lockDocketForEntryMutation(tx, id);

      await tx.docketLabour.update({
        where: { id: entryId },
        data: {
          startTime,
          finishTime,
          submittedHours: hours,
          submittedCost: cost,
        },
      });

      if (lotAllocations) {
        await tx.docketLabourLot.deleteMany({ where: { docketLabourId: entryId } });
        if (lotAllocations.length > 0) {
          await tx.docketLabourLot.createMany({
            data: lotAllocations.map((alloc: { lotId: string; hours: number }) => ({
              docketLabourId: entryId,
              lotId: alloc.lotId,
              hours: alloc.hours,
            })),
          });
        }
      }

      await refreshLabourSubmittedTotals(tx, id);

      const refreshed = await tx.docketLabour.findUnique({
        where: { id: entryId },
        include: {
          employee: {
            select: { id: true, name: true, role: true, hourlyRate: true },
          },
          lotAllocations: {
            include: {
              lot: { select: { id: true, lotNumber: true } },
            },
          },
        },
      });

      if (!refreshed) {
        throw AppError.notFound('Labour entry');
      }
      return refreshed;
    });

    res.json({
      labourEntry: {
        id: updated.id,
        employee: {
          id: updated.employee.id,
          name: updated.employee.name,
          role: updated.employee.role,
          hourlyRate: Number(updated.employee.hourlyRate) || 0,
        },
        startTime: updated.startTime,
        finishTime: updated.finishTime,
        submittedHours: Number(updated.submittedHours) || 0,
        hourlyRate: Number(updated.hourlyRate) || 0,
        submittedCost: Number(updated.submittedCost) || 0,
        lotAllocations: updated.lotAllocations.map((alloc) => ({
          lotId: alloc.lotId,
          lotNumber: alloc.lot.lotNumber,
          hours: Number(alloc.hours) || 0,
        })),
      },
    });
  }),
);

// DELETE /api/dockets/:id/labour/:entryId - Delete a labour entry
docketsRouter.delete(
  '/:id/labour/:entryId',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const entryId = parseDocketRouteParam(req.params.entryId, 'entryId');

    const entry = await prisma.docketLabour.findFirst({
      where: { id: entryId, docketId: id },
    });

    if (!entry) {
      throw AppError.notFound('Labour entry');
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } });
    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);
    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }

    await prisma.$transaction(async (tx) => {
      await lockDocketForEntryMutation(tx, id);

      // Delete entry (cascade deletes lot allocations)
      await tx.docketLabour.delete({ where: { id: entryId } });
      await refreshLabourSubmittedTotals(tx, id);
    });

    res.json({ message: 'Labour entry deleted' });
  }),
);

// ============================================================================
// Feature #262 - Plant Entry Management
// ============================================================================

// GET /api/dockets/:id/plant - Get plant entries for a docket
docketsRouter.get(
  '/:id/plant',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
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

    // Format plant entries
    const plantEntries = docket.plantEntries.map((entry) =>
      mapDocketPlantEntry(entry, { includeAdjustmentReason: true }),
    );

    res.json({
      plantEntries,
      totals: sumDocketPlantTotals(plantEntries),
    });
  }),
);

// POST /api/dockets/:id/plant - Add a plant entry to a docket
docketsRouter.post(
  '/:id/plant',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');

    // Validate request body
    const parseResult = addPlantEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { plantId, hoursOperated, wetOrDry } = parseResult.data;

    // Get docket
    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: { select: { id: true } },
      },
    });

    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);

    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }

    // Get plant from register
    const plant = await prisma.plantRegister.findFirst({
      where: {
        id: plantId,
        subcontractorCompanyId: docket.subcontractorCompanyId,
      },
    });

    if (!plant) {
      throw AppError.notFound('Plant in register');
    }
    requireApprovedDocketResource(plant.status, 'Plant');

    // Determine rate based on wet/dry
    const isWet = wetOrDry === 'wet';
    const hourlyRate = isWet
      ? Number(plant.wetRate) || Number(plant.dryRate) || 0
      : Number(plant.dryRate) || 0;
    const cost = Number(hoursOperated) * hourlyRate;

    const { entry, totals } = await prisma.$transaction(async (tx) => {
      await lockDocketForEntryMutation(tx, id);

      const created = await tx.docketPlant.create({
        data: {
          docketId: id,
          plantId,
          hoursOperated,
          wetOrDry: wetOrDry || 'dry',
          hourlyRate,
          submittedCost: cost,
        },
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
      });

      return {
        entry: created,
        totals: await refreshPlantSubmittedTotals(tx, id),
      };
    });

    res.status(201).json({
      plantEntry: {
        id: entry.id,
        plant: {
          id: entry.plant.id,
          type: entry.plant.type,
          description: entry.plant.description,
          idRego: entry.plant.idRego,
          dryRate: Number(entry.plant.dryRate) || 0,
          wetRate: Number(entry.plant.wetRate) || 0,
        },
        hoursOperated: Number(entry.hoursOperated) || 0,
        wetOrDry: entry.wetOrDry || 'dry',
        hourlyRate: Number(entry.hourlyRate) || 0,
        submittedCost: Number(entry.submittedCost) || 0,
      },
      runningTotal: {
        hours: totals.hours,
        cost: totals.cost,
      },
    });
  }),
);

// PUT /api/dockets/:id/plant/:entryId - Update a plant entry
docketsRouter.put(
  '/:id/plant/:entryId',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const entryId = parseDocketRouteParam(req.params.entryId, 'entryId');

    // Validate request body
    const parseResult = updatePlantEntrySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
    }

    const { hoursOperated, wetOrDry } = parseResult.data;

    const entry = await prisma.docketPlant.findFirst({
      where: { id: entryId, docketId: id },
      include: {
        plant: { select: { dryRate: true, wetRate: true, status: true } },
      },
    });

    if (!entry) {
      throw AppError.notFound('Plant entry');
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } });
    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);
    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }
    requireApprovedDocketResource(entry.plant.status, 'Plant');

    // Recalculate cost
    const hours = hoursOperated !== undefined ? Number(hoursOperated) : Number(entry.hoursOperated);
    const isWet = (wetOrDry || entry.wetOrDry) === 'wet';
    const hourlyRate = isWet
      ? Number(entry.plant.wetRate) || Number(entry.plant.dryRate) || 0
      : Number(entry.plant.dryRate) || 0;
    const cost = hours * hourlyRate;

    const updated = await prisma.$transaction(async (tx) => {
      await lockDocketForEntryMutation(tx, id);

      const refreshed = await tx.docketPlant.update({
        where: { id: entryId },
        data: {
          hoursOperated: hours,
          wetOrDry: wetOrDry || entry.wetOrDry,
          hourlyRate,
          submittedCost: cost,
        },
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
      });

      await refreshPlantSubmittedTotals(tx, id);
      return refreshed;
    });

    res.json({
      plantEntry: {
        id: updated.id,
        plant: {
          id: updated.plant.id,
          type: updated.plant.type,
          description: updated.plant.description,
          idRego: updated.plant.idRego,
          dryRate: Number(updated.plant.dryRate) || 0,
          wetRate: Number(updated.plant.wetRate) || 0,
        },
        hoursOperated: Number(updated.hoursOperated) || 0,
        wetOrDry: updated.wetOrDry || 'dry',
        hourlyRate: Number(updated.hourlyRate) || 0,
        submittedCost: Number(updated.submittedCost) || 0,
      },
    });
  }),
);

// DELETE /api/dockets/:id/plant/:entryId - Delete a plant entry
docketsRouter.delete(
  '/:id/plant/:entryId',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const entryId = parseDocketRouteParam(req.params.entryId, 'entryId');

    const entry = await prisma.docketPlant.findFirst({
      where: { id: entryId, docketId: id },
    });

    if (!entry) {
      throw AppError.notFound('Plant entry');
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } });
    if (!docket) {
      throw AppError.notFound('Docket');
    }
    await requireDocketSubcontractorAccess(req.user!, docket);
    if (!isDocketEntryEditable(docket.status)) {
      throw AppError.badRequest('Can only modify entries on draft, queried, or rejected dockets');
    }

    await prisma.$transaction(async (tx) => {
      await lockDocketForEntryMutation(tx, id);

      // Delete entry
      await tx.docketPlant.delete({ where: { id: entryId } });
      await refreshPlantSubmittedTotals(tx, id);
    });

    res.json({ message: 'Plant entry deleted' });
  }),
);
