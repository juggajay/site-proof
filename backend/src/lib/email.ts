// Email Service for SiteProof
// Uses Resend API for production email delivery
// Falls back to console logging in development mode

import { Resend } from 'resend';
import * as fs from 'fs';
import { randomUUID } from 'node:crypto';
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
  const safeTicketId = sanitizeSupportEmailLine(data.ticketId, 'Unknown ticket');
  const safeCategory = sanitizeSupportEmailLine(data.category, 'general');
  const safeSubject = sanitizeSupportEmailLine(data.subject, 'No subject');
  const safeUserEmail = sanitizeSupportEmailLine(data.userEmail);
  const safeUserName = sanitizeSupportEmailLine(data.userName);

  const text = [
    `Ticket: ${safeTicketId}`,
    `Category: ${safeCategory}`,
    `Subject: ${safeSubject}`,
    `User email: ${safeUserEmail}`,
    `User name: ${safeUserName}`,
    '',
    'Message:',
    data.message,
  ].join('\n');

  return sendEmail({
    to: supportInbox,
    subject: `[SiteProof Support] ${safeTicketId}: ${safeSubject}`,
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
  const subjectTitle = sanitizeSupportEmailLine(data.title, 'Notification');
  const subject = `[SiteProof] ${subjectTitle}`;
  const notificationLinkUrl = data.linkUrl ? buildFrontendUrl(data.linkUrl) : '';
  const settingsUrl = buildFrontendUrl('/settings');
  const safeSubject = escapeEmailHtml(subject);
  const safeTitle = escapeEmailHtml(data.title);
  const safeMessage = escapeEmailHtml(data.message);
  const safeProjectName = data.projectName ? escapeEmailHtml(data.projectName) : '';
  const safeUserName = data.userName ? escapeEmailHtml(data.userName) : '';
  const safeNotificationType = escapeEmailHtml(notificationType);
  const safeNotificationLinkUrl = notificationLinkUrl ? escapeEmailHtml(notificationLinkUrl) : '';
  const safeSettingsUrl = escapeEmailHtml(settingsUrl);

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
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 15px 0; }
    .button:hover { background: #1d4ed8; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SiteProof</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">${safeTitle}</h2>
      ${safeProjectName ? `<p class="meta">Project: ${safeProjectName}</p>` : ''}
      ${safeUserName ? `<p class="meta">From: ${safeUserName}</p>` : ''}
      <div class="message-box">
        <p>${safeMessage}</p>
      </div>
      ${
        safeNotificationLinkUrl
          ? `
        <a href="${safeNotificationLinkUrl}" class="button">
          View in SiteProof
        </a>
      `
          : ''
      }
    </div>
    <div class="footer">
      <p>This notification was sent from SiteProof Quality Management System.</p>
      <p>You received this email because you have notifications enabled for ${safeNotificationType} events.</p>
      <p>To manage your notification preferences, visit your <a href="${safeSettingsUrl}">Settings</a>.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
${data.title}

${data.projectName ? `Project: ${data.projectName}` : ''}
${data.userName ? `From: ${data.userName}` : ''}

${data.message}

${notificationLinkUrl ? `View in SiteProof: ${notificationLinkUrl}` : ''}

---
This notification was sent from SiteProof Quality Management System.
To manage your notification preferences, visit: ${settingsUrl}
  `;

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
  const subjectLotNumber = sanitizeSupportEmailLine(data.lotNumber, 'Lot');
  const subject = `[SiteProof] Hold Point Release Request - ${subjectLotNumber}`;
  const safeSubject = escapeEmailHtml(subject);
  const safeSuperintendentName = escapeEmailHtml(data.superintendentName);
  const safeProjectName = escapeEmailHtml(data.projectName);
  const safeLotNumber = escapeEmailHtml(data.lotNumber);
  const safeHoldPointDescription = escapeEmailHtml(data.holdPointDescription);
  const safeRequestedBy = escapeEmailHtml(data.requestedBy);
  const safeScheduledDate = data.scheduledDate ? escapeEmailHtml(data.scheduledDate) : '';
  const safeScheduledTime = data.scheduledTime ? escapeEmailHtml(data.scheduledTime) : '';
  const safeNoticeOverrideReason = data.noticeOverrideReason
    ? escapeEmailHtml(data.noticeOverrideReason)
    : '';
  const safeEvidencePackageUrl = data.evidencePackageUrl
    ? escapeEmailHtml(data.evidencePackageUrl)
    : '';
  const safeReleaseUrl = escapeEmailHtml(data.releaseUrl);
  const safeSecureReleaseUrl = data.secureReleaseUrl ? escapeEmailHtml(data.secureReleaseUrl) : '';

  const scheduledInfo = data.scheduledDate
    ? `<strong>Scheduled:</strong> ${safeScheduledDate}${safeScheduledTime ? ` at ${safeScheduledTime}` : ''}`
    : '<strong>Scheduled:</strong> As soon as possible';

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
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .message-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0; }
    .detail-row { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-row:last-child { border-bottom: none; }
    .button { display: inline-block; background: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 5px; font-size: 16px; }
    .button.secondary { background: #2563eb; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .highlight { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; }
    .urgent { background: #fee2e2; padding: 12px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚧 Hold Point Release Request</h1>
      <p style="margin: 5px 0 0 0;">Action Required</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi ${safeSuperintendentName},</h2>
      <p>A hold point release has been requested on project <strong>${safeProjectName}</strong>.</p>

      <div class="message-box">
        <div class="detail-row">
          <strong>📍 Lot:</strong> ${safeLotNumber}
        </div>
        <div class="detail-row">
          <strong>🔒 Hold Point:</strong> ${safeHoldPointDescription}
        </div>
        <div class="detail-row">
          ${scheduledInfo}
        </div>
        <div class="detail-row">
          <strong>👤 Requested By:</strong> ${safeRequestedBy}
        </div>
      </div>

      ${
        safeNoticeOverrideReason
          ? `
      <div class="urgent">
        <strong>⚠️ Notice Period Override:</strong><br>
        ${safeNoticeOverrideReason}
      </div>
      `
          : ''
      }

      ${
        safeEvidencePackageUrl
          ? `
      <div class="highlight">
        <strong>📋 Evidence Package Available</strong><br>
        All prerequisite checklist items have been completed. The evidence package is ready for your review.
      </div>
      `
          : ''
      }

      <div style="text-align: center; margin: 25px 0;">
        ${
          safeEvidencePackageUrl
            ? `
        <a href="${safeEvidencePackageUrl}" class="button secondary">
          View Evidence Package
        </a>
        `
            : ''
        }
        <a href="${safeReleaseUrl}" class="button">
          Review & Release Hold Point
        </a>
        ${
          safeSecureReleaseUrl
            ? `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
            Or release without logging in:
          </p>
          <a href="${safeSecureReleaseUrl}" class="button" style="background: #7c3aed;">
            🔐 Release via Secure Link
          </a>
        </div>
        `
            : ''
        }
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        Please review the submission and release the hold point when satisfied, or contact the requestor if additional information is required.
      </p>
    </div>
    <div class="footer">
      <p>This notification was sent from SiteProof Quality Management System.</p>
      <p>Project: ${safeProjectName}</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi ${data.superintendentName},

A hold point release has been requested on project ${data.projectName}.

HOLD POINT DETAILS
------------------
Lot: ${data.lotNumber}
Hold Point: ${data.holdPointDescription}
Scheduled: ${data.scheduledDate ? `${data.scheduledDate}${data.scheduledTime ? ` at ${data.scheduledTime}` : ''}` : 'As soon as possible'}
Requested By: ${data.requestedBy}
${data.noticeOverrideReason ? `\nNOTICE PERIOD OVERRIDE: ${data.noticeOverrideReason}\n` : ''}
${
  data.evidencePackageUrl
    ? `
EVIDENCE PACKAGE
----------------
All prerequisite checklist items have been completed.
View evidence package: ${data.evidencePackageUrl}
`
    : ''
}

ACTIONS
-------
Review & Release Hold Point: ${data.releaseUrl}
${data.secureReleaseUrl ? `\nOr release without logging in (secure link):\n${data.secureReleaseUrl}\n` : ''}
Please review the submission and release the hold point when satisfied, or contact the requestor if additional information is required.

---
This notification was sent from SiteProof Quality Management System.
Project: ${data.projectName}
  `;

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
  const subjectLotNumber = sanitizeSupportEmailLine(data.lotNumber, 'Lot');
  const subject = `[SiteProof] REMINDER: Hold Point Awaiting Release - ${subjectLotNumber} (Chase #${data.chaseCount})`;
  const safeSubject = escapeEmailHtml(subject);
  const safeSuperintendentName = escapeEmailHtml(data.superintendentName);
  const safeProjectName = escapeEmailHtml(data.projectName);
  const safeLotNumber = escapeEmailHtml(data.lotNumber);
  const safeHoldPointDescription = escapeEmailHtml(data.holdPointDescription);
  const safeOriginalRequestDate = escapeEmailHtml(data.originalRequestDate);
  const safeRequestedBy = escapeEmailHtml(data.requestedBy);
  const safeEvidencePackageUrl = data.evidencePackageUrl
    ? escapeEmailHtml(data.evidencePackageUrl)
    : '';
  const safeReleaseUrl = escapeEmailHtml(data.releaseUrl);

  const urgencyMessage =
    data.daysSinceRequest > 5
      ? `<strong style="color: #dc2626;">This hold point has been awaiting release for ${data.daysSinceRequest} days.</strong>`
      : `This hold point has been awaiting release for ${data.daysSinceRequest} days.`;

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
    .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .message-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0; }
    .detail-row { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-row:last-child { border-bottom: none; }
    .button { display: inline-block; background: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 5px; font-size: 16px; }
    .button.secondary { background: #2563eb; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .highlight { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; }
    .urgent { background: #fee2e2; padding: 12px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 15px 0; }
    .chase-badge { display: inline-block; background: #f59e0b; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Hold Point Reminder</h1>
      <p style="margin: 5px 0 0 0;"><span class="chase-badge">Chase #${data.chaseCount}</span></p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi ${safeSuperintendentName},</h2>

      <div class="urgent">
        ${urgencyMessage}
      </div>

      <p>This is a reminder about a hold point release request on project <strong>${safeProjectName}</strong> that is still awaiting your action.</p>

      <div class="message-box">
        <div class="detail-row">
          <strong>📍 Lot:</strong> ${safeLotNumber}
        </div>
        <div class="detail-row">
          <strong>🔒 Hold Point:</strong> ${safeHoldPointDescription}
        </div>
        <div class="detail-row">
          <strong>📅 Originally Requested:</strong> ${safeOriginalRequestDate}
        </div>
        <div class="detail-row">
          <strong>👤 Requested By:</strong> ${safeRequestedBy}
        </div>
      </div>

      ${
        safeEvidencePackageUrl
          ? `
      <div class="highlight">
        <strong>📋 Evidence Package Available</strong><br>
        The original evidence package is still available for your review.
      </div>
      `
          : ''
      }

      <div style="text-align: center; margin: 25px 0;">
        ${
          safeEvidencePackageUrl
            ? `
        <a href="${safeEvidencePackageUrl}" class="button secondary">
          View Evidence Package
        </a>
        `
            : ''
        }
        <a href="${safeReleaseUrl}" class="button">
          Review & Release Hold Point
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        Please review and release the hold point, or contact the requestor if you require additional information.
      </p>
    </div>
    <div class="footer">
      <p>This is reminder #${data.chaseCount} for this hold point release request.</p>
      <p>Project: ${safeProjectName}</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi ${data.superintendentName},

REMINDER: Hold Point Awaiting Release (Chase #${data.chaseCount})

This hold point has been awaiting release for ${data.daysSinceRequest} days.

HOLD POINT DETAILS
------------------
Lot: ${data.lotNumber}
Hold Point: ${data.holdPointDescription}
Originally Requested: ${data.originalRequestDate}
Requested By: ${data.requestedBy}

${
  data.evidencePackageUrl
    ? `
EVIDENCE PACKAGE
----------------
The original evidence package is still available for your review.
View evidence package: ${data.evidencePackageUrl}
`
    : ''
}

ACTIONS
-------
Review & Release Hold Point: ${data.releaseUrl}

Please review and release the hold point, or contact the requestor if you require additional information.

---
This is reminder #${data.chaseCount} for this hold point release request.
Project: ${data.projectName}
  `;

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
  const subjectLotNumber = sanitizeSupportEmailLine(data.lotNumber, 'Lot');
  const subject = `[SiteProof] Hold Point Released - ${subjectLotNumber}`;
  const safeSubject = escapeEmailHtml(subject);
  const safeRecipientName = escapeEmailHtml(data.recipientName);
  const safeProjectName = escapeEmailHtml(data.projectName);
  const safeLotNumber = escapeEmailHtml(data.lotNumber);
  const safeHoldPointDescription = escapeEmailHtml(data.holdPointDescription);
  const safeReleasedByName = escapeEmailHtml(data.releasedByName);
  const safeReleasedByOrg = data.releasedByOrg ? escapeEmailHtml(data.releasedByOrg) : '';
  const safeReleaseMethod = data.releaseMethod ? escapeEmailHtml(data.releaseMethod) : '';
  const safeReleaseNotes = data.releaseNotes ? escapeEmailHtml(data.releaseNotes) : '';
  const safeReleasedAt = escapeEmailHtml(data.releasedAt);
  const safeLotUrl = escapeEmailHtml(data.lotUrl);

  const roleSpecificMessage =
    data.recipientRole === 'contractor'
      ? 'You may now proceed with the next phase of work.'
      : 'This is confirmation that the hold point has been released.';

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
    .header { background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .message-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0; }
    .detail-row { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-row:last-child { border-bottom: none; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 5px; font-size: 16px; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .success-badge { background: #dcfce7; color: #166534; padding: 12px 20px; border-radius: 8px; text-align: center; margin: 20px 0; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Hold Point Released</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi ${safeRecipientName},</h2>

      <div class="success-badge">
        The hold point has been released successfully
      </div>

      <p>${roleSpecificMessage}</p>

      <div class="message-box">
        <div class="detail-row">
          <strong>📍 Lot:</strong> ${safeLotNumber}
        </div>
        <div class="detail-row">
          <strong>🔒 Hold Point:</strong> ${safeHoldPointDescription}
        </div>
        <div class="detail-row">
          <strong>✍️ Released By:</strong> ${safeReleasedByName}${safeReleasedByOrg ? ` (${safeReleasedByOrg})` : ''}
        </div>
        <div class="detail-row">
          <strong>📅 Released At:</strong> ${safeReleasedAt}
        </div>
        ${
          safeReleaseMethod
            ? `
        <div class="detail-row">
          <strong>📝 Release Method:</strong> ${safeReleaseMethod}
        </div>
        `
            : ''
        }
        ${
          safeReleaseNotes
            ? `
        <div class="detail-row">
          <strong>📋 Notes:</strong> ${safeReleaseNotes}
        </div>
        `
            : ''
        }
      </div>

      <div style="text-align: center; margin: 25px 0;">
        <a href="${safeLotUrl}" class="button">
          View Lot Details
        </a>
      </div>
    </div>
    <div class="footer">
      <p>This confirmation was sent from SiteProof Quality Management System.</p>
      <p>Project: ${safeProjectName}</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi ${data.recipientName},

HOLD POINT RELEASED

The hold point has been released successfully. ${roleSpecificMessage}

RELEASE DETAILS
---------------
Lot: ${data.lotNumber}
Hold Point: ${data.holdPointDescription}
Released By: ${data.releasedByName}${data.releasedByOrg ? ` (${data.releasedByOrg})` : ''}
Released At: ${data.releasedAt}
${data.releaseMethod ? `Release Method: ${data.releaseMethod}\n` : ''}${data.releaseNotes ? `Notes: ${data.releaseNotes}\n` : ''}

View lot details: ${data.lotUrl}

---
This confirmation was sent from SiteProof Quality Management System.
Project: ${data.projectName}
  `;

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

/**
 * Send email verification email
 * Sent when a user registers or requests a new verification link
 */
export async function sendVerificationEmail(data: {
  to: string;
  userName?: string;
  verificationUrl: string;
  expiresInHours?: number;
}): Promise<EmailResult> {
  const expiresIn = data.expiresInHours || 24;
  const subject = `[SiteProof] Verify your email address`;
  const safeSubject = escapeEmailHtml(subject);
  const safeUserName = data.userName ? escapeEmailHtml(data.userName) : '';
  const safeVerificationUrl = escapeEmailHtml(data.verificationUrl);

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
    .button { display: inline-block; background: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; font-size: 16px; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .warning { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Verify Your Email</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi${safeUserName ? ` ${safeUserName}` : ''},</h2>

      <p>Thanks for signing up for SiteProof! Please verify your email address by clicking the button below.</p>

      <div style="text-align: center;">
        <a href="${safeVerificationUrl}" class="button">
          Verify Email Address
        </a>
      </div>

      <div class="warning">
        <strong>This link expires in ${expiresIn} hours.</strong><br>
        If you didn't create an account, you can safely ignore this email.
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span style="word-break: break-all;">${safeVerificationUrl}</span>
      </p>
    </div>
    <div class="footer">
      <p>This verification link was sent from SiteProof.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi${data.userName ? ` ${data.userName}` : ''},

Thanks for signing up for SiteProof! Please verify your email address by clicking the link below.

${data.verificationUrl}

This link expires in ${expiresIn} hours.

If you didn't create an account, you can safely ignore this email.

---
This verification link was sent from SiteProof.
  `;

  if (process.env.NODE_ENV !== 'production') {
    logInfo('[Email Service] Prepared email verification:', { recipientCount: 1 });
  }

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  });
}

/**
 * Send password reset email
 * Sent when a user requests to reset their password
 */
export async function sendPasswordResetEmail(data: {
  to: string;
  userName?: string;
  resetUrl: string;
  expiresInMinutes?: number;
}): Promise<EmailResult> {
  const expiresIn = data.expiresInMinutes || 60;
  const subject = `[SiteProof] Reset your password`;
  const safeSubject = escapeEmailHtml(subject);
  const safeUserName = data.userName ? escapeEmailHtml(data.userName) : '';
  const safeResetUrl = escapeEmailHtml(data.resetUrl);

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
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; font-size: 16px; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .warning { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reset Your Password</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi${safeUserName ? ` ${safeUserName}` : ''},</h2>

      <p>We received a request to reset your password. Click the button below to create a new password.</p>

      <div style="text-align: center;">
        <a href="${safeResetUrl}" class="button">
          Reset Password
        </a>
      </div>

      <div class="warning">
        <strong>This link expires in ${expiresIn} minutes.</strong><br>
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span style="word-break: break-all;">${safeResetUrl}</span>
      </p>
    </div>
    <div class="footer">
      <p>This password reset was requested from SiteProof.</p>
      <p>For security reasons, this link can only be used once.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi${data.userName ? ` ${data.userName}` : ''},

We received a request to reset your password. Click the link below to create a new password.

${data.resetUrl}

This link expires in ${expiresIn} minutes.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
This password reset was requested from SiteProof.
For security reasons, this link can only be used once.
  `;

  if (process.env.NODE_ENV !== 'production') {
    logInfo('[Email Service] Prepared password reset email:', { recipientCount: 1 });
  }

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  });
}

/**
 * Send magic link login email (Feature #1005)
 * Passwordless login via email link
 */
export async function sendMagicLinkEmail(data: {
  to: string;
  userName?: string;
  magicLinkUrl: string;
  expiresInMinutes: number;
}): Promise<EmailResult> {
  const subject = `[SiteProof] Your Login Link`;
  const safeSubject = escapeEmailHtml(subject);
  const safeUserName = data.userName ? escapeEmailHtml(data.userName) : '';
  const safeMagicLinkUrl = escapeEmailHtml(data.magicLinkUrl);

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
    .button { display: inline-block; background: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; font-size: 16px; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .warning { background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Sign In to SiteProof</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi${safeUserName ? ` ${safeUserName}` : ''},</h2>

      <p>Click the button below to sign in to your SiteProof account. No password needed!</p>

      <div style="text-align: center;">
        <a href="${safeMagicLinkUrl}" class="button">
          Sign In to SiteProof
        </a>
      </div>

      <div class="warning">
        <strong>⏰ This link expires in ${data.expiresInMinutes} minutes.</strong><br>
        If you didn't request this link, you can safely ignore this email.
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span style="word-break: break-all;">${safeMagicLinkUrl}</span>
      </p>
    </div>
    <div class="footer">
      <p>This login link was requested from SiteProof.</p>
      <p>For security, this link can only be used once.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi${data.userName ? ` ${data.userName}` : ''},

Sign In to SiteProof
--------------------

Click the link below to sign in to your account. No password needed!

${data.magicLinkUrl}

This link expires in ${data.expiresInMinutes} minutes.

If you didn't request this link, you can safely ignore this email.
For security, this link can only be used once.

---
This login link was requested from SiteProof.
  `;

  if (process.env.NODE_ENV !== 'production') {
    logInfo('[Email Service] Prepared magic link login email:', { recipientCount: 1 });
  }

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  });
}

/**
 * Send scheduled report email with PDF attachment (Feature #1016)
 */
export async function sendScheduledReportEmail(data: {
  to: string | string[];
  recipientName?: string;
  projectName: string;
  reportType: string;
  reportName: string;
  generatedAt: string;
  dateRange?: { from: string; to: string };
  pdfBuffer?: Buffer;
  pdfPath?: string;
  viewReportUrl?: string;
}): Promise<EmailResult> {
  const subjectReportName = sanitizeSupportEmailLine(data.reportName, 'Report');
  const subject = `[SiteProof] Scheduled Report: ${subjectReportName}`;
  const safeSubject = escapeEmailHtml(subject);
  const safeRecipientName = data.recipientName ? escapeEmailHtml(data.recipientName) : '';
  const safeProjectName = escapeEmailHtml(data.projectName);
  const safeReportType = escapeEmailHtml(data.reportType);
  const safeReportName = escapeEmailHtml(data.reportName);
  const safeGeneratedAt = escapeEmailHtml(data.generatedAt);
  const safeDateFrom = data.dateRange ? escapeEmailHtml(data.dateRange.from) : '';
  const safeDateTo = data.dateRange ? escapeEmailHtml(data.dateRange.to) : '';
  const safeViewReportUrl = data.viewReportUrl ? escapeEmailHtml(data.viewReportUrl) : '';
  const hasAttachment = Boolean(data.pdfBuffer || data.pdfPath);

  const dateRangeText = data.dateRange
    ? `<div class="detail-row"><strong>📅 Date Range:</strong> ${safeDateFrom} to ${safeDateTo}</div>`
    : '';
  const attachmentNotice = hasAttachment
    ? `
      <div class="attachment-notice">
        <strong>📎 Attachment:</strong> ${safeReportName}.pdf
      </div>
    `
    : '';

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
    .detail-row { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-row:last-child { border-bottom: none; }
    .button { display: inline-block; background: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 5px; font-size: 16px; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px; }
    .attachment-notice { background: #dbeafe; color: #1e40af; padding: 12px; border-radius: 6px; margin: 15px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Scheduled Report</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Hi${safeRecipientName ? ` ${safeRecipientName}` : ''},</h2>

      <p>Your scheduled report has been generated${hasAttachment ? ' and is attached to this email' : ''}.</p>

      <div class="message-box">
        <div class="detail-row">
          <strong>📋 Report:</strong> ${safeReportName}
        </div>
        <div class="detail-row">
          <strong>📁 Type:</strong> ${safeReportType}
        </div>
        <div class="detail-row">
          <strong>🏗️ Project:</strong> ${safeProjectName}
        </div>
        ${dateRangeText}
        <div class="detail-row">
          <strong>🕒 Generated:</strong> ${safeGeneratedAt}
        </div>
      </div>

      ${attachmentNotice}

      ${
        safeViewReportUrl
          ? `
      <div style="text-align: center; margin: 25px 0;">
        <a href="${safeViewReportUrl}" class="button">
          View Report Online
        </a>
      </div>
      `
          : ''
      }

      <p style="color: #6b7280; font-size: 14px;">
        This is an automated email from your scheduled report settings.
      </p>
    </div>
    <div class="footer">
      <p>This report was generated by SiteProof Quality Management System.</p>
      <p>Project: ${safeProjectName}</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Hi${data.recipientName ? ` ${data.recipientName}` : ''},

Your scheduled report has been generated${hasAttachment ? ' and is attached to this email' : ''}.

REPORT DETAILS
--------------
Report: ${data.reportName}
Type: ${data.reportType}
Project: ${data.projectName}
${data.dateRange ? `Date Range: ${data.dateRange.from} to ${data.dateRange.to}\n` : ''}Generated: ${data.generatedAt}

${
  hasAttachment
    ? `ATTACHMENT
----------
${data.reportName}.pdf

`
    : ''
}${data.viewReportUrl ? `View report online: ${data.viewReportUrl}\n` : ''}

---
This report was generated by SiteProof Quality Management System.
Project: ${data.projectName}
  `;

  // Build attachments array
  const attachments: EmailAttachment[] = [];
  if (data.pdfBuffer) {
    attachments.push({
      filename: `${data.reportName.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`,
      content: data.pdfBuffer,
      contentType: 'application/pdf',
    });
  } else if (data.pdfPath) {
    attachments.push({
      filename: `${data.reportName.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`,
      path: data.pdfPath,
      contentType: 'application/pdf',
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    logInfo('[Email Service] Prepared scheduled report email:', { recipientCount: 1 });
  }

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}

/**
 * Digest notification item
 */
export interface DigestItem {
  type: string;
  title: string;
  message: string;
  projectName?: string;
  linkUrl?: string;
  timestamp: Date;
}

/**
 * Send daily digest email
 */
export async function sendDailyDigestEmail(to: string, items: DigestItem[]): Promise<EmailResult> {
  if (items.length === 0) {
    return { success: false, error: 'No items in digest' };
  }

  const subject = `[SiteProof] Daily Digest - ${items.length} notification${items.length > 1 ? 's' : ''}`;
  const safeSubject = escapeEmailHtml(subject);
  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const dashboardUrl = buildFrontendUrl('/dashboard');
  const settingsUrl = buildFrontendUrl('/settings');
  const safeToday = escapeEmailHtml(today);
  const safeDashboardUrl = escapeEmailHtml(dashboardUrl);
  const safeSettingsUrl = escapeEmailHtml(settingsUrl);

  // Group items by project
  const itemsByProject = items.reduce(
    (acc, item) => {
      const project = item.projectName || 'General';
      if (!acc[project]) {
        acc[project] = [];
      }
      acc[project].push(item);
      return acc;
    },
    {} as Record<string, DigestItem[]>,
  );

  const projectSections = Object.entries(itemsByProject)
    .map(([project, projectItems]) => {
      const itemsHtml = projectItems
        .map(
          (item) => `
      <div style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
        <div style="font-weight: 500; color: #374151;">${escapeEmailHtml(item.title)}</div>
        <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">${escapeEmailHtml(item.message)}</div>
        ${
          item.linkUrl
            ? `
          <a href="${escapeEmailHtml(buildFrontendUrl(item.linkUrl))}"
             style="display: inline-block; margin-top: 8px; color: #2563eb; text-decoration: none; font-size: 14px;">
            View Details →
          </a>
        `
            : ''
        }
      </div>
    `,
        )
        .join('');

      return `
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; padding: 8px 12px; background: #f3f4f6; border-radius: 6px; font-size: 14px; color: #374151;">
          📁 ${escapeEmailHtml(project)}
        </h3>
        ${itemsHtml}
      </div>
    `;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeSubject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 24px;">📬 Daily Digest</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">${safeToday}</p>
    </div>
    <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb;">
      <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 16px;">
          You have <strong>${items.length}</strong> notification${items.length > 1 ? 's' : ''} from today.
        </p>
      </div>

      ${projectSections}

      <div style="text-align: center; margin-top: 24px;">
        <a href="${safeDashboardUrl}"
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          View All in SiteProof
        </a>
      </div>
    </div>
    <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px;">
      <p style="margin: 0;">This is your daily digest from SiteProof Quality Management System.</p>
      <p style="margin: 8px 0 0 0;">
        To manage your notification preferences, visit your
        <a href="${safeSettingsUrl}" style="color: #2563eb;">Settings</a>.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const itemsList = items
    .map(
      (item) =>
        `- ${item.title}: ${item.message}${item.linkUrl ? ` (${buildFrontendUrl(item.linkUrl)})` : ''}`,
    )
    .join('\n');

  const text = `
Daily Digest - ${today}

You have ${items.length} notification${items.length > 1 ? 's' : ''} from today:

${itemsList}

---
View all in SiteProof: ${dashboardUrl}
To manage your notification preferences, visit: ${settingsUrl}
  `;

  return sendEmail({
    to,
    subject,
    html,
    text,
  });
}
