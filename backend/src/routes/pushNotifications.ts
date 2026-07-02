import { Router } from 'express';
import webpush from 'web-push';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware.js';
import { requireBrowserSession } from '../middleware/browserSession.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { logError } from '../lib/serverLogger.js';
import { isSubcontractorPortalRole } from '../lib/projectAccess.js';
import {
  buildGeneratedVapidKeysResponse,
  buildPushPublicConfigResponse,
  buildPushServiceStatusResponse,
  buildPushSubscriptionRegisteredResponse,
  buildPushSubscriptionsResponse,
  buildPushTestSendResponse,
  buildPushUnsubscribedResponse,
} from './pushNotificationResponses.js';
import { initializeWebPush } from './pushNotifications/vapid.js';
import {
  getRequestUserAgent,
  getSubscriptionId,
  parseEndpoint,
  parseNotificationUrl,
  parseOptionalData,
  parseOptionalString,
  parseOptionalSubscriptionId,
  parsePushSubscription,
  parseRequiredString,
  PUSH_MESSAGE_BODY_MAX_LENGTH,
  PUSH_MESSAGE_TAG_MAX_LENGTH,
  PUSH_MESSAGE_TITLE_MAX_LENGTH,
} from './pushNotifications/validation.js';
import {
  broadcastPushNotification,
  getPushErrorDetails,
  removeInvalidStoredPushSubscription,
  sendPushNotification,
  sendStoredPushSubscription,
} from './pushNotifications/delivery.js';

export { broadcastPushNotification, sendPushNotification };

export const pushNotificationsRouter = Router();

const PUSH_CONFIG_ROLES = ['owner', 'admin'];

function canManagePushConfig(req: AuthRequest): boolean {
  return Boolean(req.user && PUSH_CONFIG_ROLES.includes(req.user.roleInCompany));
}

async function canSendToTargetUser(
  req: AuthRequest,
  targetUserId: string,
  targetCompanyId: string | null,
): Promise<boolean> {
  if (!req.user) {
    return false;
  }

  if (isSubcontractorPortalRole(req.user.roleInCompany)) {
    return false;
  }

  if (
    PUSH_CONFIG_ROLES.includes(req.user.roleInCompany) &&
    req.user.companyId &&
    targetCompanyId === req.user.companyId
  ) {
    return true;
  }

  const sharedProject = await prisma.projectUser.findFirst({
    where: {
      userId: targetUserId,
      status: 'active',
      project: {
        status: 'active',
        projectUsers: {
          some: {
            userId: req.user.id,
            status: 'active',
            role: 'project_manager',
          },
        },
      },
    },
    select: { id: true },
  });

  return Boolean(sharedProject);
}

// Apply authentication middleware to all routes
pushNotificationsRouter.use(requireAuth);

// GET /api/push/vapid-public-key - Get VAPID public key for client subscription
pushNotificationsRouter.get(
  '/vapid-public-key',
  asyncHandler(async (_req: AuthRequest, res) => {
    const config = initializeWebPush();

    if (!config.configured) {
      throw new AppError(
        503,
        'Push notifications not configured. VAPID keys are not set.',
        'EXTERNAL_SERVICE_ERROR',
      );
    }

    res.json(buildPushPublicConfigResponse(config.keys.publicKey, config.configured));
  }),
);

// POST /api/push/subscribe - Register push subscription for current user
pushNotificationsRouter.post(
  '/subscribe',
  asyncHandler(async (req: AuthRequest, res) => {
    requireBrowserSession(req, 'Push subscription registration');
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const subscription = parsePushSubscription(req.body.subscription);

    // Store subscription (keyed by endpoint for uniqueness)
    const subscriptionId = getSubscriptionId(subscription.endpoint);
    const userAgent = getRequestUserAgent(req);
    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint },
      select: { userId: true },
    });

    if (existingSubscription && existingSubscription.userId !== userId) {
      throw AppError.forbidden('Push subscription is already registered to another user');
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        id: subscriptionId,
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
      create: {
        id: subscriptionId,
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
    });

    res.json(buildPushSubscriptionRegisteredResponse(subscriptionId));
  }),
);

// DELETE /api/push/unsubscribe - Remove push subscription
pushNotificationsRouter.delete(
  '/unsubscribe',
  asyncHandler(async (req: AuthRequest, res) => {
    requireBrowserSession(req, 'Push subscription removal');
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const endpoint = parseEndpoint(req.body.endpoint);

    const subscription = await prisma.pushSubscription.findUnique({
      where: { endpoint },
    });

    if (!subscription) {
      throw AppError.notFound('Subscription not found');
    }

    if (subscription.userId !== userId) {
      throw AppError.forbidden('Not authorized to unsubscribe this device');
    }

    await prisma.pushSubscription.delete({
      where: { endpoint },
    });

    res.json(buildPushUnsubscribedResponse());
  }),
);

// GET /api/push/subscriptions - Get user's push subscriptions
pushNotificationsRouter.get(
  '/subscriptions',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const userSubscriptions = (
      await prisma.pushSubscription.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })
    ).map((subscription) => ({
      id: subscription.id,
      userAgent: subscription.userAgent,
      createdAt: subscription.createdAt,
      // Don't expose the full endpoint for security
      endpointPreview: subscription.endpoint.substring(0, 50) + '...',
    }));

    res.json(buildPushSubscriptionsResponse(userSubscriptions));
  }),
);

// POST /api/push/test - Send a test push notification to current user
pushNotificationsRouter.post(
  '/test',
  asyncHandler(async (req: AuthRequest, res) => {
    requireBrowserSession(req, 'Push notification test');
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });

    // Find all subscriptions for this user
    const userSubscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (userSubscriptions.length === 0) {
      throw AppError.badRequest(
        'No push subscriptions found. Please enable push notifications in your browser first.',
      );
    }

    const pushConfig = initializeWebPush();
    if (!pushConfig.configured) {
      throw new AppError(
        503,
        'Push notifications not configured. VAPID keys are not set.',
        'EXTERNAL_SERVICE_ERROR',
      );
    }

    const payload = JSON.stringify({
      title: 'CIVOS Push Test',
      body: `Hello ${user?.fullName || 'there'}! Push notifications are working.`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'test-notification',
      data: {
        url: '/settings',
        type: 'test',
        timestamp: new Date().toISOString(),
      },
    });

    const results: { subscriptionId: string; success: boolean; error?: string }[] = [];

    for (const subscription of userSubscriptions) {
      try {
        await sendStoredPushSubscription(subscription, payload);
        results.push({ subscriptionId: subscription.id, success: true });
      } catch (error: unknown) {
        if (error instanceof AppError) {
          results.push({
            subscriptionId: subscription.id,
            success: false,
            error: await removeInvalidStoredPushSubscription(subscription),
          });
          continue;
        }

        const pushError = getPushErrorDetails(error);
        // Handle expired subscriptions
        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
          await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
          results.push({
            subscriptionId: subscription.id,
            success: false,
            error: 'Subscription expired - removed',
          });
        } else {
          results.push({
            subscriptionId: subscription.id,
            success: false,
            error: pushError.message,
          });
        }
        logError(`[Push] Failed to send to ${subscription.id}:`, pushError);
      }
    }

    res.json(buildPushTestSendResponse(results));
  }),
);

// POST /api/push/send - Send push notification to a specific user (admin only or internal)
pushNotificationsRouter.post(
  '/send',
  asyncHandler(async (req: AuthRequest, res) => {
    requireBrowserSession(req, 'Push notification send');
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const targetUserId = parseRequiredString(req.body.targetUserId, 'targetUserId', 128);
    const title = parseRequiredString(req.body.title, 'title', PUSH_MESSAGE_TITLE_MAX_LENGTH);
    const body = parseRequiredString(req.body.body, 'body', PUSH_MESSAGE_BODY_MAX_LENGTH);
    const url = parseNotificationUrl(req.body.url);
    const tag = parseOptionalString(req.body.tag, 'tag', PUSH_MESSAGE_TAG_MAX_LENGTH);
    const data = parseOptionalData(req.body.data);

    if (targetUserId !== userId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { companyId: true },
      });

      if (!targetUser) {
        throw AppError.notFound('Target user');
      }

      if (!(await canSendToTargetUser(req, targetUserId, targetUser.companyId))) {
        throw AppError.forbidden('Target user is outside your allowed notification scope');
      }
    }

    const result = await sendPushNotification(targetUserId, {
      title,
      body,
      url,
      tag,
      data,
    });

    res.json(result);
  }),
);

// GET /api/push/status - Get push notification configuration status
pushNotificationsRouter.get(
  '/status',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized('Unauthorized');
    }

    const pushConfig = initializeWebPush();
    const currentDeviceSubscriptionId = parseOptionalSubscriptionId(req.query.subscriptionId);
    const visibleSubscriptionWhere: Prisma.PushSubscriptionWhereInput =
      canManagePushConfig(req) && req.user?.companyId
        ? { user: { companyId: req.user.companyId } }
        : { userId };

    const [visibleSubscriptionCount, userSubscriptionCount, currentDeviceSubscriptionCount] =
      await Promise.all([
        prisma.pushSubscription.count({ where: visibleSubscriptionWhere }),
        prisma.pushSubscription.count({ where: { userId } }),
        currentDeviceSubscriptionId
          ? prisma.pushSubscription.count({ where: { id: currentDeviceSubscriptionId, userId } })
          : Promise.resolve(null),
      ]);

    res.json(
      buildPushServiceStatusResponse({
        configured: pushConfig.configured,
        vapidConfigured: pushConfig.vapidConfigured,
        usingGeneratedKeys: pushConfig.usingGeneratedKeys,
        totalSubscriptions: visibleSubscriptionCount,
        userSubscriptionCount,
        currentDeviceSubscribed:
          currentDeviceSubscriptionCount === null ? undefined : currentDeviceSubscriptionCount > 0,
      }),
    );
  }),
);

// GET /api/push/generate-vapid-keys - Generate new VAPID keys (development only)
pushNotificationsRouter.get(
  '/generate-vapid-keys',
  asyncHandler(async (req: AuthRequest, res) => {
    requireBrowserSession(req, 'Push notification configuration');
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      throw AppError.forbidden('Not available in production');
    }

    if (!canManagePushConfig(req)) {
      throw AppError.forbidden('Only company owners and admins can generate VAPID keys');
    }

    const keys = webpush.generateVAPIDKeys();

    res.json(buildGeneratedVapidKeysResponse(keys.publicKey, keys.privateKey));
  }),
);
