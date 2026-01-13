import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import * as trpcExpress from '@trpc/server/adapters/express'
import { createContext } from './trpc/context.js'
import { appRouter } from './trpc/router.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requestLogger } from './middleware/requestLogger.js'
import { authRouter } from './routes/auth.js'
import { projectsRouter } from './routes/projects.js'
import { lotsRouter } from './routes/lots.js'
import { ncrsRouter } from './routes/ncrs.js'
import { subcontractorsRouter } from './routes/subcontractors.js'
import { reportsRouter } from './routes/reports.js'
import { testResultsRouter } from './routes/testResults.js'

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet())
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5177',
    'http://localhost:5178',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5177',
    process.env.FRONTEND_URL || ''
  ].filter(Boolean),
  credentials: true
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Request logging
app.use(requestLogger)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// REST API routes
app.use('/api/auth', authRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/lots', lotsRouter)
app.use('/api/ncrs', ncrsRouter)
app.use('/api/subcontractors', subcontractorsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/test-results', testResultsRouter)

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
app.listen(PORT, () => {
  console.log(`🚀 SiteProof API server running on http://localhost:${PORT}`)
  console.log(`📊 tRPC endpoint: http://localhost:${PORT}/trpc`)
  console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`)
  console.log(`❤️  Health check: http://localhost:${PORT}/health`)
})

export type { AppRouter } from './trpc/router.js'
