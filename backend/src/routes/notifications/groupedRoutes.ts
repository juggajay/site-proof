/**
 * GET /api/notifications/grouped — the triaged, repeat-collapsed read model
 * behind NotificationsPage and the header bell.
 *
 * This is a NEW endpoint. `GET /api/notifications` (userRoutes.ts) is untouched:
 * subcontractor dashboards, badge counts and every other consumer read its shape
 * and its limit/offset pagination, and none of them change here.
 *
 * Grouping is done over a bounded recent window (GROUPED_NOTIFICATION_WINDOW),
 * NOT across offset pages — grouping page 2 of an offset scan would produce
 * groups missing the members that live on page 1, and counts that shrink as you
 * page. The window is the whole contract: the response says whether it was
 * truncated, and the UI says "showing recent notifications".
 */

import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { buildVisibleNotificationWhere } from './userRoutes.js';
import { groupNotifications } from './triage.js';

export const notificationGroupedRouter = Router();

/**
 * How many of the user's most recent notifications are grouped. Constant, not a
 * query parameter: the client cannot be allowed to widen it, because the whole
 * window is loaded into memory and returned in one response.
 */
export const GROUPED_NOTIFICATION_WINDOW = 200;

export function buildGroupedNotificationsResponse<
  TNotification extends {
    id: string;
    type: string;
    isRead: boolean;
    createdAt: Date;
    linkUrl: string | null;
    projectId: string | null;
  },
>(windowRows: TNotification[], unreadCount: number) {
  // One row is fetched beyond the window purely to answer "is there more?".
  const truncated = windowRows.length > GROUPED_NOTIFICATION_WINDOW;
  const notifications = truncated ? windowRows.slice(0, GROUPED_NOTIFICATION_WINDOW) : windowRows;

  return {
    groups: groupNotifications(notifications),
    unreadCount,
    windowSize: GROUPED_NOTIFICATION_WINDOW,
    truncated,
  };
}

notificationGroupedRouter.get(
  '/grouped',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) {
      throw AppError.unauthorized();
    }

    const where = buildVisibleNotificationWhere(user);

    const [windowRows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: GROUPED_NOTIFICATION_WINDOW + 1,
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

    res.json(buildGroupedNotificationsResponse(windowRows, unreadCount));
  }),
);
