/**
 * Centralized API configuration and helper functions
 * Use this module instead of hardcoding API URLs throughout the app
 */

// Import the correct getAuthToken from auth module
import { getAuthToken as getAuthTokenFromAuth } from './auth';
import { notifySessionExpired } from './authStorage';
import { API_URL, apiUrl } from './config';
import { fetchWithTimeout, RequestTimeoutError } from './fetchWithTimeout';

export { API_URL, apiUrl };

export type ApiErrorData = {
  error?:
    | {
        message?: string;
        details?: Record<string, unknown>;
        code?: string;
      }
    | string;
  message?: string;
};

function getBrowserOriginFallback(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://localhost';
}

function parseConfiguredApiUrl(path: string): URL {
  return new URL(apiUrl(path), getBrowserOriginFallback());
}

function assertAllowedApiRequestUrl(url: URL): void {
  const apiRoot = parseConfiguredApiUrl('/api/');
  if (url.origin !== apiRoot.origin || !url.pathname.startsWith(apiRoot.pathname)) {
    throw new Error('Refusing to send an authenticated request outside the configured API origin');
  }
}

function resolveApiRequestUrl(path: string): string {
  let absoluteUrl: URL | null = null;

  try {
    absoluteUrl = new URL(path);
  } catch {
    absoluteUrl = null;
  }

  if (absoluteUrl) {
    if (absoluteUrl.protocol !== 'http:' && absoluteUrl.protocol !== 'https:') {
      throw new Error('Authenticated API requests must use HTTP or HTTPS');
    }

    assertAllowedApiRequestUrl(absoluteUrl);
    return path;
  }

  const resolvedPath = apiUrl(path);
  assertAllowedApiRequestUrl(parseConfiguredApiUrl(path));
  return resolvedPath;
}

/**
 * Custom error class for API errors.
 * `body` is the raw response text (preserved for backward compatibility).
 * `data` is the parsed JSON body (null if response was not JSON).
 */
export class ApiError extends Error {
  status: number;
  body: string;
  data: ApiErrorData | null;

  constructor(status: number, body: string) {
    super(`API Error ${status}: ${body}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    try {
      const parsed: unknown = JSON.parse(body);
      this.data = parsed && typeof parsed === 'object' ? (parsed as ApiErrorData) : null;
    } catch {
      this.data = null;
    }
  }
}

/**
 * True when a failed request never produced a definitive server answer, so the
 * write is safe to retry later (e.g. queue it for offline sync): the browser
 * reports offline, the request timed out, fetch failed at the network layer
 * (fetch rejects with a TypeError on DNS/connection failures), or the server
 * answered 5xx. A 4xx response is a definitive rejection — it must surface to
 * the user as a real error, never be queued and replayed.
 */
export function isRetriableNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  if (error instanceof RequestTimeoutError) {
    return true;
  }
  if (error instanceof ApiError) {
    return error.status >= 500;
  }
  return error instanceof TypeError;
}

/**
 * Get the auth token from storage
 * Delegates to auth module which handles the siteproof_auth JSON structure
 */
export function getAuthToken(): string | null {
  return getAuthTokenFromAuth();
}

/**
 * Make an authenticated fetch request while preserving caller-controlled
 * headers and body types such as FormData, Blob, and ArrayBuffer.
 */
export async function authFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options?.headers);

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetchWithTimeout(resolveApiRequestUrl(path), {
    ...options,
    headers,
  });

  if (response.status === 401) {
    notifySessionExpired();
  }

  return response;
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
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await authFetch(path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(response.status, body);
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const body = await response.text();
  if (!body) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    return JSON.parse(body) as T;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    return body as T;
  }
}

/**
 * Make an authenticated GET request
 */
export async function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' });
}

/**
 * Make an authenticated POST request
 */
export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Make an authenticated PUT request
 */
export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Make an authenticated PATCH request
 */
export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Make an authenticated DELETE request
 */
export async function apiDelete<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE' });
}
