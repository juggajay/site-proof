import { ZodError } from 'zod'

/**
 * Application error class for centralized error handling.
 * Throw these from route handlers — the global errorHandler middleware
 * converts them to consistent JSON responses.
 */
export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly details?: Record<string, unknown>
  public readonly isOperational: boolean

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    details?: Record<string, unknown>,
    isOperational = true
  ) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code || AppError.defaultCodeForStatus(statusCode)
    this.details = details
    this.isOperational = isOperational
    Error.captureStackTrace(this, this.constructor)
  }

  private static defaultCodeForStatus(status: number): string {
    switch (status) {
      case 400: return ErrorCodes.VALIDATION_ERROR
      case 401: return ErrorCodes.UNAUTHORIZED
      case 403: return ErrorCodes.FORBIDDEN
      case 404: return ErrorCodes.NOT_FOUND
      case 409: return ErrorCodes.CONFLICT
      case 429: return ErrorCodes.RATE_LIMITED
      default: return ErrorCodes.INTERNAL_ERROR
    }
  }

  // --- Factory methods ---

  static badRequest(message = 'Bad request', details?: Record<string, unknown>) {
    return new AppError(400, message, ErrorCodes.VALIDATION_ERROR, details)
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(401, message, ErrorCodes.UNAUTHORIZED)
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(403, message, ErrorCodes.FORBIDDEN)
  }

  static notFound(resource = 'Resource') {
    return new AppError(404, `${resource} not found`, ErrorCodes.NOT_FOUND)
  }

  static conflict(message = 'Resource already exists', details?: Record<string, unknown>) {
    return new AppError(409, message, ErrorCodes.CONFLICT, details)
  }

  static internal(message = 'Internal server error') {
    return new AppError(500, message, ErrorCodes.INTERNAL_ERROR, undefined, false)
  }

  static fromZodError(error: ZodError, message = 'Validation failed') {
    return new AppError(400, message, ErrorCodes.VALIDATION_ERROR, {
      issues: error.issues,
    })
  }
}

/**
 * Common error codes for consistency across the API
 */
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',

  // File/upload errors
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]
