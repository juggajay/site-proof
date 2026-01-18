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

// Default notification preferences
const DEFAULT_EMAIL_PREFERENCES = {
  enabled: true,
  mentions: true,
  ncrAssigned: true,
  ncrStatusChange: true,
  holdPointReminder: true,
  commentReply: true,
  scheduledReports: true,
  dailyDigest: false, // When enabled, batches notifications into a daily email
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

// PUT /api/notifications/email-preferences - Update email notification preferences
notificationsRouter.put('/email-preferences', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { preferences } = req.body

    // Validate preferences
    const validatedPreferences = {
      enabled: Boolean(preferences?.enabled ?? DEFAULT_EMAIL_PREFERENCES.enabled),
      mentions: Boolean(preferences?.mentions ?? DEFAULT_EMAIL_PREFERENCES.mentions),
      ncrAssigned: Boolean(preferences?.ncrAssigned ?? DEFAULT_EMAIL_PREFERENCES.ncrAssigned),
      ncrStatusChange: Boolean(preferences?.ncrStatusChange ?? DEFAULT_EMAIL_PREFERENCES.ncrStatusChange),
      holdPointReminder: Boolean(preferences?.holdPointReminder ?? DEFAULT_EMAIL_PREFERENCES.holdPointReminder),
      commentReply: Boolean(preferences?.commentReply ?? DEFAULT_EMAIL_PREFERENCES.commentReply),
      scheduledReports: Boolean(preferences?.scheduledReports ?? DEFAULT_EMAIL_PREFERENCES.scheduledReports),
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

// Helper function to send notification email if user preferences allow
export async function sendNotificationIfEnabled(
  userId: string,
  notificationType: keyof typeof DEFAULT_EMAIL_PREFERENCES,
  data: {
    title: string
    message: string
    linkUrl?: string
    projectName?: string
    userName?: string
  }
): Promise<boolean> {
  const preferences = userEmailPreferences.get(userId) || DEFAULT_EMAIL_PREFERENCES

  // Check if email notifications are enabled
  if (!preferences.enabled) {
    return false
  }

  // Check if specific notification type is enabled
  if (notificationType !== 'enabled' && !preferences[notificationType]) {
    return false
  }

  // Get user email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })

  if (!user) {
    return false
  }

  // Send the email
  const result = await sendNotificationEmail(user.email, notificationType, data)
  return result.success
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
