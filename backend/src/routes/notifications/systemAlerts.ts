/**
 * System-alert route handlers for critical notification issues.
 *
 * Mounted by alerts.ts under the same notifications router, after the parent
 * notifications router has already applied route-wide authentication.
 */

import { Router } from 'express';
import type { Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { getAccessibleActiveProjectIds, getManageableActiveProjectIds } from './access.js';
import { generateAlertId, toAlert, type Alert, type AlertSeverity } from './alertMappers.js';
import { createAlertRecord } from './alertPersistence.js';
import { buildProjectEntityLink } from './links.js';
import {
  buildSystemAlertsCheckResponse,
  buildSystemAlertsSummaryResponse,
  type SystemAlertResult,
} from './systemAlertResponses.js';
import { parseOptionalString } from './validation.js';

export const notificationSystemAlertsRouter = Router();

// POST /api/notifications/system-alerts/check - Check and generate system alerts for critical issues
// This is the main endpoint that checks for all critical issues and creates appropriate alerts
// It should be called periodically (e.g., every hour) by a scheduled task or cron job
notificationSystemAlertsRouter.post(
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
notificationSystemAlertsRouter.get(
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
