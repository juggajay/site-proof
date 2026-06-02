import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { parseOptionalDate, parseOptionalString } from './notifications/validation.js';
import { type NotificationTiming } from './notifications/emailPreferences.js';
import {
  getManageableActiveProjectIds,
  requireProjectNotificationAdminAccess,
  requireProjectReadAccess,
} from './notifications/access.js';
import { getUserDigestQueue } from './notifications/digestQueue.js';
import { type Alert, type AlertSeverity, type AlertType } from './notifications/alertMappers.js';
import { getNotificationTiming, sendNotificationIfEnabled } from './notifications/delivery.js';
import { notificationAlertsRouter } from './notifications/alerts.js';
import { notificationUserRouter } from './notifications/userRoutes.js';
import { notificationEmailRouter } from './notifications/emailRoutes.js';
import { createMentionNotifications } from './notifications/mentions.js';
import {
  buildMentionableProjectFilter,
  buildMentionableUserFilters,
  buildMentionableUsersResponse,
} from './notifications/mentionUsers.js';
import {
  buildDiaryReminderCheckResponse,
  buildDiaryReminderSendResponse,
  buildDocketBacklogAlertsResponse,
  buildMissingDiaryAlertsResponse,
  type DiaryReminderResult,
  type DocketBacklogAlertResult,
  type MissingDiaryAlertResult,
} from './notifications/diaryReminderResponses.js';

// Re-exported so external modules that import the notification timing type from
// this route file keep working after the email-preference helper extraction.
export type { NotificationTiming };
// Re-exported so external modules that import the digest-queue accessor from
// this route file keep working after the digest-queue helper extraction.
export { getUserDigestQueue };
// Re-exported so external modules that import the alert value types from this
// route file keep working after the alert-mapper helper extraction.
export type { Alert, AlertSeverity, AlertType };
// Re-exported so the claims, dockets, holdpoints, projects and testResults
// routes that import these delivery helpers from this route file keep working
// after the delivery helper extraction.
export { getNotificationTiming, sendNotificationIfEnabled };
// Re-exported so the comments route that imports this mention helper from this
// route file keeps working after the mention helper extraction.
export { createMentionNotifications };

export const notificationsRouter = Router();

// Apply authentication middleware to all notification routes
notificationsRouter.use(requireAuth);

// GET /api/notifications/users - Get users that can be mentioned (for autocomplete)
notificationsRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const search = parseOptionalString(req.query.search, 'search');
    const projectId = parseOptionalString(req.query.projectId, 'projectId');

    const filters = buildMentionableUserFilters(user, search);

    // If projectId provided, filter by project membership
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { companyId: true },
      });

      if (!project) {
        throw AppError.notFound('Project');
      }

      await requireProjectReadAccess(user, projectId);
      filters.push(buildMentionableProjectFilter(projectId, project.companyId));
    }

    const users = await prisma.user.findMany({
      where: { AND: filters },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
      },
      take: 10,
      orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
    });

    res.json(buildMentionableUsersResponse(users));
  }),
);

// Email and digest operational routes (preferences, test email, service status,
// email queue, and digest queue) live in a child router
// (notifications/emailRoutes.ts), mounted here after the route-wide requireAuth
// above so they inherit auth (mirrors the diary/ and dockets/ child router
// pattern). Mounted before the diary-reminder routes below and before the
// dynamic DELETE /:id in notifications/userRoutes.ts, so the static
// DELETE /email-queue and DELETE /digest-queue routes are not shadowed. Paths
// are unchanged.
notificationsRouter.use(notificationEmailRouter);

// ============================================================================
// Feature #934: Daily Diary Reminder Notification
// ============================================================================

// POST /api/notifications/diary-reminder/check - Check for missing diaries and send reminders
// This would typically be called by a cron job at end of day (e.g., 5pm local time)
notificationsRouter.post(
  '/diary-reminder/check',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userId = user?.id;
    if (!user || !userId) {
      throw AppError.unauthorized();
    }
    // Get today's date (or allow override for testing)
    const dateOverride = parseOptionalDate(req.body.date, 'date');
    const specificProjectId = parseOptionalString(req.body.projectId, 'projectId');
    const accessibleProjectIds = await getManageableActiveProjectIds(user, specificProjectId);
    const targetDate = dateOverride ?? new Date();
    targetDate.setHours(0, 0, 0, 0);
    const dateString = targetDate.toISOString().split('T')[0];

    // Get all active projects
    const projectQuery: Prisma.ProjectWhereInput = {
      status: 'active',
      id: { in: accessibleProjectIds },
    };

    const projects = await prisma.project.findMany({
      where: projectQuery,
      select: { id: true, name: true },
    });

    const remindersCreated: DiaryReminderResult[] = [];
    const usersNotified = new Set<string>();

    for (const project of projects) {
      // Check if a diary exists for this project on the target date
      const existingDiary = await prisma.dailyDiary.findFirst({
        where: {
          projectId: project.id,
          date: {
            gte: targetDate,
            lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });

      if (existingDiary) {
        // Diary exists, no reminder needed
        continue;
      }

      const existingReminder = await prisma.notification.findFirst({
        where: {
          projectId: project.id,
          type: 'diary_reminder',
          message: { contains: dateString },
        },
      });

      if (existingReminder) {
        // Reminder already sent for this project/date.
        continue;
      }

      // No diary - find users who should be reminded (site engineers and foremen)
      const projectUsers = await prisma.projectUser.findMany({
        where: {
          projectId: project.id,
          role: { in: ['site_engineer', 'foreman', 'project_manager'] },
          status: 'active',
        },
      });

      const userIds = projectUsers.map((pu) => pu.userId);
      const users =
        userIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, email: true, fullName: true },
            })
          : [];

      // Create reminder notifications
      const notificationsToCreate = users.map((user) => ({
        userId: user.id,
        projectId: project.id,
        type: 'diary_reminder',
        title: 'Daily Diary Reminder',
        message: `No daily diary entry found for ${project.name} on ${dateString}. Please complete your site diary.`,
        linkUrl: `/projects/${project.id}/diary`,
      }));

      if (notificationsToCreate.length > 0) {
        await prisma.notification.createMany({
          data: notificationsToCreate,
        });

        for (const user of users) {
          usersNotified.add(user.id);

          // Send email notification
          await sendNotificationIfEnabled(user.id, 'diaryReminder', {
            title: 'Daily Diary Reminder',
            message: `No daily diary entry found for ${project.name} on ${dateString}. Please complete your site diary.`,
            projectName: project.name,
            linkUrl: `/projects/${project.id}/diary`,
          });
        }

        remindersCreated.push({
          projectId: project.id,
          projectName: project.name,
          date: dateString,
          usersNotified: users.map((u) => u.email),
        });
      }
    }

    res.json(
      buildDiaryReminderCheckResponse(dateString, projects.length, remindersCreated, usersNotified),
    );
  }),
);

// POST /api/notifications/diary-reminder/send - Manually send a diary reminder for a specific project
notificationsRouter.post(
  '/diary-reminder/send',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userId = user?.id;
    if (!user || !userId) {
      throw AppError.unauthorized();
    }
    const projectId = parseOptionalString(req.body.projectId, 'projectId');
    const date = parseOptionalDate(req.body.date, 'date');

    if (!projectId) {
      throw AppError.badRequest('projectId is required');
    }

    const targetDate = date ?? new Date();
    targetDate.setHours(0, 0, 0, 0);
    const dateString = targetDate.toISOString().split('T')[0];

    // Get project info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw AppError.notFound('Project');
    }
    await requireProjectNotificationAdminAccess(user, projectId);

    // Get users to notify
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId,
        role: { in: ['site_engineer', 'foreman', 'project_manager'] },
        status: 'active',
      },
    });

    const userIds = projectUsers.map((pu) => pu.userId);
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, fullName: true },
          })
        : [];

    // Create notifications
    const notificationsToCreate = users.map((user) => ({
      userId: user.id,
      projectId: project.id,
      type: 'diary_reminder',
      title: 'Daily Diary Reminder',
      message: `Reminder: Please complete the daily diary for ${project.name} on ${dateString}.`,
      linkUrl: `/projects/${project.id}/diary`,
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
      });

      // Send email notifications
      for (const user of users) {
        await sendNotificationIfEnabled(user.id, 'diaryReminder', {
          title: 'Daily Diary Reminder',
          message: `Reminder: Please complete the daily diary for ${project.name} on ${dateString}.`,
          projectName: project.name,
          linkUrl: `/projects/${project.id}/diary`,
        });
      }
    }

    res.json(
      buildDiaryReminderSendResponse(project, dateString, users, notificationsToCreate.length),
    );
  }),
);

// POST /api/notifications/diary-reminder/check-alerts - Check for diaries missing 24+ hours and generate alerts (Feature #937)
// This is an escalation - generates alerts (higher severity) for diaries missing more than 24 hours
notificationsRouter.post(
  '/diary-reminder/check-alerts',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userId = user?.id;
    if (!user || !userId) {
      throw AppError.unauthorized();
    }
    // Check for diaries missing from yesterday or earlier
    const specificProjectId = parseOptionalString(req.body.projectId, 'projectId');
    const accessibleProjectIds = await getManageableActiveProjectIds(user, specificProjectId);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayString = yesterday.toISOString().split('T')[0];

    // Get all active projects
    const projectQuery: Prisma.ProjectWhereInput = {
      status: 'active',
      id: { in: accessibleProjectIds },
    };

    const projects = await prisma.project.findMany({
      where: projectQuery,
      select: { id: true, name: true },
    });

    const alertsCreated: MissingDiaryAlertResult[] = [];
    const usersNotified = new Set<string>();

    for (const project of projects) {
      // Check if a diary exists for yesterday
      const existingDiary = await prisma.dailyDiary.findFirst({
        where: {
          projectId: project.id,
          date: {
            gte: yesterday,
            lt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });

      if (existingDiary) {
        // Diary exists, no alert needed
        continue;
      }

      // Check if we already sent an alert for this date
      const existingAlert = await prisma.notification.findFirst({
        where: {
          projectId: project.id,
          type: 'diary_missing_alert',
          message: { contains: yesterdayString },
        },
      });

      if (existingAlert) {
        // Alert already sent for this date
        continue;
      }

      // No diary and no previous alert - find users to alert (escalate to project managers and admins)
      const projectUsers = await prisma.projectUser.findMany({
        where: {
          projectId: project.id,
          role: { in: ['project_manager', 'admin', 'owner'] },
          status: 'active',
        },
      });

      const userIds = projectUsers.map((pu) => pu.userId);
      const users =
        userIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, email: true, fullName: true },
            })
          : [];

      // Create alert notifications (higher severity than reminders)
      const alertsToCreate = users.map((user) => ({
        userId: user.id,
        projectId: project.id,
        type: 'diary_missing_alert',
        title: 'Missing Diary Alert',
        message: `ALERT: No daily diary entry was completed for ${project.name} on ${yesterdayString}. This is more than 24 hours overdue.`,
        linkUrl: `/projects/${project.id}/diary`,
      }));

      if (alertsToCreate.length > 0) {
        await prisma.notification.createMany({
          data: alertsToCreate,
        });

        for (const user of users) {
          usersNotified.add(user.id);

          // Send email notification for alerts (always immediate for escalations)
          await sendNotificationIfEnabled(
            user.id,
            'ncrAssigned', // Using ncrAssigned for urgent alerts
            {
              title: 'Missing Diary Alert',
              message: `ALERT: No daily diary entry was completed for ${project.name} on ${yesterdayString}. This is more than 24 hours overdue.`,
              projectName: project.name,
              linkUrl: `/projects/${project.id}/diary`,
            },
          );
        }

        alertsCreated.push({
          projectId: project.id,
          projectName: project.name,
          missingDate: yesterdayString,
          usersNotified: users.map((u) => u.email),
        });
      }
    }

    res.json(
      buildMissingDiaryAlertsResponse(
        yesterdayString,
        projects.length,
        alertsCreated,
        usersNotified,
      ),
    );
  }),
);

// ============================================================================
// Feature #938: Docket Backlog Alert Notification
// ============================================================================

// POST /api/notifications/docket-backlog/check - Check for dockets pending >48 hours and alert foreman/PM
notificationsRouter.post(
  '/docket-backlog/check',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userId = user?.id;
    if (!user || !userId) {
      throw AppError.unauthorized();
    }
    const specificProjectId = parseOptionalString(req.body.projectId, 'projectId');
    const accessibleProjectIds = await getManageableActiveProjectIds(user, specificProjectId);

    // Calculate 48 hours ago
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 48);

    // Get all dockets that have been pending_approval for more than 48 hours
    const whereClause: Prisma.DailyDocketWhereInput = {
      status: 'pending_approval',
      submittedAt: {
        lt: cutoffTime,
      },
    };

    whereClause.projectId = { in: accessibleProjectIds };

    const overdueDockers = await prisma.dailyDocket.findMany({
      where: whereClause,
    });

    const alertsCreated: DocketBacklogAlertResult[] = [];
    const usersNotified = new Set<string>();

    // Group dockets by project for efficient notification
    const docketsByProject = new Map<string, typeof overdueDockers>();
    for (const docket of overdueDockers) {
      const projectDockets = docketsByProject.get(docket.projectId) || [];
      projectDockets.push(docket);
      docketsByProject.set(docket.projectId, projectDockets);
    }

    for (const [projectId, dockets] of docketsByProject.entries()) {
      // Get project info
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true },
      });

      if (!project) continue;

      // Check if we already sent an alert for these specific dockets today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingAlert = await prisma.notification.findFirst({
        where: {
          projectId,
          type: 'docket_backlog_alert',
          createdAt: { gte: today },
        },
      });

      if (existingAlert) {
        // Already sent an alert today for this project
        continue;
      }

      // Get foremen and project managers to alert
      const projectUsers = await prisma.projectUser.findMany({
        where: {
          projectId,
          role: { in: ['foreman', 'project_manager', 'admin'] },
          status: 'active',
        },
      });

      const userIds = projectUsers.map((pu) => pu.userId);
      const users =
        userIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, email: true, fullName: true },
            })
          : [];

      // Format docket list for notification
      const docketCount = dockets.length;
      const docketIds = dockets
        .slice(0, 3)
        .map((d) => d.id.substring(0, 8))
        .join(', ');
      const moreText = docketCount > 3 ? ` and ${docketCount - 3} more` : '';

      // Create alert notifications
      const alertsToCreate = users.map((user) => ({
        userId: user.id,
        projectId,
        type: 'docket_backlog_alert',
        title: 'Docket Backlog Alert',
        message: `${docketCount} docket(s) have been pending approval for more than 48 hours on ${project.name}: ${docketIds}${moreText}. Please review.`,
        linkUrl: `/projects/${projectId}/dockets`,
      }));

      if (alertsToCreate.length > 0) {
        await prisma.notification.createMany({
          data: alertsToCreate,
        });

        for (const user of users) {
          usersNotified.add(user.id);

          // Send email notification
          await sendNotificationIfEnabled(
            user.id,
            'holdPointReminder', // Using existing type for backlog alerts
            {
              title: 'Docket Backlog Alert',
              message: `${docketCount} docket(s) have been pending approval for more than 48 hours on ${project.name}. Please review.`,
              projectName: project.name,
              linkUrl: `/projects/${projectId}/dockets`,
            },
          );
        }

        alertsCreated.push({
          projectId,
          projectName: project.name,
          docketCount,
          docketIds: dockets.map((d) => d.id),
          usersNotified: users.map((u) => u.email),
        });
      }
    }

    res.json(
      buildDocketBacklogAlertsResponse(
        cutoffTime,
        overdueDockers.length,
        docketsByProject.size,
        alertsCreated,
        usersNotified,
      ),
    );
  }),
);

// Alert and system-alert routes live in a child router (notifications/alerts.ts),
// mounted here after the route-wide requireAuth above so they inherit auth
// (mirrors the diary/ and dockets/ child router pattern). Paths are unchanged.
notificationsRouter.use(notificationAlertsRouter);

// Core authenticated user-notification routes (list, unread-count, mark-read,
// mark-all-read, delete) live in a child router (notifications/userRoutes.ts).
// Mounted LAST — after the static /email-queue and /digest-queue DELETE routes
// above — so its dynamic DELETE /:id does not shadow them. It inherits the
// route-wide requireAuth (mirrors the diary/ and dockets/ child router pattern).
notificationsRouter.use(notificationUserRouter);
