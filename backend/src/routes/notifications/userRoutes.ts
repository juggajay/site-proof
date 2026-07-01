/**
 * Core authenticated user-notification route handlers, extracted from
 * backend/src/routes/notifications.ts as a handler-group relocation slice of the
 * notifications route split (engineering-health Workstream 1).
 *
 * This child router is mounted by notifications.ts with
 * notificationsRouter.use(notificationUserRouter) AFTER the parent applies its
 * route-wide requireAuth, so every route here inherits authentication exactly as
 * it did when the handlers lived inline (mirrors the diary/ and dockets/ child
 * router pattern). It is mounted LAST in the parent — after the static
 * /email-queue and /digest-queue DELETE routes — so its dynamic DELETE /:id does
 * not shadow them. Paths, auth, response builders, and error contracts are
 * unchanged from the inline implementation.
 */

import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  parseNotificationPagination,
  parseNotificationRouteId,
  parseOptionalString,
} from './validation.js';
import {
  buildNotificationReadResponse,
  buildNotificationSuccessResponse,
  buildNotificationsListResponse,
  buildUnreadCountResponse,
} from './readResponses.js';

export const notificationUserRouter = Router();

const COMPANY_PROJECT_NOTIFICATION_ROLES = new Set(['owner', 'admin']);

function buildVisibleNotificationWhere(
  user: NonNullable<Express.Request['user']>,
): Prisma.NotificationWhereInput {
  const projectAccessOr: Prisma.ProjectWhereInput[] = [
    {
      projectUsers: {
        some: {
          userId: user.id,
          status: 'active',
        },
      },
    },
    {
      subcontractorCompanies: {
        some: {
          status: 'approved',
          users: {
            some: {
              userId: user.id,
            },
          },
        },
      },
    },
  ];

  if (user.companyId && COMPANY_PROJECT_NOTIFICATION_ROLES.has(user.roleInCompany || '')) {
    projectAccessOr.push({
      companyId: user.companyId,
    });
  }

  return {
    userId: user.id,
    OR: [
      { projectId: null },
      {
        project: {
          status: 'active',
          OR: projectAccessOr,
        },
      },
    ],
  };
}

// GET /api/notifications - Get notifications for current user
notificationUserRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) {
      throw AppError.unauthorized();
    }

    const unreadOnly = parseOptionalString(req.query.unreadOnly, 'unreadOnly', 5);
    const { limit, offset } = parseNotificationPagination(req.query);

    const where = buildVisibleNotificationWhere(user);
    if (unreadOnly !== undefined && unreadOnly !== 'true' && unreadOnly !== 'false') {
      throw AppError.badRequest('unreadOnly must be true or false');
    }
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              projectNumber: true,
            },
          },
        },
      }),
      prisma.notification.count({
        where: {
          ...buildVisibleNotificationWhere(user),
          isRead: false,
        },
      }),
    ]);

    res.json(buildNotificationsListResponse(notifications, unreadCount));
  }),
);

// GET /api/notifications/unread-count - Get unread notification count
notificationUserRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) {
      throw AppError.unauthorized();
    }

    const count = await prisma.notification.count({
      where: {
        ...buildVisibleNotificationWhere(user),
        isRead: false,
      },
    });

    res.json(buildUnreadCountResponse(count));
  }),
);

// PUT /api/notifications/:id/read - Mark notification as read
notificationUserRouter.put(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) {
      throw AppError.unauthorized();
    }

    const id = parseNotificationRouteId(req.params.id);

    const ownedNotification = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!ownedNotification) {
      throw AppError.notFound('Notification');
    }

    if (ownedNotification.userId !== user.id) {
      throw AppError.forbidden('Access denied');
    }

    const visibleNotification = await prisma.notification.findFirst({
      where: {
        ...buildVisibleNotificationWhere(user),
        id,
      },
      select: { id: true },
    });

    if (!visibleNotification) {
      throw AppError.notFound('Notification');
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json(buildNotificationReadResponse(updated));
  }),
);

// PUT /api/notifications/read-all - Mark all notifications as read
notificationUserRouter.put(
  '/read-all',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) {
      throw AppError.unauthorized();
    }

    await prisma.notification.updateMany({
      where: {
        ...buildVisibleNotificationWhere(user),
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json(buildNotificationSuccessResponse());
  }),
);

// DELETE /api/notifications/:id - Delete a notification.
// This dynamic :id delete must stay last; the parent mounts this router after
// its static DELETE routes (/email-queue, /digest-queue) so those paths are not
// treated as notification IDs.
notificationUserRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) {
      throw AppError.unauthorized();
    }

    const id = parseNotificationRouteId(req.params.id);

    const ownedNotification = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!ownedNotification) {
      throw AppError.notFound('Notification');
    }

    if (ownedNotification.userId !== user.id) {
      throw AppError.forbidden('Access denied');
    }

    const visibleNotification = await prisma.notification.findFirst({
      where: {
        ...buildVisibleNotificationWhere(user),
        id,
      },
      select: { id: true },
    });

    if (!visibleNotification) {
      throw AppError.notFound('Notification');
    }

    await prisma.notification.delete({
      where: { id },
    });

    res.json(buildNotificationSuccessResponse());
  }),
);
