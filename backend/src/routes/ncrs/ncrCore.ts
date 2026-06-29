// NCR CRUD: create, list, get, update, delete
import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { type AuthUser } from '../../lib/auth.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import {
  canReadNcr,
  NCR_CREATE_ROLES,
  parseNcrRouteParam,
  requireActiveProjectUser,
} from './ncrAccess.js';
import { logError } from '../../lib/serverLogger.js';
import { isProjectNotificationEnabled } from '../../lib/projectNotificationPreferences.js';
import {
  activeSubcontractorCompanyWhere,
  assertProjectAllowsWrite,
} from '../../lib/projectAccess.js';
import { buildNcrResponse, buildNcrUpdatedResponse } from './ncrCoreResponses.js';
import { createNcrSchema, parseOptionalNcrDueDate, updateNcrSchema } from './ncrCoreValidation.js';
import { createNcrWithAllocatedNumber } from './ncrNumberAllocation.js';
import { ncrListRouter } from './ncrListRoute.js';
import { assertNcrLinkableLots } from './ncrLotStatus.js';
import { emitNcrWebhookEvent } from './webhookEvents.js';
import {
  enableSubcontractorNcrPortalAccessOnAssignment,
  notifySubcontractorNcrPortalUsers,
} from './ncrNotifications.js';

export const ncrCoreRouter = Router();

function addNcrUpdateAuditChange(
  changes: Record<string, unknown>,
  field: string,
  from: string | null,
  to: string | null,
) {
  if (from !== to) {
    changes[field] = { from, to };
  }
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
    select: { id: true, lotNumber: true, status: true },
  });

  if (matchingLots.length !== uniqueLotIds.length) {
    throw AppError.badRequest('All NCR lots must belong to the NCR project');
  }

  assertNcrLinkableLots(matchingLots);

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

async function requireActiveResponsibleSubcontractor(
  projectId: string,
  responsibleSubcontractorId?: string | null,
): Promise<void> {
  if (!responsibleSubcontractorId) {
    return;
  }

  const subcontractor = await prisma.subcontractorCompany.findFirst({
    where: activeSubcontractorCompanyWhere({ id: responsibleSubcontractorId, projectId }),
    select: { id: true },
  });

  if (!subcontractor) {
    throw AppError.badRequest(
      'Responsible subcontractor must be an active subcontractor on this project',
    );
  }
}

async function requireFailedTestResultForNcr(
  projectId: string,
  linkedTestResultId?: string | null,
  ncrLotIds: string[] = [],
): Promise<string | null> {
  if (!linkedTestResultId) {
    return null;
  }

  const testResult = await prisma.testResult.findUnique({
    where: { id: linkedTestResultId },
    select: {
      id: true,
      projectId: true,
      lotId: true,
      passFail: true,
    },
  });

  if (!testResult || testResult.projectId !== projectId) {
    throw AppError.badRequest('Linked test result must belong to the NCR project');
  }

  if (testResult.passFail !== 'fail') {
    throw AppError.badRequest('Only failed test results can be linked to an NCR');
  }

  if (testResult.lotId && ncrLotIds.length > 0 && !ncrLotIds.includes(testResult.lotId)) {
    throw AppError.badRequest('Linked test result lot must be included in the NCR lots');
  }

  return testResult.id;
}

ncrCoreRouter.use(ncrListRouter);

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
      responsibleSubcontractorId,
      linkedTestResultId,
      dueDate,
      lotIds,
    } = validation.data;

    await requireActiveProjectUser(
      projectId,
      user,
      'You do not have permission to create NCRs for this project',
      NCR_CREATE_ROLES,
    );
    await assertProjectAllowsWrite(projectId);

    const ncrLotIds = await requireNcrLotsInProject(projectId, lotIds || []);
    await requireActiveResponsibleUser(projectId, responsibleUserId);
    await requireActiveResponsibleSubcontractor(projectId, responsibleSubcontractorId);
    const linkedFailedTestResultId = await requireFailedTestResultForNcr(
      projectId,
      linkedTestResultId,
      ncrLotIds,
    );
    const parsedDueDate = parseOptionalNcrDueDate(dueDate);

    // Major NCRs require QM approval to close and client notification
    const isMajor = severity === 'major';

    const ncr = await createNcrWithAllocatedNumber(projectId, async (tx, ncrNumber) => {
      const createdNcr = await tx.nCR.create({
        data: {
          projectId,
          ncrNumber,
          description,
          specificationReference,
          category,
          severity: severity || 'minor',
          linkedTestResultId: linkedFailedTestResultId,
          qmApprovalRequired: isMajor,
          clientNotificationRequired: isMajor, // Feature #213: Major NCRs require client notification
          raisedById: user.userId,
          responsibleUserId,
          responsibleSubcontractorId,
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
              lot: { select: { lotNumber: true } },
            },
          },
        },
      });

      // Update affected lots status in the same transaction as the NCR record.
      if (ncrLotIds.length) {
        await tx.lot.updateMany({
          where: { id: { in: ncrLotIds }, projectId, status: { notIn: ['conformed', 'claimed'] } },
          data: { status: 'ncr_raised' },
        });
      }

      return createdNcr;
    });

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
        ...(linkedFailedTestResultId ? { linkedTestResultId: linkedFailedTestResultId } : {}),
      },
      req,
    });

    // Feature #212: Notify responsible party when assigned to NCR.
    // Respect the project-level "NCR Assignments" notification toggle: when an
    // admin turns this category off, suppress the assignment notification for
    // the whole project. Absent/missing settings default to on.
    if (responsibleUserId && responsibleUserId !== user.userId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { settings: true },
      });

      if (isProjectNotificationEnabled(project?.settings, 'ncrAssignments')) {
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
    }

    // Feature N1: Notify the assigned subcontractor's portal users when an NCR
    // is raised against their company. Respects the same project-level "NCR
    // Assignments" toggle as the user-assignment notification above.
    if (responsibleSubcontractorId) {
      // Grant the subcontractor NCR portal visibility on assignment (before the
      // notification, which is gated on the same module flag).
      await enableSubcontractorNcrPortalAccessOnAssignment(
        responsibleSubcontractorId,
        projectId,
        user.userId,
        ncr.ncrNumber,
        req,
      );

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { settings: true },
      });

      if (isProjectNotificationEnabled(project?.settings, 'ncrAssignments')) {
        try {
          await notifySubcontractorNcrPortalUsers({
            projectId,
            subcontractorCompanyId: responsibleSubcontractorId,
            ncrId: ncr.id,
            type: 'ncr_assigned',
            title: 'NCR Assigned to Your Company',
            message: `${ncr.ncrNumber} has been assigned to your company: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
          });
        } catch (notifError) {
          logError('Failed to create subcontractor assignment notifications:', notifError);
        }
      }
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

    emitNcrWebhookEvent(ncr.projectId, 'ncr.created', {
      ncrId: ncr.id,
      projectId: ncr.projectId,
      ncrNumber: ncr.ncrNumber,
      status: ncr.status,
      severity: ncr.severity,
      actorUserId: user.userId,
      action: 'created',
    });

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
    const { responsibleUserId, responsibleSubcontractorId, comments } = validation.data;

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        project: true,
        responsibleUser: { select: { id: true, fullName: true, email: true } },
        responsibleSubcontractor: { select: { id: true, companyName: true } },
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
    await assertProjectAllowsWrite(ncr.projectId);

    // Build update data
    const updateData: Prisma.NCRUncheckedUpdateInput = {};
    const auditChanges: Record<string, unknown> = {
      ncrNumber: ncr.ncrNumber,
    };
    const notificationsEnabled = isProjectNotificationEnabled(
      ncr.project.settings,
      'ncrAssignments',
    );

    // Responsible-party assignment is mutually exclusive: assigning to a user
    // clears any subcontractor (and vice-versa); passing null/empty clears the
    // field to unassigned. Schema-level superRefine already rejects requests
    // that try to set BOTH a user and a subcontractor at once.
    const assigningUser = responsibleUserId !== undefined && responsibleUserId !== null;
    const assigningSubcontractor =
      responsibleSubcontractorId !== undefined && responsibleSubcontractorId !== null;

    // Mutual-exclusion swap-clear (see below): each change-branch clears the
    // OPPOSITE target whenever it assigns its own. The clear is gated on the
    // change-branch being entered, which is sufficient because a request that
    // changes the responsible party necessarily enters the matching branch, and
    // that branch's clear nulls the other field. Both-set can therefore never
    // persist. The schema-level superRefine (createNcrSchema/updateNcrSchema in
    // ncrCoreValidation.ts) is the authoritative guard — it rejects any single
    // request that sends BOTH a non-null user id and a non-null subcontractor
    // id — so at most one of `assigningUser` / `assigningSubcontractor` is ever
    // true here, and the swap-clears below are belt-and-braces, not the
    // primary defence.

    // If responsibleUserId is being changed (redirect to a user)
    if (responsibleUserId !== undefined && responsibleUserId !== ncr.responsibleUserId) {
      await requireActiveResponsibleUser(ncr.projectId, responsibleUserId);

      updateData.responsibleUserId = responsibleUserId || null;
      addNcrUpdateAuditChange(
        auditChanges,
        'responsibleUserId',
        ncr.responsibleUserId,
        responsibleUserId || null,
      );
      // Swap target type: assigning to a user clears any subcontractor.
      if (assigningUser) {
        updateData.responsibleSubcontractorId = null;
        addNcrUpdateAuditChange(
          auditChanges,
          'responsibleSubcontractorId',
          ncr.responsibleSubcontractorId,
          null,
        );
      }

      // If redirecting to a new user, create a notification. Respect the
      // project-level "NCR Assignments" notification toggle (a redirect is an
      // assignment): when off, suppress it. Absent/missing settings default on.
      if (responsibleUserId && notificationsEnabled) {
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

    // If responsibleSubcontractorId is being changed (redirect to a subcontractor)
    if (
      responsibleSubcontractorId !== undefined &&
      responsibleSubcontractorId !== ncr.responsibleSubcontractorId
    ) {
      await requireActiveResponsibleSubcontractor(ncr.projectId, responsibleSubcontractorId);

      updateData.responsibleSubcontractorId = responsibleSubcontractorId || null;
      addNcrUpdateAuditChange(
        auditChanges,
        'responsibleSubcontractorId',
        ncr.responsibleSubcontractorId,
        responsibleSubcontractorId || null,
      );
      // Swap target type: assigning to a subcontractor clears any user.
      if (assigningSubcontractor) {
        updateData.responsibleUserId = null;
        addNcrUpdateAuditChange(auditChanges, 'responsibleUserId', ncr.responsibleUserId, null);
      }

      if (responsibleSubcontractorId) {
        // Grant the subcontractor NCR portal visibility on (re)assignment
        // (before the notification, which is gated on the same module flag).
        await enableSubcontractorNcrPortalAccessOnAssignment(
          responsibleSubcontractorId,
          ncr.projectId,
          user.userId,
          ncr.ncrNumber,
          req,
        );
      }

      // Notify the subcontractor's portal users on (re)assignment. Same toggle.
      if (responsibleSubcontractorId && notificationsEnabled) {
        try {
          await notifySubcontractorNcrPortalUsers({
            projectId: ncr.projectId,
            subcontractorCompanyId: responsibleSubcontractorId,
            ncrId: ncr.id,
            type: 'ncr_redirect',
            title: 'NCR Redirected to Your Company',
            message: `NCR #${ncr.ncrNumber} "${ncr.description.substring(0, 50)}..." has been redirected to your company for response`,
          });
        } catch (notifError) {
          logError('Failed to create subcontractor redirect notifications:', notifError);
        }
      }
    }

    // If comments are provided, add them as revision comments
    if (comments) {
      updateData.qmReviewComments = comments;
      auditChanges.commentsPresent = true;
    }

    if (Object.keys(updateData).length === 0) {
      throw AppError.badRequest('No fields to update');
    }

    const updatedNcr = await prisma.nCR.update({
      where: { id },
      data: updateData,
      include: {
        responsibleUser: { select: { id: true, fullName: true, email: true } },
        responsibleSubcontractor: { select: { id: true, companyName: true } },
        raisedBy: { select: { id: true, fullName: true, email: true } },
        ncrLots: {
          include: {
            lot: { select: { id: true, lotNumber: true } },
          },
        },
      },
    });

    await createAuditLog({
      projectId: ncr.projectId,
      userId: user.userId,
      entityType: 'ncr',
      entityId: ncr.id,
      action: AuditAction.NCR_UPDATED,
      changes: auditChanges,
      req,
    });

    res.json(buildNcrUpdatedResponse(updatedNcr));
  }),
);
