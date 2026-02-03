/**
 * Standardized API response types and helpers
 *
 * Use these utilities across all API routes for consistent response formatting.
 *
 * @example
 * // Success response
 * res.json(successResponse({ id: 1, name: 'Example' }))
 *
 * @example
 * // Error response
 * res.status(404).json(errorResponse('Resource not found', 'NOT_FOUND'))
 *
 * @example
 * // Paginated response
 * res.json(paginatedResponse(items, totalCount, page, limit))
 */

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    message: string
    code: string
    details?: unknown
  }
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

/**
 * Create a successful API response
 * @param data - The response data
 * @param pagination - Optional pagination metadata
 */
export function successResponse<T>(data: T, pagination?: ApiResponse<T>['pagination']): ApiResponse<T> {
  return { success: true, data, pagination }
}

/**
 * Create an error API response
 * @param message - Human-readable error message
 * @param code - Machine-readable error code (e.g., 'NOT_FOUND', 'VALIDATION_ERROR')
 * @param details - Optional additional error details
 */
export function errorResponse(message: string, code: string, details?: unknown): ApiResponse<never> {
  return {
    success: false,
    error: { message, code, details }
  }
}

/**
 * Create a paginated API response
 * @param data - Array of items for the current page
 * @param total - Total number of items across all pages
 * @param page - Current page number (1-indexed)
 * @param limit - Number of items per page
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): ApiResponse<T[]> {
  const totalPages = Math.ceil(total / limit)

  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
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

  // File/upload errors
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]
