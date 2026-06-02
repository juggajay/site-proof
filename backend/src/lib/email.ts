// Email Service for SiteProof
// Uses Resend API for production email delivery
// Falls back to console logging in development mode

import { Resend } from 'resend';
import * as fs from 'fs';
import { randomUUID } from 'node:crypto';
import {
  renderNotificationEmail,
  renderSupportRequestEmail,
} from './email/supportAndNotificationTemplates.js';
import {
  renderHoldPointChaseEmail,
  renderHoldPointReleaseConfirmationEmail,
  renderHoldPointReleaseRequestEmail,
} from './email/holdPointTemplates.js';
import {
  sendMagicLinkEmail as sendMagicLinkAuthEmail,
  sendPasswordResetEmail as sendPasswordResetAuthEmail,
  sendVerificationEmail as sendVerificationAuthEmail,
  type MagicLinkEmailData,
  type PasswordResetEmailData,
  type VerificationEmailData,
} from './email/authTemplates.js';
import {
  sendDailyDigestEmail as sendDailyDigestTemplateEmail,
  type DigestItem,
} from './email/digestTemplates.js';
import {
  sendScheduledReportEmail as sendScheduledReportTemplateEmail,
  type ScheduledReportEmailData,
} from './email/reportTemplates.js';
import { buildFrontendUrl } from './runtimeConfig.js';
import { logError, logInfo } from './serverLogger.js';

interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string; // Alternative: path to file on disk
  contentType?: string;
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  attachments?: EmailAttachment[];
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: 'resend' | 'mock';
}

// Email queue for testing/development
const emailQueue: EmailOptions[] = [];

// Configuration
const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'noreply@siteproof.app',
  enabled: process.env.EMAIL_ENABLED !== 'false',
  resendApiKey: process.env.RESEND_API_KEY,
};

const isProductionEmailRuntime = process.env.NODE_ENV === 'production';
const useMockEmail =
  !isProductionEmailRuntime &&
  (process.env.NODE_ENV === 'test' || process.env.EMAIL_PROVIDER === 'mock');

function getRecipientCount(to: string | string[]): number {
  return Array.isArray(to) ? to.length : 1;
}

function isValidResendApiKey(apiKey: string | undefined): apiKey is string {
  return Boolean(
    apiKey &&
    apiKey.startsWith('re_') &&
    !apiKey.toLowerCase().includes('placeholder') &&
    !apiKey.toLowerCase().includes('your_') &&
    !apiKey.toLowerCase().includes('your-'),
  );
}

// Initialize Resend client if API key is provided and valid
const resend =
  !useMockEmail && isValidResendApiKey(EMAIL_CONFIG.resendApiKey)
    ? new Resend(EMAIL_CONFIG.resendApiKey)
    : null;

/**
 * Check if Resend is configured and available
 */
export function isResendConfigured(): boolean {
  return resend !== null;
}

/**
 * Send an email
 * Uses Resend API when configured. Development/test can use mock logging;
 * production fails closed when email delivery is not configured.
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const email = {
    ...options,
    from: options.from || EMAIL_CONFIG.from,
  };

  if (!EMAIL_CONFIG.enabled) {
    if (process.env.NODE_ENV !== 'production') {
      logInfo('[Email Service] Email sending disabled');
    }
    return { success: false, error: 'Email sending disabled' };
  }

  // Store in queue for testing/development diagnostics without retaining production email contents.
  if (!isProductionEmailRuntime) {
    emailQueue.push(email);
  }

  // Try to use Resend if configured
  if (resend) {
    try {
      if (process.env.NODE_ENV !== 'production') {
        logInfo('[Email Service] Sending via Resend:', {
          recipientCount: getRecipientCount(email.to),
        });
      }

      // Prepare attachments for Resend format
      const resendAttachments = email.attachments
        ?.map((att) => {
          if (att.content) {
            return {
              filename: att.filename,
              content: typeof att.content === 'string' ? Buffer.from(att.content) : att.content,
            };
          } else if (att.path) {
            return {
              filename: att.filename,
              content: fs.readFileSync(att.path),
            };
          }
          return null;
        })
        .filter(Boolean) as { filename: string; content: Buffer }[] | undefined;

      const response = await resend.emails.send({
        from: email.from,
        to: Array.isArray(email.to) ? email.to : [email.to],
        subject: email.subject,
        text: email.text || '',
        html: email.html,
        attachments: resendAttachments,
      });

      if (response.error) {
        logError('[Email Service] Resend API error:', response.error);
        return {
          success: false,
          error: response.error.message,
          provider: 'resend',
        };
      }

      if (process.env.NODE_ENV !== 'production') {
        logInfo('[Email Service] Sent successfully:', { messageId: response.data?.id });
      }

      return {
        success: true,
        messageId: response.data?.id,
        provider: 'resend',
      };
    } catch (error) {
      logError('[Email Service] Resend API exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'resend',
      };
    }
  }

  if (isProductionEmailRuntime) {
    logError('[Email Service] Email delivery is not configured. Set a valid RESEND_API_KEY.');
    return {
      success: false,
      error: 'Email delivery is not configured',
    };
  }

  // Fallback to mock logging for development/test only
  const messageId = `mock_${Date.now()}_${randomUUID()}`;

  if (process.env.NODE_ENV !== 'production') {
    logInfo('[Email Service] MOCK:', { recipientCount: getRecipientCount(email.to) });
  }

  return {
    success: true,
    messageId,
    provider: 'mock',
  };
}

/**
 * Get queued emails (for testing)
 */
export function getQueuedEmails(): EmailOptions[] {
  return [...emailQueue];
}

/**
 * Clear email queue (for testing)
 */
export function clearEmailQueue(): void {
  emailQueue.length = 0;
}

function sanitizeSupportEmailLine(value: string | undefined, fallback = 'Not provided'): string {
  const normalized = value
    ?.replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return normalized || fallback;
}

const EMAIL_HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeEmailHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => EMAIL_HTML_ENTITIES[character]);
}

/**
 * Send a support request to the support inbox.
 * The request endpoint is public, so confirmations are not sent to the
 * provided email address to avoid turning the form into a mail relay.
 */
export async function sendSupportRequestEmail(data: {
  ticketId: string;
  category: string;
  subject: string;
  message: string;
  userEmail?: string;
  userName?: string;
  to?: string;
}): Promise<EmailResult> {
  const supportInbox = data.to || process.env.SUPPORT_EMAIL || 'support@siteproof.com.au';
  const { subject, text } = renderSupportRequestEmail(data);

  return sendEmail({
    to: supportInbox,
    subject,
    text,
  });
}

/**
 * Send notification email
 */
export async function sendNotificationEmail(
  to: string,
  notificationType: string,
  data: {
    title: string;
    message: string;
    linkUrl?: string;
    projectName?: string;
    userName?: string;
  },
): Promise<EmailResult> {
  const notificationLinkUrl = data.linkUrl ? buildFrontendUrl(data.linkUrl) : '';
  const settingsUrl = buildFrontendUrl('/settings');
  const { subject, html, text } = renderNotificationEmail(notificationType, data, {
    notificationLinkUrl,
    settingsUrl,
  });

  return sendEmail({
    to,
    subject,
    html,
    text,
  });
}

/**
 * Email notification types
 */
export const NotificationTypes = {
  MENTION: 'mention',
  NCR_ASSIGNED: 'ncr_assigned',
  NCR_STATUS_CHANGE: 'ncr_status_change',
  HOLD_POINT_SCHEDULED: 'hold_point_scheduled',
  HOLD_POINT_REMINDER: 'hold_point_reminder',
  COMMENT_REPLY: 'comment_reply',
  LOT_STATUS_CHANGE: 'lot_status_change',
  SCHEDULED_REPORT: 'scheduled_report',
  DAILY_DIGEST: 'daily_digest',
} as const;

export type NotificationType = (typeof NotificationTypes)[keyof typeof NotificationTypes];
export type { DigestItem } from './email/digestTemplates.js';

/**
 * Send subcontractor invitation email
 * Feature #942 - Sends invitation to subcontractor with setup link
 */
export async function sendSubcontractorInvitationEmail(data: {
  to: string;
  contactName: string;
  companyName: string;
  projectName: string;
  inviterEmail: string;
  inviteUrl: string;
}): Promise<EmailResult> {
  const subjectProjectName = sanitizeSupportEmailLine(data.projectName, 'Project');
  const subject = `[SiteProof] Invitation to join ${subjectProjectName}`;
  const safeSubject = escapeEmailHtml(subject);
  const safeContactName = escapeEmailHtml(data.contactName);
  const safeCompanyName = escapeEmailHtml(data.companyName);
  const safeProjectName = escapeEmailHtml(data.projectName);
  const safeInviterEmail = escapeEmailHtml(data.inviterEmail);
  const safeInviteUrl = escapeEmailHtml(data.inviteUrl);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .message-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0; }
    .button { display: inline-block; background: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 15px 0; font-size: 16px; }
    .button:hover { background: #15803d; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .highlight { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏗️ SiteProof</h1>
      <p style="margin: 5px 0 0 0;">Subcontractor Portal Invitation</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi ${safeContactName},</h2>
      <div class="message-box">
        <p>You have been invited to join the project <strong>"${safeProjectName}"</strong> on SiteProof as a subcontractor for <strong>${safeCompanyName}</strong>.</p>
        <p>SiteProof is a quality management platform that helps civil construction teams track lots, manage ITPs, and submit daily dockets.</p>
      </div>
      <div class="highlight">
        <strong>📋 What you'll be able to do:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>View lots assigned to your company</li>
          <li>Submit daily dockets for time, plant, and materials</li>
          <li>Complete ITP checklist items</li>
          <li>Upload photos and documents</li>
        </ul>
      </div>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${safeInviteUrl}" class="button">
          Accept Invitation & Set Up Account
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        This invitation was sent by <strong>${safeInviterEmail}</strong>.
      </p>
    </div>
    <div class="footer">
      <p>This invitation was sent from SiteProof Quality Management System.</p>
      <p>If you were not expecting this invitation, please contact the sender.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi ${data.contactName},

You have been invited to join the project "${data.projectName}" on SiteProof as a subcontractor for ${data.companyName}.

SiteProof is a quality management platform that helps civil construction teams track lots, manage ITPs, and submit daily dockets.

What you'll be able to do:
- View lots assigned to your company
- Submit daily dockets for time, plant, and materials
- Complete ITP checklist items
- Upload photos and documents

Click the link below to accept your invitation and set up your account:
${data.inviteUrl}

This invitation was sent by ${data.inviterEmail}.

---
If you were not expecting this invitation, please contact the sender.
  `;

  if (process.env.NODE_ENV !== 'production') {
    logInfo('[Email Service] Prepared subcontractor invitation email:', { recipientCount: 1 });
  }

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  });
}

/**
 * Send HP release request email to superintendent (Feature #946)
 */
export async function sendHPReleaseRequestEmail(data: {
  to: string;
  superintendentName: string;
  projectName: string;
  lotNumber: string;
  holdPointDescription: string;
  scheduledDate?: string;
  scheduledTime?: string;
  evidencePackageUrl?: string;
  releaseUrl: string;
  secureReleaseUrl?: string; // Feature #23 - secure link for external release
  requestedBy: string;
  noticeOverrideReason?: string;
}): Promise<EmailResult> {
  const { subject, html, text } = renderHoldPointReleaseRequestEmail(data);

  if (process.env.NODE_ENV !== 'production') {
    logInfo('[Email Service] Prepared hold point release request email:', { recipientCount: 1 });
  }

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  });
}

/**
 * Send HP chase email to superintendent (Feature #947)
 * Follow-up reminder for hold points that haven't been released
 */
export async function sendHPChaseEmail(data: {
  to: string;
  superintendentName: string;
  projectName: string;
  lotNumber: string;
  holdPointDescription: string;
  originalRequestDate: string;
  chaseCount: number;
  daysSinceRequest: number;
  evidencePackageUrl?: string;
  releaseUrl: string;
  requestedBy: string;
}): Promise<EmailResult> {
  const { subject, html, text } = renderHoldPointChaseEmail(data);

  if (process.env.NODE_ENV !== 'production') {
    logInfo('[Email Service] Prepared hold point chase email:', {
      recipientCount: 1,
      chaseCount: data.chaseCount,
    });
  }

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  });
}

/**
 * Send HP release confirmation email (Feature #948)
 * Sent to both contractor and superintendent when HP is released
 */
export async function sendHPReleaseConfirmationEmail(data: {
  to: string;
  recipientName: string;
  recipientRole: 'contractor' | 'superintendent';
  projectName: string;
  lotNumber: string;
  holdPointDescription: string;
  releasedByName: string;
  releasedByOrg?: string;
  releaseMethod?: string;
  releaseNotes?: string;
  releasedAt: string;
  lotUrl: string;
}): Promise<EmailResult> {
  const { subject, html, text } = renderHoldPointReleaseConfirmationEmail(data);

  if (process.env.NODE_ENV !== 'production') {
    logInfo('[Email Service] Prepared hold point release confirmation email:', {
      recipientCount: 1,
    });
  }

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  });
}

export async function sendVerificationEmail(data: VerificationEmailData): Promise<EmailResult> {
  return sendVerificationAuthEmail(data, { sendEmail, escapeEmailHtml });
}

export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<EmailResult> {
  return sendPasswordResetAuthEmail(data, { sendEmail, escapeEmailHtml });
}

export async function sendMagicLinkEmail(data: MagicLinkEmailData): Promise<EmailResult> {
  return sendMagicLinkAuthEmail(data, { sendEmail, escapeEmailHtml });
}

/**
 * Send scheduled report email with PDF attachment (Feature #1016)
 */
export async function sendScheduledReportEmail(
  data: ScheduledReportEmailData,
): Promise<EmailResult> {
  return sendScheduledReportTemplateEmail(data, {
    sendEmail,
    escapeEmailHtml,
    sanitizeSupportEmailLine,
  });
}

/**
 * Send daily digest email
 */
export async function sendDailyDigestEmail(to: string, items: DigestItem[]): Promise<EmailResult> {
  return sendDailyDigestTemplateEmail(to, items, {
    sendEmail,
    escapeEmailHtml,
    buildFrontendUrl,
  });
}
