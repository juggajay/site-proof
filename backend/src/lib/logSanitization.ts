export const REDACTED_LOG_VALUE = '[REDACTED]';
const URL_LOG_BASE = 'http://siteproof.local';

const SENSITIVE_LOG_KEY_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /api[-_]?key/i,
  /^key$/i,
  /^code$/i,
  /^state$/i,
  /^credential$/i,
  /^authorization$/i,
  /^signature$/i,
];

function isSensitiveLogKey(key: string): boolean {
  return SENSITIVE_LOG_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function safelyDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function containsSensitiveLogText(value: string): boolean {
  if (sanitizeLogText(value) !== value) {
    return true;
  }

  const decodedValue = safelyDecodeURIComponent(value);
  return decodedValue !== value && sanitizeLogText(decodedValue) !== decodedValue;
}

export function sanitizeLogText(value: string): string {
  return value
    .replace(/\b(Bearer|ApiKey)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED_LOG_VALUE}`)
    .replace(/\b(authorization|cookie|set-cookie)\s*[:=]\s*[^,\s;]+/gi, `$1=${REDACTED_LOG_VALUE}`)
    .replace(
      /\b(token|access_token|refresh_token|id_token|secret|password|api[-_]?key|code|state|credential|signature)=([^&\s]+)/gi,
      (_match, key) => `${key}=${REDACTED_LOG_VALUE}`,
    )
    .replace(/(\/api\/holdpoints\/public\/)[^/?#\s]+/gi, `$1${REDACTED_LOG_VALUE}`)
    .replace(/\/(?:reset|magic|verify)_[^/?#\s]+/gi, `/${REDACTED_LOG_VALUE}`);
}

export function sanitizeLogValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item));
  }

  if (value && typeof value === 'object') {
    return sanitizeLogQuery(value as Record<string, unknown>);
  }

  if (typeof value === 'string') {
    return sanitizeLogText(value);
  }

  return value;
}

export function sanitizeLogQuery(query: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [
      key,
      isSensitiveLogKey(key) ? REDACTED_LOG_VALUE : sanitizeLogValue(value),
    ]),
  );
}

export function sanitizeLogPath(pathname: string): string {
  return pathname
    .replace(/(\/api\/holdpoints\/public\/)[^/?#]+/gi, `$1${REDACTED_LOG_VALUE}`)
    .replace(/\/(?:reset|magic|verify)_[^/?#]+/gi, `/${REDACTED_LOG_VALUE}`);
}

function formatQueryParam(key: string, value: string): string {
  if (isSensitiveLogKey(key) || containsSensitiveLogText(value)) {
    return `${encodeURIComponent(key)}=${REDACTED_LOG_VALUE}`;
  }

  return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function formatRedactedQuery(searchParams: URLSearchParams): string {
  return Array.from(searchParams.keys())
    .map((key) => `${encodeURIComponent(key)}=${REDACTED_LOG_VALUE}`)
    .join('&');
}

export function sanitizeLogUrl(originalUrl: string): string {
  try {
    const url = new URL(originalUrl, URL_LOG_BASE);
    const sanitizedPath = sanitizeLogPath(url.pathname);
    const params = Array.from(url.searchParams.entries())
      .map(([key, value]) => formatQueryParam(key, value))
      .join('&');

    return params ? `${sanitizedPath}?${params}` : sanitizedPath;
  } catch {
    const [pathPart, queryString] = originalUrl.split('?', 2);
    const sanitizedPath = sanitizeLogPath(pathPart || '/');
    if (!queryString) {
      return sanitizedPath;
    }

    const params = queryString
      .split('&')
      .filter(Boolean)
      .map((param) => {
        const [key = '', value = ''] = param.split('=', 2);
        return formatQueryParam(safelyDecodeURIComponent(key), safelyDecodeURIComponent(value));
      })
      .join('&');

    return params ? `${sanitizedPath}?${params}` : sanitizedPath;
  }
}

export function sanitizeUrlValueForLog(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, URL_LOG_BASE);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return REDACTED_LOG_VALUE;
    }

    const sanitizedPath = sanitizeLogPath(url.pathname);
    const params = formatRedactedQuery(url.searchParams);
    const origin = url.origin === URL_LOG_BASE ? '' : url.origin;

    return params ? `${origin}${sanitizedPath}?${params}` : `${origin}${sanitizedPath}`;
  } catch {
    return REDACTED_LOG_VALUE;
  }
}
