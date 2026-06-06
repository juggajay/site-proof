import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { escalateSchema, parseHoldPointRouteParam } from './validation.js';
import {
  requireProjectReadAccess,
  requireHoldPointReadAccess,
  requireProjectRole,
} from './access.js';
import {
  buildHoldPointEscalatedResponse,
  buildHoldPointEscalationResolvedResponse,
} from './actionResponses.js';

const HP_ESCALATION_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'superintendent',
];

export const holdPointEscalationRouter = Router();

// Escalate a hold point to QM/PM
holdPointEscalationRouter.post(
  '/:id/escalate',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseHoldPointRouteParam(req.params.id, 'id');
    const parseResult = escalateSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error);
    }

    const { escalatedTo, escalationReason } = parseResult.data;
    const userId = req.user!.userId;

    // Get hold point with lot/project info
    const existingHP = await prisma.holdPoint.findUnique({
      where: { id },
      include: {
        lot: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!existingHP) {
      throw AppError.notFound('Hold point');
    }

    await requireHoldPointReadAccess(existingHP, req.user!);
    await requireProjectRole(
      existingHP.lot.projectId,
      req.user!,
      HP_ESCALATION_ROLES,
      'You do not have permission to escalate hold points',
    );

    if (existingHP.status === 'released') {
      throw AppError.badRequest('Released hold points cannot be escalated.');
    }

    // Update hold point with escalation info
    const holdPoint = await prisma.holdPoint.update({
      where: { id },
      data: {
        isEscalated: true,
        escalatedAt: new Date(),
        escalatedById: userId,
        escalatedTo: escalatedTo || 'QM,PM', // Default to QM and PM
        escalationReason: escalationReason || 'Stale hold point - no response received',
      },
      include: {
        lot: true,
        itpChecklistItem: true,
      },
    });

    // Get QM/PM users from the project to notify
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: existingHP.lot.projectId,
        role: { in: ['admin', 'project_manager', 'qm', 'quality_manager'] },
        status: 'active',
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    // Create notifications for QM/PM users
    const notificationsToCreate = projectUsers.map((pu) => ({
      userId: pu.userId,
      projectId: existingHP.lot.projectId,
      type: 'hold_point_escalation',
      title: 'Hold Point Escalated',
      message: `Hold point "${holdPoint.description}" on lot ${holdPoint.lot.lotNumber} has been escalated. Reason: ${holdPoint.escalationReason}`,
      linkUrl: `/projects/${existingHP.lot.projectId}/holdpoints/${id}`,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });
    }

    // Audit log for HP escalation
    await createAuditLog({
      projectId: existingHP.lot.projectId,
      userId,
      entityType: 'hold_point',
      entityId: id,
      action: AuditAction.HP_ESCALATED,
      changes: { escalatedTo, escalationReason },
      req,
    });

    res.json(buildHoldPointEscalatedResponse(holdPoint, projectUsers));
  }),
);

// Resolve an escalated hold point
holdPointEscalationRouter.post(
  '/:id/resolve-escalation',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseHoldPointRouteParam(req.params.id, 'id');

    const existingHP = await prisma.holdPoint.findUnique({
      where: { id },
      include: { lot: { select: { projectId: true } } },
    });

    if (!existingHP) {
      throw AppError.notFound('Hold point');
    }

    await requireProjectReadAccess(
      existingHP.lot.projectId,
      req.user!,
      'You do not have access to this hold point',
    );
    await requireProjectRole(
      existingHP.lot.projectId,
      req.user!,
      HP_ESCALATION_ROLES,
      'You do not have permission to resolve hold point escalations',
    );

    const holdPoint = await prisma.holdPoint.update({
      where: { id },
      data: {
        escalationResolved: true,
        escalationResolvedAt: new Date(),
      },
      include: { lot: { select: { projectId: true } } },
    });

    // Audit log for HP escalation resolved
    await createAuditLog({
      projectId: holdPoint.lot.projectId,
      userId: req.user!.userId,
      entityType: 'hold_point',
      entityId: id,
      action: AuditAction.HP_ESCALATION_RESOLVED,
      changes: { escalationResolved: true },
      req,
    });

    res.json(buildHoldPointEscalationResolvedResponse(holdPoint));
  }),
);
