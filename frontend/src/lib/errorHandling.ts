/**
 * Standardized error handling utilities for the frontend
 *
 * Provides consistent error handling across the application with user feedback
 * via toast notifications and proper error message extraction.
 */

import { toast } from '@/components/ui/toaster'
import { ApiError } from './api'

/**
 * Extract a user-friendly error message from various error types
 */
export function extractErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError) {
    // Use pre-parsed data field (avoids double-parsing)
    if (error.data) {
      return error.data.error?.message || error.data.message || (typeof error.data.error === 'string' ? error.data.error : null) || fallbackMessage
    }
    // Body is not JSON, use it directly if it looks like a message
    if (error.body && error.body.length < 200 && !error.body.startsWith('<')) {
      return error.body
    }
    return fallbackMessage
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage
  }

  if (typeof error === 'string') {
    return error
  }

  return fallbackMessage
}

/**
 * Extract the error details object from an API error response.
 * Returns the `details` field from `{ error: { details } }`, or null.
 */
export function extractErrorDetails(error: unknown): Record<string, any> | null {
  if (error instanceof ApiError && error.data) {
    return error.data.error?.details ?? null
  }
  return null
}

/**
 * Extract the machine-readable error code from an API error response.
 * Returns the `code` field from `{ error: { code } }`, or null.
 */
export function extractErrorCode(error: unknown): string | null {
  if (error instanceof ApiError && error.data) {
    return error.data.error?.code ?? null
  }
  return null
}

/**
 * Standardized API error handler with user feedback
 *
 * Logs the error to console and displays a toast notification to the user.
 * Handles ApiError instances specially to extract server error messages.
 *
 * @param error - The error to handle
 * @param fallbackMessage - Message to show if error message cannot be extracted
 * @returns The extracted error message
 *
 * @example
 * ```ts
 * try {
 *   await apiFetch('/api/lots')
 * } catch (error) {
 *   handleApiError(error, 'Failed to load lots')
 * }
 * ```
 */
export function handleApiError(error: unknown, fallbackMessage = 'An error occurred'): string {
  console.error('API Error:', error)

  const message = extractErrorMessage(error, fallbackMessage)

  toast({
    title: 'Error',
    description: message,
    variant: 'error'
  })

  return message
}

/**
 * Silent error handler that logs but doesn't show toast
 * Useful for background operations where user notification isn't needed
 */
export function handleSilentError(error: unknown, context = 'Operation'): string {
  const message = extractErrorMessage(error, 'Unknown error')
  console.error(`${context} failed:`, error)
  return message
}

/**
 * Wrapper for promises that handles errors automatically
 *
 * @param promise - The promise to wrap
 * @param fallbackMessage - Message to show if the promise rejects
 * @returns The resolved value or null if an error occurred
 *
 * @example
 * ```ts
 * const lots = await withErrorHandling(
 *   apiFetch<Lot[]>('/api/lots'),
 *   'Failed to load lots'
 * )
 * if (lots) {
 *   // Handle successful response
 * }
 * ```
 */
export async function withErrorHandling<T>(
  promise: Promise<T>,
  fallbackMessage = 'An error occurred'
): Promise<T | null> {
  try {
    return await promise
  } catch (error) {
    handleApiError(error, fallbackMessage)
    return null
  }
}

/**
 * Creates a mutation error handler for TanStack Query
 *
 * @param fallbackMessage - Message to show on error
 * @returns Error handler function suitable for onError callback
 *
 * @example
 * ```ts
 * const mutation = useMutation({
 *   mutationFn: createLot,
 *   onError: createMutationErrorHandler('Failed to create lot')
 * })
 * ```
 */
export function createMutationErrorHandler(fallbackMessage: string) {
  return (error: unknown) => handleApiError(error, fallbackMessage)
}

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * Check if an error indicates a specific HTTP status
 */
export function hasStatus(error: unknown, status: number): boolean {
  return isApiError(error) && error.status === status
}

/**
 * Check if error is a 401 Unauthorized
 */
export function isUnauthorized(error: unknown): boolean {
  return hasStatus(error, 401)
}

/**
 * Check if error is a 403 Forbidden
 */
export function isForbidden(error: unknown): boolean {
  return hasStatus(error, 403)
}

/**
 * Check if error is a 404 Not Found
 */
export function isNotFound(error: unknown): boolean {
  return hasStatus(error, 404)
}

/**
 * Check if error is a validation error (400 Bad Request)
 */
export function isValidationError(error: unknown): boolean {
  return hasStatus(error, 400)
}
