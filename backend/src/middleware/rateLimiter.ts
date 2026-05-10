// Feature #742: API rate limiting middleware
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/AppError.js';
import { prisma } from '../lib/prisma.js';
import { logInfo } from '../lib/serverLogger.js';

interface RateLimitEntry {
  count: number;
  firstRequestTime: number;
}

interface LockoutEntry {
  failedAttempts: number;
  lockedUntil: number | null;
  lastAttemptTime: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

type RateLimitScope = 'api' | 'auth' | 'support';
type AuthLockoutResult = { locked: boolean; remainingSeconds: number };

const rateLimitStore = new Map<string, RateLimitEntry>();
const authRateLimitStore = new Map<string, RateLimitEntry>();
const lockoutStore = new Map<string, LockoutEntry>();

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`FATAL: ${name} must be a positive integer`);
    }

    return fallback;
  }

  return value;
}

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = readPositiveIntegerEnv('API_RATE_LIMIT_MAX', 1000);
const AUTH_WINDOW_MS = 60 * 1000;
const AUTH_MAX_REQUESTS = readPositiveIntegerEnv(
  'AUTH_RATE_LIMIT_MAX',
  process.env.NODE_ENV === 'production' ? 10 : 50,
);
const SUPPORT_WINDOW_MS = 60 * 1000;
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const MAX_MAP_SIZE = 10000;
const LOCKOUT_THRESHOLD = readPositiveIntegerEnv('AUTH_LOCKOUT_THRESHOLD', 5);
const LOCKOUT_DURATION = readPositiveIntegerEnv('AUTH_LOCKOUT_DURATION_MS', 15 * 60 * 1000);
const LOCKOUT_STALE_MS = 60 * 60 * 1000;

let lastDatabaseCleanup = 0;

function getSupportMaxRequests(): number {
  return readPositiveIntegerEnv(
    'SUPPORT_RATE_LIMIT_MAX',
    process.env.NODE_ENV === 'production' ? 10 : 50,
  );
}

function usesDatabaseRateLimitStore(): boolean {
  const configuredStore = process.env.RATE_LIMIT_STORE?.toLowerCase();
  if (configuredStore === 'database') {
    return true;
  }
  if (configuredStore === 'memory') {
    return false;
  }
  return process.env.NODE_ENV === 'production';
}

function hashStorageKey(scope: string, identifier: string): string {
  const salt = process.env.RATE_LIMIT_KEY_SALT || process.env.JWT_SECRET || '';
  return `${scope}:${crypto.createHash('sha256').update(`${scope}:${identifier}:${salt}`).digest('hex')}`;
}

function cleanupRateLimitMap(store: Map<string, RateLimitEntry>, windowMs: number) {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.firstRequestTime > windowMs * 2) {
      store.delete(key);
    }
  }

  if (store.size > MAX_MAP_SIZE) {
    const entries = Array.from(store.entries());
    entries.sort((a, b) => a[1].firstRequestTime - b[1].firstRequestTime);
    for (const [key] of entries.slice(0, entries.length - MAX_MAP_SIZE)) {
      store.delete(key);
    }
  }
}

function cleanupLockoutMap() {
  const now = Date.now();
  for (const [key, entry] of lockoutStore.entries()) {
    if (now - entry.lastAttemptTime > LOCKOUT_STALE_MS) {
      lockoutStore.delete(key);
    }
  }
}

setInterval(() => {
  cleanupRateLimitMap(rateLimitStore, WINDOW_MS);
  cleanupRateLimitMap(authRateLimitStore, AUTH_WINDOW_MS);
  cleanupLockoutMap();
}, CLEANUP_INTERVAL).unref?.();

async function cleanupDatabaseStores(now: Date) {
  if (!usesDatabaseRateLimitStore() || now.getTime() - lastDatabaseCleanup < CLEANUP_INTERVAL) {
    return;
  }

  lastDatabaseCleanup = now.getTime();
  await Promise.all([
    prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.authLockout.deleteMany({
      where: { lastAttemptAt: { lt: new Date(now.getTime() - LOCKOUT_STALE_MS) } },
    }),
  ]);
}

/**
 * Get client IP address from request.
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  // In production, Express owns proxy trust and exposes the sanitized client address via req.ip.
  if (process.env.NODE_ENV !== 'production' && forwardedFor) {
    const ips = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(',');
    const firstIp = ips[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function consumeMemoryRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number,
): RateLimitResult {
  const now = Date.now();
  let entry = key.startsWith('auth:') ? authRateLimitStore.get(key) : rateLimitStore.get(key);
  const store = key.startsWith('auth:') ? authRateLimitStore : rateLimitStore;

  if (!entry || now - entry.firstRequestTime > windowMs) {
    entry = { count: 1, firstRequestTime: now };
    store.set(key, entry);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetSeconds: Math.ceil(windowMs / 1000),
    };
  }

  entry.count += 1;
  const resetSeconds = Math.max(1, Math.ceil((entry.firstRequestTime + windowMs - now) / 1000));

  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetSeconds,
  };
}

async function consumeDatabaseRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - windowMs);
  const expiresAt = new Date(now.getTime() + windowMs * 2);

  await cleanupDatabaseStores(now);

  const rows = await prisma.$queryRaw<Array<{ count: number | bigint; window_start: Date }>>`
    INSERT INTO "rate_limit_buckets" ("key", "count", "window_start", "expires_at", "created_at", "updated_at")
    VALUES (${key}, 1, ${now}, ${expiresAt}, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit_buckets"."window_start" <= ${windowCutoff} THEN 1
        ELSE "rate_limit_buckets"."count" + 1
      END,
      "window_start" = CASE
        WHEN "rate_limit_buckets"."window_start" <= ${windowCutoff} THEN ${now}
        ELSE "rate_limit_buckets"."window_start"
      END,
      "expires_at" = CASE
        WHEN "rate_limit_buckets"."window_start" <= ${windowCutoff} THEN ${expiresAt}
        ELSE "rate_limit_buckets"."expires_at"
      END,
      "updated_at" = ${now}
    RETURNING "count", "window_start";
  `;

  const bucket = rows[0];
  const count = Number(bucket?.count ?? 1);
  const windowStart = bucket?.window_start
    ? new Date(bucket.window_start).getTime()
    : now.getTime();
  const resetSeconds = Math.max(1, Math.ceil((windowStart + windowMs - now.getTime()) / 1000));

  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
    resetSeconds,
  };
}

async function consumeRateLimit(
  scope: RateLimitScope,
  identifier: string,
  windowMs: number,
  maxRequests: number,
): Promise<RateLimitResult> {
  const key = hashStorageKey(scope, identifier);
  if (usesDatabaseRateLimitStore()) {
    return consumeDatabaseRateLimit(key, windowMs, maxRequests);
  }
  return consumeMemoryRateLimit(`${scope}:${key}`, windowMs, maxRequests);
}

async function handleRateLimit(req: Request, res: Response, next: NextFunction) {
  const result = await consumeRateLimit('api', getClientIp(req), WINDOW_MS, MAX_REQUESTS);
  setRateLimitHeaders(res, MAX_REQUESTS, result.remaining, result.resetSeconds);

  if (!result.allowed) {
    throw new AppError(
      429,
      `Rate limit exceeded. Maximum ${MAX_REQUESTS} requests per minute. Please try again in ${result.resetSeconds} seconds.`,
      'RATE_LIMITED',
      { retryAfter: result.resetSeconds },
    );
  }

  next();
}

/**
 * Rate limiting middleware.
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  void handleRateLimit(req, res, next).catch(next);
}

/**
 * Set rate limit headers on response.
 */
function setRateLimitHeaders(
  res: Response,
  limit: number,
  remaining: number,
  resetSeconds: number,
) {
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', resetSeconds);
}

/**
 * Check if an IP is currently locked out.
 */
export async function isLockedOut(ip: string): Promise<AuthLockoutResult> {
  const key = hashStorageKey('auth-lockout', ip);

  if (!usesDatabaseRateLimitStore()) {
    const entry = lockoutStore.get(key);
    if (!entry?.lockedUntil) {
      return { locked: false, remainingSeconds: 0 };
    }

    const now = Date.now();
    if (now < entry.lockedUntil) {
      return {
        locked: true,
        remainingSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
      };
    }

    entry.lockedUntil = null;
    entry.failedAttempts = 0;
    return { locked: false, remainingSeconds: 0 };
  }

  const entry = await prisma.authLockout.findUnique({ where: { key } });
  if (!entry?.lockedUntil) {
    return { locked: false, remainingSeconds: 0 };
  }

  const now = Date.now();
  const lockedUntil = entry.lockedUntil.getTime();
  if (now < lockedUntil) {
    return {
      locked: true,
      remainingSeconds: Math.ceil((lockedUntil - now) / 1000),
    };
  }

  await prisma.authLockout.update({
    where: { key },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      lastAttemptAt: new Date(),
    },
  });

  return { locked: false, remainingSeconds: 0 };
}

/**
 * Record a failed auth attempt. Call this from auth routes on failed login/MFA.
 */
export async function recordFailedAuthAttempt(ip: string): Promise<void> {
  const now = new Date();
  const key = hashStorageKey('auth-lockout', ip);

  if (!usesDatabaseRateLimitStore()) {
    let entry = lockoutStore.get(key);

    if (
      !entry ||
      now.getTime() - entry.lastAttemptTime > LOCKOUT_STALE_MS ||
      (entry.lockedUntil !== null && entry.lockedUntil <= now.getTime())
    ) {
      entry = { failedAttempts: 1, lockedUntil: null, lastAttemptTime: now.getTime() };
      lockoutStore.set(key, entry);
      return;
    }

    entry.failedAttempts += 1;
    entry.lastAttemptTime = now.getTime();

    if (entry.failedAttempts >= LOCKOUT_THRESHOLD) {
      entry.lockedUntil = now.getTime() + LOCKOUT_DURATION;
      logInfo(
        `[SECURITY] Authentication source locked for ${LOCKOUT_DURATION / 60000} minutes after ${entry.failedAttempts} failed attempts`,
      );
    }
    return;
  }

  const staleBefore = new Date(now.getTime() - LOCKOUT_STALE_MS);
  const lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION);
  const rows = await prisma.$queryRaw<
    Array<{ failed_attempts: number | bigint; locked_until: Date | null }>
  >`
    INSERT INTO "auth_lockouts" ("key", "failed_attempts", "locked_until", "last_attempt_at", "created_at", "updated_at")
    VALUES (${key}, 1, NULL, ${now}, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "failed_attempts" = CASE
        WHEN "auth_lockouts"."last_attempt_at" < ${staleBefore}
          OR ("auth_lockouts"."locked_until" IS NOT NULL AND "auth_lockouts"."locked_until" <= ${now})
        THEN 1
        ELSE "auth_lockouts"."failed_attempts" + 1
      END,
      "locked_until" = CASE
        WHEN "auth_lockouts"."last_attempt_at" < ${staleBefore}
          OR ("auth_lockouts"."locked_until" IS NOT NULL AND "auth_lockouts"."locked_until" <= ${now})
        THEN NULL
        WHEN "auth_lockouts"."failed_attempts" + 1 >= ${LOCKOUT_THRESHOLD}
        THEN ${lockedUntil}
        ELSE "auth_lockouts"."locked_until"
      END,
      "last_attempt_at" = ${now},
      "updated_at" = ${now}
    RETURNING "failed_attempts", "locked_until";
  `;

  const entry = rows[0];
  if (entry?.locked_until) {
    logInfo(
      `[SECURITY] Authentication source locked for ${LOCKOUT_DURATION / 60000} minutes after ${Number(entry.failed_attempts)} failed attempts`,
    );
  }
}

/**
 * Clear failed attempts on successful login.
 */
export async function clearFailedAuthAttempts(ip: string): Promise<void> {
  const key = hashStorageKey('auth-lockout', ip);

  if (!usesDatabaseRateLimitStore()) {
    lockoutStore.delete(key);
    return;
  }

  await prisma.authLockout.deleteMany({ where: { key } });
}

async function handleAuthRateLimit(req: Request, res: Response, next: NextFunction) {
  const clientIp = getClientIp(req);
  const lockout = await isLockedOut(clientIp);
  if (lockout.locked) {
    throw new AppError(
      429,
      `Too many failed attempts. Please try again in ${Math.ceil(lockout.remainingSeconds / 60)} minutes.`,
      'ACCOUNT_LOCKED',
      { retryAfter: lockout.remainingSeconds, locked: true },
    );
  }

  const result = await consumeRateLimit('auth', clientIp, AUTH_WINDOW_MS, AUTH_MAX_REQUESTS);
  setRateLimitHeaders(res, AUTH_MAX_REQUESTS, result.remaining, result.resetSeconds);

  if (!result.allowed) {
    throw new AppError(
      429,
      `Too many authentication attempts. Please try again in ${result.resetSeconds} seconds.`,
      'RATE_LIMITED',
      { retryAfter: result.resetSeconds },
    );
  }

  next();
}

/**
 * Stricter rate limiter for auth endpoints.
 */
export function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  void handleAuthRateLimit(req, res, next).catch(next);
}

async function handleSupportRateLimit(req: Request, res: Response, next: NextFunction) {
  const maxRequests = getSupportMaxRequests();
  const result = await consumeRateLimit(
    'support',
    getClientIp(req),
    SUPPORT_WINDOW_MS,
    maxRequests,
  );
  setRateLimitHeaders(res, maxRequests, result.remaining, result.resetSeconds);

  if (!result.allowed) {
    throw new AppError(
      429,
      `Too many support requests. Maximum ${maxRequests} requests per minute. Please try again in ${result.resetSeconds} seconds.`,
      'RATE_LIMITED',
      { retryAfter: result.resetSeconds },
    );
  }

  next();
}

/**
 * Stricter limiter for public support request submissions.
 */
export function supportRateLimiter(req: Request, res: Response, next: NextFunction) {
  void handleSupportRateLimit(req, res, next).catch(next);
}
