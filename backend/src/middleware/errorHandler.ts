// Feature #750: Enhanced error logging with monitoring support
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { AppError } from '../lib/AppError.js';
import { ZodError } from 'zod';
import multer from 'multer';
import {
  sanitizeLogPath,
  sanitizeLogQuery,
  sanitizeLogText,
  sanitizeLogValue,
} from '../lib/logSanitization.js';

export { sanitizeLogQuery } from '../lib/logSanitization.js';

// Structured error log format
interface ErrorLogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  code: string;
  statusCode: number;
  stack?: string;
  context: {
    method: string;
    path: string;
    query: Record<string, unknown>;
    userId?: string;
    ip?: string;
    userAgent?: string;
    apiKeyId?: string;
  };
  metadata?: Record<string, unknown>;
}

type PrismaKnownRequestErrorLike = {
  name: 'PrismaClientKnownRequestError';
  code: string;
  message: string;
  meta?: Record<string, unknown>;
};

function getPrismaForeignKeyField(meta: Record<string, unknown> | undefined): string | undefined {
  const field = meta?.field_name ?? meta?.fieldName ?? meta?.field;
  return typeof field === 'string' && field.trim() ? field : undefined;
}

function isPrismaKnownRequestError(err: unknown): err is PrismaKnownRequestErrorLike {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as Record<string, unknown>;
  return (
    candidate.name === 'PrismaClientKnownRequestError' &&
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string'
  );
}

// Error log file path
const ERROR_LOG_DIR = path.join(process.cwd(), 'logs');
const ERROR_LOG_FILE = path.join(ERROR_LOG_DIR, 'errors.log');
const DEFAULT_MAX_ERROR_LOG_BYTES = 5 * 1024 * 1024;
const MIN_MAX_ERROR_LOG_BYTES = 64 * 1024;
const MAX_RECENT_ERROR_LIMIT = 500;

function getErrorLogMaxBytes(): number {
  const configured = Number(process.env.ERROR_LOG_MAX_BYTES);
  if (!Number.isInteger(configured) || configured <= 0) {
    return DEFAULT_MAX_ERROR_LOG_BYTES;
  }

  return Math.max(configured, MIN_MAX_ERROR_LOG_BYTES);
}

function shouldWriteErrorLogFile(): boolean {
  return process.env.ERROR_LOG_TO_FILE !== 'false';
}

function ensureErrorLogDirectory(): boolean {
  try {
    if (!fs.existsSync(ERROR_LOG_DIR)) {
      fs.mkdirSync(ERROR_LOG_DIR, { recursive: true });
    }

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Failed to create error log directory:', sanitizeLogText(message));
    return false;
  }
}

export function trimErrorLogContent(content: string, maxBytes: number): string {
  const contentBytes = Buffer.from(content);
  if (contentBytes.length <= maxBytes) {
    return content;
  }

  const tail = contentBytes.subarray(contentBytes.length - maxBytes).toString('utf8');
  const firstLineBreak = tail.indexOf('\n');
  return firstLineBreak === -1 ? tail : tail.slice(firstLineBreak + 1);
}

function enforceErrorLogSizeLimit(): void {
  const maxBytes = getErrorLogMaxBytes();

  try {
    if (!fs.existsSync(ERROR_LOG_FILE)) {
      return;
    }

    const stats = fs.statSync(ERROR_LOG_FILE);
    if (stats.size <= maxBytes) {
      return;
    }

    const readBytes = Math.min(maxBytes, stats.size);
    const buffer = Buffer.alloc(readBytes);
    const file = fs.openSync(ERROR_LOG_FILE, 'r');
    try {
      fs.readSync(file, buffer, 0, readBytes, stats.size - readBytes);
    } finally {
      fs.closeSync(file);
    }

    fs.writeFileSync(ERROR_LOG_FILE, trimErrorLogContent(buffer.toString('utf8'), maxBytes));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Failed to enforce error log size limit:', sanitizeLogText(message));
  }
}

function sanitizeErrorLogEntry(entry: ErrorLogEntry): ErrorLogEntry {
  return {
    ...entry,
    message: sanitizeLogText(entry.message),
    stack: entry.stack ? sanitizeLogText(entry.stack) : undefined,
    context: sanitizeLogValue(entry.context) as ErrorLogEntry['context'],
    metadata: entry.metadata
      ? (sanitizeLogValue(entry.metadata) as Record<string, unknown>)
      : undefined,
  };
}

// Log error to file and console with structured data
function logError(entry: ErrorLogEntry) {
  const sanitizedEntry = sanitizeErrorLogEntry(entry);
  const logLine = JSON.stringify(sanitizedEntry) + '\n';

  // Console log with color coding
  const color = sanitizedEntry.statusCode >= 500 ? '\x1b[31m' : '\x1b[33m'; // Red for 500+, yellow for 4xx
  const reset = '\x1b[0m';
  console.error(
    `${color}[${sanitizedEntry.timestamp}] ${sanitizedEntry.level.toUpperCase()}: ${sanitizedEntry.message}${reset}`,
    '\n  Context:',
    JSON.stringify(sanitizedEntry.context, null, 2),
    sanitizedEntry.stack
      ? '\n  Stack:' + sanitizedEntry.stack.split('\n').slice(0, 5).join('\n')
      : '',
  );

  if (shouldWriteErrorLogFile() && ensureErrorLogDirectory()) {
    enforceErrorLogSizeLimit();
    // Append to log file (non-blocking)
    fs.appendFile(ERROR_LOG_FILE, logLine, (err) => {
      if (err) console.error('Failed to write error log:', sanitizeLogText(err.message));
    });
  }

  // Hook for external monitoring services (e.g., Sentry, DataDog)
  sendToMonitoringService(sanitizedEntry);
}

// Placeholder for external monitoring integration
function sendToMonitoringService(_entry: ErrorLogEntry) {
  // External monitoring SDK integration belongs here when a provider is wired.
}

// Export the log function for use elsewhere
export { logError, ErrorLogEntry };

/**
 * Normalize any thrown value into { statusCode, message, code, details }.
 * Handles: AppError, ZodError, Prisma known errors, plain Error, unknown.
 */
function normalizeError(err: unknown): {
  statusCode: number;
  message: string;
  code: string;
  details?: Record<string, unknown>;
} {
  // AppError — already structured
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      message: err.message,
      code: err.code,
      details: err.details,
    };
  }

  // ZodError — validation failure
  if (err instanceof ZodError) {
    return {
      statusCode: 400,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: { issues: err.issues },
    };
  }

  // Multer upload validation errors
  if (err instanceof multer.MulterError) {
    const isFileSizeLimit = err.code === 'LIMIT_FILE_SIZE';
    return {
      statusCode: isFileSizeLimit ? 413 : 400,
      message: isFileSizeLimit ? 'Uploaded file is too large' : err.message || 'Invalid upload',
      code: isFileSizeLimit ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
      details: {
        uploadCode: err.code,
        ...(err.field ? { field: err.field } : {}),
      },
    };
  }

  if (err instanceof Error && err.message.toLowerCase().startsWith('invalid file type')) {
    return {
      statusCode: 400,
      message: err.message,
      code: 'INVALID_FILE_TYPE',
    };
  }

  // Prisma known request errors
  if (isPrismaKnownRequestError(err)) {
    const prismaErr = err;
    if (prismaErr.code === 'P2002') {
      return {
        statusCode: 409,
        message: 'A record with this value already exists',
        code: 'CONFLICT',
        details: prismaErr.meta ? { target: prismaErr.meta.target } : undefined,
      };
    }
    if (prismaErr.code === 'P2025') {
      return {
        statusCode: 404,
        message: 'Record not found',
        code: 'NOT_FOUND',
      };
    }
    if (prismaErr.code === 'P2003') {
      const field = getPrismaForeignKeyField(prismaErr.meta);
      return {
        statusCode: 422,
        message: 'Invalid reference',
        code: 'INVALID_REFERENCE',
        details: field ? { field } : undefined,
      };
    }
    // Other Prisma errors → 500
    return {
      statusCode: 500,
      message: 'Database error',
      code: 'DATABASE_ERROR',
    };
  }

  // Legacy errors with statusCode (e.g. from libraries)
  if (err instanceof Error && 'statusCode' in err) {
    const legacyErr = err as Error & { statusCode?: number; code?: string };
    return {
      statusCode: legacyErr.statusCode || 500,
      message: legacyErr.message || 'Internal Server Error',
      code: legacyErr.code || 'INTERNAL_ERROR',
    };
  }

  // Plain Error
  if (err instanceof Error) {
    return {
      statusCode: 500,
      message: err.message || 'Internal Server Error',
      code: 'INTERNAL_ERROR',
    };
  }

  // Unknown
  return {
    statusCode: 500,
    message: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
  };
}

function shouldExposeError(statusCode: number, err: unknown): boolean {
  return (
    statusCode < 500 ||
    process.env.NODE_ENV !== 'production' ||
    (err instanceof AppError && err.isOperational)
  );
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const { statusCode, message, code, details } = normalizeError(err);
  const exposeError = shouldExposeError(statusCode, err);
  const responseMessage = exposeError ? message : 'Internal server error';
  const responseDetails = exposeError ? details : undefined;

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
      path: sanitizeLogPath(req.path),
      query: sanitizeLogQuery(req.query as Record<string, unknown>),
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
  };

  // Log the error
  logError(logEntry);

  // Send response
  res.status(statusCode).json({
    error: {
      message: responseMessage,
      code,
      ...(responseDetails && { details: responseDetails }),
      ...(process.env.NODE_ENV === 'development' && err instanceof Error && { stack: err.stack }),
    },
  });
}

// GET endpoint for retrieving recent errors (admin only)
export async function getRecentErrors(limit: number = 100): Promise<ErrorLogEntry[]> {
  try {
    if (!fs.existsSync(ERROR_LOG_FILE)) {
      return [];
    }

    const content = fs.readFileSync(ERROR_LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const boundedLimit = Math.min(Math.max(1, Math.trunc(limit)), MAX_RECENT_ERROR_LIMIT);

    // Get last N entries
    const recentLines = lines.slice(-boundedLimit);

    return recentLines
      .map((line) => {
        try {
          return JSON.parse(line) as ErrorLogEntry;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as ErrorLogEntry[];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Failed to read error logs:', sanitizeLogText(message));
    return [];
  }
}
