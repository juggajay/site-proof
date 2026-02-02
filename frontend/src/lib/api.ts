/**
 * Centralized API configuration and helper functions
 * Use this module instead of hardcoding API URLs throughout the app
 */

// Import the correct getAuthToken from auth module
import { getAuthToken as getAuthTokenFromAuth } from './auth'

// API base URL - centralized configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Build a full API URL from a path
 * @param path - The API path (e.g., '/api/auth/login' or 'api/auth/login')
 * @returns Full URL (e.g., 'http://localhost:3001/api/auth/login')
 */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_URL}${normalizedPath}`
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  status: number
  body: string

  constructor(status: number, body: string) {
    super(`API Error ${status}: ${body}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/**
 * Get the auth token from storage
 * Delegates to auth module which handles the siteproof_auth JSON structure
 */
export function getAuthToken(): string | null {
  return getAuthTokenFromAuth()
}

/**
 * Make an authenticated API request
 * Automatically includes the auth token and handles common errors
 *
 * @param path - The API path
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws ApiError on non-OK responses
 */
export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getAuthToken()

  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new ApiError(response.status, body)
  }

  return response.json()
}

/**
 * Make an authenticated GET request
 */
export async function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' })
}

/**
 * Make an authenticated POST request
 */
export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Make an authenticated PUT request
 */
export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Make an authenticated PATCH request
 */
export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Make an authenticated DELETE request
 */
export async function apiDelete<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE' })
}
