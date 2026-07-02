/**
 * Pure email diagnostics helpers for the test-email and email-service-status
 * routes, extracted from backend/src/routes/notifications.ts as a slice of the
 * notifications route split (engineering-health Workstream 1).
 *
 * These build the test-email payload, the successful test-email JSON response,
 * and the email-service-status JSON response from values the route resolves.
 * They contain no database, email, env, or access calls — the route still owns
 * auth, prisma.user.findUnique, getEmailPreferences, isResendConfigured,
 * process.env reads, the sendNotificationEmail call, and the AppError throws.
 * Behaviour stays route-compatible while keeping wording honest about what a
 * configuration-only check can prove.
 */

/**
 * Build the data payload passed to sendNotificationEmail for the test email.
 * userName falls back to 'CIVOS System' when the user has no full name.
 */
export function buildTestEmailPayload(fullName: string | null): {
  title: string;
  message: string;
  userName: string;
  linkUrl: string;
} {
  return {
    title: 'Test Notification',
    message:
      'This is a test email notification from CIVOS. If you received this email, your email notifications are configured correctly!',
    userName: fullName || 'CIVOS System',
    linkUrl: '/settings',
  };
}

/**
 * Build the successful test-email JSON response from the send result and the
 * recipient email. The message reflects whether Resend delivered the email or
 * it was logged to the console; provider falls back to 'mock'.
 */
export function buildTestEmailSuccessResponse(
  result: { messageId?: string; provider?: 'resend' | 'mock' },
  sentTo: string,
): {
  success: true;
  message: string;
  messageId: string | undefined;
  sentTo: string;
  provider: 'resend' | 'mock';
} {
  return {
    success: true,
    message:
      result.provider === 'resend'
        ? 'Test email sent successfully via Resend API'
        : 'Test email logged to console (Resend API not configured)',
    messageId: result.messageId,
    sentTo,
    provider: result.provider || 'mock',
  };
}

/**
 * Build the email-service-status JSON response from the configuration booleans
 * the route computes (from isResendConfigured and process.env).
 */
export function buildEmailServiceStatus(params: {
  resendConfigured: boolean;
  emailEnabled: boolean;
  mockEmailEnabled: boolean;
  productionMisconfigured: boolean;
}): {
  provider: 'resend' | 'mock' | null;
  resendConfigured: boolean;
  emailEnabled: boolean;
  status: 'ready' | 'misconfigured' | 'development' | 'disabled';
  message: string;
} {
  const { resendConfigured, emailEnabled, mockEmailEnabled, productionMisconfigured } = params;

  return {
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
      ? 'Resend API is configured. Live delivery still depends on provider quota and sender-domain status; run production preflight to verify sends.'
      : productionMisconfigured
        ? 'Email delivery is not configured. Set a valid RESEND_API_KEY before using production email workflows.'
        : mockEmailEnabled
          ? 'Mock email is enabled for development. Emails are logged to console only.'
          : 'Email delivery is not configured.',
  };
}
