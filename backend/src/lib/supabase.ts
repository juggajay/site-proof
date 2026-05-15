// Supabase client for file storage
import { createClient } from '@supabase/supabase-js';
import { logWarn } from './serverLogger.js';

function getNormalizedSupabaseUrl(): string {
  return (process.env.SUPABASE_URL?.trim() || '').replace(/\/+$/, '');
}

const supabaseUrl = process.env.SUPABASE_URL?.trim() || '';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim() || '';
const hasSupabaseCredentials = Boolean(
  supabaseUrl && supabaseServiceKey && supabaseUrl !== 'http://localhost:54321',
);
const normalizedSupabaseUrl = getNormalizedSupabaseUrl();

if (!hasSupabaseCredentials) {
  logWarn('Supabase credentials not configured. File storage will use local filesystem.');
}

export const supabase = hasSupabaseCredentials
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase storage is not configured');
  }

  return supabase;
}

// Get the public URL for a file in Supabase storage
export function getSupabasePublicUrl(bucket: string, path: string): string {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase storage is not configured');
  }

  return `${normalizedSupabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

// Documents bucket name
export const DOCUMENTS_BUCKET = 'documents';

interface SupabaseStoragePathOptions {
  bucket?: string;
  expectedPrefix?: string;
}

function normalizeStoragePathPrefix(prefix: string | undefined): string | null {
  if (!prefix) {
    return null;
  }

  const normalized = prefix.replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized.includes('\\')) {
    return null;
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return null;
  }

  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

export function getSupabaseStoragePath(
  fileUrl: string,
  bucketOrOptions: string | SupabaseStoragePathOptions = DOCUMENTS_BUCKET,
): string | null {
  const bucket =
    typeof bucketOrOptions === 'string'
      ? bucketOrOptions
      : bucketOrOptions.bucket || DOCUMENTS_BUCKET;
  const expectedStoragePrefix =
    typeof bucketOrOptions === 'string'
      ? null
      : normalizeStoragePathPrefix(bucketOrOptions.expectedPrefix);

  if (
    typeof bucketOrOptions !== 'string' &&
    bucketOrOptions.expectedPrefix &&
    !expectedStoragePrefix
  ) {
    return null;
  }

  const configuredSupabaseUrl = getNormalizedSupabaseUrl();
  if (!configuredSupabaseUrl || fileUrl.includes('\\') || /(^|\/)\.{1,2}(\/|$)/.test(fileUrl)) {
    return null;
  }

  let parsedFileUrl: URL;
  let parsedSupabaseUrl: URL;
  try {
    parsedFileUrl = new URL(fileUrl);
    parsedSupabaseUrl = new URL(configuredSupabaseUrl);
  } catch {
    return null;
  }

  if (parsedFileUrl.username || parsedFileUrl.password) {
    return null;
  }

  const expectedPathPrefix = `/storage/v1/object/public/${bucket}/`;
  if (
    parsedFileUrl.origin !== parsedSupabaseUrl.origin ||
    !parsedFileUrl.pathname.startsWith(expectedPathPrefix)
  ) {
    return null;
  }

  const encodedStoragePath = parsedFileUrl.pathname.slice(expectedPathPrefix.length);
  if (!encodedStoragePath) {
    return null;
  }

  try {
    const storagePath = decodeURIComponent(encodedStoragePath);
    const segments = storagePath.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
      return null;
    }
    if (expectedStoragePrefix && !storagePath.startsWith(expectedStoragePrefix)) {
      return null;
    }
    return storagePath;
  } catch {
    return null;
  }
}
