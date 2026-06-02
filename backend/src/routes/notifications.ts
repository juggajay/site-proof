import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { parseOptionalString } from './notifications/validation.js';
import { type NotificationTiming } from './notifications/emailPreferences.js';
import { requireProjectReadAccess } from './notifications/access.js';
import { getUserDigestQueue } from './notifications/digestQueue.js';
import { type Alert, type AlertSeverity, type AlertType } from './notifications/alertMappers.js';
import { getNotificationTiming, sendNotificationIfEnabled } from './notifications/delivery.js';
import { notificationAlertsRouter } from './notifications/alerts.js';
import { notificationUserRouter } from './notifications/userRoutes.js';
import { notificationEmailRouter } from './notifications/emailRoutes.js';
import { notificationDiaryReminderRouter } from './notifications/diaryReminderRoutes.js';
import { createMentionNotifications } from './notifications/mentions.js';
import {
  buildMentionableProjectFilter,
  buildMentionableUserFilters,
  buildMentionableUsersResponse,
} from './notifications/mentionUsers.js';

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

// Diary-reminder and docket-backlog notification routes live in a child router
// and inherit the route-wide requireAuth middleware above. Mounted before alert
// and user routes so static paths cannot be shadowed by dynamic notification ids.
notificationsRouter.use(notificationDiaryReminderRouter);

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
