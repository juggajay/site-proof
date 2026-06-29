import { prisma } from '../../lib/prisma.js';
import { sendNotificationEmail, type DigestItem } from '../../lib/email.js';
import { logError } from '../../lib/serverLogger.js';
import { getEmailPreferences, type NotificationTiming } from './emailPreferences.js';
import { addDigestItem } from './digestQueue.js';

/**
 * Notification email delivery/timing helpers, extracted verbatim from
 * backend/src/routes/notifications.ts as a slice of the notifications route
 * split (engineering-health Workstream 1).
 *
 * sendNotificationIfEnabled is the shared delivery entry point used by the
 * claims, dockets, holdpoints, projects and testResults routes (imported
 * through ./notifications.js), so its public surface is preserved by a
 * re-export from the route file. Behaviour is unchanged from the inline
 * implementation: disabled global or specific preferences and a missing user
 * short-circuit to { sent: false, queued: false }; digest timing queues via
 * addDigestItem and returns { sent: false, queued: true }; immediate timing
 * sends via sendNotificationEmail, logs delivery failures with logError, and
 * returns { sent: result.success, queued: false }. getNotificationTiming reads
 * the per-type timing preference and falls back to 'immediate'.
 */

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

  if (timing === 'digest' && !preferences.dailyDigest) {
    return { sent: false, queued: false };
  }

  if (timing === 'digest') {
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
