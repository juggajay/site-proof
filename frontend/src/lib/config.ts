const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const PLACEHOLDER_MARKERS = ['example.', 'placeholder', 'your-'];
const API_PATH_PREFIX = '/api';

function hasPlaceholderMarker(value: string): boolean {
  const normalized = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

function normalizePublicBaseUrl(name: string, value: string | undefined): string {
  const rawValue = value?.trim() ?? '';
  if (!rawValue || rawValue === '/') {
    return '';
  }

  const withoutTrailingSlash = rawValue.replace(/\/+$/, '');
  if (withoutTrailingSlash.startsWith('/') && !withoutTrailingSlash.startsWith('//')) {
    return withoutTrailingSlash;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(withoutTrailingSlash);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL or a same-origin path`);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`${name} must use HTTP or HTTPS`);
  }

  if (import.meta.env.PROD) {
    if (parsedUrl.protocol !== 'https:') {
      throw new Error(`${name} must use HTTPS in production`);
    }

    if (LOCAL_HOSTNAMES.has(parsedUrl.hostname)) {
      throw new Error(`${name} cannot point to localhost in production`);
    }

    if (hasPlaceholderMarker(withoutTrailingSlash)) {
      throw new Error(`${name} must not use placeholder values in production`);
    }
  }

  return parsedUrl.toString().replace(/\/+$/, '');
}

const configuredApiUrl = normalizePublicBaseUrl('VITE_API_URL', import.meta.env.VITE_API_URL);
const configuredSupabaseUrl = normalizePublicBaseUrl(
  'VITE_SUPABASE_URL',
  import.meta.env.VITE_SUPABASE_URL,
);

export const API_URL = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:3001' : '');
export const SUPABASE_URL = configuredSupabaseUrl;

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedBaseUrl = API_URL.replace(/\/+$/, '');

  if (!normalizedBaseUrl) {
    return normalizedPath;
  }

  if (
    normalizedBaseUrl.endsWith(API_PATH_PREFIX) &&
    (normalizedPath === API_PATH_PREFIX || normalizedPath.startsWith(`${API_PATH_PREFIX}/`))
  ) {
    return `${normalizedBaseUrl}${normalizedPath.slice(API_PATH_PREFIX.length)}`;
  }

  return `${normalizedBaseUrl}${normalizedPath}`;
}
