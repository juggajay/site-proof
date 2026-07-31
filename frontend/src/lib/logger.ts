import { apiUrl } from './config';
import { fetchWithTimeout } from './fetchWithTimeout';

const MAX_CLIENT_ERROR_FIELD_LENGTH = 6000;

export function devLog(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.debug(...args);
  }
}

export function devWarn(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
}

export function logError(message: string, error?: unknown) {
  if (import.meta.env.DEV) {
    if (error !== undefined) {
      console.error(message, error);
    } else {
      console.error(message);
    }
  }
}

type ClientErrorInfo = {
  componentStack?: string | null;
};

type SerializedClientError = {
  name?: string;
  message: string;
  stack?: string;
};

function truncateClientErrorField(
  value: string | undefined | null,
  maxLength = MAX_CLIENT_ERROR_FIELD_LENGTH,
): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function serializeClientError(error: unknown): SerializedClientError {
  if (error instanceof Error) {
    return {
      name: truncateClientErrorField(error.name, 120),
      message: truncateClientErrorField(error.message, 1000) || 'Unknown client error',
      stack: truncateClientErrorField(error.stack),
    };
  }

  if (typeof error === 'string') {
    return {
      message: truncateClientErrorField(error, 1000) || 'Unknown client error',
    };
  }

  try {
    return {
      message: truncateClientErrorField(JSON.stringify(error), 1000) || 'Unknown client error',
    };
  } catch {
    return {
      message: 'Unknown client error',
    };
  }
}

export const REDACTED = '[redacted]';
// Base for parsing relative URLs. Never echoed back: the origin is only kept
// when the caller's URL was absolute to begin with.
const URL_PARSE_BASE = 'http://siteproof.local';

// Mirrors the backend vocabulary in backend/src/lib/logSanitization.ts. The two
// packages cannot share a module, so keep these in step when either changes.
// ponytail: only the token shapes that can reach a browser are ported — path
// capability tokens and bearer/secret key=value pairs.
const PATH_TOKEN_PATTERNS: RegExp[] = [
  // Public hold-point release links carry the capability token in the path,
  // both as the app route and as the API call the page makes.
  /(\/hp-release\/(?:batch\/)?)[^/?#\s]+/gi,
  /(\/api\/holdpoints\/public\/(?:batch\/)?)[^/?#\s]+/gi,
];

/** Redact capability tokens embedded in a URL path segment. */
export function redactPath(pathname: string): string {
  let safe = pathname;
  for (const pattern of PATH_TOKEN_PATTERNS) {
    safe = safe.replace(pattern, `$1${REDACTED}`);
  }
  return safe
    .replace(/sub_invite_[^/?#\s]+/gi, REDACTED)
    .replace(/\/(?:reset|magic|verify)_[^/?#\s]+/gi, `/${REDACTED}`);
}

/** Redact secrets in free text (error messages, breadcrumb messages). */
export function redactSensitiveText(value: string): string {
  return redactPath(value)
    .replace(/\b(Bearer|ApiKey)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`)
    .replace(
      /\b(token|access_token|refresh_token|id_token|secret|password|api[-_]?key|code|state|credential|signature|authorization)=([^&\s]+)/gi,
      (_match, key: string) => `${key}=${REDACTED}`,
    );
}

/**
 * Sanitize a URL for logging: path tokens redacted, every query value and the
 * hash redacted wholesale (a value is not trusted just because its key looks
 * innocuous). Origin is preserved so breadcrumbs stay useful.
 */
export function redactUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, URL_PARSE_BASE);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return REDACTED;
    }

    const origin = rawUrl.startsWith(url.origin) ? url.origin : '';
    const query = Array.from(url.searchParams.keys())
      .map((key) => `${encodeURIComponent(key)}=${REDACTED}`)
      .join('&');

    return `${origin}${redactPath(url.pathname)}${query ? `?${query}` : ''}${
      url.hash ? `#${REDACTED}` : ''
    }`;
  } catch {
    return REDACTED;
  }
}

export function getSafeLocationPath(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const { pathname, search, hash } = window.location;
  return `${redactPath(pathname)}${search ? '?[redacted]' : ''}${hash ? '#[redacted]' : ''}`;
}

export async function reportClientError(
  error: unknown,
  errorInfo?: ClientErrorInfo,
): Promise<boolean> {
  if (!import.meta.env.PROD) {
    return false;
  }

  const serializedError = serializeClientError(error);

  try {
    const response = await fetchWithTimeout(
      apiUrl('/api/support/client-error'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...serializedError,
          componentStack: truncateClientErrorField(errorInfo?.componentStack),
          path: truncateClientErrorField(getSafeLocationPath(), 500),
          userAgent: truncateClientErrorField(
            typeof navigator === 'undefined' ? undefined : navigator.userAgent,
            500,
          ),
          timestamp: new Date().toISOString(),
        }),
      },
      10000,
    );

    return response.ok;
  } catch {
    return false;
  }
}
