export type PasswordHashKind = 'bcrypt' | 'legacy_sha256' | 'empty' | 'unknown';

const BCRYPT_PASSWORD_HASH_PATTERN = /^\$2[aby]\$/;
const LEGACY_SHA256_PASSWORD_HASH_PATTERN = /^[a-f0-9]{64}$/i;

export function classifyPasswordHash(hash: string | null | undefined): PasswordHashKind {
  if (!hash) {
    return 'empty';
  }

  if (BCRYPT_PASSWORD_HASH_PATTERN.test(hash)) {
    return 'bcrypt';
  }

  if (LEGACY_SHA256_PASSWORD_HASH_PATTERN.test(hash)) {
    return 'legacy_sha256';
  }

  return 'unknown';
}

export function isBcryptPasswordHash(hash: string): boolean {
  return classifyPasswordHash(hash) === 'bcrypt';
}

export function isLegacySha256PasswordHash(hash: string): boolean {
  return classifyPasswordHash(hash) === 'legacy_sha256';
}
