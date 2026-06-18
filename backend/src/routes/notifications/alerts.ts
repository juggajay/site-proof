/**
 * Alert and system-alert route handlers for the notifications API, extracted
 * from backend/src/routes/notifications.ts as a handler-group relocation slice
 * of the notifications route split (engineering-health Workstream 1).
 *
 * This child router is mounted by notifications.ts with
 * notificationsRouter.use(notificationAlertsRouter) AFTER the parent applies its
 * route-wide requireAuth, so every route here inherits authentication exactly as
 * it did when the handlers lived inline (mirrors the diary/ and dockets/ child
 * router pattern). Paths, auth, role checks, escalation behaviour, notification
 * creation, audit/response shapes, and dev-only guards are unchanged from the
 * inline implementation.
 */

import { Router } from 'express';
import { type Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  MAX_NOTIFICATION_FILTER_LENGTH,
  MAX_NOTIFICATION_MESSAGE_LENGTH,
  MAX_NOTIFICATION_TITLE_LENGTH,
  parseNotificationRouteId,
  parseOptionalString,
  parseRequiredString,
} from './validation.js';
import { buildProjectEntityLink } from './links.js';
import {
  canReceiveProjectAlert,
  getAccessibleActiveProjectIds,
  getManageableActiveProjectIds,
  requireAlertAccess,
  requireAlertResolveAccess,
  requireNotificationAdmin,
  requireProjectNotificationAdminAccess,
  requireProjectReadAccess,
} from './access.js';
import {
  generateAlertId,
  parseAlertSeverity,
  parseAlertStatusFilter,
  parseAlertType,
  parseOptionalAlertType,
  toAlert,
  type Alert,
} from './alertMappers.js';
import { ESCALATION_CONFIG, createAlertRecord, updateAlertEscalation } from './alertPersistence.js';
import { sendNotificationIfEnabled } from './delivery.js';
import {
  buildAlertCreatedResponse,
  buildAlertEscalationCheckResponse,
  buildAlertEscalationConfigResponse,
  buildAlertResolvedResponse,
  buildAlertsListResponse,
  buildAlertTestEscalatedResponse,
} from './alertResponses.js';
import { notificationSystemAlertsRouter } from './systemAlerts.js';

export const notificationAlertsRouter = Router();
const MAX_ALERT_LIST_RESULTS = 500;

// ============================================================================
// ALERT ESCALATION SYSTEM
// ============================================================================

// POST /api/notifications/alerts - Create a new alert
notificationAlertsRouter.post(
  '/alerts',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userId = user?.id;
    if (!user || !userId) {
      throw AppError.unauthorized();
    }

    const alertType = parseAlertType(req.body.type);
    const alertSeverity = parseAlertSeverity(req.body.severity);
    const title = parseRequiredString(req.body.title, 'title', MAX_NOTIFICATION_TITLE_LENGTH);
    const message = parseRequiredString(
      req.body.message,
      'message',
      MAX_NOTIFICATION_MESSAGE_LENGTH,
    );
    const entityId = parseRequiredString(
      req.body.entityId,
      'entityId',
      MAX_NOTIFICATION_FILTER_LENGTH,
    );
    const entityType = parseRequiredString(
      req.body.entityType,
      'entityType',
      MAX_NOTIFICATION_FILTER_LENGTH,
    );
    const assignedTo = parseRequiredString(
      req.body.assignedTo,
      'assignedTo',
      MAX_NOTIFICATION_FILTER_LENGTH,
    );
    const alertProjectId = parseOptionalString(
      req.body.projectId,
      'projectId',
      MAX_NOTIFICATION_FILTER_LENGTH,
    );

    if (alertProjectId) {
      await requireProjectReadAccess(user, alertProjectId);
      if (!(await canReceiveProjectAlert(assignedTo, alertProjectId, entityType))) {
        throw AppError.forbidden('Assigned user does not have project access');
      }
    } else if (assignedTo !== userId) {
      throw AppError.forbidden('Project alerts must include a projectId');
    }

    const alert: Alert = {
      id: generateAlertId(),
      type: alertType,
      severity: alertSeverity,
      title,
      message,
      entityId,
      entityType,
      projectId: alertProjectId,
      assignedTo,
      createdAt: new Date(),
      escalationLevel: 0,
    };

    const savedAlert = await createAlertRecord(alert);

    // Create in-app notification for assigned user
    await prisma.notification.create({
      data: {
        userId: assignedTo,
        projectId: alertProjectId || null,
        type: `alert_${alertType}`,
        title,
        message,
        linkUrl: buildProjectEntityLink(entityType, entityId, alertProjectId),
      },
    });

    res.json(buildAlertCreatedResponse(savedAlert));
  }),
);

// GET /api/notifications/alerts - Get all active alerts
notificationAlertsRouter.get(
  '/alerts',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userId = user?.id;
    if (!user || !userId) {
      throw AppError.unauthorized();
    }

    const status = parseAlertStatusFilter(req.query.status);
    const type = parseOptionalAlertType(req.query.type);
    const assignedTo = parseOptionalString(
      req.query.assignedTo,
      'assignedTo',
      MAX_NOTIFICATION_FILTER_LENGTH,
    );

    const accessibleProjectIds = new Set(await getAccessibleActiveProjectIds(user));
    const alertWhere: Prisma.NotificationAlertWhereInput = {
      OR: [
        { assignedToId: userId },
        { projectId: { in: [...accessibleProjectIds] } },
        // Keep escalated recipients visible even when they are not project members.
        // JSON array contains filters are not portable across the test/runtime DBs.
        { escalationLevel: { gt: 0 } },
      ],
    };

    if (status === 'active') {
      alertWhere.resolvedAt = null;
    } else if (status === 'resolved') {
      alertWhere.resolvedAt = { not: null };
    } else if (status === 'escalated') {
      alertWhere.resolvedAt = null;
      alertWhere.escalationLevel = { gt: 0 };
    }

    const alertRecords = await prisma.notificationAlert.findMany({
      where: alertWhere,
      orderBy: { createdAt: 'desc' },
      take: MAX_ALERT_LIST_RESULTS,
    });

    let alerts = alertRecords
      .map(toAlert)
      .filter(
        (alert) =>
          alert.assignedTo === userId ||
          alert.escalatedTo?.includes(userId) ||
          (alert.projectId ? accessibleProjectIds.has(alert.projectId) : false),
      );

    // Filter by status
    if (status === 'active') {
      alerts = alerts.filter((a) => !a.resolvedAt);
    } else if (status === 'resolved') {
      alerts = alerts.filter((a) => !!a.resolvedAt);
    } else if (status === 'escalated') {
      alerts = alerts.filter((a) => a.escalationLevel > 0 && !a.resolvedAt);
    }

    // Filter by type
    if (type) {
      alerts = alerts.filter((a) => a.type === type);
    }

    // Filter by assigned user
    if (assignedTo) {
      alerts = alerts.filter(
        (a) => a.assignedTo === assignedTo || a.escalatedTo?.includes(assignedTo as string),
      );
    }

    // Sort by creation date (newest first)
    alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(buildAlertsListResponse(alerts));
  }),
);

// PUT /api/notifications/alerts/:id/resolve - Resolve an alert
notificationAlertsRouter.put(
  '/alerts/:id/resolve',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userId = user?.id;
    if (!user || !userId) {
      throw AppError.unauthorized();
    }

    const id = parseNotificationRouteId(req.params.id);
    const alertRecord = await prisma.notificationAlert.findUnique({ where: { id } });

    if (!alertRecord) {
      throw AppError.notFound('Alert');
    }

    const alert = toAlert(alertRecord);
    if (alert.resolvedAt) {
      throw AppError.badRequest('Alert is already resolved');
    }
    await requireAlertResolveAccess(user, alert);

    const updatedAlert = toAlert(
      await prisma.notificationAlert.update({
        where: { id },
        data: { resolvedAt: new Date() },
      }),
    );

    res.json(buildAlertResolvedResponse(updatedAlert));
  }),
);

// POST /api/notifications/alerts/check-escalations - Check and process escalations
// This would typically be called by a cron job or scheduled task
notificationAlertsRouter.post(
  '/alerts/check-escalations',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userId = user?.id;
    if (!user || !userId) {
      throw AppError.unauthorized();
    }
    const accessibleProjectIds = new Set(await getManageableActiveProjectIds(user));

    const now = new Date();
    const escalatedAlerts: Alert[] = [];
    const alertRecords = await prisma.notificationAlert.findMany({
      where: {
        resolvedAt: null,
        OR: [{ assignedToId: userId }, { projectId: { in: [...accessibleProjectIds] } }],
      },
    });

    for (const alertRecord of alertRecords) {
      const alert = toAlert(alertRecord);
      if (alert.projectId && !accessibleProjectIds.has(alert.projectId)) continue;

      const config = ESCALATION_CONFIG[alert.type];
      if (!config) continue;

      const hoursSinceCreation =
        (now.getTime() - new Date(alert.createdAt).getTime()) / (1000 * 60 * 60);

      // Check if we need to escalate
      let shouldEscalate = false;
      let newLevel = alert.escalationLevel;

      if (alert.escalationLevel === 0 && hoursSinceCreation >= config.firstEscalationAfterHours) {
        shouldEscalate = true;
        newLevel = 1;
      } else if (
        alert.escalationLevel === 1 &&
        hoursSinceCreation >= config.secondEscalationAfterHours
      ) {
        shouldEscalate = true;
        newLevel = 2;
      }

      if (shouldEscalate) {
        // Find users to escalate to based on roles in project
        const escalationUsers = alert.projectId
          ? await prisma.user.findMany({
              where: {
                projectUsers: {
                  some: {
                    projectId: alert.projectId,
                    status: 'active',
                    role: {
                      in: config.escalationRoles,
                    },
                  },
                },
              },
              select: {
                id: true,
                email: true,
                fullName: true,
                roleInCompany: true,
              },
            })
          : [];

        const escalatedToIds = escalationUsers.map((u) => u.id);

        const escalatedAlert = await updateAlertEscalation(alert.id, newLevel, now, escalatedToIds);

        // Create notifications for escalation recipients
        for (const user of escalationUsers) {
          await prisma.notification.create({
            data: {
              userId: user.id,
              projectId: alert.projectId || null,
              type: 'alert_escalation',
              title: `ESCALATED: ${alert.title}`,
              message: `Alert has been escalated (Level ${newLevel}): ${alert.message}`,
              linkUrl: buildProjectEntityLink(alert.entityType, alert.entityId, alert.projectId),
            },
          });

          // Send email notification for escalation (always immediate for escalations)
          await sendNotificationIfEnabled(user.id, 'ncrAssigned', {
            title: `ESCALATED ALERT: ${alert.title}`,
            message: `This alert has been escalated to you because it was not resolved within ${newLevel === 1 ? config.firstEscalationAfterHours : config.secondEscalationAfterHours} hours.\n\n${alert.message}`,
            linkUrl: buildProjectEntityLink(alert.entityType, alert.entityId, alert.projectId),
          });
        }

        escalatedAlerts.push(escalatedAlert);
      }
    }

    const totalActiveAlerts = await prisma.notificationAlert.count({
      where: {
        resolvedAt: null,
        OR: [{ assignedToId: userId }, { projectId: { in: [...accessibleProjectIds] } }],
      },
    });

    res.json(buildAlertEscalationCheckResponse(escalatedAlerts, totalActiveAlerts));
  }),
);

// GET /api/notifications/alerts/escalation-config - Get escalation configuration
notificationAlertsRouter.get(
  '/alerts/escalation-config',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userId = user?.id;
    if (!user || !userId) {
      throw AppError.unauthorized();
    }
    requireNotificationAdmin(user);

    res.json(buildAlertEscalationConfigResponse(ESCALATION_CONFIG));
  }),
);

// POST /api/notifications/alerts/:id/test-escalate - Force escalate an alert (for testing)
// This simulates time passing and triggers escalation
notificationAlertsRouter.post(
  '/alerts/:id/test-escalate',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userId = user?.id;
    if (!user || !userId) {
      throw AppError.unauthorized();
    }
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      throw AppError.forbidden('Not available in production');
    }

    const id = parseNotificationRouteId(req.params.id);
    const alertRecord = await prisma.notificationAlert.findUnique({ where: { id } });

    if (!alertRecord) {
      throw AppError.notFound('Alert');
    }

    const alert = toAlert(alertRecord);
    if (alert.resolvedAt) {
      throw AppError.badRequest('Alert is already resolved');
    }
    if (alert.projectId) {
      await requireProjectNotificationAdminAccess(user, alert.projectId);
    } else {
      requireNotificationAdmin(user);
      await requireAlertAccess(user, alert);
    }

    const config = ESCALATION_CONFIG[alert.type];
    if (!config) {
      throw AppError.badRequest('Unknown alert type');
    }

    // Determine the next escalation level
    const newLevel = alert.escalationLevel + 1;
    if (newLevel > 2) {
      throw AppError.badRequest('Alert is already at maximum escalation level');
    }

    // Find users to escalate to based on roles in project
    const escalationUsers = alert.projectId
      ? await prisma.user.findMany({
          where: {
            projectUsers: {
              some: {
                projectId: alert.projectId,
                status: 'active',
                role: {
                  in: config.escalationRoles,
                },
              },
            },
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            roleInCompany: true,
          },
        })
      : [];

    const escalatedToIds = escalationUsers.map((u) => u.id);

    const escalatedAt = new Date();
    const escalatedAlert = await updateAlertEscalation(id, newLevel, escalatedAt, escalatedToIds);

    // Create notifications for escalation recipients
    for (const user of escalationUsers) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          projectId: alert.projectId || null,
          type: 'alert_escalation',
          title: `ESCALATED: ${alert.title}`,
          message: `Alert has been escalated (Level ${newLevel}): ${alert.message}`,
          linkUrl: buildProjectEntityLink(alert.entityType, alert.entityId, alert.projectId),
        },
      });
    }

    res.json(buildAlertTestEscalatedResponse(escalatedAlert, escalationUsers, newLevel));
  }),
);

notificationAlertsRouter.use(notificationSystemAlertsRouter);
