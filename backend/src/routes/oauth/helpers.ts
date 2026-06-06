import crypto from 'crypto';
import { AppError } from '../../lib/AppError.js';

const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface GoogleCredentialPayload {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean | string;
  aud?: string;
  iss?: string;
  exp?: number | string;
}

export function hashOAuthState(state: string): string {
  const salt = process.env.OAUTH_STATE_SALT || process.env.JWT_SECRET || '';
  return crypto.createHash('sha256').update(`${state}:${salt}`).digest('hex');
}

export function hashOAuthCallbackCode(code: string): string {
  const salt = process.env.OAUTH_CALLBACK_CODE_SALT || process.env.JWT_SECRET || '';
  return crypto.createHash('sha256').update(`${code}:${salt}`).digest('hex');
}

export function isMockOAuthEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_MOCK_OAUTH === 'true';
}

export function normalizeOAuthEmail(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();

  if (
    !normalizedEmail ||
    normalizedEmail.length > EMAIL_MAX_LENGTH ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    throw AppError.badRequest('Invalid email address');
  }

  return normalizedEmail;
}

export function formatOAuthProviderStatus(response: Response): string {
  const status =
    typeof response.status === 'number' && response.status > 0
      ? String(response.status)
      : 'unknown';
  const statusText = typeof response.statusText === 'string' ? response.statusText.trim() : '';

  return statusText ? `${status} ${statusText}` : status;
}

export function parseOAuthCallbackQueryParam(value: unknown): string | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

export function getMfaRequiredError() {
  return AppError.forbidden(
    'MFA verification required. Sign in with email and password to complete MFA.',
  );
}

export function decodeJwtPayload(credential: string): GoogleCredentialPayload {
  const parts = credential.split('.');
  if (parts.length !== 3) {
    throw AppError.badRequest('Invalid credential format');
  }

  try {
    const normalizedPayload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    );
    return JSON.parse(
      Buffer.from(paddedPayload, 'base64').toString('utf8'),
    ) as GoogleCredentialPayload;
  } catch {
    throw AppError.badRequest('Invalid credential payload');
  }
}

export function isVerifiedEmail(value: boolean | string | undefined): boolean {
  return value === true || value === 'true';
}
