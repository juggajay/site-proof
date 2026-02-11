// Feature #171 N/A trigger

// Global error handlers - must be registered BEFORE any async code runs
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { errorHandler } from './middleware/errorHandler.js'
import { requestLogger, getPerformanceMetrics } from './middleware/requestLogger.js'
import { rateLimiter, authRateLimiter } from './middleware/rateLimiter.js'
import { requireAuth, requireRole } from './middleware/authMiddleware.js'
import { authRouter } from './routes/auth.js'
import { projectsRouter } from './routes/projects.js'
import { lotsRouter } from './routes/lots.js'
import { lotAssignmentsRouter } from './routes/lotAssignments.js'
import { ncrsRouter } from './routes/ncrs/index.js'
import { subcontractorsRouter } from './routes/subcontractors.js'
import { reportsRouter } from './routes/reports.js'
import { testResultsRouter } from './routes/testResults.js'
import { itpRouter } from './routes/itp/index.js'
import diaryRouter from './routes/diary/index.js'
import claimsRouter from './routes/claims.js'
import { holdpointsRouter } from './routes/holdpoints.js'
import { docketsRouter } from './routes/dockets.js'
import { companyRouter } from './routes/company.js'
import { supportRouter } from './routes/support.js'
import { auditLogRouter } from './routes/auditLog.js'
import { commentsRouter } from './routes/comments.js'
import { notificationsRouter } from './routes/notifications.js'
import documentsRouter from './routes/documents.js'
import { drawingsRouter } from './routes/drawings.js'
import { dashboardRouter } from './routes/dashboard.js'
import apiKeysRouter, { authenticateApiKey } from './routes/apiKeys.js'
import { consentRouter } from './routes/consent.js'
import { mfaRouter } from './routes/mfa.js'
import { oauthRouter } from './routes/oauth.js'
import webhooksRouter from './routes/webhooks.js'
import { pushNotificationsRouter } from './routes/pushNotifications.js'

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
// Feature #762: HTTPS enforcement and HSTS
app.use(helmet({
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}))

// Feature #762: HTTPS redirect in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Check x-forwarded-proto (common when behind reverse proxy/load balancer)
    const proto = req.headers['x-forwarded-proto'] || req.protocol
    if (proto !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`)
    }
    next()
  })
}
// Environment-based CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl) only in development
    if (!origin) {
      return callback(null, process.env.NODE_ENV !== 'production')
    }

    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = [process.env.FRONTEND_URL].filter(Boolean) as string[]
      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(null, false)
      }
    } else {
      // Development: allow any localhost origin
      if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
        callback(null, true)
      } else {
        callback(null, false)
      }
    }
  },
  credentials: true
}))

// Body parsing
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// Request logging
app.use(requestLogger)

// Rate limiting (Feature #742)
app.use(rateLimiter)

// Serve static files from uploads directory (for avatars, documents, etc.)
// Feature #755: CDN-friendly cache headers for static assets
app.use('/uploads', (req, res, next) => {
  // CORS headers for cross-origin image loading
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.setHeader('Access-Control-Allow-Origin', '*')

  // Feature #755: Cache control headers for CDN and browser caching
  // Images and documents can be cached for 1 day, CDN can revalidate with stale-while-revalidate
  const cacheableExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.ico']
  const ext = path.extname(req.path).toLowerCase()

  if (cacheableExtensions.includes(ext)) {
    // Cache for 1 day, allow CDN to serve stale for 1 hour while revalidating
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600')
    // Add ETag support for conditional requests
    res.setHeader('Vary', 'Accept-Encoding')
  } else {
    // Other files: shorter cache, require revalidation
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate')
  }

  next()
}, express.static(path.join(process.cwd(), 'uploads'), {
  etag: true,
  lastModified: true,
  immutable: false,
}))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Feature #751: Performance metrics endpoint (admin only)
app.get('/api/metrics', requireAuth, requireRole(['owner', 'admin']), (_req, res) => {
  const metrics = getPerformanceMetrics()
  res.json(metrics)
})

// Feature #747: API key authentication middleware (checked before JWT)
app.use(authenticateApiKey)

// REST API routes
// Auth routes have stricter rate limiting to prevent brute force attacks
app.use('/api/auth', authRateLimiter, authRouter)
app.use('/api/api-keys', apiKeysRouter)  // Feature #747: API key management
app.use('/api/projects', projectsRouter)
app.use('/api/lots', lotsRouter)
app.use('/api/lots', lotAssignmentsRouter)
app.use('/api/ncrs', ncrsRouter)
app.use('/api/subcontractors', subcontractorsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/test-results', testResultsRouter)
app.use('/api/itp', itpRouter)
app.use('/api/diary', diaryRouter)
app.use('/api/projects', claimsRouter)
app.use('/api/holdpoints', holdpointsRouter)
app.use('/api/dockets', docketsRouter)
app.use('/api/company', companyRouter)
app.use('/api/support', supportRouter)
app.use('/api/audit-logs', auditLogRouter)
app.use('/api/comments', commentsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/documents', documentsRouter)
app.use('/api/drawings', drawingsRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/consent', consentRouter)  // Feature #776: Privacy consent tracking
app.use('/api/mfa', mfaRouter)  // Feature #22, #420, #421: MFA/2FA support
app.use('/api/auth', oauthRouter)  // Feature #414, #1004: Google OAuth support
app.use('/api/webhooks', webhooksRouter)  // Feature #746: Webhook external integration
app.use('/api/push', pushNotificationsRouter)  // Feature #657: Mobile push notifications

// Error handling
app.use(errorHandler)

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 SiteProof API server running on http://localhost:${PORT}`)
  console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`)
  console.log(`❤️  Health check: http://localhost:${PORT}/health`)
})

// Feature #757: Graceful shutdown handling
let isShuttingDown = false

// Health check returns 503 during shutdown to stop receiving new traffic
app.get('/ready', (_req, res) => {
  if (isShuttingDown) {
    res.status(503).json({ status: 'shutting_down', message: 'Server is shutting down' })
  } else {
    res.json({ status: 'ready' })
  }
})

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    console.log(`[${signal}] Shutdown already in progress...`)
    return
  }

  isShuttingDown = true
  console.log(`\n[${signal}] Initiating graceful shutdown...`)

  // Set a hard timeout for shutdown (30 seconds)
  const shutdownTimeout = setTimeout(() => {
    console.error('Shutdown timeout exceeded, forcing exit')
    process.exit(1)
  }, 30000)

  try {
    // Stop accepting new connections
    server.close((err) => {
      if (err) {
        console.error('Error closing server:', err)
      } else {
        console.log('Server closed, no longer accepting connections')
      }
    })

    // Wait a bit for in-flight requests to complete
    console.log('Waiting for in-flight requests to complete...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Close database connections (Prisma)
    console.log('Closing database connections...')
    const { prisma } = await import('./lib/prisma.js')
    await prisma.$disconnect()

    console.log('Graceful shutdown complete')
    clearTimeout(shutdownTimeout)
    process.exit(0)
  } catch (error) {
    console.error('Error during shutdown:', error)
    clearTimeout(shutdownTimeout)
    process.exit(1)
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
