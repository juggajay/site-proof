import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, AuthRequest } from '../middleware/authMiddleware.js'
import { sendNotificationEmail, sendDailyDigestEmail, getQueuedEmails, clearEmailQueue, NotificationTypes, DigestItem } from '../lib/email.js'

export const notificationsRouter = Router()

// Apply authentication middleware to all notification routes
notificationsRouter.use(requireAuth)

// GET /api/notifications - Get notifications for current user
notificationsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
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
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/notifications/unread-count - Get unread notification count
notificationsRouter.get('/unread-count', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    })

    res.json({ count })
  } catch (error) {
    console.error('Get unread count error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/notifications/:id/read - Mark notification as read
notificationsRouter.put('/:id/read', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id } = req.params

    const notification = await prisma.notification.findUnique({
      where: { id },
    })

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    })

    res.json({ notification: updated })
  } catch (error) {
    console.error('Mark read error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/notifications/read-all - Mark all notifications as read
notificationsRouter.put('/read-all', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Mark all read error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/notifications/:id - Delete a notification
notificationsRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id } = req.params

    const notification = await prisma.notification.findUnique({
      where: { id },
    })

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await prisma.notification.delete({
      where: { id },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Delete notification error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

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
notificationsRouter.get('/users', async (req: AuthRequest, res) => {
  try {
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
  } catch (error) {
    console.error('Get mentionable users error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

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
notificationsRouter.get('/email-preferences', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const preferences = userEmailPreferences.get(userId) || DEFAULT_EMAIL_PREFERENCES

    res.json({ preferences })
  } catch (error) {
    console.error('Get email preferences error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Helper to validate timing preference
function validateTiming(value: any, defaultValue: NotificationTiming): NotificationTiming {
  if (value === 'immediate' || value === 'digest') {
    return value
  }
  return defaultValue
}

// PUT /api/notifications/email-preferences - Update email notification preferences
notificationsRouter.put('/email-preferences', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
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
  } catch (error) {
    console.error('Update email preferences error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/notifications/send-test-email - Send a test email notification
notificationsRouter.post('/send-test-email', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check email preferences
    const preferences = userEmailPreferences.get(userId) || DEFAULT_EMAIL_PREFERENCES
    if (!preferences.enabled) {
      return res.status(400).json({ error: 'Email notifications are disabled. Enable them first in your preferences.' })
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
        message: 'Test email sent successfully',
        messageId: result.messageId,
        sentTo: user.email,
      })
    } else {
      res.status(500).json({ error: 'Failed to send test email', details: result.error })
    }
  } catch (error) {
    console.error('Send test email error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/notifications/email-queue - Get queued emails (for testing/debugging)
notificationsRouter.get('/email-queue', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not available in production' })
    }

    const queue = getQueuedEmails()
    res.json({ emails: queue, count: queue.length })
  } catch (error) {
    console.error('Get email queue error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/notifications/email-queue - Clear email queue (for testing/debugging)
notificationsRouter.delete('/email-queue', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not available in production' })
    }

    clearEmailQueue()
    res.json({ success: true, message: 'Email queue cleared' })
  } catch (error) {
    console.error('Clear email queue error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

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

    console.log(`[Notifications] Queued ${notificationType} notification for user ${userId} (timing: digest)`)
    return { sent: false, queued: true }
  }

  // Send the email immediately
  console.log(`[Notifications] Sending ${notificationType} notification to user ${userId} immediately (timing: immediate)`)
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
notificationsRouter.post('/add-to-digest', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { type, title, message, projectName, linkUrl } = req.body

    if (!type || !title || !message) {
      return res.status(400).json({ error: 'type, title, and message are required' })
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
  } catch (error) {
    console.error('Add to digest error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/notifications/send-digest - Send daily digest email
notificationsRouter.post('/send-digest', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check email preferences
    const preferences = userEmailPreferences.get(userId) || DEFAULT_EMAIL_PREFERENCES
    if (!preferences.enabled) {
      return res.status(400).json({ error: 'Email notifications are disabled' })
    }

    // Get digest items
    const items = digestQueue.get(userId) || []

    if (items.length === 0) {
      return res.status(400).json({ error: 'No items in digest queue' })
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
      res.status(500).json({ error: 'Failed to send digest', details: result.error })
    }
  } catch (error) {
    console.error('Send digest error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/notifications/digest-queue - Get current digest queue
notificationsRouter.get('/digest-queue', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const items = digestQueue.get(userId) || []

    res.json({
      items,
      count: items.length,
    })
  } catch (error) {
    console.error('Get digest queue error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/notifications/digest-queue - Clear digest queue
notificationsRouter.delete('/digest-queue', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    digestQueue.delete(userId)

    res.json({ success: true, message: 'Digest queue cleared' })
  } catch (error) {
    console.error('Clear digest queue error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

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
notificationsRouter.post('/alerts', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { type, severity, title, message, entityId, entityType, projectId, assignedTo } = req.body

    if (!type || !title || !message || !entityId || !entityType || !assignedTo) {
      return res.status(400).json({ error: 'Missing required fields: type, title, message, entityId, entityType, assignedTo' })
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

    console.log(`[Alerts] Created alert ${alert.id} of type ${type} assigned to ${assignedTo}`)

    res.json({
      success: true,
      alert,
      message: 'Alert created successfully',
    })
  } catch (error) {
    console.error('Create alert error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/notifications/alerts - Get all active alerts
notificationsRouter.get('/alerts', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
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
  } catch (error) {
    console.error('Get alerts error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/notifications/alerts/:id/resolve - Resolve an alert
notificationsRouter.put('/alerts/:id/resolve', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id } = req.params
    const alert = alertStore.get(id)

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' })
    }

    if (alert.resolvedAt) {
      return res.status(400).json({ error: 'Alert is already resolved' })
    }

    alert.resolvedAt = new Date()
    alertStore.set(id, alert)

    console.log(`[Alerts] Alert ${id} resolved by user ${userId}`)

    res.json({
      success: true,
      alert,
      message: 'Alert resolved successfully',
    })
  } catch (error) {
    console.error('Resolve alert error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/notifications/alerts/check-escalations - Check and process escalations
// This would typically be called by a cron job or scheduled task
notificationsRouter.post('/alerts/check-escalations', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
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
        // Find users to escalate to based on roles
        const escalationUsers = await prisma.user.findMany({
          where: {
            role: {
              in: config.escalationRoles,
            },
            // If there's a project, find users in that project
            ...(alert.projectId ? {
              projectUsers: {
                some: {
                  projectId: alert.projectId,
                },
              },
            } : {}),
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        })

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
        console.log(`[Alerts] Alert ${id} escalated to level ${newLevel}, notified ${escalationUsers.length} users`)
      }
    }

    res.json({
      success: true,
      message: `Escalation check complete. ${escalatedAlerts.length} alerts escalated.`,
      escalatedAlerts,
      totalActiveAlerts: Array.from(alertStore.values()).filter(a => !a.resolvedAt).length,
    })
  } catch (error) {
    console.error('Check escalations error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/notifications/alerts/escalation-config - Get escalation configuration
notificationsRouter.get('/alerts/escalation-config', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    res.json({
      config: ESCALATION_CONFIG,
    })
  } catch (error) {
    console.error('Get escalation config error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/notifications/alerts/:id/test-escalate - Force escalate an alert (for testing)
// This simulates time passing and triggers escalation
notificationsRouter.post('/alerts/:id/test-escalate', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not available in production' })
    }

    const { id } = req.params
    const alert = alertStore.get(id)

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' })
    }

    if (alert.resolvedAt) {
      return res.status(400).json({ error: 'Alert is already resolved' })
    }

    const config = ESCALATION_CONFIG[alert.type]
    if (!config) {
      return res.status(400).json({ error: 'Unknown alert type' })
    }

    // Determine the next escalation level
    const newLevel = alert.escalationLevel + 1
    if (newLevel > 2) {
      return res.status(400).json({ error: 'Alert is already at maximum escalation level' })
    }

    // Find users to escalate to based on roles
    const escalationUsers = await prisma.user.findMany({
      where: {
        role: {
          in: config.escalationRoles,
        },
        ...(alert.projectId ? {
          projectUsers: {
            some: {
              projectId: alert.projectId,
            },
          },
        } : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    })

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

      console.log(`[Alerts] Sent escalation notification to ${user.email}`)
    }

    console.log(`[Alerts] TEST: Alert ${id} force-escalated to level ${newLevel}`)

    res.json({
      success: true,
      alert,
      escalatedTo: escalationUsers.map(u => ({ id: u.id, email: u.email, role: u.role })),
      message: `Alert escalated to level ${newLevel}. Notified ${escalationUsers.length} users.`,
    })
  } catch (error) {
    console.error('Test escalate error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ============================================================================
// Feature #934: Daily Diary Reminder Notification
// ============================================================================

// POST /api/notifications/diary-reminder/check - Check for missing diaries and send reminders
// This would typically be called by a cron job at end of day (e.g., 5pm local time)
notificationsRouter.post('/diary-reminder/check', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get today's date (or allow override for testing)
    const { date: dateOverride, projectId: specificProjectId } = req.body
    const targetDate = dateOverride ? new Date(dateOverride) : new Date()
    targetDate.setHours(0, 0, 0, 0)
    const dateString = targetDate.toISOString().split('T')[0]

    console.log(`[Diary Reminder] Checking for missing diaries on ${dateString}`)

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
            project.id,
            'diary_reminder',
            'Daily Diary Reminder',
            `No daily diary entry found for ${project.name} on ${dateString}. Please complete your site diary.`,
            user.email
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

    console.log(`[Diary Reminder] Created ${remindersCreated.length} reminder(s) for ${usersNotified.size} user(s)`)

    res.json({
      success: true,
      date: dateString,
      projectsChecked: projects.length,
      remindersCreated: remindersCreated.length,
      uniqueUsersNotified: usersNotified.size,
      details: remindersCreated
    })
  } catch (error) {
    console.error('Diary reminder check error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/notifications/diary-reminder/send - Manually send a diary reminder for a specific project
notificationsRouter.post('/diary-reminder/send', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { projectId, date } = req.body

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' })
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
      return res.status(404).json({ error: 'Project not found' })
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
          project.id,
          'diary_reminder',
          'Daily Diary Reminder',
          `Reminder: Please complete the daily diary for ${project.name} on ${dateString}.`,
          user.email
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
  } catch (error) {
    console.error('Send diary reminder error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
