import { Router } from 'express'
import webpush from 'web-push'
import { prisma } from '../lib/prisma.js'
import { requireAuth, AuthRequest } from '../middleware/authMiddleware.js'

export const pushNotificationsRouter = Router()

// Configure VAPID keys from environment
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@siteproof.com'

// In-memory storage for push subscriptions (in production, store in database)
const pushSubscriptions: Map<string, {
  userId: string
  endpoint: string
  keys: { p256dh: string; auth: string }
  userAgent?: string
  createdAt: Date
}> = new Map()

// Generate VAPID keys if not set (for development)
let generatedVapidKeys: { publicKey: string; privateKey: string } | null = null

function getVapidKeys() {
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    return {
      publicKey: VAPID_PUBLIC_KEY,
      privateKey: VAPID_PRIVATE_KEY
    }
  }

  // Generate keys for development if not set
  if (!generatedVapidKeys) {
    generatedVapidKeys = webpush.generateVAPIDKeys()
  }

  return generatedVapidKeys
}

// Initialize web-push with VAPID keys
function initializeWebPush() {
  const keys = getVapidKeys()
  if (keys.publicKey && keys.privateKey) {
    webpush.setVapidDetails(
      VAPID_SUBJECT,
      keys.publicKey,
      keys.privateKey
    )
    return true
  }
  return false
}

// Initialize on module load
const isConfigured = initializeWebPush()

// Apply authentication middleware to all routes
pushNotificationsRouter.use(requireAuth)

// GET /api/push/vapid-public-key - Get VAPID public key for client subscription
pushNotificationsRouter.get('/vapid-public-key', async (_req: AuthRequest, res) => {
  try {
    const keys = getVapidKeys()

    if (!keys.publicKey) {
      return res.status(500).json({
        error: 'Push notifications not configured',
        message: 'VAPID keys are not set. Please configure VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.'
      })
    }

    res.json({
      publicKey: keys.publicKey,
      configured: isConfigured
    })
  } catch (error) {
    console.error('Get VAPID key error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/push/subscribe - Register push subscription for current user
pushNotificationsRouter.post('/subscribe', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { subscription } = req.body

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription object' })
    }

    // Store subscription (keyed by endpoint for uniqueness)
    const subscriptionId = Buffer.from(subscription.endpoint).toString('base64').slice(0, 32)

    pushSubscriptions.set(subscriptionId, {
      userId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      },
      userAgent: req.headers['user-agent'],
      createdAt: new Date()
    })

    res.json({
      success: true,
      message: 'Push notification subscription registered',
      subscriptionId
    })
  } catch (error) {
    console.error('Subscribe error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/push/unsubscribe - Remove push subscription
pushNotificationsRouter.delete('/unsubscribe', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { endpoint } = req.body

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' })
    }

    const subscriptionId = Buffer.from(endpoint).toString('base64').slice(0, 32)
    const subscription = pushSubscriptions.get(subscriptionId)

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' })
    }

    if (subscription.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to unsubscribe this device' })
    }

    pushSubscriptions.delete(subscriptionId)

    res.json({ success: true, message: 'Unsubscribed from push notifications' })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/push/subscriptions - Get user's push subscriptions
pushNotificationsRouter.get('/subscriptions', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const userSubscriptions = Array.from(pushSubscriptions.entries())
      .filter(([_, sub]) => sub.userId === userId)
      .map(([id, sub]) => ({
        id,
        userAgent: sub.userAgent,
        createdAt: sub.createdAt,
        // Don't expose the full endpoint for security
        endpointPreview: sub.endpoint.substring(0, 50) + '...'
      }))

    res.json({
      subscriptions: userSubscriptions,
      count: userSubscriptions.length
    })
  } catch (error) {
    console.error('Get subscriptions error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/push/test - Send a test push notification to current user
pushNotificationsRouter.post('/test', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true }
    })

    // Find all subscriptions for this user
    const userSubscriptions = Array.from(pushSubscriptions.entries())
      .filter(([_, sub]) => sub.userId === userId)

    if (userSubscriptions.length === 0) {
      return res.status(400).json({
        error: 'No push subscriptions found',
        message: 'Please enable push notifications in your browser first.'
      })
    }

    const payload = JSON.stringify({
      title: 'SiteProof Push Test',
      body: `Hello ${user?.fullName || 'there'}! Push notifications are working.`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'test-notification',
      data: {
        url: '/settings',
        type: 'test',
        timestamp: new Date().toISOString()
      }
    })

    const results: { subscriptionId: string; success: boolean; error?: string }[] = []

    for (const [subscriptionId, subscription] of userSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys
          },
          payload
        )
        results.push({ subscriptionId, success: true })
      } catch (error: any) {
        // Handle expired subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          pushSubscriptions.delete(subscriptionId)
          results.push({ subscriptionId, success: false, error: 'Subscription expired - removed' })
        } else {
          results.push({ subscriptionId, success: false, error: error.message })
        }
        console.error(`[Push] Failed to send to ${subscriptionId}:`, error.message)
      }
    }

    const successCount = results.filter(r => r.success).length

    res.json({
      success: successCount > 0,
      message: `Sent push notification to ${successCount}/${results.length} device(s)`,
      results
    })
  } catch (error) {
    console.error('Test push error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/push/send - Send push notification to a specific user (admin only or internal)
pushNotificationsRouter.post('/send', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { targetUserId, title, body, url, tag, data } = req.body

    if (!targetUserId || !title || !body) {
      return res.status(400).json({ error: 'targetUserId, title, and body are required' })
    }

    const result = await sendPushNotification(targetUserId, {
      title,
      body,
      url,
      tag,
      data
    })

    res.json(result)
  } catch (error) {
    console.error('Send push error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/push/status - Get push notification configuration status
pushNotificationsRouter.get('/status', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    getVapidKeys() // Ensure keys are initialized
    const userSubscriptionCount = Array.from(pushSubscriptions.values())
      .filter(sub => sub.userId === userId).length

    res.json({
      configured: isConfigured,
      vapidConfigured: !!VAPID_PUBLIC_KEY && !!VAPID_PRIVATE_KEY,
      usingGeneratedKeys: !VAPID_PUBLIC_KEY && !!generatedVapidKeys,
      totalSubscriptions: pushSubscriptions.size,
      userSubscriptionCount,
      message: isConfigured
        ? 'Push notifications are configured and ready'
        : 'Push notifications require VAPID keys to be configured'
    })
  } catch (error) {
    console.error('Get status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Helper function to send push notification to a user (exported for use by other modules)
export async function sendPushNotification(
  userId: string,
  notification: {
    title: string
    body: string
    url?: string
    tag?: string
    icon?: string
    badge?: string
    data?: Record<string, any>
  }
): Promise<{ success: boolean; sent: number; failed: number; errors?: string[] }> {
  const userSubscriptions = Array.from(pushSubscriptions.entries())
    .filter(([_, sub]) => sub.userId === userId)

  if (userSubscriptions.length === 0) {
    return { success: false, sent: 0, failed: 0, errors: ['No subscriptions found for user'] }
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: notification.icon || '/pwa-192x192.png',
    badge: notification.badge || '/pwa-192x192.png',
    tag: notification.tag || 'siteproof-notification',
    data: {
      url: notification.url || '/',
      timestamp: new Date().toISOString(),
      ...notification.data
    }
  })

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const [subscriptionId, subscription] of userSubscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys
        },
        payload
      )
      sent++
    } catch (error: any) {
      failed++
      // Remove expired subscriptions
      if (error.statusCode === 410 || error.statusCode === 404) {
        pushSubscriptions.delete(subscriptionId)
        errors.push(`Subscription ${subscriptionId.slice(0, 8)}... expired and removed`)
      } else {
        errors.push(`Subscription ${subscriptionId.slice(0, 8)}...: ${error.message}`)
      }
    }
  }

  return {
    success: sent > 0,
    sent,
    failed,
    errors: errors.length > 0 ? errors : undefined
  }
}

// Helper function to broadcast push notification to multiple users
export async function broadcastPushNotification(
  userIds: string[],
  notification: {
    title: string
    body: string
    url?: string
    tag?: string
    data?: Record<string, any>
  }
): Promise<{ totalSent: number; totalFailed: number; results: Record<string, { sent: number; failed: number }> }> {
  const results: Record<string, { sent: number; failed: number }> = {}
  let totalSent = 0
  let totalFailed = 0

  for (const userId of userIds) {
    const result = await sendPushNotification(userId, notification)
    results[userId] = { sent: result.sent, failed: result.failed }
    totalSent += result.sent
    totalFailed += result.failed
  }

  return { totalSent, totalFailed, results }
}

// GET /api/push/generate-vapid-keys - Generate new VAPID keys (development only)
pushNotificationsRouter.get('/generate-vapid-keys', async (_req: AuthRequest, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not available in production' })
    }

    const keys = webpush.generateVAPIDKeys()

    res.json({
      message: 'New VAPID keys generated. Add these to your .env file:',
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      envFormat: `VAPID_PUBLIC_KEY="${keys.publicKey}"\nVAPID_PRIVATE_KEY="${keys.privateKey}"`
    })
  } catch (error) {
    console.error('Generate VAPID keys error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
