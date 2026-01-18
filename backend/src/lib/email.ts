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
