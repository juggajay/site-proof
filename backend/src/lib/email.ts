// Email Service for SiteProof
// This is a mock email service for development. In production, integrate with:
// - SendGrid
// - AWS SES
// - Nodemailer with SMTP

interface EmailOptions {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  from?: string
}

interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

// Email queue for testing/development
const emailQueue: EmailOptions[] = []

// Configuration
const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'noreply@siteproof.app',
  enabled: process.env.EMAIL_ENABLED === 'true' || true, // Enable by default for dev
}

/**
 * Send an email
 * In development, this logs to console and stores in memory queue
 * In production, integrate with actual email provider
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const email = {
    ...options,
    from: options.from || EMAIL_CONFIG.from,
  }

  if (!EMAIL_CONFIG.enabled) {
    console.log('[Email Service] Email sending disabled')
    return { success: false, error: 'Email sending disabled' }
  }

  // In development, log and queue the email
  console.log('[Email Service] Sending email:')
  console.log('  To:', email.to)
  console.log('  Subject:', email.subject)
  console.log('  From:', email.from)

  // Store in queue for testing
  emailQueue.push(email)

  // Generate a mock message ID
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Log HTML content in dev mode
  if (email.html) {
    console.log('  HTML Content Preview:', email.html.substring(0, 200) + '...')
  }

  return {
    success: true,
    messageId,
  }
}

/**
 * Get queued emails (for testing)
 */
export function getQueuedEmails(): EmailOptions[] {
  return [...emailQueue]
}

/**
 * Clear email queue (for testing)
 */
export function clearEmailQueue(): void {
  emailQueue.length = 0
}

/**
 * Send notification email
 */
export async function sendNotificationEmail(
  to: string,
  notificationType: string,
  data: {
    title: string
    message: string
    linkUrl?: string
    projectName?: string
    userName?: string
  }
): Promise<EmailResult> {
  const subject = `[SiteProof] ${data.title}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
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
      <h2 style="margin-top: 0;">${data.title}</h2>
      ${data.projectName ? `<p class="meta">Project: ${data.projectName}</p>` : ''}
      ${data.userName ? `<p class="meta">From: ${data.userName}</p>` : ''}
      <div class="message-box">
        <p>${data.message}</p>
      </div>
      ${data.linkUrl ? `
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}${data.linkUrl}" class="button">
          View in SiteProof
        </a>
      ` : ''}
    </div>
    <div class="footer">
      <p>This notification was sent from SiteProof Quality Management System.</p>
      <p>You received this email because you have notifications enabled for ${notificationType} events.</p>
      <p>To manage your notification preferences, visit your <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}/settings">Settings</a>.</p>
    </div>
  </div>
</body>
</html>
  `

  const text = `
${data.title}

${data.projectName ? `Project: ${data.projectName}` : ''}
${data.userName ? `From: ${data.userName}` : ''}

${data.message}

${data.linkUrl ? `View in SiteProof: ${process.env.FRONTEND_URL || 'http://localhost:5174'}${data.linkUrl}` : ''}

---
This notification was sent from SiteProof Quality Management System.
To manage your notification preferences, visit: ${process.env.FRONTEND_URL || 'http://localhost:5174'}/settings
  `

  return sendEmail({
    to,
    subject,
    html,
    text,
  })
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
} as const

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes]

/**
 * Send subcontractor invitation email
 * Feature #942 - Sends invitation to subcontractor with setup link
 */
export async function sendSubcontractorInvitationEmail(data: {
  to: string
  contactName: string
  companyName: string
  projectName: string
  inviterEmail: string
  inviteUrl: string
}): Promise<EmailResult> {
  const subject = `[SiteProof] Invitation to join ${data.projectName}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
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
      <h2 style="margin-top: 0;">Hi ${data.contactName},</h2>
      <div class="message-box">
        <p>You have been invited to join the project <strong>"${data.projectName}"</strong> on SiteProof as a subcontractor for <strong>${data.companyName}</strong>.</p>
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
        <a href="${data.inviteUrl}" class="button">
          Accept Invitation & Set Up Account
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        This invitation was sent by <strong>${data.inviterEmail}</strong>.
      </p>
    </div>
    <div class="footer">
      <p>This invitation was sent from SiteProof Quality Management System.</p>
      <p>If you were not expecting this invitation, please contact the sender.</p>
    </div>
  </div>
</body>
</html>
  `

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
  `

  // Also log to console in dev mode for easy testing
  console.log('\n========================================')
  console.log('📧 SUBCONTRACTOR INVITATION EMAIL')
  console.log('========================================')
  console.log('To:', data.to)
  console.log('Subject:', subject)
  console.log('----------------------------------------')
  console.log('Hi ' + data.contactName + ',')
  console.log('')
  console.log('You have been invited to join the project "' + data.projectName + '" on SiteProof')
  console.log('as a subcontractor for ' + data.companyName + '.')
  console.log('')
  console.log('Click the link below to accept your invitation and set up your account:')
  console.log(data.inviteUrl)
  console.log('')
  console.log('This invitation was sent by ' + data.inviterEmail + '.')
  console.log('========================================\n')

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  })
}

/**
 * Send HP release request email to superintendent (Feature #946)
 */
export async function sendHPReleaseRequestEmail(data: {
  to: string
  superintendentName: string
  projectName: string
  lotNumber: string
  holdPointDescription: string
  scheduledDate?: string
  scheduledTime?: string
  evidencePackageUrl?: string
  releaseUrl: string
  requestedBy: string
  noticeOverrideReason?: string
}): Promise<EmailResult> {
  const subject = `[SiteProof] Hold Point Release Request - ${data.lotNumber}`

  const scheduledInfo = data.scheduledDate
    ? `<strong>Scheduled:</strong> ${data.scheduledDate}${data.scheduledTime ? ` at ${data.scheduledTime}` : ''}`
    : '<strong>Scheduled:</strong> As soon as possible'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
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
      <h2 style="margin-top: 0;">Hi ${data.superintendentName},</h2>
      <p>A hold point release has been requested on project <strong>${data.projectName}</strong>.</p>

      <div class="message-box">
        <div class="detail-row">
          <strong>📍 Lot:</strong> ${data.lotNumber}
        </div>
        <div class="detail-row">
          <strong>🔒 Hold Point:</strong> ${data.holdPointDescription}
        </div>
        <div class="detail-row">
          ${scheduledInfo}
        </div>
        <div class="detail-row">
          <strong>👤 Requested By:</strong> ${data.requestedBy}
        </div>
      </div>

      ${data.noticeOverrideReason ? `
      <div class="urgent">
        <strong>⚠️ Notice Period Override:</strong><br>
        ${data.noticeOverrideReason}
      </div>
      ` : ''}

      ${data.evidencePackageUrl ? `
      <div class="highlight">
        <strong>📋 Evidence Package Available</strong><br>
        All prerequisite checklist items have been completed. The evidence package is ready for your review.
      </div>
      ` : ''}

      <div style="text-align: center; margin: 25px 0;">
        ${data.evidencePackageUrl ? `
        <a href="${data.evidencePackageUrl}" class="button secondary">
          View Evidence Package
        </a>
        ` : ''}
        <a href="${data.releaseUrl}" class="button">
          Review & Release Hold Point
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        Please review the submission and release the hold point when satisfied, or contact the requestor if additional information is required.
      </p>
    </div>
    <div class="footer">
      <p>This notification was sent from SiteProof Quality Management System.</p>
      <p>Project: ${data.projectName}</p>
    </div>
  </div>
</body>
</html>
  `

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
${data.evidencePackageUrl ? `
EVIDENCE PACKAGE
----------------
All prerequisite checklist items have been completed.
View evidence package: ${data.evidencePackageUrl}
` : ''}

ACTIONS
-------
Review & Release Hold Point: ${data.releaseUrl}

Please review the submission and release the hold point when satisfied, or contact the requestor if additional information is required.

---
This notification was sent from SiteProof Quality Management System.
Project: ${data.projectName}
  `

  // Also log to console in dev mode for easy testing
  console.log('\n========================================')
  console.log('📧 HP RELEASE REQUEST EMAIL')
  console.log('========================================')
  console.log('To:', data.to)
  console.log('Subject:', subject)
  console.log('----------------------------------------')
  console.log('Hi ' + data.superintendentName + ',')
  console.log('')
  console.log('A hold point release has been requested on project ' + data.projectName + '.')
  console.log('')
  console.log('Lot:', data.lotNumber)
  console.log('Hold Point:', data.holdPointDescription)
  console.log('Scheduled:', data.scheduledDate || 'ASAP')
  console.log('Requested By:', data.requestedBy)
  if (data.noticeOverrideReason) {
    console.log('Notice Override:', data.noticeOverrideReason)
  }
  if (data.evidencePackageUrl) {
    console.log('')
    console.log('Evidence Package:', data.evidencePackageUrl)
  }
  console.log('')
  console.log('Release URL:', data.releaseUrl)
  console.log('========================================\n')

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  })
}

/**
 * Send HP chase email to superintendent (Feature #947)
 * Follow-up reminder for hold points that haven't been released
 */
export async function sendHPChaseEmail(data: {
  to: string
  superintendentName: string
  projectName: string
  lotNumber: string
  holdPointDescription: string
  originalRequestDate: string
  chaseCount: number
  daysSinceRequest: number
  evidencePackageUrl?: string
  releaseUrl: string
  requestedBy: string
}): Promise<EmailResult> {
  const subject = `[SiteProof] REMINDER: Hold Point Awaiting Release - ${data.lotNumber} (Chase #${data.chaseCount})`

  const urgencyMessage = data.daysSinceRequest > 5
    ? `<strong style="color: #dc2626;">This hold point has been awaiting release for ${data.daysSinceRequest} days.</strong>`
    : `This hold point has been awaiting release for ${data.daysSinceRequest} days.`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
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
      <h2 style="margin-top: 0;">Hi ${data.superintendentName},</h2>

      <div class="urgent">
        ${urgencyMessage}
      </div>

      <p>This is a reminder about a hold point release request on project <strong>${data.projectName}</strong> that is still awaiting your action.</p>

      <div class="message-box">
        <div class="detail-row">
          <strong>📍 Lot:</strong> ${data.lotNumber}
        </div>
        <div class="detail-row">
          <strong>🔒 Hold Point:</strong> ${data.holdPointDescription}
        </div>
        <div class="detail-row">
          <strong>📅 Originally Requested:</strong> ${data.originalRequestDate}
        </div>
        <div class="detail-row">
          <strong>👤 Requested By:</strong> ${data.requestedBy}
        </div>
      </div>

      ${data.evidencePackageUrl ? `
      <div class="highlight">
        <strong>📋 Evidence Package Available</strong><br>
        The original evidence package is still available for your review.
      </div>
      ` : ''}

      <div style="text-align: center; margin: 25px 0;">
        ${data.evidencePackageUrl ? `
        <a href="${data.evidencePackageUrl}" class="button secondary">
          View Evidence Package
        </a>
        ` : ''}
        <a href="${data.releaseUrl}" class="button">
          Review & Release Hold Point
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        Please review and release the hold point, or contact the requestor if you require additional information.
      </p>
    </div>
    <div class="footer">
      <p>This is reminder #${data.chaseCount} for this hold point release request.</p>
      <p>Project: ${data.projectName}</p>
    </div>
  </div>
</body>
</html>
  `

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

${data.evidencePackageUrl ? `
EVIDENCE PACKAGE
----------------
The original evidence package is still available for your review.
View evidence package: ${data.evidencePackageUrl}
` : ''}

ACTIONS
-------
Review & Release Hold Point: ${data.releaseUrl}

Please review and release the hold point, or contact the requestor if you require additional information.

---
This is reminder #${data.chaseCount} for this hold point release request.
Project: ${data.projectName}
  `

  // Also log to console in dev mode for easy testing
  console.log('\n========================================')
  console.log('📧 HP CHASE EMAIL (Reminder #' + data.chaseCount + ')')
  console.log('========================================')
  console.log('To:', data.to)
  console.log('Subject:', subject)
  console.log('----------------------------------------')
  console.log('Hi ' + data.superintendentName + ',')
  console.log('')
  console.log('REMINDER: Hold point awaiting release for ' + data.daysSinceRequest + ' days')
  console.log('')
  console.log('Lot:', data.lotNumber)
  console.log('Hold Point:', data.holdPointDescription)
  console.log('Originally Requested:', data.originalRequestDate)
  console.log('Requested By:', data.requestedBy)
  if (data.evidencePackageUrl) {
    console.log('')
    console.log('Evidence Package:', data.evidencePackageUrl)
  }
  console.log('')
  console.log('Release URL:', data.releaseUrl)
  console.log('========================================\n')

  return sendEmail({
    to: data.to,
    subject,
    html,
    text,
  })
}

/**
 * Digest notification item
 */
export interface DigestItem {
  type: string
  title: string
  message: string
  projectName?: string
  linkUrl?: string
  timestamp: Date
}

/**
 * Send daily digest email
 */
export async function sendDailyDigestEmail(
  to: string,
  items: DigestItem[]
): Promise<EmailResult> {
  if (items.length === 0) {
    return { success: false, error: 'No items in digest' }
  }

  const subject = `[SiteProof] Daily Digest - ${items.length} notification${items.length > 1 ? 's' : ''}`
  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Group items by project
  const itemsByProject = items.reduce((acc, item) => {
    const project = item.projectName || 'General'
    if (!acc[project]) {
      acc[project] = []
    }
    acc[project].push(item)
    return acc
  }, {} as Record<string, DigestItem[]>)

  const projectSections = Object.entries(itemsByProject).map(([project, projectItems]) => {
    const itemsHtml = projectItems.map(item => `
      <div style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
        <div style="font-weight: 500; color: #374151;">${item.title}</div>
        <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">${item.message}</div>
        ${item.linkUrl ? `
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}${item.linkUrl}"
             style="display: inline-block; margin-top: 8px; color: #2563eb; text-decoration: none; font-size: 14px;">
            View Details →
          </a>
        ` : ''}
      </div>
    `).join('')

    return `
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; padding: 8px 12px; background: #f3f4f6; border-radius: 6px; font-size: 14px; color: #374151;">
          📁 ${project}
        </h3>
        ${itemsHtml}
      </div>
    `
  }).join('')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 24px;">📬 Daily Digest</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">${today}</p>
    </div>
    <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb;">
      <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 16px;">
          You have <strong>${items.length}</strong> notification${items.length > 1 ? 's' : ''} from today.
        </p>
      </div>

      ${projectSections}

      <div style="text-align: center; margin-top: 24px;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}/dashboard"
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          View All in SiteProof
        </a>
      </div>
    </div>
    <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f3f4f6; border-radius: 0 0 8px 8px;">
      <p style="margin: 0;">This is your daily digest from SiteProof Quality Management System.</p>
      <p style="margin: 8px 0 0 0;">
        To manage your notification preferences, visit your
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}/settings" style="color: #2563eb;">Settings</a>.
      </p>
    </div>
  </div>
</body>
</html>
  `

  const itemsList = items.map(item =>
    `- ${item.title}: ${item.message}${item.linkUrl ? ` (${process.env.FRONTEND_URL || 'http://localhost:5174'}${item.linkUrl})` : ''}`
  ).join('\n')

  const text = `
Daily Digest - ${today}

You have ${items.length} notification${items.length > 1 ? 's' : ''} from today:

${itemsList}

---
View all in SiteProof: ${process.env.FRONTEND_URL || 'http://localhost:5174'}/dashboard
To manage your notification preferences, visit: ${process.env.FRONTEND_URL || 'http://localhost:5174'}/settings
  `

  return sendEmail({
    to,
    subject,
    html,
    text,
  })
}
