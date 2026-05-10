const DEFAULT_FRONTEND_URL = 'http://localhost:5174';
const SECRET_PLACEHOLDER_MARKERS = [
  'placeholder',
  'your-',
  'your_',
  'change-me',
  'changeme',
  'dev-secret',
  'mock-',
];

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function normalizePublicUrl(name: string, rawValue: string): string {
  const value = rawValue.trim();

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('URL must use http or https');
    }

    return url.toString().replace(/\/$/, '');
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Invalid URL';
    throw new Error(`FATAL: ${name} must be an absolute public URL (${reason})`);
  }
}

function assertProductionPublicUrl(name: string, urlValue: string): void {
  const url = new URL(urlValue);
  if (url.protocol !== 'https:') {
    throw new Error(`FATAL: ${name} must use https in production`);
  }

  if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) {
    throw new Error(`FATAL: ${name} cannot point to localhost in production`);
  }
}

function envUrl(name: string, fallback: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    if (isProduction()) {
      throw new Error(`FATAL: ${name} environment variable is required in production`);
    }

    return normalizePublicUrl(name, fallback);
  }

  return normalizePublicUrl(name, value);
}

function firstConfiguredUrl(names: string[], fallback: string): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return normalizePublicUrl(name, value);
    }
  }

  if (isProduction()) {
    throw new Error(`FATAL: one of ${names.join(', ')} must be configured in production`);
  }

  return normalizePublicUrl(names[0], fallback);
}

function appendPath(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

function normalizeRedirectPath(path: string): string {
  const pathWithLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  return pathWithLeadingSlash.replace(/^\/+/, '/');
}

function isPlaceholderSecret(value: string): boolean {
  const normalized = value.toLowerCase();
  return SECRET_PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

function assertProductionSecret(name: string, value: string | undefined, minLength = 32): string {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    throw new Error(`FATAL: ${name} environment variable is required in production`);
  }

  if (trimmedValue.length < minLength) {
    throw new Error(`FATAL: ${name} must be at least ${minLength} characters in production`);
  }

  if (isPlaceholderSecret(trimmedValue)) {
    throw new Error(`FATAL: ${name} must not use a placeholder or development value in production`);
  }

  return trimmedValue;
}

function assertProductionHexKey(name: string, value: string | undefined, byteLength: number): void {
  const expectedLength = byteLength * 2;
  const trimmedValue = assertProductionSecret(name, value, expectedLength);

  if (!/^[a-f0-9]+$/i.test(trimmedValue)) {
    throw new Error(
      `FATAL: ${name} must be a ${expectedLength}-character hex string in production`,
    );
  }

  if (/^([a-f0-9])\1+$/i.test(trimmedValue)) {
    throw new Error(`FATAL: ${name} must not use a repeated-character value in production`);
  }
}

function isValidResendApiKey(apiKey: string | undefined): boolean {
  return Boolean(apiKey && apiKey.startsWith('re_') && !isPlaceholderSecret(apiKey));
}

function isExplicitlyEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes'].includes(value?.trim().toLowerCase() ?? '');
}

export function getExpressTrustProxySetting(
  value = process.env.TRUST_PROXY,
): boolean | number | string | undefined {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return undefined;
  }

  const normalizedValue = trimmedValue.toLowerCase();
  if (['0', 'false', 'no'].includes(normalizedValue)) {
    return undefined;
  }
  if (['true', 'yes'].includes(normalizedValue)) {
    return true;
  }

  const numericValue = Number(trimmedValue);
  if (Number.isInteger(numericValue) && numericValue > 0) {
    return numericValue;
  }

  return trimmedValue;
}

function assertProductionStorageConfig(): void {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
  const hasAnySupabaseValue = Boolean(supabaseUrl || supabaseServiceRoleKey || supabaseAnonKey);

  if (!hasAnySupabaseValue) {
    if (isExplicitlyEnabled(process.env.ALLOW_LOCAL_FILE_STORAGE)) {
      return;
    }

    throw new Error(
      'FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for production file storage unless ALLOW_LOCAL_FILE_STORAGE=true is set',
    );
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured together in production',
    );
  }

  const normalizedSupabaseUrl = normalizePublicUrl('SUPABASE_URL', supabaseUrl);
  assertProductionPublicUrl('SUPABASE_URL', normalizedSupabaseUrl);
  assertProductionSecret('SUPABASE_SERVICE_ROLE_KEY', supabaseServiceRoleKey);
}

function assertOptionalPositiveInteger(name: string): void {
  const value = process.env[name]?.trim();
  if (!value) {
    return;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`FATAL: ${name} must be a positive integer in production`);
  }
}

function assertEmailAddress(name: string, value: string): void {
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`FATAL: ${name} must be a valid email address in production`);
  }
}

function assertOptionalEmail(name: string): void {
  const value = process.env[name]?.trim();
  if (!value) {
    return;
  }

  assertEmailAddress(name, value);
}

function assertProductionEmailFrom(): void {
  if (process.env.EMAIL_ENABLED === 'false') {
    return;
  }

  const value = process.env.EMAIL_FROM?.trim();
  if (!value) {
    throw new Error('FATAL: EMAIL_FROM must be configured for production email delivery');
  }

  if (/[\r\n]/.test(value)) {
    throw new Error('FATAL: EMAIL_FROM must be a valid email sender in production');
  }

  if (isPlaceholderSecret(value)) {
    throw new Error(
      'FATAL: EMAIL_FROM must not use a placeholder or development value in production',
    );
  }

  const displayNameMatch = value.match(/^[^<>]*<([^<>]+)>$/);
  assertEmailAddress('EMAIL_FROM', (displayNameMatch?.[1] ?? value).trim());
}

function assertProductionVapidConfig(): void {
  const publicKeyConfigured = Boolean(process.env.VAPID_PUBLIC_KEY?.trim());
  const privateKeyConfigured = Boolean(process.env.VAPID_PRIVATE_KEY?.trim());

  if (publicKeyConfigured !== privateKeyConfigured) {
    throw new Error(
      'FATAL: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be configured together in production',
    );
  }

  if (!publicKeyConfigured) {
    return;
  }

  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!subject) {
    throw new Error('FATAL: VAPID_SUBJECT must be configured when production VAPID keys are set');
  }

  if (isPlaceholderSecret(subject)) {
    throw new Error(
      'FATAL: VAPID_SUBJECT must not use a placeholder or development value in production',
    );
  }

  if (subject.toLowerCase().startsWith('mailto:')) {
    assertEmailAddress('VAPID_SUBJECT', subject.slice('mailto:'.length));
    return;
  }

  assertProductionPublicUrl('VAPID_SUBJECT', normalizePublicUrl('VAPID_SUBJECT', subject));
}

function assertProductionGoogleOAuthConfig(): void {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();

  if (!clientId && !clientSecret && !redirectUri) {
    return;
  }

  if (!clientId || !clientSecret) {
    throw new Error(
      'FATAL: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together in production',
    );
  }

  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    throw new Error('FATAL: GOOGLE_CLIENT_ID must be a Google OAuth web client id in production');
  }

  assertProductionSecret('GOOGLE_CLIENT_SECRET', clientSecret, 16);
  assertProductionPublicUrl('GOOGLE_REDIRECT_URI', getGoogleRedirectUri());
}

const LOCAL_DEVELOPMENT_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

export function getFrontendUrl(): string {
  return envUrl('FRONTEND_URL', DEFAULT_FRONTEND_URL);
}

export function getBackendUrl(): string {
  return firstConfiguredUrl(
    ['BACKEND_URL', 'API_URL'],
    `http://localhost:${process.env.PORT || 3001}`,
  );
}

export function getApiUrl(): string {
  return firstConfiguredUrl(
    ['API_URL', 'BACKEND_URL'],
    `http://localhost:${process.env.PORT || 3001}`,
  );
}

export function getGoogleRedirectUri(): string {
  const configuredRedirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configuredRedirectUri) {
    return normalizePublicUrl('GOOGLE_REDIRECT_URI', configuredRedirectUri);
  }

  return buildBackendUrl('/api/auth/google/callback');
}

export function buildFrontendUrl(path: string): string {
  return appendPath(getFrontendUrl(), path);
}

export function buildBackendUrl(path: string): string {
  return appendPath(getBackendUrl(), path);
}

export function buildApiUrl(path: string): string {
  return appendPath(getApiUrl(), path);
}

export function buildHttpsRedirectUrl(path: string): string {
  return appendPath(getBackendUrl(), normalizeRedirectPath(path));
}

export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    return !isProduction();
  }

  if (isProduction()) {
    return origin === getFrontendUrl();
  }

  return LOCAL_DEVELOPMENT_ORIGIN.test(origin);
}

export function validateRuntimeConfig(): void {
  if (!isProduction()) {
    return;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('FATAL: DATABASE_URL environment variable is required in production');
  }

  assertProductionSecret('JWT_SECRET', process.env.JWT_SECRET);
  assertProductionHexKey('ENCRYPTION_KEY', process.env.ENCRYPTION_KEY, 32);

  if (process.env.RATE_LIMIT_STORE?.toLowerCase() === 'memory') {
    throw new Error('FATAL: RATE_LIMIT_STORE=memory is not allowed in production');
  }
  if (isExplicitlyEnabled(process.env.ALLOW_MOCK_OAUTH)) {
    throw new Error('FATAL: ALLOW_MOCK_OAUTH=true is not allowed in production');
  }
  if (isExplicitlyEnabled(process.env.ALLOW_TEST_AUTH_ENDPOINTS)) {
    throw new Error('FATAL: ALLOW_TEST_AUTH_ENDPOINTS=true is not allowed in production');
  }
  assertOptionalPositiveInteger('API_RATE_LIMIT_MAX');
  assertOptionalPositiveInteger('AUTH_RATE_LIMIT_MAX');
  assertOptionalPositiveInteger('SUPPORT_RATE_LIMIT_MAX');
  assertOptionalPositiveInteger('AUTH_LOCKOUT_THRESHOLD');
  assertOptionalPositiveInteger('AUTH_LOCKOUT_DURATION_MS');
  assertOptionalPositiveInteger('WEBHOOK_DELIVERY_TIMEOUT_MS');
  assertOptionalPositiveInteger('ERROR_LOG_MAX_BYTES');
  if (process.env.RATE_LIMIT_KEY_SALT?.trim()) {
    assertProductionSecret('RATE_LIMIT_KEY_SALT', process.env.RATE_LIMIT_KEY_SALT, 16);
  }
  if (process.env.MFA_BACKUP_CODE_SECRET?.trim()) {
    assertProductionSecret('MFA_BACKUP_CODE_SECRET', process.env.MFA_BACKUP_CODE_SECRET);
  }

  if (process.env.EMAIL_PROVIDER === 'mock') {
    throw new Error('FATAL: EMAIL_PROVIDER=mock is not allowed in production');
  }
  if (process.env.EMAIL_ENABLED !== 'false' && !isValidResendApiKey(process.env.RESEND_API_KEY)) {
    throw new Error('FATAL: RESEND_API_KEY must be configured for production email delivery');
  }
  assertProductionEmailFrom();
  assertOptionalEmail('SUPPORT_EMAIL');

  assertProductionVapidConfig();

  const frontendUrl = getFrontendUrl();
  const backendUrl = getBackendUrl();

  assertProductionPublicUrl('FRONTEND_URL', frontendUrl);
  assertProductionPublicUrl('BACKEND_URL/API_URL', backendUrl);
  assertProductionStorageConfig();

  assertProductionGoogleOAuthConfig();
}
