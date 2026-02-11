// Feature #746: Webhook external integration
import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import crypto from 'crypto'
import { AppError } from '../lib/AppError.js'
import { asyncHandler } from '../lib/asyncHandler.js'

const router = Router()

// In-memory store for webhook configurations and delivery logs (for testing/dev)
// In production, these would be stored in the database
interface WebhookConfig {
  id: string
  companyId: string
  url: string
  secret: string
  events: string[]
  enabled: boolean
  createdAt: Date
  createdById: string
}

interface WebhookDelivery {
  id: string
  webhookId: string
  event: string
  payload: any
  responseStatus: number | null
  responseBody: string | null
  error: string | null
  deliveredAt: Date
  success: boolean
}

const webhookConfigs: Map<string, WebhookConfig> = new Map()
const webhookDeliveries: WebhookDelivery[] = []

// Test endpoint to receive webhooks (for internal testing)
const testWebhookReceived: Array<{
  id: string
  timestamp: Date
  headers: any
  body: any
  signature: string | null
}> = []

// Generate HMAC signature for webhook payload
function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

// Verify webhook signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = generateSignature(payload, secret)
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

// ================================
// PUBLIC ENDPOINT - Webhook receiver for testing
// This is placed BEFORE auth middleware so it can receive external webhook posts
// ================================

// POST /api/webhooks/test-receiver - Test endpoint to receive webhooks
router.post('/test-receiver', (req: Request, res: Response) => {
  const signature = req.headers['x-webhook-signature'] as string | undefined

  // Strip sensitive headers before storing
  const sanitizedHeaders = { ...req.headers }
  delete sanitizedHeaders.authorization
  delete sanitizedHeaders.cookie

  const received = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    headers: sanitizedHeaders,
    body: req.body,
    signature: signature || null
  }

  testWebhookReceived.push(received)

  // Keep only last 100 webhooks
  if (testWebhookReceived.length > 100) {
    testWebhookReceived.shift()
  }

  res.status(200).json({
    received: true,
    id: received.id,
    timestamp: received.timestamp.toISOString()
  })
})

// GET /api/webhooks/test-receiver/logs - Get received test webhooks (for verification)
router.get('/test-receiver/logs', (req: Request, res: Response) => {
  const { limit = 10 } = req.query
  const logs = testWebhookReceived
    .slice(-parseInt(String(limit)))
    .reverse()

  res.json({
    logs,
    total: testWebhookReceived.length,
    message: `Showing last ${logs.length} received webhooks`
  })
})

// Clear test logs
router.delete('/test-receiver/logs', (_req: Request, res: Response) => {
  testWebhookReceived.length = 0
  res.json({ message: 'Test webhook logs cleared' })
})

// ================================
// PROTECTED ENDPOINTS - Require authentication
// ================================
router.use(requireAuth)

// GET /api/webhooks - List webhook configurations for the company
router.get('/', asyncHandler(async (req: Request, res: Response) => {

  const user = req.user!
  if (!user?.companyId) {
    throw AppError.forbidden('Company context required')
  }

  const configs = Array.from(webhookConfigs.values())
    .filter(c => c.companyId === user.companyId)
    .map(c => ({
      ...c,
      secret: '****' // Don't expose secret
    }))

  res.json({ webhooks: configs })
  
}))

// POST /api/webhooks - Create webhook configuration
router.post('/', asyncHandler(async (req: Request, res: Response) => {

  const user = req.user!
  if (!user?.companyId) {
    throw AppError.forbidden('Company context required')
  }

  const { url, events = ['*'] } = req.body

  if (!url) {
    throw AppError.badRequest('URL is required')
  }

  // Validate URL format
  try {
    new URL(url)
  } catch {
    throw AppError.badRequest('Invalid URL format')
  }

  // Generate webhook config
  const config: WebhookConfig = {
    id: crypto.randomUUID(),
    companyId: user.companyId,
    url,
    secret: crypto.randomBytes(32).toString('hex'),
    events,
    enabled: true,
    createdAt: new Date(),
    createdById: user.id
  }

  webhookConfigs.set(config.id, config)

  res.status(201).json({
    id: config.id,
    url: config.url,
    secret: config.secret, // Return secret only on creation
    events: config.events,
    enabled: config.enabled,
    createdAt: config.createdAt.toISOString(),
    message: 'Webhook configured successfully. Save the secret - it will not be shown again.'
  })
  
}))

// GET /api/webhooks/:id - Get specific webhook config
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {

  const { id } = req.params
  const user = req.user!

  const config = webhookConfigs.get(id)
  if (!config) {
    throw AppError.notFound('Webhook not found')
  }

  if (config.companyId !== user.companyId) {
    throw AppError.forbidden('Access denied')
  }

  res.json({
    ...config,
    secret: '****' // Don't expose secret
  })
  
}))

// PATCH /api/webhooks/:id - Update webhook config
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {

  const { id } = req.params
  const user = req.user!
  const { url, events, enabled } = req.body

  const config = webhookConfigs.get(id)
  if (!config) {
    throw AppError.notFound('Webhook not found')
  }

  if (config.companyId !== user.companyId) {
    throw AppError.forbidden('Access denied')
  }

  // Update allowed fields
  if (url !== undefined) {
    try {
      new URL(url)
      config.url = url
    } catch {
      throw AppError.badRequest('Invalid URL format')
    }
  }
  if (events !== undefined) config.events = events
  if (enabled !== undefined) config.enabled = enabled

  webhookConfigs.set(id, config)

  res.json({
    ...config,
    secret: '****'
  })
  
}))

// DELETE /api/webhooks/:id - Delete webhook config
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {

  const { id } = req.params
  const user = req.user!

  const config = webhookConfigs.get(id)
  if (!config) {
    throw AppError.notFound('Webhook not found')
  }

  if (config.companyId !== user.companyId) {
    throw AppError.forbidden('Access denied')
  }

  webhookConfigs.delete(id)

  res.status(204).send()
  
}))

// POST /api/webhooks/:id/regenerate-secret - Regenerate webhook secret
router.post('/:id/regenerate-secret', asyncHandler(async (req: Request, res: Response) => {

  const { id } = req.params
  const user = req.user!

  const config = webhookConfigs.get(id)
  if (!config) {
    throw AppError.notFound('Webhook not found')
  }

  if (config.companyId !== user.companyId) {
    throw AppError.forbidden('Access denied')
  }

  config.secret = crypto.randomBytes(32).toString('hex')
  webhookConfigs.set(id, config)

  res.json({
    id: config.id,
    secret: config.secret,
    message: 'Secret regenerated. Save the new secret - it will not be shown again.'
  })
  
}))

// GET /api/webhooks/:id/deliveries - Get delivery history for a webhook
router.get('/:id/deliveries', asyncHandler(async (req: Request, res: Response) => {

  const { id } = req.params
  const { limit = 20 } = req.query
  const user = req.user!

  const config = webhookConfigs.get(id)
  if (!config) {
    throw AppError.notFound('Webhook not found')
  }

  if (config.companyId !== user.companyId) {
    throw AppError.forbidden('Access denied')
  }

  const deliveries = webhookDeliveries
    .filter(d => d.webhookId === id)
    .slice(-parseInt(String(limit)))
    .reverse()

  res.json({
    deliveries,
    total: webhookDeliveries.filter(d => d.webhookId === id).length
  })
  
}))

// POST /api/webhooks/:id/test - Send test webhook
router.post('/:id/test', asyncHandler(async (req: Request, res: Response) => {

  const { id } = req.params
  const user = req.user!

  const config = webhookConfigs.get(id)
  if (!config) {
    throw AppError.notFound('Webhook not found')
  }

  if (config.companyId !== user.companyId) {
    throw AppError.forbidden('Access denied')
  }

  // Create test payload
  const testPayload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook delivery',
      triggeredBy: user.email
    }
  }

  // Deliver the webhook
  const delivery = await deliverWebhook(config, 'test', testPayload)

  res.json({
    success: delivery.success,
    deliveryId: delivery.id,
    responseStatus: delivery.responseStatus,
    responseBody: delivery.responseBody,
    error: delivery.error
  })
  
}))

// ================================
// WEBHOOK DELIVERY FUNCTION (exported for use by other routes)
// ================================
export async function deliverWebhook(
  config: WebhookConfig,
  event: string,
  data: any
): Promise<WebhookDelivery> {
  const deliveryId = crypto.randomUUID()
  const payload = JSON.stringify({
    id: deliveryId,
    event,
    timestamp: new Date().toISOString(),
    data
  })

  const signature = generateSignature(payload, config.secret)

  const delivery: WebhookDelivery = {
    id: deliveryId,
    webhookId: config.id,
    event,
    payload: JSON.parse(payload),
    responseStatus: null,
    responseBody: null,
    error: null,
    deliveredAt: new Date(),
    success: false
  }

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
        'X-Webhook-ID': deliveryId
      },
      body: payload
    })

    delivery.responseStatus = response.status
    delivery.responseBody = await response.text()
    delivery.success = response.status >= 200 && response.status < 300
  } catch (error: any) {
    delivery.error = error.message || 'Unknown error'
    delivery.success = false
    console.error(`[Webhook Delivery] ${event} -> ${config.url}: ERROR - ${delivery.error}`)
  }

  // Store delivery record
  webhookDeliveries.push(delivery)

  // Keep only last 100 deliveries to limit memory usage
  if (webhookDeliveries.length > 100) {
    webhookDeliveries.shift()
  }

  return delivery
}

// ================================
// HELPER: Trigger webhooks for an event
// ================================
export async function triggerWebhooks(
  companyId: string,
  event: string,
  data: any
): Promise<void> {
  const configs = Array.from(webhookConfigs.values())
    .filter(c =>
      c.companyId === companyId &&
      c.enabled &&
      (c.events.includes('*') || c.events.includes(event))
    )

  for (const config of configs) {
    // Fire and forget - don't block the main request
    deliverWebhook(config, event, data).catch(err => {
      console.error(`[Webhook] Failed to deliver ${event} to ${config.url}:`, err)
    })
  }
}

export { webhookConfigs, generateSignature, verifySignature }
export default router
