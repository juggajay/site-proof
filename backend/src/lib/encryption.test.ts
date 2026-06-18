import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decrypt, encrypt, generateEncryptionKey, isEncrypted } from './encryption.js';

const ORIGINAL_ENV = {
  ALLOW_PLAINTEXT_SECRET_STORAGE: process.env.ALLOW_PLAINTEXT_SECRET_STORAGE,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  NODE_ENV: process.env.NODE_ENV,
};

function resetEncryptionEnv() {
  delete process.env.ALLOW_PLAINTEXT_SECRET_STORAGE;
  delete process.env.ENCRYPTION_KEY;
  delete process.env.NODE_ENV;
}

function restoreEncryptionEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('encryption', () => {
  beforeEach(resetEncryptionEnv);
  afterEach(restoreEncryptionEnv);

  it('encrypts and decrypts with a configured key', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_KEY = generateEncryptionKey();

    const encrypted = encrypt('sensitive secret');

    expect(encrypted).not.toBe('sensitive secret');
    expect(isEncrypted(encrypted)).toBe(true);
    expect(decrypt(encrypted)).toBe('sensitive secret');
  });

  it('allows plaintext fallback in explicit local development and test modes only', () => {
    process.env.NODE_ENV = 'development';
    expect(encrypt('local secret')).toBe('local secret');

    process.env.NODE_ENV = 'test';
    expect(encrypt('test secret')).toBe('test secret');
  });

  it('supports an explicit plaintext fallback escape hatch for local sandboxes', () => {
    process.env.NODE_ENV = 'staging';
    process.env.ALLOW_PLAINTEXT_SECRET_STORAGE = 'true';

    expect(encrypt('sandbox secret')).toBe('sandbox secret');
  });

  it('rejects missing keys in staging-like environments', () => {
    process.env.NODE_ENV = 'staging';

    expect(() => encrypt('shared secret')).toThrow('Encryption key not configured');
  });

  it('keeps legacy plaintext decrypt support while rejecting encrypted-looking values without a key', () => {
    process.env.NODE_ENV = 'staging';

    expect(decrypt('legacy plaintext')).toBe('legacy plaintext');
    expect(() => decrypt('0123456789abcdef01234567:0123456789abcdef0123456789abcdef:abcd')).toThrow(
      'Encryption key not configured',
    );
  });
});
