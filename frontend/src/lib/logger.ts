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

function getSafeLocationPath(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const { pathname, search, hash } = window.location;
  return `${pathname}${search ? '?[redacted]' : ''}${hash ? '#[redacted]' : ''}`;
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
