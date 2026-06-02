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
import type { Prisma } from '@prisma/client';
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
  type AlertSeverity,
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
import {
  buildSystemAlertsCheckResponse,
  buildSystemAlertsSummaryResponse,
  type SystemAlertResult,
} from './systemAlertResponses.js';

export const notificationAlertsRouter = Router();

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
    const alertRecords = await prisma.notificationAlert.findMany({
      where: {
        OR: [
          { assignedToId: userId },
          { projectId: { in: [...accessibleProjectIds] } },
          // Keep escalated recipients visible even when they are not project members.
          // JSON array contains filters are not portable across the test/runtime DBs.
          { escalationLevel: { gt: 0 } },
        ],
      },
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

// ============================================================================
// Feature #303: System Alerts for Critical Issues
// ============================================================================

// POST /api/notifications/system-alerts/check - Check and generate system alerts for critical issues
// This is the main endpoint that checks for all critical issues and creates appropriate alerts
// It should be called periodically (e.g., every hour) by a scheduled task or cron job
notificationAlertsRouter.post(
  '/system-alerts/check',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userId = user?.id;
    if (!user || !userId) {
      throw AppError.unauthorized();
    }
    const specificProjectId = parseOptionalString(req.body.projectId, 'projectId');
    const accessibleProjectIds = await getManageableActiveProjectIds(user, specificProjectId);
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alertsGenerated: SystemAlertResult[] = [];

    // Get projects to check
    const projectQuery: Prisma.ProjectWhereInput = {
      status: 'active',
      id: { in: accessibleProjectIds },
    };

    const projects = await prisma.project.findMany({
      where: projectQuery,
      select: { id: true, name: true },
    });

    for (const project of projects) {
      // ==========================================
      // 1. CHECK FOR OVERDUE NCRs
      // ==========================================
      const overdueNCRs = await prisma.nCR.findMany({
        where: {
          projectId: project.id,
          status: { notIn: ['closed', 'closed_concession'] },
          dueDate: { lt: now },
        },
        select: {
          id: true,
          ncrNumber: true,
          description: true,
          dueDate: true,
          responsibleUserId: true,
        },
      });

      for (const ncr of overdueNCRs) {
        // Check if an alert already exists for this NCR (avoid duplicates)
        const existingAlert = await prisma.notificationAlert.findFirst({
          where: {
            entityId: ncr.id,
            type: 'overdue_ncr',
            resolvedAt: null,
          },
        });

        if (!existingAlert) {
          const daysOverdue = ncr.dueDate
            ? Math.ceil((now.getTime() - new Date(ncr.dueDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          const severity: AlertSeverity =
            daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'high' : 'medium';

          const alert: Alert = {
            id: generateAlertId(),
            type: 'overdue_ncr',
            severity,
            title: `NCR ${ncr.ncrNumber} is overdue`,
            message: `NCR ${ncr.ncrNumber} is ${daysOverdue} day(s) overdue. ${ncr.description?.substring(0, 100) || 'No description'}`,
            entityId: ncr.id,
            entityType: 'ncr',
            projectId: project.id,
            assignedTo: ncr.responsibleUserId || userId,
            createdAt: now,
            escalationLevel: 0,
          };

          await createAlertRecord(alert);

          // Create in-app notification
          if (ncr.responsibleUserId) {
            await prisma.notification.create({
              data: {
                userId: ncr.responsibleUserId,
                projectId: project.id,
                type: 'alert_overdue_ncr',
                title: alert.title,
                message: alert.message,
                linkUrl: buildProjectEntityLink('ncr', ncr.id, project.id),
              },
            });
          }

          alertsGenerated.push({
            type: 'overdue_ncr',
            alertId: alert.id,
            entityId: ncr.id,
            projectName: project.name,
            severity,
            message: alert.title,
          });
        }
      }

      // ==========================================
      // 2. CHECK FOR STALE HOLD POINTS
      // ==========================================
      // Stale = requested/scheduled but not released within 24 hours
      const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

      const staleHoldPoints = await prisma.holdPoint.findMany({
        where: {
          lot: { projectId: project.id },
          status: { in: ['requested', 'scheduled'] },
          scheduledDate: { lt: staleThreshold },
        },
        include: {
          lot: { select: { id: true, lotNumber: true } },
          itpChecklistItem: { select: { id: true, description: true } },
        },
      });

      for (const hp of staleHoldPoints) {
        const existingAlert = await prisma.notificationAlert.findFirst({
          where: {
            entityId: hp.id,
            type: 'stale_hold_point',
            resolvedAt: null,
          },
        });

        if (!existingAlert) {
          const hoursStale = hp.scheduledDate
            ? Math.ceil((now.getTime() - new Date(hp.scheduledDate).getTime()) / (1000 * 60 * 60))
            : 0;

          const severity: AlertSeverity =
            hoursStale > 48 ? 'critical' : hoursStale > 24 ? 'high' : 'medium';

          const alert: Alert = {
            id: generateAlertId(),
            type: 'stale_hold_point',
            severity,
            title: `Hold Point stale: Lot ${hp.lot.lotNumber}`,
            message: `Hold Point for Lot ${hp.lot.lotNumber} has been ${hp.status} for ${hoursStale} hours. ${hp.itpChecklistItem?.description?.substring(0, 80) || ''}`,
            entityId: hp.id,
            entityType: 'holdpoint',
            projectId: project.id,
            assignedTo: userId, // Will be escalated to appropriate role
            createdAt: now,
            escalationLevel: 0,
          };

          await createAlertRecord(alert);

          // Notify project managers and superintendents
          const pmUsers = await prisma.projectUser.findMany({
            where: {
              projectId: project.id,
              role: { in: ['project_manager', 'superintendent', 'quality_manager'] },
              status: 'active',
            },
            select: { userId: true },
          });

          for (const pu of pmUsers) {
            await prisma.notification.create({
              data: {
                userId: pu.userId,
                projectId: project.id,
                type: 'alert_stale_hold_point',
                title: alert.title,
                message: alert.message,
                linkUrl: buildProjectEntityLink('lot', hp.lot.id, project.id, {
                  tab: 'holdpoints',
                }),
              },
            });
          }

          alertsGenerated.push({
            type: 'stale_hold_point',
            alertId: alert.id,
            entityId: hp.id,
            projectName: project.name,
            severity,
            message: alert.title,
          });
        }
      }

      // ==========================================
      // 3. CHECK FOR MISSED DIARY SUBMISSIONS
      // ==========================================
      // Check if yesterday's diary is missing
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayEnd = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000);

      const existingDiary = await prisma.dailyDiary.findFirst({
        where: {
          projectId: project.id,
          date: { gte: yesterday, lt: yesterdayEnd },
        },
      });

      if (!existingDiary) {
        const dateString = yesterday.toISOString().split('T')[0];
        const missingDiaryEntityId = `diary-${project.id}-${dateString}`;
        // Check if we already created an alert for this
        const existingMissingAlert = await prisma.notificationAlert.findFirst({
          where: {
            type: 'pending_approval',
            entityType: 'diary',
            projectId: project.id,
            entityId: missingDiaryEntityId,
            resolvedAt: null,
          },
        });

        if (!existingMissingAlert) {
          const alert: Alert = {
            id: generateAlertId(),
            type: 'pending_approval', // Using pending_approval for missing diary
            severity: 'high',
            title: `Missing Daily Diary: ${project.name}`,
            message: `No daily diary was submitted for ${project.name} on ${dateString}. This affects project records and compliance.`,
            entityId: missingDiaryEntityId,
            entityType: 'diary',
            projectId: project.id,
            assignedTo: userId,
            createdAt: now,
            escalationLevel: 0,
          };

          await createAlertRecord(alert);

          // Notify site engineers, foremen, and project managers
          const diaryUsers = await prisma.projectUser.findMany({
            where: {
              projectId: project.id,
              role: { in: ['site_engineer', 'foreman', 'project_manager'] },
              status: 'active',
            },
            select: { userId: true },
          });

          for (const pu of diaryUsers) {
            await prisma.notification.create({
              data: {
                userId: pu.userId,
                projectId: project.id,
                type: 'alert_missing_diary',
                title: alert.title,
                message: alert.message,
                linkUrl: `/projects/${project.id}/diary`,
              },
            });
          }

          alertsGenerated.push({
            type: 'missing_diary',
            alertId: alert.id,
            projectName: project.name,
            severity: 'high',
            message: alert.title,
          });
        }
      }
    }

    // Summary
    const summary = {
      overdueNCRs: alertsGenerated.filter((a) => a.type === 'overdue_ncr').length,
      staleHoldPoints: alertsGenerated.filter((a) => a.type === 'stale_hold_point').length,
      missingDiaries: alertsGenerated.filter((a) => a.type === 'missing_diary').length,
    };
    const activeAlerts = await prisma.notificationAlert.count({
      where: {
        resolvedAt: null,
        projectId: { in: accessibleProjectIds },
      },
    });

    res.json(
      buildSystemAlertsCheckResponse(now, projects.length, alertsGenerated, summary, activeAlerts),
    );
  }),
);

// GET /api/notifications/system-alerts/summary - Get summary of all active system alerts
notificationAlertsRouter.get(
  '/system-alerts/summary',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userId = user?.id;
    if (!user || !userId) {
      throw AppError.unauthorized();
    }

    const projectId = parseOptionalString(req.query.projectId, 'projectId');
    const accessibleProjectIds = new Set(await getAccessibleActiveProjectIds(user, projectId));

    const activeAlerts = (
      await prisma.notificationAlert.findMany({
        where: {
          resolvedAt: null,
          projectId: { in: [...accessibleProjectIds] },
        },
        orderBy: { createdAt: 'desc' },
      })
    ).map(toAlert);

    res.json(buildSystemAlertsSummaryResponse(activeAlerts));
  }),
);
