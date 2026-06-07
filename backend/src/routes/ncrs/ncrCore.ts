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
import { buildNcrResponse, buildNcrUpdatedResponse } from './ncrCoreResponses.js';
import { createNcrSchema, parseOptionalNcrDueDate, updateNcrSchema } from './ncrCoreValidation.js';
import { createNcrWithAllocatedNumber } from './ncrNumberAllocation.js';
import { ncrListRouter } from './ncrListRoute.js';

export const ncrCoreRouter = Router();

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

    const ncr = await createNcrWithAllocatedNumber(projectId, async (tx, ncrNumber) => {
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

      // If redirecting to a new user, create a notification. Respect the
      // project-level "NCR Assignments" notification toggle (a redirect is an
      // assignment): when off, suppress it. Absent/missing settings default on.
      if (
        responsibleUserId &&
        isProjectNotificationEnabled(ncr.project.settings, 'ncrAssignments')
      ) {
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
