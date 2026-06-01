import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  sendNotificationEmail,
  sendDailyDigestEmail,
  getQueuedEmails,
  clearEmailQueue,
  DigestItem,
  isResendConfigured,
} from '../lib/email.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { logError } from '../lib/serverLogger.js';
import {
  MAX_NOTIFICATION_FILTER_LENGTH,
  MAX_NOTIFICATION_MESSAGE_LENGTH,
  MAX_NOTIFICATION_TITLE_LENGTH,
  parseNotificationPagination,
  parseNotificationRouteId,
  parseOptionalDate,
  parseOptionalString,
  parseRequiredString,
} from './notifications/validation.js';
import { buildProjectEntityLink } from './notifications/links.js';
import {
  type NotificationTiming,
  getEmailPreferences,
  normalizeEmailPreferences,
  saveEmailPreferences,
} from './notifications/emailPreferences.js';
import {
  canReceiveProjectAlert,
  getAccessibleActiveProjectIds,
  getManageableActiveProjectIds,
  isSubcontractorRole,
  requireAlertAccess,
  requireAlertResolveAccess,
  requireNonProductionDiagnostics,
  requireNotificationAdmin,
  requireProjectNotificationAdminAccess,
  requireProjectReadAccess,
} from './notifications/access.js';
import {
  addDigestItem,
  clearDigestItems,
  getDigestItems,
  getUserDigestQueue,
} from './notifications/digestQueue.js';
import {
  generateAlertId,
  parseAlertSeverity,
  parseAlertStatusFilter,
  parseAlertType,
  parseOptionalAlertType,
  toAlert,
  type Alert,
  type AlertSeverity,
  type AlertType,
} from './notifications/alertMappers.js';

// Re-exported so external modules that import the notification timing type from
// this route file keep working after the email-preference helper extraction.
export type { NotificationTiming };
// Re-exported so external modules that import the digest-queue accessor from
// this route file keep working after the digest-queue helper extraction.
export { getUserDigestQueue };
// Re-exported so external modules that import the alert value types from this
// route file keep working after the alert-mapper helper extraction.
export type { Alert, AlertSeverity, AlertType };

export const notificationsRouter = Router();

// Apply authentication middleware to all notification routes
notificationsRouter.use(requireAuth);

type DiaryReminderResult = {
  projectId: string;
  projectName: string;
  date: string;
  usersNotified: string[];
};

type MissingDiaryAlertResult = {
  projectId: string;
  projectName: string;
  missingDate: string;
  usersNotified: string[];
};

type DocketBacklogAlertResult = {
  projectId: string;
  projectName: string;
  docketCount: number;
  docketIds: string[];
  usersNotified: string[];
};

type SystemAlertResult = {
  type: 'overdue_ncr' | 'stale_hold_point' | 'missing_diary';
  alertId: string;
  entityId?: string;
  projectName: string;
  severity: AlertSeverity;
  message: string;
};

// GET /api/notifications - Get notifications for current user
notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    const unreadOnly = parseOptionalString(req.query.unreadOnly, 'unreadOnly', 5);
    const { limit, offset } = parseNotificationPagination(req.query);

    const where: Prisma.NotificationWhereInput = { userId };
    if (unreadOnly !== undefined && unreadOnly !== 'true' && unreadOnly !== 'false') {
      throw AppError.badRequest('unreadOnly must be true or false');
    }
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
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
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    res.json({ notifications, unreadCount });
  }),
);

// GET /api/notifications/unread-count - Get unread notification count
notificationsRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    res.json({ count });
  }),
);

// PUT /api/notifications/:id/read - Mark notification as read
notificationsRouter.put(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    const id = parseNotificationRouteId(req.params.id);

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw AppError.notFound('Notification');
    }

    if (notification.userId !== userId) {
      throw AppError.forbidden('Access denied');
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ notification: updated });
  }),
);

// PUT /api/notifications/read-all - Mark all notifications as read
notificationsRouter.put(
  '/read-all',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ success: true });
  }),
);

// Helper function to create mention notifications
export async function createMentionNotifications(
  content: string,
  authorId: string,
  entityType: string,
  entityId: string,
  commentId: string,
  projectId?: string,
): Promise<void> {
  // Extract @mentions from content (format: @email or @fullName)
  const mentionPattern = /@([\w.+-]+@[\w.-]+|[\w\s]+?)(?=\s|$|@)/g;
  const mentions = content.match(mentionPattern);

  if (!mentions || mentions.length === 0) return;

  // Get unique mention strings (remove @ prefix)
  const uniqueMentions = [...new Set(mentions.map((m) => m.slice(1).trim()))];
  const project = projectId
    ? await prisma.project.findUnique({
        where: { id: projectId },
        select: { companyId: true },
      })
    : null;

  // Find users by email or fullName (case-insensitive for SQLite)
  for (const mention of uniqueMentions) {
    const mentionLower = mention.toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        AND: [
          {
            OR: [{ email: mentionLower }, { fullName: mentionLower }],
          },
          projectId && project
            ? {
                OR: [
                  {
                    projectUsers: {
                      some: { projectId, status: 'active' },
                    },
                  },
                  {
                    companyId: project.companyId,
                    roleInCompany: { in: ['owner', 'admin'] },
                  },
                ],
              }
            : {},
        ],
      },
    });

    if (user && user.id !== authorId) {
      // Get author info for notification
      const author = await prisma.user.findUnique({
        where: { id: authorId },
        select: { fullName: true, email: true },
      });

      const authorName = author?.fullName || author?.email || 'Someone';

      // Create notification
      await prisma.notification.create({
        data: {
          userId: user.id,
          projectId: projectId || null,
          type: 'mention',
          title: `${authorName} mentioned you in a comment`,
          message: content.length > 100 ? content.substring(0, 100) + '...' : content,
          linkUrl: buildProjectEntityLink(entityType, entityId, projectId, {
            tab: 'comments',
            commentId,
          }),
        },
      });
    }
  }
}

// GET /api/notifications/users - Get users that can be mentioned (for autocomplete)
notificationsRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const search = parseOptionalString(req.query.search, 'search');
    const projectId = parseOptionalString(req.query.projectId, 'projectId');

    const filters: Prisma.UserWhereInput[] = isSubcontractorRole(user.roleInCompany)
      ? [{ id: user.id }]
      : user.companyId
        ? [{ companyId: user.companyId }]
        : [{ id: user.id }];

    // If search provided, filter by email or fullName (SQLite - case-sensitive contains)
    if (search && search.length >= 2) {
      const searchLower = search.toLowerCase();
      filters.push({
        OR: [{ email: { contains: searchLower } }, { fullName: { contains: searchLower } }],
      });
    }

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
      filters.push({
        OR: [
          {
            projectUsers: {
              some: { projectId, status: 'active' },
            },
          },
          {
            companyId: project.companyId,
            roleInCompany: { in: ['owner', 'admin'] },
          },
        ],
      });
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

    res.json({ users });
  }),
);

// GET /api/notifications/email-preferences - Get email notification preferences
notificationsRouter.get(
  '/email-preferences',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    const preferences = await getEmailPreferences(userId);

    res.json({ preferences });
  }),
);

// PUT /api/notifications/email-preferences - Update email notification preferences
notificationsRouter.put(
  '/email-preferences',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    const validatedPreferences = normalizeEmailPreferences(req.body.preferences);
    const savedPreferences = await saveEmailPreferences(userId, validatedPreferences);

    res.json({ preferences: savedPreferences, message: 'Email preferences updated' });
  }),
);

// POST /api/notifications/send-test-email - Send a test email notification
notificationsRouter.post(
  '/send-test-email',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });

    if (!user) {
      throw AppError.notFound('User');
    }

    // Check email preferences
    const preferences = await getEmailPreferences(userId);
    if (!preferences.enabled) {
      throw AppError.badRequest(
        'Email notifications are disabled. Enable them first in your preferences.',
      );
    }

    // Send test email
    const result = await sendNotificationEmail(user.email, 'test', {
      title: 'Test Notification',
      message:
        'This is a test email notification from SiteProof. If you received this email, your email notifications are configured correctly!',
      userName: user.fullName || 'SiteProof System',
      linkUrl: '/settings',
    });

    if (result.success) {
      res.json({
        success: true,
        message:
          result.provider === 'resend'
            ? 'Test email sent successfully via Resend API'
            : 'Test email logged to console (Resend API not configured)',
        messageId: result.messageId,
        sentTo: user.email,
        provider: result.provider || 'mock',
      });
    } else {
      throw AppError.internal('Failed to send test email');
    }
  }),
);

// GET /api/notifications/email-service-status - Get email service configuration status
notificationsRouter.get(
  '/email-service-status',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    const resendConfigured = isResendConfigured();
    const emailEnabled = process.env.EMAIL_ENABLED !== 'false';
    const mockEmailEnabled =
      process.env.NODE_ENV !== 'production' && process.env.EMAIL_PROVIDER === 'mock';
    const productionMisconfigured =
      process.env.NODE_ENV === 'production' && emailEnabled && !resendConfigured;

    res.json({
      provider: resendConfigured ? 'resend' : mockEmailEnabled ? 'mock' : null,
      resendConfigured,
      emailEnabled,
      status: resendConfigured
        ? 'ready'
        : productionMisconfigured
          ? 'misconfigured'
          : mockEmailEnabled
            ? 'development'
            : 'disabled',
      message: resendConfigured
        ? 'Resend API is configured and emails will be delivered to real recipients.'
        : productionMisconfigured
          ? 'Email delivery is not configured. Set a valid RESEND_API_KEY before using production email workflows.'
          : mockEmailEnabled
            ? 'Mock email is enabled for development. Emails are logged to console only.'
            : 'Email delivery is not configured.',
    });
  }),
);

// GET /api/notifications/email-queue - Get queued emails (for testing/debugging)
notificationsRouter.get(
  '/email-queue',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    requireNonProductionDiagnostics();

    const queue = getQueuedEmails();
    res.json({ emails: queue, count: queue.length });
  }),
);

// DELETE /api/notifications/email-queue - Clear email queue (for testing/debugging)
notificationsRouter.delete(
  '/email-queue',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    requireNonProductionDiagnostics();

    clearEmailQueue();
    res.json({ success: true, message: 'Email queue cleared' });
  }),
);

// Type for notification types that support timing
type NotificationTypeWithTiming =
  | 'mentions'
  | 'ncrAssigned'
  | 'ncrStatusChange'
  | 'holdPointReminder'
  | 'holdPointRelease'
  | 'commentReply'
  | 'scheduledReports'
  | 'diaryReminder';

// Helper function to send notification email if user preferences allow
// Returns: { sent: boolean, queued: boolean } - sent means immediate, queued means added to digest
export async function sendNotificationIfEnabled(
  userId: string,
  notificationType: NotificationTypeWithTiming | 'enabled',
  data: {
    title: string;
    message: string;
    linkUrl?: string;
    projectName?: string;
    userName?: string;
  },
): Promise<{ sent: boolean; queued: boolean }> {
  const preferences = await getEmailPreferences(userId);

  // Check if email notifications are enabled
  if (!preferences.enabled) {
    return { sent: false, queued: false };
  }

  // Check if specific notification type is enabled
  if (notificationType !== 'enabled' && !preferences[notificationType]) {
    return { sent: false, queued: false };
  }

  // Get user email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    return { sent: false, queued: false };
  }

  // Check timing preference for this notification type
  const timingKey = `${notificationType}Timing` as keyof typeof preferences;
  const timing =
    notificationType !== 'enabled' && timingKey in preferences
      ? (preferences[timingKey] as NotificationTiming)
      : 'immediate';

  if (timing === 'digest' && preferences.dailyDigest) {
    // Add to digest queue instead of sending immediately
    const digestItem: DigestItem = {
      type: notificationType,
      title: data.title,
      message: data.message,
      projectName: data.projectName,
      linkUrl: data.linkUrl,
      timestamp: new Date(),
    };

    await addDigestItem(userId, digestItem);

    return { sent: false, queued: true };
  }

  // Send the email immediately
  const result = await sendNotificationEmail(user.email, notificationType, data);
  if (!result.success) {
    logError('[Notifications] Email delivery failed', {
      userId,
      notificationType,
      error: result.error || 'Email delivery failed',
      provider: result.provider,
    });
  }
  return { sent: result.success, queued: false };
}

// Helper function to get notification timing for a specific type
export async function getNotificationTiming(
  userId: string,
  notificationType: NotificationTypeWithTiming,
): Promise<NotificationTiming> {
  const preferences = await getEmailPreferences(userId);
  const timingKey = `${notificationType}Timing` as keyof typeof preferences;
  return timingKey in preferences ? (preferences[timingKey] as NotificationTiming) : 'immediate';
}

// POST /api/notifications/add-to-digest - Add item to digest queue
notificationsRouter.post(
  '/add-to-digest',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }
    requireNonProductionDiagnostics();

    const { type, title, message, projectName, linkUrl } = req.body;

    if (
      typeof type !== 'string' ||
      typeof title !== 'string' ||
      typeof message !== 'string' ||
      !type ||
      !title ||
      !message
    ) {
      throw AppError.badRequest('type, title, and message are required');
    }

    const digestItem: DigestItem = {
      type,
      title,
      message,
      projectName: typeof projectName === 'string' ? projectName : undefined,
      linkUrl: typeof linkUrl === 'string' ? linkUrl : undefined,
      timestamp: new Date(),
    };

    const queuedItems = await addDigestItem(userId, digestItem);

    res.json({
      success: true,
      message: 'Item added to digest',
      queuedItems,
    });
  }),
);

// POST /api/notifications/send-digest - Send daily digest email
notificationsRouter.post(
  '/send-digest',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }
    requireNonProductionDiagnostics();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });

    if (!user) {
      throw AppError.notFound('User');
    }

    // Check email preferences
    const preferences = await getEmailPreferences(userId);
    if (!preferences.enabled) {
      throw AppError.badRequest('Email notifications are disabled');
    }

    // Get digest items
    const items = await getDigestItems(userId);

    if (items.length === 0) {
      throw AppError.badRequest('No items in digest queue');
    }

    // Send digest email
    const result = await sendDailyDigestEmail(user.email, items);

    if (result.success) {
      // Clear the digest queue after sending
      await clearDigestItems(userId);

      res.json({
        success: true,
        message: 'Daily digest sent successfully',
        messageId: result.messageId,
        sentTo: user.email,
        itemCount: items.length,
      });
    } else {
      throw AppError.internal('Failed to send digest');
    }
  }),
);

// GET /api/notifications/digest-queue - Get current digest queue
notificationsRouter.get(
  '/digest-queue',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }
    requireNonProductionDiagnostics();

    const items = await getDigestItems(userId);

    res.json({
      items,
      count: items.length,
    });
  }),
);

// DELETE /api/notifications/digest-queue - Clear digest queue
notificationsRouter.delete(
  '/digest-queue',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }
    requireNonProductionDiagnostics();

    await clearDigestItems(userId);

    res.json({ success: true, message: 'Digest queue cleared' });
  }),
);

// DELETE /api/notifications/:id - Delete a notification.
// Keep this after static DELETE routes so paths like /digest-queue are not treated as IDs.
notificationsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    const id = parseNotificationRouteId(req.params.id);

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw AppError.notFound('Notification');
    }

    if (notification.userId !== userId) {
      throw AppError.forbidden('Access denied');
    }

    await prisma.notification.delete({
      where: { id },
    });

    res.json({ success: true });
  }),
);

// ============================================================================
// ALERT ESCALATION SYSTEM
// ============================================================================

// Escalation configuration (in hours)
const ESCALATION_CONFIG = {
  overdue_ncr: {
    firstEscalationAfterHours: 24, // Escalate after 24 hours
    secondEscalationAfterHours: 48, // Second escalation after 48 hours
    escalationRoles: ['project_manager', 'quality_manager', 'admin'],
  },
  stale_hold_point: {
    firstEscalationAfterHours: 4, // Escalate after 4 hours (critical workflow)
    secondEscalationAfterHours: 8, // Second escalation after 8 hours
    escalationRoles: ['superintendent', 'project_manager', 'admin'],
  },
  pending_approval: {
    firstEscalationAfterHours: 8, // Escalate after 8 hours
    secondEscalationAfterHours: 24, // Second escalation after 24 hours
    escalationRoles: ['project_manager', 'admin'],
  },
  overdue_test: {
    firstEscalationAfterHours: 48, // Escalate after 48 hours
    secondEscalationAfterHours: 96, // Second escalation after 96 hours
    escalationRoles: ['quality_manager', 'project_manager'],
  },
};

async function createAlertRecord(alert: Alert): Promise<Alert> {
  const record = await prisma.notificationAlert.create({
    data: {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      entityId: alert.entityId,
      entityType: alert.entityType,
      projectId: alert.projectId ?? null,
      assignedToId: alert.assignedTo,
      createdAt: alert.createdAt,
      resolvedAt: alert.resolvedAt ?? null,
      escalatedAt: alert.escalatedAt ?? null,
      escalationLevel: alert.escalationLevel,
      escalatedTo: alert.escalatedTo ?? undefined,
    },
  });

  return toAlert(record);
}

async function updateAlertEscalation(
  id: string,
  escalationLevel: number,
  escalatedAt: Date,
  escalatedTo: string[],
): Promise<Alert> {
  const record = await prisma.notificationAlert.update({
    where: { id },
    data: {
      escalationLevel,
      escalatedAt,
      escalatedTo,
    },
  });

  return toAlert(record);
}

// POST /api/notifications/alerts - Create a new alert
notificationsRouter.post(
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

    res.json({
      success: true,
      alert: savedAlert,
      message: 'Alert created successfully',
    });
  }),
);

// GET /api/notifications/alerts - Get all active alerts
notificationsRouter.get(
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

    res.json({
      alerts,
      count: alerts.length,
    });
  }),
);

// PUT /api/notifications/alerts/:id/resolve - Resolve an alert
notificationsRouter.put(
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

    res.json({
      success: true,
      alert: updatedAlert,
      message: 'Alert resolved successfully',
    });
  }),
);

// POST /api/notifications/alerts/check-escalations - Check and process escalations
// This would typically be called by a cron job or scheduled task
notificationsRouter.post(
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

    res.json({
      success: true,
      message: `Escalation check complete. ${escalatedAlerts.length} alerts escalated.`,
      escalatedAlerts,
      totalActiveAlerts,
    });
  }),
);

// GET /api/notifications/alerts/escalation-config - Get escalation configuration
notificationsRouter.get(
  '/alerts/escalation-config',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userId = user?.id;
    if (!user || !userId) {
      throw AppError.unauthorized();
    }
    requireNotificationAdmin(user);

    res.json({
      config: ESCALATION_CONFIG,
    });
  }),
);

// POST /api/notifications/alerts/:id/test-escalate - Force escalate an alert (for testing)
// This simulates time passing and triggers escalation
notificationsRouter.post(
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

    res.json({
      success: true,
      alert: escalatedAlert,
      escalatedTo: escalationUsers.map((u) => ({
        id: u.id,
        email: u.email,
        roleInCompany: u.roleInCompany,
      })),
      message: `Alert escalated to level ${newLevel}. Notified ${escalationUsers.length} users.`,
    });
  }),
);

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

    res.json({
      success: true,
      date: dateString,
      projectsChecked: projects.length,
      remindersCreated: remindersCreated.length,
      uniqueUsersNotified: usersNotified.size,
      details: remindersCreated,
    });
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

    res.json({
      success: true,
      projectId: project.id,
      projectName: project.name,
      date: dateString,
      usersNotified: users.map((u) => ({ id: u.id, email: u.email })),
      notificationCount: notificationsToCreate.length,
    });
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

    res.json({
      success: true,
      missingDate: yesterdayString,
      projectsChecked: projects.length,
      alertsCreated: alertsCreated.length,
      uniqueUsersNotified: usersNotified.size,
      details: alertsCreated,
    });
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

    res.json({
      success: true,
      cutoffTime: cutoffTime.toISOString(),
      totalOverdueDockets: overdueDockers.length,
      projectsWithBacklog: docketsByProject.size,
      alertsCreated: alertsCreated.length,
      uniqueUsersNotified: usersNotified.size,
      details: alertsCreated,
    });
  }),
);

// ============================================================================
// Feature #303: System Alerts for Critical Issues
// ============================================================================

// POST /api/notifications/system-alerts/check - Check and generate system alerts for critical issues
// This is the main endpoint that checks for all critical issues and creates appropriate alerts
// It should be called periodically (e.g., every hour) by a scheduled task or cron job
notificationsRouter.post(
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

    res.json({
      success: true,
      timestamp: now.toISOString(),
      projectsChecked: projects.length,
      alertsGenerated: alertsGenerated.length,
      summary,
      alerts: alertsGenerated,
      activeAlerts,
    });
  }),
);

// GET /api/notifications/system-alerts/summary - Get summary of all active system alerts
notificationsRouter.get(
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

    const bySeverity = {
      critical: activeAlerts.filter((a) => a.severity === 'critical').length,
      high: activeAlerts.filter((a) => a.severity === 'high').length,
      medium: activeAlerts.filter((a) => a.severity === 'medium').length,
      low: activeAlerts.filter((a) => a.severity === 'low').length,
    };

    const byType = {
      overdue_ncr: activeAlerts.filter((a) => a.type === 'overdue_ncr').length,
      stale_hold_point: activeAlerts.filter((a) => a.type === 'stale_hold_point').length,
      pending_approval: activeAlerts.filter((a) => a.type === 'pending_approval').length,
      overdue_test: activeAlerts.filter((a) => a.type === 'overdue_test').length,
    };

    const escalated = activeAlerts.filter((a) => a.escalationLevel > 0).length;

    res.json({
      totalActive: activeAlerts.length,
      bySeverity,
      byType,
      escalated,
      criticalItems: activeAlerts
        .filter((a) => a.severity === 'critical')
        .slice(0, 5)
        .map((a) => ({ id: a.id, type: a.type, title: a.title, createdAt: a.createdAt })),
    });
  }),
);
