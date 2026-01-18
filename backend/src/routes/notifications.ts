import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, AuthRequest } from '../middleware/authMiddleware.js'

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
