import { afterEach, describe, expect, it } from 'vitest';
import { AppError } from '../../lib/AppError.js';
import {
  decodeJwtPayload,
  formatOAuthProviderStatus,
  hashOAuthCallbackCode,
  hashOAuthState,
  isMockOAuthEnabled,
  isVerifiedEmail,
  normalizeOAuthEmail,
  parseOAuthCallbackQueryParam,
} from './helpers.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function encodeJwtPayload(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `header.${encoded}.signature`;
}

describe('OAuth helpers', () => {
  it('hashes state and callback codes with their dedicated salts', () => {
    process.env.JWT_SECRET = 'jwt-salt';
    process.env.OAUTH_STATE_SALT = 'state-salt';
    process.env.OAUTH_CALLBACK_CODE_SALT = 'callback-salt';

    expect(hashOAuthState('state')).toHaveLength(64);
    expect(hashOAuthCallbackCode('code')).toHaveLength(64);
    expect(hashOAuthState('state')).not.toBe(hashOAuthCallbackCode('state'));
  });

  it('normalizes valid OAuth email addresses and rejects invalid values', () => {
    expect(normalizeOAuthEmail(' USER@Example.COM ')).toBe('user@example.com');
    expect(() => normalizeOAuthEmail('not-an-email')).toThrow(AppError);
    expect(() => normalizeOAuthEmail('x'.repeat(245) + '@example.com')).toThrow(
      'Invalid email address',
    );
  });

  it('detects mock OAuth only outside production with the explicit flag enabled', () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_MOCK_OAUTH = 'true';
    expect(isMockOAuthEnabled()).toBe(true);

    process.env.NODE_ENV = 'production';
    expect(isMockOAuthEnabled()).toBe(false);

    process.env.NODE_ENV = 'test';
    process.env.ALLOW_MOCK_OAUTH = 'false';
    expect(isMockOAuthEnabled()).toBe(false);
  });

  it('formats provider response status values', () => {
    expect(
      formatOAuthProviderStatus(new Response(null, { status: 401, statusText: 'Denied' })),
    ).toBe('401 Denied');
    expect(formatOAuthProviderStatus(new Response(null, { status: 204 }))).toBe('204');
  });

  it('parses callback query params with malformed-array detection', () => {
    expect(parseOAuthCallbackQueryParam(undefined)).toBeUndefined();
    expect(parseOAuthCallbackQueryParam(' code ')).toBe('code');
    expect(parseOAuthCallbackQueryParam(' ')).toBeUndefined();
    expect(parseOAuthCallbackQueryParam(['code'])).toBeNull();
  });

  it('decodes JWT payloads and preserves the existing failure messages', () => {
    expect(
      decodeJwtPayload(encodeJwtPayload({ sub: 'google-1', email: 'user@example.com' })),
    ).toEqual({
      sub: 'google-1',
      email: 'user@example.com',
    });
    expect(() => decodeJwtPayload('bad')).toThrow('Invalid credential format');
    expect(() => decodeJwtPayload('a.not-json.c')).toThrow('Invalid credential payload');
  });

  it('accepts only boolean true or string true as verified email values', () => {
    expect(isVerifiedEmail(true)).toBe(true);
    expect(isVerifiedEmail('true')).toBe(true);
    expect(isVerifiedEmail(false)).toBe(false);
    expect(isVerifiedEmail('false')).toBe(false);
    expect(isVerifiedEmail(undefined)).toBe(false);
  });
});
