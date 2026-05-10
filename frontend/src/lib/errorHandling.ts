/**
 * Standardized error handling utilities for the frontend
 *
 * Provides consistent error handling across the application with user feedback
 * via toast notifications and proper error message extraction.
 */

import { toast } from '@/components/ui/toaster';
import { ApiError } from './api';
import { logError } from './logger';

type ErrorDataLike = {
  error?: unknown;
  message?: unknown;
};

function extractMessageFromErrorData(data: ErrorDataLike): string | null {
  const errorPayload = data.error;
  if (errorPayload && typeof errorPayload === 'object') {
    const nestedMessage = (errorPayload as { message?: unknown }).message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
      return nestedMessage;
    }
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }

  if (typeof errorPayload === 'string' && errorPayload.trim()) {
    return errorPayload;
  }

  return null;
}

export function extractResponseErrorMessage(responseBody: string, fallbackMessage: string): string {
  if (!responseBody) return fallbackMessage;

  try {
    const parsed: unknown = JSON.parse(responseBody);
    if (parsed && typeof parsed === 'object') {
      return extractMessageFromErrorData(parsed as ErrorDataLike) || fallbackMessage;
    }
  } catch {
    // Keep the plain response body.
  }

  if (responseBody.length < 200 && !responseBody.startsWith('<')) {
    return responseBody;
  }

  return fallbackMessage;
}

/**
 * Extract a user-friendly error message from various error types
 */
export function extractErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError) {
    // Use pre-parsed data field (avoids double-parsing)
    if (error.data) {
      return extractMessageFromErrorData(error.data) || fallbackMessage;
    }
    // Body is not JSON, use it directly if it looks like a message
    if (error.body && error.body.length < 200 && !error.body.startsWith('<')) {
      return error.body;
    }
    return fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  if (typeof error === 'string') {
    return error;
  }

  return fallbackMessage;
}

/**
 * Extract the error details object from an API error response.
 * Returns the `details` field from `{ error: { details } }`, or null.
 */
export function extractErrorDetails(error: unknown): Record<string, unknown> | null {
  if (error instanceof ApiError && error.data) {
    return typeof error.data.error === 'object' ? (error.data.error.details ?? null) : null;
  }
  return null;
}

/**
 * Extract the machine-readable error code from an API error response.
 * Returns the `code` field from `{ error: { code } }`, or null.
 */
export function extractErrorCode(error: unknown): string | null {
  if (error instanceof ApiError && error.data) {
    return typeof error.data.error === 'object' ? (error.data.error.code ?? null) : null;
  }
  return null;
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
  logError('API Error:', error);

  const message = extractErrorMessage(error, fallbackMessage);

  toast({
    title: 'Error',
    description: message,
    variant: 'error',
  });

  return message;
}

/**
 * Silent error handler that logs but doesn't show toast
 * Useful for background operations where user notification isn't needed
 */
export function handleSilentError(error: unknown, context = 'Operation'): string {
  const message = extractErrorMessage(error, 'Unknown error');
  logError(`${context} failed:`, error);
  return message;
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
  fallbackMessage = 'An error occurred',
): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    handleApiError(error, fallbackMessage);
    return null;
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
  return (error: unknown) => handleApiError(error, fallbackMessage);
}

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Check if an error indicates a specific HTTP status
 */
export function hasStatus(error: unknown, status: number): boolean {
  return isApiError(error) && error.status === status;
}

/**
 * Check if error is a 401 Unauthorized
 */
export function isUnauthorized(error: unknown): boolean {
  return hasStatus(error, 401);
}

/**
 * Check if error is a 403 Forbidden
 */
export function isForbidden(error: unknown): boolean {
  return hasStatus(error, 403);
}

/**
 * Check if error is a 404 Not Found
 */
export function isNotFound(error: unknown): boolean {
  return hasStatus(error, 404);
}

/**
 * Check if error is a validation error (400 Bad Request)
 */
export function isValidationError(error: unknown): boolean {
  return hasStatus(error, 400);
}
