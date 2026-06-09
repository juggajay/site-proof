import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { requireEditableDiaryForWrite } from '../diary/diaryAccess.js';
import {
  DOCKET_APPROVERS,
  requireDocketApproverAccess,
  requireDocketSubcontractorAccess,
} from './access.js';
import {
  approveDocketSchema,
  parseDocketRouteParam,
  queryDocketSchema,
  rejectDocketSchema,
  respondDocketSchema,
} from './validation.js';
import { formatDocketDate, formatDocketNumber, formatDocketUserName } from './formatting.js';
import { buildQueryResponseNotes } from './queryResponse.js';
import {
  buildDocketApprovedNotifications,
  buildDocketQueriedNotifications,
  buildDocketQueryResponseNotification,
  buildDocketRejectedNotifications,
} from './notifications.js';
import { buildDocketApprovedResponse, resolveDocketApprovedTotals } from './approvalResponse.js';
import {
  buildDocketQueriedResponse,
  buildDocketQueryResponseSubmittedResponse,
  buildDocketRejectedResponse,
} from './reviewResponses.js';
import { notifyDocketSubcontractorUsers } from './reviewNotificationDelivery.js';
import { parseDocketReviewRequest, requireNonBlankReviewText } from './reviewRequest.js';

export const docketReviewRouter = Router();

// POST /api/dockets/:id/approve - Approve a docket
docketReviewRouter.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    const { foremanNotes, adjustmentReason, adjustedLabourHours, adjustedPlantHours } =
      parseDocketReviewRequest(approveDocketSchema, req.body, 'Invalid request body');

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

    const { labourApproved, plantApproved } = resolveDocketApprovedTotals({
      adjustedLabourHours,
      adjustedPlantHours,
      totalLabourSubmitted: docket.totalLabourSubmitted,
      totalPlantSubmitted: docket.totalPlantSubmitted,
    });

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
          // Write personnel records from labour entries (single batched insert)
          if (fullDocket.labourEntries.length > 0) {
            await tx.diaryPersonnel.createMany({
              data: fullDocket.labourEntries.map((entry) => ({
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
              })),
            });
          }

          // Write plant records from plant entries (single batched insert)
          if (fullDocket.plantEntries.length > 0) {
            await tx.diaryPlant.createMany({
              data: fullDocket.plantEntries.map((entry) => ({
                diaryId: diary.id,
                description: entry.plant.description || entry.plant.type,
                idRego: entry.plant.idRego || undefined,
                company: fullDocket.subcontractorCompany.companyName,
                hoursOperated: entry.hoursOperated || undefined,
                source: 'docket',
                docketId: docket.id,
                lotId: entry.lotAllocations[0]?.lotId || undefined,
              })),
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

    const { inApp: approvedInApp, email: approvedEmail } = buildDocketApprovedNotifications({
      projectId: docket.projectId,
      projectName: docket.project.name,
      docketNumber,
      docketDate,
      approverName,
      foremanNotes,
      adjustmentReason,
    });

    const subcontractorUsers = await notifyDocketSubcontractorUsers({
      subcontractorCompanyId: docket.subcontractorCompanyId,
      inApp: approvedInApp,
      email: approvedEmail,
    });

    res.json(buildDocketApprovedResponse({ updatedDocket, subcontractorUsers }));
  }),
);

// POST /api/dockets/:id/reject - Reject a docket
docketReviewRouter.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    const { reason } = parseDocketReviewRequest(
      rejectDocketSchema,
      req.body,
      'Invalid request body',
    );

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

    const { inApp: rejectedInApp, email: rejectedEmail } = buildDocketRejectedNotifications({
      projectId: docket.projectId,
      projectName: docket.project.name,
      docketNumber,
      docketDate,
      rejectorName,
      reason,
    });

    const subcontractorUsers = await notifyDocketSubcontractorUsers({
      subcontractorCompanyId: docket.subcontractorCompanyId,
      inApp: rejectedInApp,
      email: rejectedEmail,
    });

    res.json(buildDocketRejectedResponse(updatedDocket, subcontractorUsers));
  }),
);

// POST /api/dockets/:id/query - Query a docket (Feature #268)
docketReviewRouter.post(
  '/:id/query',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    const { questions } = parseDocketReviewRequest(
      queryDocketSchema,
      req.body,
      'Questions/issues are required',
    );
    requireNonBlankReviewText(questions, 'Questions/issues are required');

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

    const { inApp: queriedInApp, email: queriedEmail } = buildDocketQueriedNotifications({
      projectId: docket.projectId,
      projectName: docket.project.name,
      docketNumber,
      docketDate,
      querierName,
      questions,
    });

    const subcontractorUsers = await notifyDocketSubcontractorUsers({
      subcontractorCompanyId: docket.subcontractorCompanyId,
      inApp: queriedInApp,
      email: queriedEmail,
    });

    res.json(buildDocketQueriedResponse(updatedDocket, subcontractorUsers));
  }),
);

// POST /api/dockets/:id/respond - Respond to a docket query (Feature #268 Step 7)
docketReviewRouter.post(
  '/:id/respond',
  asyncHandler(async (req, res) => {
    const id = parseDocketRouteParam(req.params.id, 'id');
    const user = req.user!;

    const { response } = parseDocketReviewRequest(
      respondDocketSchema,
      req.body,
      'Response is required',
    );
    requireNonBlankReviewText(response, 'Response is required');

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
    const newNotes = buildQueryResponseNotes(docket.notes, response);

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

    res.json(buildDocketQueryResponseSubmittedResponse(updatedDocket));
  }),
);
