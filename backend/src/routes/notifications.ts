import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { sendNotificationEmail, sendDailyDigestEmail, getQueuedEmails, clearEmailQueue, DigestItem, isResendConfigured } from '../lib/email.js'
import { AppError } from '../lib/AppError.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const notificationsRouter = Router()

// Apply authentication middleware to all notification routes
notificationsRouter.use(requireAuth)

// GET /api/notifications - Get notifications for current user
notificationsRouter.get('/', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const { unreadOnly, limit = '20', offset = '0' } = req.query

  const where: any = { userId }
  if (unreadOnly === 'true') {
    where.isRead = false
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit as string),
    skip: parseInt(offset as string),
    include: {
      project: {
        select: {
          id: true,
          name: true,
          projectNumber: true,
        },
      },
    },
  })

  const unreadCount = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  })

  res.json({ notifications, unreadCount })
}))

// GET /api/notifications/unread-count - Get unread notification count
notificationsRouter.get('/unread-count', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const count = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  })

  res.json({ count })
}))

// PUT /api/notifications/:id/read - Mark notification as read
notificationsRouter.put('/:id/read', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const { id } = req.params

  const notification = await prisma.notification.findUnique({
    where: { id },
  })

  if (!notification) {
    throw AppError.notFound('Notification')
  }

  if (notification.userId !== userId) {
    throw AppError.forbidden('Access denied')
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  })

  res.json({ notification: updated })
}))

// PUT /api/notifications/read-all - Mark all notifications as read
notificationsRouter.put('/read-all', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: { isRead: true },
  })

  res.json({ success: true })
}))

// DELETE /api/notifications/:id - Delete a notification
notificationsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const { id } = req.params

  const notification = await prisma.notification.findUnique({
    where: { id },
  })

  if (!notification) {
    throw AppError.notFound('Notification')
  }

  if (notification.userId !== userId) {
    throw AppError.forbidden('Access denied')
  }

  await prisma.notification.delete({
    where: { id },
  })

  res.json({ success: true })
}))

// Helper function to create mention notifications
export async function createMentionNotifications(
  content: string,
  authorId: string,
  entityType: string,
  entityId: string,
  commentId: string,
  projectId?: string
): Promise<void> {
  // Extract @mentions from content (format: @email or @fullName)
  const mentionPattern = /@([\w.+-]+@[\w.-]+|[\w\s]+?)(?=\s|$|@)/g
  const mentions = content.match(mentionPattern)

  if (!mentions || mentions.length === 0) return

  // Get unique mention strings (remove @ prefix)
  const uniqueMentions = [...new Set(mentions.map(m => m.slice(1).trim()))]

  // Find users by email or fullName (case-insensitive for SQLite)
  for (const mention of uniqueMentions) {
    const mentionLower = mention.toLowerCase()
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: mentionLower },
          { fullName: mentionLower },
        ],
      },
    })

    if (user && user.id !== authorId) {
      // Get author info for notification
      const author = await prisma.user.findUnique({
        where: { id: authorId },
        select: { fullName: true, email: true },
      })

      const authorName = author?.fullName || author?.email || 'Someone'

      // Create notification
      await prisma.notification.create({
        data: {
          userId: user.id,
          projectId: projectId || null,
          type: 'mention',
          title: `${authorName} mentioned you in a comment`,
          message: content.length > 100 ? content.substring(0, 100) + '...' : content,
          linkUrl: `/${entityType.toLowerCase()}s/${entityId}?tab=comments&commentId=${commentId}`,
        },
      })
    }
  }
}

// GET /api/notifications/users - Get users that can be mentioned (for autocomplete)
notificationsRouter.get('/users', asyncHandler(async (req, res) => {
  const { search, projectId } = req.query

  let where: any = {}

  // If search provided, filter by email or fullName (SQLite - case-sensitive contains)
  if (search && typeof search === 'string' && search.length >= 2) {
    const searchLower = search.toLowerCase()
    where.OR = [
      { email: { contains: searchLower } },
      { fullName: { contains: searchLower } },
    ]
  }

  // If projectId provided, filter by project membership
  if (projectId) {
    where.projectUsers = {
      some: { projectId: projectId as string },
    }
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
    },
    take: 10,
    orderBy: [
      { fullName: 'asc' },
      { email: 'asc' },
    ],
  })

  res.json({ users })
}))

// Notification timing options
export type NotificationTiming = 'immediate' | 'digest'

// Default notification preferences with timing options
const DEFAULT_EMAIL_PREFERENCES = {
  enabled: true,
  mentions: true,
  mentionsTiming: 'immediate' as NotificationTiming,
  ncrAssigned: true,
  ncrAssignedTiming: 'immediate' as NotificationTiming,
  ncrStatusChange: true,
  ncrStatusChangeTiming: 'immediate' as NotificationTiming,
  holdPointReminder: true,
  holdPointReminderTiming: 'immediate' as NotificationTiming,
  holdPointRelease: true,
  holdPointReleaseTiming: 'immediate' as NotificationTiming,  // HP release - always immediate by default
  commentReply: true,
  commentReplyTiming: 'immediate' as NotificationTiming,
  scheduledReports: true,
  scheduledReportsTiming: 'immediate' as NotificationTiming,
  dailyDigest: false, // Master toggle for daily digest feature
  diaryReminder: true, // Feature #934: Daily diary reminder notification
  diaryReminderTiming: 'immediate' as NotificationTiming,
}

// In-memory storage for digest items (in production, store in database)
const digestQueue: Map<string, DigestItem[]> = new Map()

// In-memory storage for email preferences (in production, store in database)
const userEmailPreferences: Map<string, typeof DEFAULT_EMAIL_PREFERENCES> = new Map()

// GET /api/notifications/email-preferences - Get email notification preferences
notificationsRouter.get('/email-preferences', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const preferences = userEmailPreferences.get(userId) || DEFAULT_EMAIL_PREFERENCES

  res.json({ preferences })
}))

// Helper to validate timing preference
function validateTiming(value: any, defaultValue: NotificationTiming): NotificationTiming {
  if (value === 'immediate' || value === 'digest') {
    return value
  }
  return defaultValue
}

// PUT /api/notifications/email-preferences - Update email notification preferences
notificationsRouter.put('/email-preferences', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const { preferences } = req.body

  // Validate preferences with timing options
  const validatedPreferences = {
    enabled: Boolean(preferences?.enabled ?? DEFAULT_EMAIL_PREFERENCES.enabled),
    mentions: Boolean(preferences?.mentions ?? DEFAULT_EMAIL_PREFERENCES.mentions),
    mentionsTiming: validateTiming(preferences?.mentionsTiming, DEFAULT_EMAIL_PREFERENCES.mentionsTiming),
    ncrAssigned: Boolean(preferences?.ncrAssigned ?? DEFAULT_EMAIL_PREFERENCES.ncrAssigned),
    ncrAssignedTiming: validateTiming(preferences?.ncrAssignedTiming, DEFAULT_EMAIL_PREFERENCES.ncrAssignedTiming),
    ncrStatusChange: Boolean(preferences?.ncrStatusChange ?? DEFAULT_EMAIL_PREFERENCES.ncrStatusChange),
    ncrStatusChangeTiming: validateTiming(preferences?.ncrStatusChangeTiming, DEFAULT_EMAIL_PREFERENCES.ncrStatusChangeTiming),
    holdPointReminder: Boolean(preferences?.holdPointReminder ?? DEFAULT_EMAIL_PREFERENCES.holdPointReminder),
    holdPointReminderTiming: validateTiming(preferences?.holdPointReminderTiming, DEFAULT_EMAIL_PREFERENCES.holdPointReminderTiming),
    holdPointRelease: Boolean(preferences?.holdPointRelease ?? DEFAULT_EMAIL_PREFERENCES.holdPointRelease),
    holdPointReleaseTiming: validateTiming(preferences?.holdPointReleaseTiming, DEFAULT_EMAIL_PREFERENCES.holdPointReleaseTiming),
    commentReply: Boolean(preferences?.commentReply ?? DEFAULT_EMAIL_PREFERENCES.commentReply),
    commentReplyTiming: validateTiming(preferences?.commentReplyTiming, DEFAULT_EMAIL_PREFERENCES.commentReplyTiming),
    scheduledReports: Boolean(preferences?.scheduledReports ?? DEFAULT_EMAIL_PREFERENCES.scheduledReports),
    scheduledReportsTiming: validateTiming(preferences?.scheduledReportsTiming, DEFAULT_EMAIL_PREFERENCES.scheduledReportsTiming),
    dailyDigest: Boolean(preferences?.dailyDigest ?? DEFAULT_EMAIL_PREFERENCES.dailyDigest),
    diaryReminder: Boolean(preferences?.diaryReminder ?? DEFAULT_EMAIL_PREFERENCES.diaryReminder),
    diaryReminderTiming: validateTiming(preferences?.diaryReminderTiming, DEFAULT_EMAIL_PREFERENCES.diaryReminderTiming),
  }

  userEmailPreferences.set(userId, validatedPreferences)

  res.json({ preferences: validatedPreferences, message: 'Email preferences updated' })
}))

// POST /api/notifications/send-test-email - Send a test email notification
notificationsRouter.post('/send-test-email', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, fullName: true },
  })

  if (!user) {
    throw AppError.notFound('User')
  }

  // Check email preferences
  const preferences = userEmailPreferences.get(userId) || DEFAULT_EMAIL_PREFERENCES
  if (!preferences.enabled) {
    throw AppError.badRequest('Email notifications are disabled. Enable them first in your preferences.')
  }

  // Send test email
  const result = await sendNotificationEmail(
    user.email,
    'test',
    {
      title: 'Test Notification',
      message: 'This is a test email notification from SiteProof. If you received this email, your email notifications are configured correctly!',
      userName: user.fullName || 'SiteProof System',
      linkUrl: '/settings',
    }
  )

  if (result.success) {
    res.json({
      success: true,
      message: result.provider === 'resend'
        ? 'Test email sent successfully via Resend API'
        : 'Test email logged to console (Resend API not configured)',
      messageId: result.messageId,
      sentTo: user.email,
      provider: result.provider || 'mock',
    })
  } else {
    throw AppError.internal('Failed to send test email')
  }
}))

// GET /api/notifications/email-service-status - Get email service configuration status
notificationsRouter.get('/email-service-status', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const resendConfigured = isResendConfigured()

  res.json({
    provider: resendConfigured ? 'resend' : 'mock',
    resendConfigured,
    emailEnabled: process.env.EMAIL_ENABLED !== 'false',
    status: resendConfigured ? 'production' : 'development',
    message: resendConfigured
      ? 'Resend API is configured and emails will be delivered to real recipients.'
      : 'Resend API not configured. Emails are logged to console only. Set RESEND_API_KEY in .env for production email delivery.',
  })
}))

// GET /api/notifications/email-queue - Get queued emails (for testing/debugging)
notificationsRouter.get('/email-queue', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    throw AppError.forbidden('Not available in production')
  }

  const queue = getQueuedEmails()
  res.json({ emails: queue, count: queue.length })
}))

// DELETE /api/notifications/email-queue - Clear email queue (for testing/debugging)
notificationsRouter.delete('/email-queue', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    throw AppError.forbidden('Not available in production')
  }

  clearEmailQueue()
  res.json({ success: true, message: 'Email queue cleared' })
}))

// Type for notification types that support timing
type NotificationTypeWithTiming = 'mentions' | 'ncrAssigned' | 'ncrStatusChange' | 'holdPointReminder' | 'holdPointRelease' | 'commentReply' | 'scheduledReports'

// Helper function to send notification email if user preferences allow
// Returns: { sent: boolean, queued: boolean } - sent means immediate, queued means added to digest
export async function sendNotificationIfEnabled(
  userId: string,
  notificationType: NotificationTypeWithTiming | 'enabled',
  data: {
    title: string
    message: string
    linkUrl?: string
    projectName?: string
    userName?: string
  }
): Promise<{ sent: boolean; queued: boolean }> {
  const preferences = userEmailPreferences.get(userId) || DEFAULT_EMAIL_PREFERENCES

  // Check if email notifications are enabled
  if (!preferences.enabled) {
    return { sent: false, queued: false }
  }

  // Check if specific notification type is enabled
  if (notificationType !== 'enabled' && !preferences[notificationType]) {
    return { sent: false, queued: false }
  }

  // Get user email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })

  if (!user) {
    return { sent: false, queued: false }
  }

  // Check timing preference for this notification type
  const timingKey = `${notificationType}Timing` as keyof typeof preferences
  const timing = (notificationType !== 'enabled' && timingKey in preferences)
    ? preferences[timingKey] as NotificationTiming
    : 'immediate'

  if (timing === 'digest') {
    // Add to digest queue instead of sending immediately
    const digestItem: DigestItem = {
      type: notificationType,
      title: data.title,
      message: data.message,
      projectName: data.projectName,
      linkUrl: data.linkUrl,
      timestamp: new Date(),
    }

    const userDigest = digestQueue.get(userId) || []
    userDigest.push(digestItem)
    digestQueue.set(userId, userDigest)

    return { sent: false, queued: true }
  }

  // Send the email immediately
  const result = await sendNotificationEmail(user.email, notificationType, data)
  return { sent: result.success, queued: false }
}

// Helper function to get notification timing for a specific type
export function getNotificationTiming(userId: string, notificationType: NotificationTypeWithTiming): NotificationTiming {
  const preferences = userEmailPreferences.get(userId) || DEFAULT_EMAIL_PREFERENCES
  const timingKey = `${notificationType}Timing` as keyof typeof preferences
  return (timingKey in preferences) ? preferences[timingKey] as NotificationTiming : 'immediate'
}

// Helper function to get digest queue for a user
export function getUserDigestQueue(userId: string): DigestItem[] {
  return digestQueue.get(userId) || []
}

// POST /api/notifications/add-to-digest - Add item to digest queue
notificationsRouter.post('/add-to-digest', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const { type, title, message, projectName, linkUrl } = req.body

  if (!type || !title || !message) {
    throw AppError.badRequest('type, title, and message are required')
  }

  const digestItem: DigestItem = {
    type,
    title,
    message,
    projectName,
    linkUrl,
    timestamp: new Date(),
  }

  // Add to user's digest queue
  const userDigest = digestQueue.get(userId) || []
  userDigest.push(digestItem)
  digestQueue.set(userId, userDigest)

  res.json({
    success: true,
    message: 'Item added to digest',
    queuedItems: userDigest.length,
  })
}))

// POST /api/notifications/send-digest - Send daily digest email
notificationsRouter.post('/send-digest', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, fullName: true },
  })

  if (!user) {
    throw AppError.notFound('User')
  }

  // Check email preferences
  const preferences = userEmailPreferences.get(userId) || DEFAULT_EMAIL_PREFERENCES
  if (!preferences.enabled) {
    throw AppError.badRequest('Email notifications are disabled')
  }

  // Get digest items
  const items = digestQueue.get(userId) || []

  if (items.length === 0) {
    throw AppError.badRequest('No items in digest queue')
  }

  // Send digest email
  const result = await sendDailyDigestEmail(user.email, items)

  if (result.success) {
    // Clear the digest queue after sending
    digestQueue.delete(userId)

    res.json({
      success: true,
      message: 'Daily digest sent successfully',
      messageId: result.messageId,
      sentTo: user.email,
      itemCount: items.length,
    })
  } else {
    throw AppError.internal('Failed to send digest')
  }
}))

// GET /api/notifications/digest-queue - Get current digest queue
notificationsRouter.get('/digest-queue', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const items = digestQueue.get(userId) || []

  res.json({
    items,
    count: items.length,
  })
}))

// DELETE /api/notifications/digest-queue - Clear digest queue
notificationsRouter.delete('/digest-queue', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  digestQueue.delete(userId)

  res.json({ success: true, message: 'Digest queue cleared' })
}))

// ============================================================================
// ALERT ESCALATION SYSTEM
// ============================================================================

// Alert types that can be escalated
export type AlertType = 'overdue_ncr' | 'stale_hold_point' | 'pending_approval' | 'overdue_test'

// Alert severity levels
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

// Alert interface
export interface Alert {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  entityId: string  // ID of the related entity (NCR, hold point, etc.)
  entityType: string
  projectId?: string
  assignedTo: string  // User ID who should resolve this
  createdAt: Date
  resolvedAt?: Date
  escalatedAt?: Date
  escalationLevel: number  // 0 = not escalated, 1 = first escalation, 2 = second, etc.
  escalatedTo?: string[]  // User IDs of escalation recipients
}

// Escalation configuration (in hours)
const ESCALATION_CONFIG = {
  overdue_ncr: {
    firstEscalationAfterHours: 24,      // Escalate after 24 hours
    secondEscalationAfterHours: 48,     // Second escalation after 48 hours
    escalationRoles: ['project_manager', 'quality_manager', 'admin'],
  },
  stale_hold_point: {
    firstEscalationAfterHours: 4,       // Escalate after 4 hours (critical workflow)
    secondEscalationAfterHours: 8,      // Second escalation after 8 hours
    escalationRoles: ['superintendent', 'project_manager', 'admin'],
  },
  pending_approval: {
    firstEscalationAfterHours: 8,       // Escalate after 8 hours
    secondEscalationAfterHours: 24,     // Second escalation after 24 hours
    escalationRoles: ['project_manager', 'admin'],
  },
  overdue_test: {
    firstEscalationAfterHours: 48,      // Escalate after 48 hours
    secondEscalationAfterHours: 96,     // Second escalation after 96 hours
    escalationRoles: ['quality_manager', 'project_manager'],
  },
}

// In-memory alert store (in production, store in database)
const alertStore: Map<string, Alert> = new Map()

// Generate unique alert ID
function generateAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// POST /api/notifications/alerts - Create a new alert
notificationsRouter.post('/alerts', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const { type, severity, title, message, entityId, entityType, projectId, assignedTo } = req.body

  if (!type || !title || !message || !entityId || !entityType || !assignedTo) {
    throw AppError.badRequest('Missing required fields: type, title, message, entityId, entityType, assignedTo')
  }

  const alert: Alert = {
    id: generateAlertId(),
    type: type as AlertType,
    severity: severity || 'medium',
    title,
    message,
    entityId,
    entityType,
    projectId,
    assignedTo,
    createdAt: new Date(),
    escalationLevel: 0,
  }

  alertStore.set(alert.id, alert)

  // Create in-app notification for assigned user
  await prisma.notification.create({
    data: {
      userId: assignedTo,
      projectId: projectId || null,
      type: `alert_${type}`,
      title,
      message,
      linkUrl: `/${entityType}s/${entityId}`,
    },
  })

  res.json({
    success: true,
    alert,
    message: 'Alert created successfully',
  })
}))

// GET /api/notifications/alerts - Get all active alerts
notificationsRouter.get('/alerts', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const { status, type, assignedTo } = req.query

  let alerts = Array.from(alertStore.values())

  // Filter by status
  if (status === 'active') {
    alerts = alerts.filter(a => !a.resolvedAt)
  } else if (status === 'resolved') {
    alerts = alerts.filter(a => !!a.resolvedAt)
  } else if (status === 'escalated') {
    alerts = alerts.filter(a => a.escalationLevel > 0 && !a.resolvedAt)
  }

  // Filter by type
  if (type) {
    alerts = alerts.filter(a => a.type === type)
  }

  // Filter by assigned user
  if (assignedTo) {
    alerts = alerts.filter(a => a.assignedTo === assignedTo || a.escalatedTo?.includes(assignedTo as string))
  }

  // Sort by creation date (newest first)
  alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  res.json({
    alerts,
    count: alerts.length,
  })
}))

// PUT /api/notifications/alerts/:id/resolve - Resolve an alert
notificationsRouter.put('/alerts/:id/resolve', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const { id } = req.params
  const alert = alertStore.get(id)

  if (!alert) {
    throw AppError.notFound('Alert')
  }

  if (alert.resolvedAt) {
    throw AppError.badRequest('Alert is already resolved')
  }

  alert.resolvedAt = new Date()
  alertStore.set(id, alert)

  res.json({
    success: true,
    alert,
    message: 'Alert resolved successfully',
  })
}))

// POST /api/notifications/alerts/check-escalations - Check and process escalations
// This would typically be called by a cron job or scheduled task
notificationsRouter.post('/alerts/check-escalations', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const now = new Date()
  const escalatedAlerts: Alert[] = []

  for (const [id, alert] of alertStore.entries()) {
    // Skip resolved alerts
    if (alert.resolvedAt) continue

    const config = ESCALATION_CONFIG[alert.type]
    if (!config) continue

    const hoursSinceCreation = (now.getTime() - new Date(alert.createdAt).getTime()) / (1000 * 60 * 60)

    // Check if we need to escalate
    let shouldEscalate = false
    let newLevel = alert.escalationLevel

    if (alert.escalationLevel === 0 && hoursSinceCreation >= config.firstEscalationAfterHours) {
      shouldEscalate = true
      newLevel = 1
    } else if (alert.escalationLevel === 1 && hoursSinceCreation >= config.secondEscalationAfterHours) {
      shouldEscalate = true
      newLevel = 2
    }

    if (shouldEscalate) {
      // Find users to escalate to based on roles in project
      const escalationUsers = alert.projectId
        ? await prisma.user.findMany({
            where: {
              projectUsers: {
                some: {
                  projectId: alert.projectId,
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
        : []

      const escalatedToIds = escalationUsers.map(u => u.id)

      // Update alert
      alert.escalationLevel = newLevel
      alert.escalatedAt = now
      alert.escalatedTo = escalatedToIds
      alertStore.set(id, alert)

      // Create notifications for escalation recipients
      for (const user of escalationUsers) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            projectId: alert.projectId || null,
            type: 'alert_escalation',
            title: `ESCALATED: ${alert.title}`,
            message: `Alert has been escalated (Level ${newLevel}): ${alert.message}`,
            linkUrl: `/${alert.entityType}s/${alert.entityId}`,
          },
        })

        // Send email notification for escalation (always immediate for escalations)
        await sendNotificationIfEnabled(user.id, 'ncrAssigned', {
          title: `ESCALATED ALERT: ${alert.title}`,
          message: `This alert has been escalated to you because it was not resolved within ${newLevel === 1 ? config.firstEscalationAfterHours : config.secondEscalationAfterHours} hours.\n\n${alert.message}`,
          linkUrl: `/${alert.entityType}s/${alert.entityId}`,
        })
      }

      escalatedAlerts.push(alert)
    }
  }

  res.json({
    success: true,
    message: `Escalation check complete. ${escalatedAlerts.length} alerts escalated.`,
    escalatedAlerts,
    totalActiveAlerts: Array.from(alertStore.values()).filter(a => !a.resolvedAt).length,
  })
}))

// GET /api/notifications/alerts/escalation-config - Get escalation configuration
notificationsRouter.get('/alerts/escalation-config', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  res.json({
    config: ESCALATION_CONFIG,
  })
}))

// POST /api/notifications/alerts/:id/test-escalate - Force escalate an alert (for testing)
// This simulates time passing and triggers escalation
notificationsRouter.post('/alerts/:id/test-escalate', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    throw AppError.forbidden('Not available in production')
  }

  const { id } = req.params
  const alert = alertStore.get(id)

  if (!alert) {
    throw AppError.notFound('Alert')
  }

  if (alert.resolvedAt) {
    throw AppError.badRequest('Alert is already resolved')
  }

  const config = ESCALATION_CONFIG[alert.type]
  if (!config) {
    throw AppError.badRequest('Unknown alert type')
  }

  // Determine the next escalation level
  const newLevel = alert.escalationLevel + 1
  if (newLevel > 2) {
    throw AppError.badRequest('Alert is already at maximum escalation level')
  }

  // Find users to escalate to based on roles in project
  const escalationUsers = alert.projectId
    ? await prisma.user.findMany({
        where: {
          projectUsers: {
            some: {
              projectId: alert.projectId,
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
    : []

  const escalatedToIds = escalationUsers.map(u => u.id)

  // Update alert
  alert.escalationLevel = newLevel
  alert.escalatedAt = new Date()
  alert.escalatedTo = escalatedToIds
  alertStore.set(id, alert)

  // Create notifications for escalation recipients
  for (const user of escalationUsers) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        projectId: alert.projectId || null,
        type: 'alert_escalation',
        title: `ESCALATED: ${alert.title}`,
        message: `Alert has been escalated (Level ${newLevel}): ${alert.message}`,
        linkUrl: `/${alert.entityType}s/${alert.entityId}`,
      },
    })

  }

  res.json({
    success: true,
    alert,
    escalatedTo: escalationUsers.map(u => ({ id: u.id, email: u.email, roleInCompany: u.roleInCompany })),
    message: `Alert escalated to level ${newLevel}. Notified ${escalationUsers.length} users.`,
  })
}))

// ============================================================================
// Feature #934: Daily Diary Reminder Notification
// ============================================================================

// POST /api/notifications/diary-reminder/check - Check for missing diaries and send reminders
// This would typically be called by a cron job at end of day (e.g., 5pm local time)
notificationsRouter.post('/diary-reminder/check', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  // Get today's date (or allow override for testing)
  const { date: dateOverride, projectId: specificProjectId } = req.body
  const targetDate = dateOverride ? new Date(dateOverride) : new Date()
  targetDate.setHours(0, 0, 0, 0)
  const dateString = targetDate.toISOString().split('T')[0]

  // Get all active projects
  const projectQuery: any = { status: 'active' }
  if (specificProjectId) {
    projectQuery.id = specificProjectId
  }

  const projects = await prisma.project.findMany({
    where: projectQuery,
    select: { id: true, name: true }
  })

  const remindersCreated: any[] = []
  const usersNotified = new Set<string>()

  for (const project of projects) {
    // Check if a diary exists for this project on the target date
    const existingDiary = await prisma.dailyDiary.findFirst({
      where: {
        projectId: project.id,
        date: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    })

    if (existingDiary) {
      // Diary exists, no reminder needed
      continue
    }

    // No diary - find users who should be reminded (site engineers and foremen)
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: project.id,
        role: { in: ['site_engineer', 'foreman', 'project_manager'] },
        status: { in: ['active', 'accepted'] }
      }
    })

    const userIds = projectUsers.map(pu => pu.userId)
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, fullName: true }
        })
      : []

    // Create reminder notifications
    const notificationsToCreate = users.map(user => ({
      userId: user.id,
      projectId: project.id,
      type: 'diary_reminder',
      title: 'Daily Diary Reminder',
      message: `No daily diary entry found for ${project.name} on ${dateString}. Please complete your site diary.`,
      linkUrl: `/projects/${project.id}/diary`
    }))

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate
      })

      for (const user of users) {
        usersNotified.add(user.id)

        // Send email notification
        await sendNotificationIfEnabled(
          user.id,
          'mentions', // Using mentions as closest notification type
          {
            title: 'Daily Diary Reminder',
            message: `No daily diary entry found for ${project.name} on ${dateString}. Please complete your site diary.`,
            projectName: project.name,
            linkUrl: `/projects/${project.id}/diary`,
          }
        )
      }

      remindersCreated.push({
        projectId: project.id,
        projectName: project.name,
        date: dateString,
        usersNotified: users.map(u => u.email)
      })
    }
  }

  res.json({
    success: true,
    date: dateString,
    projectsChecked: projects.length,
    remindersCreated: remindersCreated.length,
    uniqueUsersNotified: usersNotified.size,
    details: remindersCreated
  })
}))

// POST /api/notifications/diary-reminder/send - Manually send a diary reminder for a specific project
notificationsRouter.post('/diary-reminder/send', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const { projectId, date } = req.body

  if (!projectId) {
    throw AppError.badRequest('projectId is required')
  }

  const targetDate = date ? new Date(date) : new Date()
  targetDate.setHours(0, 0, 0, 0)
  const dateString = targetDate.toISOString().split('T')[0]

  // Get project info
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true }
  })

  if (!project) {
    throw AppError.notFound('Project')
  }

  // Get users to notify
  const projectUsers = await prisma.projectUser.findMany({
    where: {
      projectId,
      role: { in: ['site_engineer', 'foreman', 'project_manager'] },
      status: { in: ['active', 'accepted'] }
    }
  })

  const userIds = projectUsers.map(pu => pu.userId)
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, fullName: true }
      })
    : []

  // Create notifications
  const notificationsToCreate = users.map(user => ({
    userId: user.id,
    projectId: project.id,
    type: 'diary_reminder',
    title: 'Daily Diary Reminder',
    message: `Reminder: Please complete the daily diary for ${project.name} on ${dateString}.`,
    linkUrl: `/projects/${project.id}/diary`
  }))

  if (notificationsToCreate.length > 0) {
    await prisma.notification.createMany({
      data: notificationsToCreate
    })

    // Send email notifications
    for (const user of users) {
      await sendNotificationIfEnabled(
        user.id,
        'mentions', // Using mentions as closest notification type
        {
          title: 'Daily Diary Reminder',
          message: `Reminder: Please complete the daily diary for ${project.name} on ${dateString}.`,
          projectName: project.name,
          linkUrl: `/projects/${project.id}/diary`,
        }
      )
    }
  }

  res.json({
    success: true,
    projectId: project.id,
    projectName: project.name,
    date: dateString,
    usersNotified: users.map(u => ({ id: u.id, email: u.email })),
    notificationCount: notificationsToCreate.length
  })
}))

// POST /api/notifications/diary-reminder/check-alerts - Check for diaries missing 24+ hours and generate alerts (Feature #937)
// This is an escalation - generates alerts (higher severity) for diaries missing more than 24 hours
notificationsRouter.post('/diary-reminder/check-alerts', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  // Check for diaries missing from yesterday or earlier
  const { projectId: specificProjectId } = req.body
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const yesterdayString = yesterday.toISOString().split('T')[0]

  // Get all active projects
  const projectQuery: any = { status: 'active' }
  if (specificProjectId) {
    projectQuery.id = specificProjectId
  }

  const projects = await prisma.project.findMany({
    where: projectQuery,
    select: { id: true, name: true }
  })

  const alertsCreated: any[] = []
  const usersNotified = new Set<string>()

  for (const project of projects) {
    // Check if a diary exists for yesterday
    const existingDiary = await prisma.dailyDiary.findFirst({
      where: {
        projectId: project.id,
        date: {
          gte: yesterday,
          lt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    })

    if (existingDiary) {
      // Diary exists, no alert needed
      continue
    }

    // Check if we already sent an alert for this date
    const existingAlert = await prisma.notification.findFirst({
      where: {
        projectId: project.id,
        type: 'diary_missing_alert',
        message: { contains: yesterdayString }
      }
    })

    if (existingAlert) {
      // Alert already sent for this date
      continue
    }

    // No diary and no previous alert - find users to alert (escalate to project managers and admins)
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: project.id,
        role: { in: ['project_manager', 'admin', 'owner'] },
        status: { in: ['active', 'accepted'] }
      }
    })

    const userIds = projectUsers.map(pu => pu.userId)
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, fullName: true }
        })
      : []

    // Create alert notifications (higher severity than reminders)
    const alertsToCreate = users.map(user => ({
      userId: user.id,
      projectId: project.id,
      type: 'diary_missing_alert',
      title: 'Missing Diary Alert',
      message: `ALERT: No daily diary entry was completed for ${project.name} on ${yesterdayString}. This is more than 24 hours overdue.`,
      linkUrl: `/projects/${project.id}/diary`
    }))

    if (alertsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: alertsToCreate
      })

      for (const user of users) {
        usersNotified.add(user.id)

        // Send email notification for alerts (always immediate for escalations)
        await sendNotificationIfEnabled(
          user.id,
          'ncrAssigned', // Using ncrAssigned for urgent alerts
          {
            title: 'Missing Diary Alert',
            message: `ALERT: No daily diary entry was completed for ${project.name} on ${yesterdayString}. This is more than 24 hours overdue.`,
            projectName: project.name,
            linkUrl: `/projects/${project.id}/diary`,
          }
        )
      }

      alertsCreated.push({
        projectId: project.id,
        projectName: project.name,
        missingDate: yesterdayString,
        usersNotified: users.map(u => u.email)
      })
    }
  }

  res.json({
    success: true,
    missingDate: yesterdayString,
    projectsChecked: projects.length,
    alertsCreated: alertsCreated.length,
    uniqueUsersNotified: usersNotified.size,
    details: alertsCreated
  })
}))

// ============================================================================
// Feature #938: Docket Backlog Alert Notification
// ============================================================================

// POST /api/notifications/docket-backlog/check - Check for dockets pending >48 hours and alert foreman/PM
notificationsRouter.post('/docket-backlog/check', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const { projectId: specificProjectId } = req.body

  // Calculate 48 hours ago
  const cutoffTime = new Date()
  cutoffTime.setHours(cutoffTime.getHours() - 48)

  // Get all dockets that have been pending_approval for more than 48 hours
  const whereClause: any = {
    status: 'pending_approval',
    submittedAt: {
      lt: cutoffTime
    }
  }

  if (specificProjectId) {
    whereClause.projectId = specificProjectId
  }

  const overdueDockers = await prisma.dailyDocket.findMany({
    where: whereClause,
  })

  const alertsCreated: any[] = []
  const usersNotified = new Set<string>()

  // Group dockets by project for efficient notification
  const docketsByProject = new Map<string, typeof overdueDockers>()
  for (const docket of overdueDockers) {
    const projectDockets = docketsByProject.get(docket.projectId) || []
    projectDockets.push(docket)
    docketsByProject.set(docket.projectId, projectDockets)
  }

  for (const [projectId, dockets] of docketsByProject.entries()) {
    // Get project info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true }
    })

    if (!project) continue

    // Check if we already sent an alert for these specific dockets today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const existingAlert = await prisma.notification.findFirst({
      where: {
        projectId,
        type: 'docket_backlog_alert',
        createdAt: { gte: today }
      }
    })

    if (existingAlert) {
      // Already sent an alert today for this project
      continue
    }

    // Get foremen and project managers to alert
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId,
        role: { in: ['foreman', 'project_manager', 'admin'] },
        status: { in: ['active', 'accepted'] }
      }
    })

    const userIds = projectUsers.map(pu => pu.userId)
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, fullName: true }
        })
      : []

    // Format docket list for notification
    const docketCount = dockets.length
    const docketIds = dockets.slice(0, 3).map(d => d.id.substring(0, 8)).join(', ')
    const moreText = docketCount > 3 ? ` and ${docketCount - 3} more` : ''

    // Create alert notifications
    const alertsToCreate = users.map(user => ({
      userId: user.id,
      projectId,
      type: 'docket_backlog_alert',
      title: 'Docket Backlog Alert',
      message: `${docketCount} docket(s) have been pending approval for more than 48 hours on ${project.name}: ${docketIds}${moreText}. Please review.`,
      linkUrl: `/projects/${projectId}/dockets`
    }))

    if (alertsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: alertsToCreate
      })

      for (const user of users) {
        usersNotified.add(user.id)

        // Send email notification
        await sendNotificationIfEnabled(
          user.id,
          'holdPointReminder', // Using existing type for backlog alerts
          {
            title: 'Docket Backlog Alert',
            message: `${docketCount} docket(s) have been pending approval for more than 48 hours on ${project.name}. Please review.`,
            projectName: project.name,
            linkUrl: `/projects/${projectId}/dockets`,
          }
        )
      }

      alertsCreated.push({
        projectId,
        projectName: project.name,
        docketCount,
        docketIds: dockets.map(d => d.id),
        usersNotified: users.map(u => u.email)
      })
    }
  }

  res.json({
    success: true,
    cutoffTime: cutoffTime.toISOString(),
    totalOverdueDockets: overdueDockers.length,
    projectsWithBacklog: docketsByProject.size,
    alertsCreated: alertsCreated.length,
    uniqueUsersNotified: usersNotified.size,
    details: alertsCreated
  })
}))

// ============================================================================
// Feature #303: System Alerts for Critical Issues
// ============================================================================

// POST /api/notifications/system-alerts/check - Check and generate system alerts for critical issues
// This is the main endpoint that checks for all critical issues and creates appropriate alerts
// It should be called periodically (e.g., every hour) by a scheduled task or cron job
notificationsRouter.post('/system-alerts/check', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const { projectId: specificProjectId } = req.body
  const now = new Date()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const alertsGenerated: any[] = []

  // Get projects to check
  const projectQuery: any = { status: 'active' }
  if (specificProjectId) {
    projectQuery.id = specificProjectId
  }

  const projects = await prisma.project.findMany({
    where: projectQuery,
    select: { id: true, name: true }
  })

  for (const project of projects) {
    // ==========================================
    // 1. CHECK FOR OVERDUE NCRs
    // ==========================================
    const overdueNCRs = await prisma.nCR.findMany({
      where: {
        projectId: project.id,
        status: { notIn: ['closed', 'closed_concession'] },
        dueDate: { lt: now }
      },
      select: { id: true, ncrNumber: true, description: true, dueDate: true, responsibleUserId: true }
    })

    for (const ncr of overdueNCRs) {
      // Check if an alert already exists for this NCR (avoid duplicates)
      const existingAlert = Array.from(alertStore.values()).find(
        a => a.entityId === ncr.id && a.type === 'overdue_ncr' && !a.resolvedAt
      )

      if (!existingAlert) {
        const daysOverdue = ncr.dueDate
          ? Math.ceil((now.getTime() - new Date(ncr.dueDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0

        const severity: AlertSeverity = daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'high' : 'medium'

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
        }

        alertStore.set(alert.id, alert)

        // Create in-app notification
        if (ncr.responsibleUserId) {
          await prisma.notification.create({
            data: {
              userId: ncr.responsibleUserId,
              projectId: project.id,
              type: 'alert_overdue_ncr',
              title: alert.title,
              message: alert.message,
              linkUrl: `/ncrs/${ncr.id}`,
            },
          })
        }

        alertsGenerated.push({
          type: 'overdue_ncr',
          alertId: alert.id,
          entityId: ncr.id,
          projectName: project.name,
          severity,
          message: alert.title
        })

      }
    }

    // ==========================================
    // 2. CHECK FOR STALE HOLD POINTS
    // ==========================================
    // Stale = requested/scheduled but not released within 24 hours
    const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago

    const staleHoldPoints = await prisma.holdPoint.findMany({
      where: {
        lot: { projectId: project.id },
        status: { in: ['requested', 'scheduled'] },
        scheduledDate: { lt: staleThreshold }
      },
      include: {
        lot: { select: { id: true, lotNumber: true } },
        itpChecklistItem: { select: { id: true, description: true } }
      }
    })

    for (const hp of staleHoldPoints) {
      const existingAlert = Array.from(alertStore.values()).find(
        a => a.entityId === hp.id && a.type === 'stale_hold_point' && !a.resolvedAt
      )

      if (!existingAlert) {
        const hoursStale = hp.scheduledDate
          ? Math.ceil((now.getTime() - new Date(hp.scheduledDate).getTime()) / (1000 * 60 * 60))
          : 0

        const severity: AlertSeverity = hoursStale > 48 ? 'critical' : hoursStale > 24 ? 'high' : 'medium'

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
        }

        alertStore.set(alert.id, alert)

        // Notify project managers and superintendents
        const pmUsers = await prisma.projectUser.findMany({
          where: {
            projectId: project.id,
            role: { in: ['project_manager', 'superintendent', 'quality_manager'] },
            status: { in: ['active', 'accepted'] }
          },
          select: { userId: true }
        })

        for (const pu of pmUsers) {
          await prisma.notification.create({
            data: {
              userId: pu.userId,
              projectId: project.id,
              type: 'alert_stale_hold_point',
              title: alert.title,
              message: alert.message,
              linkUrl: `/lots/${hp.lot.id}?tab=holdpoints`,
            },
          })
        }

        alertsGenerated.push({
          type: 'stale_hold_point',
          alertId: alert.id,
          entityId: hp.id,
          projectName: project.name,
          severity,
          message: alert.title
        })

      }
    }

    // ==========================================
    // 3. CHECK FOR MISSED DIARY SUBMISSIONS
    // ==========================================
    // Check if yesterday's diary is missing
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayEnd = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000)

    const existingDiary = await prisma.dailyDiary.findFirst({
      where: {
        projectId: project.id,
        date: { gte: yesterday, lt: yesterdayEnd }
      }
    })

    if (!existingDiary) {
      // Check if we already created an alert for this
      const existingMissingAlert = Array.from(alertStore.values()).find(
        a => a.type === 'pending_approval' &&
             a.entityType === 'diary' &&
             a.projectId === project.id &&
             a.message.includes(yesterday.toISOString().split('T')[0]) &&
             !a.resolvedAt
      )

      if (!existingMissingAlert) {
        const dateString = yesterday.toISOString().split('T')[0]

        const alert: Alert = {
          id: generateAlertId(),
          type: 'pending_approval', // Using pending_approval for missing diary
          severity: 'high',
          title: `Missing Daily Diary: ${project.name}`,
          message: `No daily diary was submitted for ${project.name} on ${dateString}. This affects project records and compliance.`,
          entityId: `diary-${project.id}-${dateString}`,
          entityType: 'diary',
          projectId: project.id,
          assignedTo: userId,
          createdAt: now,
          escalationLevel: 0,
        }

        alertStore.set(alert.id, alert)

        // Notify site engineers, foremen, and project managers
        const diaryUsers = await prisma.projectUser.findMany({
          where: {
            projectId: project.id,
            role: { in: ['site_engineer', 'foreman', 'project_manager'] },
            status: { in: ['active', 'accepted'] }
          },
          select: { userId: true }
        })

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
          })
        }

        alertsGenerated.push({
          type: 'missing_diary',
          alertId: alert.id,
          projectName: project.name,
          severity: 'high',
          message: alert.title
        })

      }
    }
  }

  // Summary
  const summary = {
    overdueNCRs: alertsGenerated.filter(a => a.type === 'overdue_ncr').length,
    staleHoldPoints: alertsGenerated.filter(a => a.type === 'stale_hold_point').length,
    missingDiaries: alertsGenerated.filter(a => a.type === 'missing_diary').length,
  }

  res.json({
    success: true,
    timestamp: now.toISOString(),
    projectsChecked: projects.length,
    alertsGenerated: alertsGenerated.length,
    summary,
    alerts: alertsGenerated,
    activeAlerts: Array.from(alertStore.values()).filter(a => !a.resolvedAt).length
  })
}))

// GET /api/notifications/system-alerts/summary - Get summary of all active system alerts
notificationsRouter.get('/system-alerts/summary', asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    throw AppError.unauthorized()
  }

  const { projectId } = req.query

  let activeAlerts = Array.from(alertStore.values()).filter(a => !a.resolvedAt)

  if (projectId) {
    activeAlerts = activeAlerts.filter(a => a.projectId === projectId)
  }

  const bySeverity = {
    critical: activeAlerts.filter(a => a.severity === 'critical').length,
    high: activeAlerts.filter(a => a.severity === 'high').length,
    medium: activeAlerts.filter(a => a.severity === 'medium').length,
    low: activeAlerts.filter(a => a.severity === 'low').length,
  }

  const byType = {
    overdue_ncr: activeAlerts.filter(a => a.type === 'overdue_ncr').length,
    stale_hold_point: activeAlerts.filter(a => a.type === 'stale_hold_point').length,
    pending_approval: activeAlerts.filter(a => a.type === 'pending_approval').length,
    overdue_test: activeAlerts.filter(a => a.type === 'overdue_test').length,
  }

  const escalated = activeAlerts.filter(a => a.escalationLevel > 0).length

  res.json({
    totalActive: activeAlerts.length,
    bySeverity,
    byType,
    escalated,
    criticalItems: activeAlerts
      .filter(a => a.severity === 'critical')
      .slice(0, 5)
      .map(a => ({ id: a.id, type: a.type, title: a.title, createdAt: a.createdAt }))
  })
}))
