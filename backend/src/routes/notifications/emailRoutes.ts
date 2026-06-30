/**
 * Email and digest operational route handlers, extracted from
 * backend/src/routes/notifications.ts as a handler-group relocation slice of the
 * notifications route split (engineering-health Workstream 1).
 *
 * This child router is mounted by notifications.ts with
 * notificationsRouter.use(notificationEmailRouter) AFTER the parent applies its
 * route-wide requireAuth, so every route here inherits authentication exactly as
 * it did when the handlers lived inline (mirrors the diary/ and dockets/ child
 * router pattern). It is mounted before the diary-reminder routes and before the
 * dynamic DELETE /:id in notifications/userRoutes.ts, so its static
 * DELETE /email-queue and DELETE /digest-queue routes are not shadowed. Paths,
 * auth, diagnostics gating, response builders, and error contracts are unchanged
 * from the inline implementation.
 */

import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireBrowserSession } from '../../middleware/browserSession.js';
import { createEmailDeliveryFailureError } from '../../lib/emailDeliveryErrors.js';
import {
  sendNotificationEmail,
  sendDailyDigestEmail,
  getQueuedEmails,
  clearEmailQueue,
  isResendConfigured,
} from '../../lib/email.js';
import {
  buildEmailPreferencesResponse,
  buildEmailPreferencesUpdatedResponse,
  getEmailPreferences,
  normalizeEmailPreferences,
  saveEmailPreferences,
} from './emailPreferences.js';
import { requireNonProductionDiagnostics } from './access.js';
import { addDigestItem, clearDigestItems, getDigestItems } from './digestQueue.js';
import {
  buildEmailServiceStatus,
  buildTestEmailPayload,
  buildTestEmailSuccessResponse,
} from './emailDiagnostics.js';
import { buildEmailQueueClearedResponse, buildEmailQueueResponse } from './emailQueueResponses.js';
import {
  buildDigestItemAddedResponse,
  buildDigestItemFromBody,
  buildDigestQueueClearedResponse,
  buildDigestQueueResponse,
  buildDigestSentResponse,
} from './digestResponses.js';

export const notificationEmailRouter = Router();

// GET /api/notifications/email-preferences - Get email notification preferences
notificationEmailRouter.get(
  '/email-preferences',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    const preferences = await getEmailPreferences(userId);

    res.json(buildEmailPreferencesResponse(preferences));
  }),
);

// PUT /api/notifications/email-preferences - Update email notification preferences
notificationEmailRouter.put(
  '/email-preferences',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    const validatedPreferences = normalizeEmailPreferences(req.body.preferences);
    const savedPreferences = await saveEmailPreferences(userId, validatedPreferences);

    res.json(buildEmailPreferencesUpdatedResponse(savedPreferences));
  }),
);

// POST /api/notifications/send-test-email - Send a test email notification
notificationEmailRouter.post(
  '/send-test-email',
  asyncHandler(async (req, res) => {
    requireBrowserSession(req, 'Sending test notification emails');

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
    const result = await sendNotificationEmail(
      user.email,
      'test',
      buildTestEmailPayload(user.fullName),
    );

    if (result.success) {
      res.json(buildTestEmailSuccessResponse(result, user.email));
    } else {
      throw createEmailDeliveryFailureError(result, {
        quotaMessage:
          'Email delivery is temporarily unavailable because the email provider daily sending quota has been reached.',
        unavailableMessage: 'Email delivery is temporarily unavailable. Please try again later.',
      });
    }
  }),
);

// GET /api/notifications/email-service-status - Get email service configuration status
notificationEmailRouter.get(
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

    res.json(
      buildEmailServiceStatus({
        resendConfigured,
        emailEnabled,
        mockEmailEnabled,
        productionMisconfigured,
      }),
    );
  }),
);

// GET /api/notifications/email-queue - Get queued emails (for testing/debugging)
notificationEmailRouter.get(
  '/email-queue',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    requireNonProductionDiagnostics();

    const queue = getQueuedEmails();
    res.json(buildEmailQueueResponse(queue));
  }),
);

// DELETE /api/notifications/email-queue - Clear email queue (for testing/debugging)
notificationEmailRouter.delete(
  '/email-queue',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    requireNonProductionDiagnostics();

    clearEmailQueue();
    res.json(buildEmailQueueClearedResponse());
  }),
);

// POST /api/notifications/add-to-digest - Add item to digest queue
notificationEmailRouter.post(
  '/add-to-digest',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }
    requireNonProductionDiagnostics();

    const digestItem = buildDigestItemFromBody(req.body);
    const queuedItems = await addDigestItem(userId, digestItem);

    res.json(buildDigestItemAddedResponse(queuedItems));
  }),
);

// POST /api/notifications/send-digest - Send daily digest email
notificationEmailRouter.post(
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

      res.json(
        buildDigestSentResponse({
          messageId: result.messageId,
          sentTo: user.email,
          itemCount: items.length,
        }),
      );
    } else {
      throw AppError.internal('Failed to send digest');
    }
  }),
);

// GET /api/notifications/digest-queue - Get current digest queue
notificationEmailRouter.get(
  '/digest-queue',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }
    requireNonProductionDiagnostics();

    const items = await getDigestItems(userId);

    res.json(buildDigestQueueResponse(items));
  }),
);

// DELETE /api/notifications/digest-queue - Clear digest queue
notificationEmailRouter.delete(
  '/digest-queue',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw AppError.unauthorized();
    }
    requireNonProductionDiagnostics();

    await clearDigestItems(userId);

    res.json(buildDigestQueueClearedResponse());
  }),
);
