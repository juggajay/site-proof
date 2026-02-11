// Feature #750: Enhanced error logging with monitoring support
import type { Request, Response, NextFunction } from 'express'
import fs from 'fs'
import path from 'path'
import { AppError } from '../lib/AppError.js'
import { ZodError } from 'zod'

// Structured error log format
interface ErrorLogEntry {
  timestamp: string
  level: 'error' | 'warn' | 'info'
  message: string
  code: string
  statusCode: number
  stack?: string
  context: {
    method: string
    path: string
    query: Record<string, any>
    userId?: string
    ip?: string
    userAgent?: string
    apiKeyId?: string
  }
  metadata?: Record<string, any>
}

// Error log file path
const ERROR_LOG_DIR = path.join(process.cwd(), 'logs')
const ERROR_LOG_FILE = path.join(ERROR_LOG_DIR, 'errors.log')

// Ensure log directory exists
if (!fs.existsSync(ERROR_LOG_DIR)) {
  fs.mkdirSync(ERROR_LOG_DIR, { recursive: true })
}

// Log error to file and console with structured data
function logError(entry: ErrorLogEntry) {
  const logLine = JSON.stringify(entry) + '\n'

  // Console log with color coding
  const color = entry.statusCode >= 500 ? '\x1b[31m' : '\x1b[33m' // Red for 500+, yellow for 4xx
  const reset = '\x1b[0m'
  console.error(
    `${color}[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${reset}`,
    '\n  Context:', JSON.stringify(entry.context, null, 2),
    entry.stack ? '\n  Stack:' + entry.stack.split('\n').slice(0, 5).join('\n') : ''
  )

  // Append to log file (non-blocking)
  fs.appendFile(ERROR_LOG_FILE, logLine, (err) => {
    if (err) console.error('Failed to write error log:', err)
  })

  // Hook for external monitoring services (e.g., Sentry, DataDog)
  sendToMonitoringService(entry)
}

// Placeholder for external monitoring integration
function sendToMonitoringService(entry: ErrorLogEntry) {
  // Integration point for external services
  if (process.env.SENTRY_DSN) {
    console.debug('[Monitoring] Would send to Sentry:', entry.code)
  }
}

// Export the log function for use elsewhere
export { logError, ErrorLogEntry }

/**
 * Normalize any thrown value into { statusCode, message, code, details }.
 * Handles: AppError, ZodError, Prisma known errors, plain Error, unknown.
 */
function normalizeError(err: unknown): {
  statusCode: number
  message: string
  code: string
  details?: Record<string, unknown>
} {
  // AppError — already structured
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      message: err.message,
      code: err.code,
      details: err.details,
    }
  }

  // ZodError — validation failure
  if (err instanceof ZodError) {
    return {
      statusCode: 400,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: { issues: err.issues },
    }
  }

  // Prisma known request errors
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    'name' in err &&
    (err as any).name === 'PrismaClientKnownRequestError'
  ) {
    const prismaErr = err as unknown as { code: string; message: string; meta?: Record<string, unknown> }
    if (prismaErr.code === 'P2002') {
      return {
        statusCode: 409,
        message: 'A record with this value already exists',
        code: 'CONFLICT',
        details: prismaErr.meta ? { target: prismaErr.meta.target } : undefined,
      }
    }
    if (prismaErr.code === 'P2025') {
      return {
        statusCode: 404,
        message: 'Record not found',
        code: 'NOT_FOUND',
      }
    }
    // Other Prisma errors → 500
    return {
      statusCode: 500,
      message: 'Database error',
      code: 'DATABASE_ERROR',
    }
  }

  // Legacy errors with statusCode (e.g. from libraries)
  if (err instanceof Error && 'statusCode' in err) {
    const legacyErr = err as Error & { statusCode?: number; code?: string }
    return {
      statusCode: legacyErr.statusCode || 500,
      message: legacyErr.message || 'Internal Server Error',
      code: legacyErr.code || 'INTERNAL_ERROR',
    }
  }

  // Plain Error
  if (err instanceof Error) {
    return {
      statusCode: 500,
      message: err.message || 'Internal Server Error',
      code: 'INTERNAL_ERROR',
    }
  }

  // Unknown
  return {
    statusCode: 500,
    message: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const { statusCode, message, code, details } = normalizeError(err)

  // Build structured error log entry
  const logEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: statusCode >= 500 ? 'error' : 'warn',
    message,
    code,
    statusCode,
    stack: process.env.NODE_ENV === 'development' && err instanceof Error ? err.stack : undefined,
    context: {
      method: req.method,
      path: req.path,
      query: req.query,
      userId: req.user?.id,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      apiKeyId: req.apiKey?.id,
    },
    metadata: {
      requestId: req.headers['x-request-id'],
      contentType: req.headers['content-type'],
      origin: req.headers.origin,
    },
  }

  // Log the error
  logError(logEntry)

  // Send response
  res.status(statusCode).json({
    error: {
      message,
      code,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && err instanceof Error && { stack: err.stack }),
    },
  })
}

// GET endpoint for retrieving recent errors (admin only)
export async function getRecentErrors(limit: number = 100): Promise<ErrorLogEntry[]> {
  try {
    if (!fs.existsSync(ERROR_LOG_FILE)) {
      return []
    }

    const content = fs.readFileSync(ERROR_LOG_FILE, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)

    // Get last N entries
    const recentLines = lines.slice(-limit)

    return recentLines.map(line => {
      try {
        return JSON.parse(line) as ErrorLogEntry
      } catch {
        return null
      }
    }).filter(Boolean) as ErrorLogEntry[]
  } catch (err) {
    console.error('Failed to read error logs:', err)
    return []
  }
}
