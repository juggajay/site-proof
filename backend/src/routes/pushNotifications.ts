import { Router } from 'express';
import webpush from 'web-push';
import crypto from 'crypto';
import type { PushSubscription as PushSubscriptionRecord, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { logError } from '../lib/serverLogger.js';
import { isSubcontractorPortalRole } from '../lib/projectAccess.js';

export const pushNotificationsRouter = Router();

const DEFAULT_VAPID_SUBJECT = 'mailto:admin@siteproof.com';

type PushSubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type VapidConfiguration = {
  keys: { publicKey: string; privateKey: string };
  configured: boolean;
  vapidConfigured: boolean;
  usingGeneratedKeys: boolean;
};

// Generate VAPID keys if not set (for development)
let generatedVapidKeys: { publicKey: string; privateKey: string } | null = null;

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

function getConfiguredVapidKeys() {
  return {
    publicKey: process.env.VAPID_PUBLIC_KEY?.trim() ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY?.trim() ?? '',
  };
}

function getVapidSubject(): string {
  return process.env.VAPID_SUBJECT?.trim() || DEFAULT_VAPID_SUBJECT;
}

function getVapidKeys() {
  const configuredKeys = getConfiguredVapidKeys();

  if (configuredKeys.publicKey && configuredKeys.privateKey) {
    return {
      publicKey: configuredKeys.publicKey,
      privateKey: configuredKeys.privateKey,
    };
  }

  if (isProductionRuntime()) {
    return {
      publicKey: '',
      privateKey: '',
    };
  }

  // Generate keys for development if not set
  if (!generatedVapidKeys) {
    generatedVapidKeys = webpush.generateVAPIDKeys();
  }

  return generatedVapidKeys;
}

function getVapidConfiguration(): VapidConfiguration {
  const keys = getVapidKeys();
  const configuredKeys = getConfiguredVapidKeys();
  const vapidConfigured = Boolean(configuredKeys.publicKey && configuredKeys.privateKey);

  return {
    keys,
    configured: Boolean(keys.publicKey && keys.privateKey),
    vapidConfigured,
    usingGeneratedKeys: !isProductionRuntime() && !vapidConfigured && Boolean(generatedVapidKeys),
  };
}

// Initialize web-push with VAPID keys
function initializeWebPush(): VapidConfiguration {
  const config = getVapidConfiguration();
  if (config.configured) {
    webpush.setVapidDetails(getVapidSubject(), config.keys.publicKey, config.keys.privateKey);
  }
  return config;
}

const PUSH_CONFIG_ROLES = ['owner', 'admin'];
const PUSH_ENDPOINT_MAX_LENGTH = 2048;
const PUSH_KEY_MAX_LENGTH = 512;
const PUSH_MESSAGE_TITLE_MAX_LENGTH = 120;
const PUSH_MESSAGE_BODY_MAX_LENGTH = 500;
const PUSH_MESSAGE_URL_MAX_LENGTH = 2048;
const PUSH_MESSAGE_TAG_MAX_LENGTH = 128;
const PUSH_USER_AGENT_MAX_LENGTH = 512;
const PUSH_DATA_MAX_BYTES = 2048;
const PUSH_DATA_MAX_DEPTH = 5;
const PUSH_SUBSCRIPTION_ID_PATTERN = /^[a-f0-9]{64}$/i;
const RESERVED_PUSH_DATA_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ALLOWED_PUSH_ENDPOINT_HOSTS = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
]);
const ALLOWED_PUSH_ENDPOINT_SUFFIXES = ['.push.apple.com'];

function getPushErrorDetails(error: unknown): { statusCode?: number; message: string } {
  if (error instanceof Error) {
    const candidate = error as Error & { statusCode?: unknown };
    const statusCode = typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined;
    return { statusCode, message: error.message };
  }
  if (error && typeof error === 'object') {
    const candidate = error as Record<string, unknown>;
    return {
      statusCode: typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined,
      message:
        typeof candidate.message === 'string'
          ? candidate.message
          : 'Unknown push notification error',
    };
  }
  return { message: 'Unknown push notification error' };
}

function canManagePushConfig(req: AuthRequest): boolean {
  return Boolean(req.user && PUSH_CONFIG_ROLES.includes(req.user.roleInCompany));
}

function getSubscriptionId(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex');
}

function getRequestUserAgent(req: AuthRequest): string | undefined {
  const userAgent = req.headers['user-agent'];
  return typeof userAgent === 'string' ? userAgent.slice(0, PUSH_USER_AGENT_MAX_LENGTH) : undefined;
}

function isPrivatePushEndpointHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true;
  }

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) {
      return true;
    }

    const [first, second] = octets as [number, number, number, number];
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19))
    );
  }

  if (!host.includes(':')) {
    return false;
  }

  return (
    host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')
  );
}

function normalizeEndpointHostname(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

function isAllowedPushEndpointHost(hostname: string): boolean {
  const host = normalizeEndpointHostname(hostname);

  return (
    ALLOWED_PUSH_ENDPOINT_HOSTS.has(host) ||
    ALLOWED_PUSH_ENDPOINT_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}

function parseEndpoint(endpoint: unknown): string {
  if (typeof endpoint !== 'string' || !endpoint.trim()) {
    throw AppError.badRequest('Endpoint is required');
  }

  const normalizedEndpoint = endpoint.trim();
  if (normalizedEndpoint.length > PUSH_ENDPOINT_MAX_LENGTH) {
    throw AppError.badRequest('Endpoint is too long');
  }

  try {
    const endpointUrl = new URL(normalizedEndpoint);
    if (endpointUrl.protocol !== 'https:') {
      throw AppError.badRequest('Endpoint must be an HTTPS URL');
    }
    if (endpointUrl.username || endpointUrl.password) {
      throw AppError.badRequest('Endpoint must not include credentials');
    }
    if (endpointUrl.hash) {
      throw AppError.badRequest('Endpoint must not include a URL fragment');
    }
    if (endpointUrl.port || isPrivatePushEndpointHost(endpointUrl.hostname)) {
      throw AppError.badRequest('Endpoint host is not allowed');
    }
    if (!isAllowedPushEndpointHost(endpointUrl.hostname)) {
      throw AppError.badRequest('Endpoint host is not allowed');
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw AppError.badRequest('Endpoint must be a valid URL');
  }

  return normalizedEndpoint;
}

function parseRequiredString(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw AppError.badRequest(`${fieldName} must be ${maxLength} characters or fewer`);
  }

  return normalized;
}

function parseOptionalString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (normalized.length > maxLength) {
    throw AppError.badRequest(`${fieldName} must be ${maxLength} characters or fewer`);
  }

  return normalized;
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
}

function parseNotificationUrl(value: unknown): string | undefined {
  const normalized = parseOptionalString(value, 'url', PUSH_MESSAGE_URL_MAX_LENGTH);
  if (!normalized) {
    return undefined;
  }

  if (
    !normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    normalized.includes('\\') ||
    containsControlCharacter(normalized)
  ) {
    throw AppError.badRequest('url must be an app-relative path');
  }

  return normalized;
}

function assertJsonCompatiblePushData(value: unknown, depth: number): void {
  if (depth > PUSH_DATA_MAX_DEPTH) {
    throw AppError.badRequest('data is too deeply nested');
  }

  if (value === null) {
    return;
  }

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'boolean') {
    return;
  }

  if (valueType === 'number') {
    if (!Number.isFinite(value)) {
      throw AppError.badRequest('data must contain only finite numbers');
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      assertJsonCompatiblePushData(entry, depth + 1);
    }
    return;
  }

  if (valueType === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (RESERVED_PUSH_DATA_KEYS.has(key)) {
        throw AppError.badRequest('data contains a reserved key');
      }
      assertJsonCompatiblePushData(entry, depth + 1);
    }
    return;
  }

  throw AppError.badRequest('data must be JSON-serializable');
}

function parseOptionalData(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw AppError.badRequest('data must be an object');
  }

  const data = value as Record<string, unknown>;
  assertJsonCompatiblePushData(data, 0);

  let serialized: string;
  try {
    serialized = JSON.stringify(data);
  } catch {
    throw AppError.badRequest('data must be JSON-serializable');
  }

  if (Buffer.byteLength(serialized, 'utf8') > PUSH_DATA_MAX_BYTES) {
    throw AppError.badRequest(`data must be ${PUSH_DATA_MAX_BYTES} bytes or fewer`);
  }

  return data;
}

function parseOptionalSubscriptionId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw AppError.badRequest('subscriptionId must be a string');
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest('subscriptionId must be a string');
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (!PUSH_SUBSCRIPTION_ID_PATTERN.test(normalized)) {
    throw AppError.badRequest('subscriptionId must be a valid push subscription id');
  }

  return normalized.toLowerCase();
}

function parsePushSubscription(subscription: unknown): PushSubscriptionPayload {
  if (!subscription || typeof subscription !== 'object') {
    throw AppError.badRequest('Invalid subscription object');
  }

  const candidate = subscription as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };

  if (
    typeof candidate.endpoint !== 'string' ||
    !candidate.endpoint.trim() ||
    !candidate.keys ||
    typeof candidate.keys.p256dh !== 'string' ||
    typeof candidate.keys.auth !== 'string' ||
    !candidate.keys.p256dh.trim() ||
    !candidate.keys.auth.trim() ||
    candidate.keys.p256dh.length > PUSH_KEY_MAX_LENGTH ||
    candidate.keys.auth.length > PUSH_KEY_MAX_LENGTH
  ) {
    throw AppError.badRequest('Invalid subscription object');
  }
  const endpoint = parseEndpoint(candidate.endpoint);

  return {
    endpoint,
    keys: {
      p256dh: candidate.keys.p256dh.trim(),
      auth: candidate.keys.auth.trim(),
    },
  };
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

function toWebPushSubscription(subscription: PushSubscriptionRecord): PushSubscriptionPayload {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

async function removeInvalidStoredPushSubscription(
  subscription: PushSubscriptionRecord,
): Promise<string> {
  await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
  return `Subscription ${subscription.id.slice(0, 8)}... invalid endpoint - removed`;
}

async function sendStoredPushSubscription(
  subscription: PushSubscriptionRecord,
  payload: string,
): Promise<void> {
  parseEndpoint(subscription.endpoint);
  await webpush.sendNotification(toWebPushSubscription(subscription), payload);
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

    res.json({
      publicKey: config.keys.publicKey,
      configured: config.configured,
    });
  }),
);

// POST /api/push/subscribe - Register push subscription for current user
pushNotificationsRouter.post(
  '/subscribe',
  asyncHandler(async (req: AuthRequest, res) => {
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

    res.json({
      success: true,
      message: 'Push notification subscription registered',
      subscriptionId,
    });
  }),
);

// DELETE /api/push/unsubscribe - Remove push subscription
pushNotificationsRouter.delete(
  '/unsubscribe',
  asyncHandler(async (req: AuthRequest, res) => {
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

    res.json({ success: true, message: 'Unsubscribed from push notifications' });
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

    res.json({
      subscriptions: userSubscriptions,
      count: userSubscriptions.length,
    });
  }),
);

// POST /api/push/test - Send a test push notification to current user
pushNotificationsRouter.post(
  '/test',
  asyncHandler(async (req: AuthRequest, res) => {
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
      title: 'SiteProof Push Test',
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

    const successCount = results.filter((r) => r.success).length;

    res.json({
      success: successCount > 0,
      message: `Sent push notification to ${successCount}/${results.length} device(s)`,
      results,
    });
  }),
);

// POST /api/push/send - Send push notification to a specific user (admin only or internal)
pushNotificationsRouter.post(
  '/send',
  asyncHandler(async (req: AuthRequest, res) => {
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

    res.json({
      configured: pushConfig.configured,
      vapidConfigured: pushConfig.vapidConfigured,
      usingGeneratedKeys: pushConfig.usingGeneratedKeys,
      totalSubscriptions: visibleSubscriptionCount,
      userSubscriptionCount,
      currentDeviceSubscribed:
        currentDeviceSubscriptionCount === null ? undefined : currentDeviceSubscriptionCount > 0,
      message: pushConfig.configured
        ? 'Push notifications are configured and ready'
        : 'Push notifications require VAPID keys to be configured',
    });
  }),
);

// Helper function to send push notification to a user (exported for use by other modules)
export async function sendPushNotification(
  userId: string,
  notification: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    icon?: string;
    badge?: string;
    data?: Record<string, unknown>;
  },
): Promise<{ success: boolean; sent: number; failed: number; errors?: string[] }> {
  const userSubscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (userSubscriptions.length === 0) {
    return { success: false, sent: 0, failed: 0, errors: ['No subscriptions found for user'] };
  }

  const pushConfig = initializeWebPush();
  if (!pushConfig.configured) {
    return {
      success: false,
      sent: 0,
      failed: userSubscriptions.length,
      errors: [
        'Push notifications are not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.',
      ],
    };
  }

  const title = parseRequiredString(notification.title, 'title', PUSH_MESSAGE_TITLE_MAX_LENGTH);
  const body = parseRequiredString(notification.body, 'body', PUSH_MESSAGE_BODY_MAX_LENGTH);
  const url = parseNotificationUrl(notification.url);
  const tag = parseOptionalString(notification.tag, 'tag', PUSH_MESSAGE_TAG_MAX_LENGTH);
  const data = parseOptionalData(notification.data);

  const payload = JSON.stringify({
    title,
    body,
    icon: notification.icon || '/pwa-192x192.png',
    badge: notification.badge || '/pwa-192x192.png',
    tag: tag || 'siteproof-notification',
    data: {
      ...data,
      url: url || '/',
      timestamp: new Date().toISOString(),
    },
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const subscription of userSubscriptions) {
    try {
      await sendStoredPushSubscription(subscription, payload);
      sent++;
    } catch (error: unknown) {
      if (error instanceof AppError) {
        failed++;
        errors.push(await removeInvalidStoredPushSubscription(subscription));
        continue;
      }

      const pushError = getPushErrorDetails(error);
      failed++;
      // Remove expired subscriptions
      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
        await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
        errors.push(`Subscription ${subscription.id.slice(0, 8)}... expired and removed`);
      } else {
        errors.push(`Subscription ${subscription.id.slice(0, 8)}...: ${pushError.message}`);
      }
    }
  }

  return {
    success: sent > 0,
    sent,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Helper function to broadcast push notification to multiple users
export async function broadcastPushNotification(
  userIds: string[],
  notification: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    data?: Record<string, unknown>;
  },
): Promise<{
  totalSent: number;
  totalFailed: number;
  results: Record<string, { sent: number; failed: number }>;
}> {
  const results: Record<string, { sent: number; failed: number }> = {};
  let totalSent = 0;
  let totalFailed = 0;

  for (const userId of Array.from(new Set(userIds))) {
    const result = await sendPushNotification(userId, notification);
    results[userId] = { sent: result.sent, failed: result.failed };
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { totalSent, totalFailed, results };
}

// GET /api/push/generate-vapid-keys - Generate new VAPID keys (development only)
pushNotificationsRouter.get(
  '/generate-vapid-keys',
  asyncHandler(async (req: AuthRequest, res) => {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      throw AppError.forbidden('Not available in production');
    }

    if (!canManagePushConfig(req)) {
      throw AppError.forbidden('Only company owners and admins can generate VAPID keys');
    }

    const keys = webpush.generateVAPIDKeys();

    res.json({
      message: 'New VAPID keys generated. Add these to your .env file:',
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      envFormat: `VAPID_PUBLIC_KEY="${keys.publicKey}"\nVAPID_PRIVATE_KEY="${keys.privateKey}"`,
    });
  }),
);
