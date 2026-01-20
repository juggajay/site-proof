// Feature #171 N/A trigger
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import * as trpcExpress from '@trpc/server/adapters/express'
import { createContext } from './trpc/context.js'
import { appRouter } from './trpc/router.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requestLogger, getPerformanceMetrics } from './middleware/requestLogger.js'
import { rateLimiter, authRateLimiter } from './middleware/rateLimiter.js'
import { authRouter } from './routes/auth.js'
import { projectsRouter } from './routes/projects.js'
import { lotsRouter } from './routes/lots.js'
import { ncrsRouter } from './routes/ncrs.js'
import { subcontractorsRouter } from './routes/subcontractors.js'
import { reportsRouter } from './routes/reports.js'
import { testResultsRouter } from './routes/testResults.js'
import { itpRouter } from './routes/itp.js'
import diaryRouter from './routes/diary.js'
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

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet())
// Use a function for CORS origin to ensure proper handling
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
      'http://localhost:5178',
      'http://localhost:5179',
      'http://localhost:5180',
      'http://localhost:5181',
      'http://localhost:5182',
      'http://localhost:5183',
      'http://localhost:5184',
      'http://localhost:5185',
      'http://localhost:5186',
      'http://localhost:5187',
      'http://localhost:5188',
      'http://localhost:5189',
      'http://localhost:5190',
      'http://localhost:5191',
      'http://localhost:5192',
      'http://localhost:5193',
      'http://localhost:5194',
      'http://localhost:5195',
      'http://localhost:5196',
      'http://localhost:5197',
      'http://localhost:5198',
      'http://localhost:5199',
      'http://localhost:5200',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:5177',
      'http://127.0.0.1:5179',
      'http://127.0.0.1:5182',
      'http://127.0.0.1:5185',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, false);
    }
  },
  credentials: true
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Request logging
app.use(requestLogger)

// Rate limiting (Feature #742)
app.use(rateLimiter)

// Serve static files from uploads directory (for avatars, documents, etc.)
// Add CORS headers for cross-origin image loading
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.setHeader('Access-Control-Allow-Origin', '*')
  next()
}, express.static(path.join(process.cwd(), 'uploads')))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Feature #751: Performance metrics endpoint
app.get('/api/metrics', (_req, res) => {
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

// tRPC
app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
)

// Error handling
app.use(errorHandler)

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 SiteProof API server running on http://localhost:${PORT}`)
  console.log(`📊 tRPC endpoint: http://localhost:${PORT}/trpc`)
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

export type { AppRouter } from './trpc/router.js'
