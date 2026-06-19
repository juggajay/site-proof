import crypto from 'crypto';

import { buildBackendUrl } from './runtimeConfig.js';

const DEFAULT_STORAGE_ACCESS_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function hashStoragePath(storagePath: string): string {
  return crypto.createHash('sha256').update(storagePath).digest('hex');
}

function signStorageAccessToken(
  subjectId: string,
  storagePath: string,
  expiresAtMs: number,
  secret = DEFAULT_STORAGE_ACCESS_SECRET,
): string {
  const pathHash = hashStoragePath(storagePath);
  return crypto
    .createHmac('sha256', secret)
    .update(`${subjectId}.${pathHash}.${expiresAtMs}`)
    .digest('hex');
}

export function createSignedStorageAccessToken(
  subjectId: string,
  storagePath: string,
  ttlMs: number,
  nowMs = Date.now(),
): string {
  const expiresAtMs = nowMs + ttlMs;
  const signature = signStorageAccessToken(subjectId, storagePath, expiresAtMs);
  return `${expiresAtMs}.${signature}`;
}

export function validateSignedStorageAccessToken(
  token: string | undefined,
  subjectId: string,
  storagePath: string,
  nowMs = Date.now(),
): boolean {
  if (!token) return false;

  const [expiresAtRaw, signature, ...extra] = token.split('.');
  if (extra.length > 0 || !expiresAtRaw || !signature || !/^\d+$/.test(expiresAtRaw)) {
    return false;
  }

  const expiresAtMs = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs < nowMs) {
    return false;
  }

  const expected = signStorageAccessToken(subjectId, storagePath, expiresAtMs);
  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function buildSignedStorageFileUrl(
  routePrefix: string,
  subjectId: string,
  storagePath: string,
  ttlMs: number,
): string {
  const query = new URLSearchParams({
    token: createSignedStorageAccessToken(subjectId, storagePath, ttlMs),
  });
  return buildBackendUrl(`${routePrefix}/${encodeURIComponent(subjectId)}?${query}`);
}
