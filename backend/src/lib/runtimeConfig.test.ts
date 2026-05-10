import { afterEach, describe, expect, it } from 'vitest';
import {
  buildApiUrl,
  buildBackendUrl,
  buildFrontendUrl,
  buildHttpsRedirectUrl,
  getExpressTrustProxySetting,
  getGoogleRedirectUri,
  isCorsOriginAllowed,
  validateRuntimeConfig,
} from './runtimeConfig.js';

const ORIGINAL_ENV = { ...process.env };
const VALID_JWT_SECRET = 'prod-jwt-secret-32-plus-chars-2026';
const VALID_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const VALID_RESEND_API_KEY = 're_prod_valid_api_key_123456789';
const VALID_SUPABASE_SERVICE_ROLE_KEY = 'prod-supabase-service-role-key-32-plus-chars';

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function configureProductionBase() {
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = 'postgresql://user:pass@example.com:5432/siteproof';
  process.env.JWT_SECRET = VALID_JWT_SECRET;
  process.env.ENCRYPTION_KEY = VALID_ENCRYPTION_KEY;
  process.env.RESEND_API_KEY = VALID_RESEND_API_KEY;
  process.env.EMAIL_FROM = 'noreply@siteproof.example';
  process.env.EMAIL_PROVIDER = 'resend';
  process.env.EMAIL_ENABLED = 'true';
  delete process.env.RATE_LIMIT_STORE;
  delete process.env.RATE_LIMIT_KEY_SALT;
  delete process.env.MFA_BACKUP_CODE_SECRET;
  delete process.env.API_RATE_LIMIT_MAX;
  delete process.env.AUTH_RATE_LIMIT_MAX;
  delete process.env.SUPPORT_RATE_LIMIT_MAX;
  delete process.env.AUTH_LOCKOUT_THRESHOLD;
  delete process.env.AUTH_LOCKOUT_DURATION_MS;
  delete process.env.WEBHOOK_DELIVERY_TIMEOUT_MS;
  delete process.env.ERROR_LOG_MAX_BYTES;
  delete process.env.SUPPORT_EMAIL;
  delete process.env.ALLOW_MOCK_OAUTH;
  delete process.env.ALLOW_TEST_AUTH_ENDPOINTS;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REDIRECT_URI;
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
  process.env.SUPABASE_URL = 'https://siteproof.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = VALID_SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.ALLOW_LOCAL_FILE_STORAGE;
}

describe('runtimeConfig', () => {
  it('uses local defaults outside production', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.FRONTEND_URL;
    delete process.env.BACKEND_URL;
    delete process.env.API_URL;
    process.env.PORT = '4321';

    expect(buildFrontendUrl('/settings')).toBe('http://localhost:5174/settings');
    expect(buildBackendUrl('/health')).toBe('http://localhost:4321/health');
    expect(buildApiUrl('/uploads/avatar.png')).toBe('http://localhost:4321/uploads/avatar.png');
  });

  it('uses configured public URLs and strips trailing slashes', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example/';
    process.env.BACKEND_URL = 'https://api.siteproof.example/';
    delete process.env.GOOGLE_REDIRECT_URI;

    expect(buildFrontendUrl('/dashboard')).toBe('https://app.siteproof.example/dashboard');
    expect(buildBackendUrl('/api/documents/1')).toBe(
      'https://api.siteproof.example/api/documents/1',
    );
    expect(getGoogleRedirectUri()).toBe('https://api.siteproof.example/api/auth/google/callback');
    expect(() => validateRuntimeConfig()).not.toThrow();
  });

  it('normalizes Express trust proxy settings from environment strings', () => {
    expect(getExpressTrustProxySetting(undefined)).toBeUndefined();
    expect(getExpressTrustProxySetting('')).toBeUndefined();
    expect(getExpressTrustProxySetting(' false ')).toBeUndefined();
    expect(getExpressTrustProxySetting('0')).toBeUndefined();
    expect(getExpressTrustProxySetting('no')).toBeUndefined();
    expect(getExpressTrustProxySetting('true')).toBe(true);
    expect(getExpressTrustProxySetting('yes')).toBe(true);
    expect(getExpressTrustProxySetting('1')).toBe(1);
    expect(getExpressTrustProxySetting('2')).toBe(2);
    expect(getExpressTrustProxySetting('loopback')).toBe('loopback');
  });

  it('builds HTTPS redirect targets from configured backend URL, not request host input', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example';
    process.env.BACKEND_URL = 'https://api.siteproof.example';

    expect(buildHttpsRedirectUrl('/api/projects?status=active')).toBe(
      'https://api.siteproof.example/api/projects?status=active',
    );
    expect(buildHttpsRedirectUrl('//attacker.example/login')).toBe(
      'https://api.siteproof.example/attacker.example/login',
    );
    expect(buildHttpsRedirectUrl('https://attacker.example/login')).toBe(
      'https://api.siteproof.example/https://attacker.example/login',
    );
  });

  it('fails closed when production public URLs are missing', () => {
    configureProductionBase();
    delete process.env.DATABASE_URL;
    delete process.env.FRONTEND_URL;
    delete process.env.BACKEND_URL;
    delete process.env.API_URL;

    expect(() => validateRuntimeConfig()).toThrow('DATABASE_URL');

    process.env.DATABASE_URL = 'postgresql://user:pass@example.com:5432/siteproof';
    expect(() => validateRuntimeConfig()).toThrow('FRONTEND_URL');

    process.env.FRONTEND_URL = 'https://app.siteproof.example';
    expect(() => validateRuntimeConfig()).toThrow('BACKEND_URL, API_URL');
  });

  it('rejects malformed public URLs', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'siteproof.example';

    expect(() => buildFrontendUrl('/dashboard')).toThrow(
      'FRONTEND_URL must be an absolute public URL',
    );
  });

  it('rejects localhost production URLs during startup validation', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'http://localhost:5174';
    process.env.BACKEND_URL = 'https://api.siteproof.example';

    expect(() => validateRuntimeConfig()).toThrow('FRONTEND_URL must use https in production');
  });

  it('rejects weak or placeholder production security secrets', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example';
    process.env.BACKEND_URL = 'https://api.siteproof.example';

    process.env.JWT_SECRET = 'your-secure-secret-key-here';
    expect(() => validateRuntimeConfig()).toThrow('JWT_SECRET');

    process.env.JWT_SECRET = VALID_JWT_SECRET;
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    expect(() => validateRuntimeConfig()).toThrow('ENCRYPTION_KEY');

    process.env.ENCRYPTION_KEY = VALID_ENCRYPTION_KEY;
    process.env.RATE_LIMIT_KEY_SALT = 'change-me';
    expect(() => validateRuntimeConfig()).toThrow('RATE_LIMIT_KEY_SALT');

    delete process.env.RATE_LIMIT_KEY_SALT;
    process.env.MFA_BACKUP_CODE_SECRET = 'dev-mfa-backup-code-secret';
    expect(() => validateRuntimeConfig()).toThrow('MFA_BACKUP_CODE_SECRET');
  });

  it('rejects production email mock mode and missing delivery keys', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example';
    process.env.BACKEND_URL = 'https://api.siteproof.example';

    process.env.EMAIL_PROVIDER = 'mock';
    expect(() => validateRuntimeConfig()).toThrow('EMAIL_PROVIDER=mock');

    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_your_resend_api_key';
    expect(() => validateRuntimeConfig()).toThrow('RESEND_API_KEY');

    process.env.EMAIL_ENABLED = 'false';
    expect(() => validateRuntimeConfig()).not.toThrow();
  });

  it('rejects missing or invalid production email sender addresses', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example';
    process.env.BACKEND_URL = 'https://api.siteproof.example';

    delete process.env.EMAIL_FROM;
    expect(() => validateRuntimeConfig()).toThrow('EMAIL_FROM');

    process.env.EMAIL_FROM = 'your-email@example.com';
    expect(() => validateRuntimeConfig()).toThrow('EMAIL_FROM');

    process.env.EMAIL_FROM = 'SiteProof <noreply@siteproof.example>';
    expect(() => validateRuntimeConfig()).not.toThrow();
  });

  it('rejects malformed production support inbox addresses', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example';
    process.env.BACKEND_URL = 'https://api.siteproof.example';

    process.env.SUPPORT_EMAIL = 'not-an-email';
    expect(() => validateRuntimeConfig()).toThrow('SUPPORT_EMAIL');

    process.env.SUPPORT_EMAIL = 'support@siteproof.example';
    expect(() => validateRuntimeConfig()).not.toThrow();
  });

  it('rejects memory rate limiting in production', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example';
    process.env.BACKEND_URL = 'https://api.siteproof.example';
    process.env.RATE_LIMIT_STORE = 'memory';

    expect(() => validateRuntimeConfig()).toThrow('RATE_LIMIT_STORE=memory');
  });

  it('rejects production mock OAuth opt-in', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example';
    process.env.BACKEND_URL = 'https://api.siteproof.example';
    process.env.ALLOW_MOCK_OAUTH = 'true';

    expect(() => validateRuntimeConfig()).toThrow('ALLOW_MOCK_OAUTH=true');
  });

  it('rejects production test auth endpoint opt-in', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example';
    process.env.BACKEND_URL = 'https://api.siteproof.example';
    process.env.ALLOW_TEST_AUTH_ENDPOINTS = 'true';

    expect(() => validateRuntimeConfig()).toThrow('ALLOW_TEST_AUTH_ENDPOINTS=true');
  });

  it('rejects non-public production Google OAuth redirect URIs', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example';
    process.env.BACKEND_URL = 'https://api.siteproof.example';

    process.env.GOOGLE_CLIENT_ID = 'siteproof.apps.googleusercontent.com';
    expect(() => validateRuntimeConfig()).toThrow('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');

    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret-for-production';
    process.env.GOOGLE_CLIENT_ID = 'not-a-google-web-client-id';
    expect(() => validateRuntimeConfig()).toThrow('GOOGLE_CLIENT_ID');

    process.env.GOOGLE_CLIENT_ID = 'siteproof.apps.googleusercontent.com';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/auth/google/callback';
    expect(() => validateRuntimeConfig()).toThrow('GOOGLE_REDIRECT_URI must use https');

    process.env.GOOGLE_REDIRECT_URI = 'https://api.siteproof.example/api/auth/google/callback';
    expect(() => validateRuntimeConfig()).not.toThrow();
  });

  it('rejects malformed production rate limit settings', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example';
    process.env.BACKEND_URL = 'https://api.siteproof.example';

    process.env.API_RATE_LIMIT_MAX = 'abc';
    expect(() => validateRuntimeConfig()).toThrow('API_RATE_LIMIT_MAX');

    process.env.API_RATE_LIMIT_MAX = '1000';
    process.env.AUTH_RATE_LIMIT_MAX = '0';
    expect(() => validateRuntimeConfig()).toThrow('AUTH_RATE_LIMIT_MAX');

    process.env.AUTH_RATE_LIMIT_MAX = '10';
    process.env.SUPPORT_RATE_LIMIT_MAX = 'many';
    expect(() => validateRuntimeConfig()).toThrow('SUPPORT_RATE_LIMIT_MAX');

    process.env.SUPPORT_RATE_LIMIT_MAX = '10';
    process.env.AUTH_LOCKOUT_THRESHOLD = '1.5';
    expect(() => validateRuntimeConfig()).toThrow('AUTH_LOCKOUT_THRESHOLD');

    process.env.AUTH_LOCKOUT_THRESHOLD = '5';
    process.env.AUTH_LOCKOUT_DURATION_MS = '-1';
    expect(() => validateRuntimeConfig()).toThrow('AUTH_LOCKOUT_DURATION_MS');

    process.env.AUTH_LOCKOUT_DURATION_MS = '900000';
    process.env.WEBHOOK_DELIVERY_TIMEOUT_MS = 'slow';
    expect(() => validateRuntimeConfig()).toThrow('WEBHOOK_DELIVERY_TIMEOUT_MS');

    process.env.WEBHOOK_DELIVERY_TIMEOUT_MS = '10000';
    process.env.ERROR_LOG_MAX_BYTES = 'small';
    expect(() => validateRuntimeConfig()).toThrow('ERROR_LOG_MAX_BYTES');

    process.env.ERROR_LOG_MAX_BYTES = '5242880';
    expect(() => validateRuntimeConfig()).not.toThrow();
  });

  it('rejects partial production VAPID push notification configuration', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example';
    process.env.BACKEND_URL = 'https://api.siteproof.example';

    process.env.VAPID_PUBLIC_KEY = 'public-key-without-private-key';
    expect(() => validateRuntimeConfig()).toThrow('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');

    process.env.VAPID_PRIVATE_KEY = 'private-key';
    expect(() => validateRuntimeConfig()).toThrow('VAPID_SUBJECT');

    process.env.VAPID_SUBJECT = 'mailto:push@siteproof.example';
    expect(() => validateRuntimeConfig()).not.toThrow();
  });

  it('rejects invalid production VAPID subjects when push keys are configured', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example';
    process.env.BACKEND_URL = 'https://api.siteproof.example';
    process.env.VAPID_PUBLIC_KEY = 'public-key';
    process.env.VAPID_PRIVATE_KEY = 'private-key';

    process.env.VAPID_SUBJECT = 'mailto:not-an-email';
    expect(() => validateRuntimeConfig()).toThrow('VAPID_SUBJECT');

    process.env.VAPID_SUBJECT = 'http://localhost/push';
    expect(() => validateRuntimeConfig()).toThrow('VAPID_SUBJECT must use https');

    process.env.VAPID_SUBJECT = 'https://push.siteproof.example';
    expect(() => validateRuntimeConfig()).not.toThrow();
  });

  it('requires durable production file storage or explicit local storage opt-in', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example';
    process.env.BACKEND_URL = 'https://api.siteproof.example';

    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    expect(() => validateRuntimeConfig()).toThrow('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

    process.env.ALLOW_LOCAL_FILE_STORAGE = 'true';
    expect(() => validateRuntimeConfig()).not.toThrow();
  });

  it('rejects partial or non-public production Supabase storage configuration', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example';
    process.env.BACKEND_URL = 'https://api.siteproof.example';

    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_ANON_KEY = 'anon-key-is-not-enough-for-server-storage';
    expect(() => validateRuntimeConfig()).toThrow(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured together',
    );

    delete process.env.SUPABASE_ANON_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = VALID_SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = 'http://localhost:54321';
    expect(() => validateRuntimeConfig()).toThrow('SUPABASE_URL must use https in production');
  });

  it('matches production CORS origins against the normalized frontend URL', () => {
    configureProductionBase();
    process.env.FRONTEND_URL = 'https://app.siteproof.example/';
    process.env.BACKEND_URL = 'https://api.siteproof.example';

    expect(isCorsOriginAllowed('https://app.siteproof.example')).toBe(true);
    expect(isCorsOriginAllowed('https://app.siteproof.example/')).toBe(false);
    expect(isCorsOriginAllowed('https://attacker.example')).toBe(false);
    expect(isCorsOriginAllowed(undefined)).toBe(false);
  });

  it('allows local browser and no-origin requests only outside production', () => {
    process.env.NODE_ENV = 'development';

    expect(isCorsOriginAllowed(undefined)).toBe(true);
    expect(isCorsOriginAllowed('http://localhost:5174')).toBe(true);
    expect(isCorsOriginAllowed('http://127.0.0.1:5174')).toBe(true);
    expect(isCorsOriginAllowed('https://app.siteproof.example')).toBe(false);
  });
});
