// Feature #742: API rate limiting middleware
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/AppError.js';
import { prisma } from '../lib/prisma.js';
import { logInfo } from '../lib/serverLogger.js';
import {
  getClientIp,
  getPrincipalLockoutKey,
  getSourceLockoutKey,
  hashStorageKey,
  readPositiveIntegerEnv,
} from './rateLimiter/identity.js';

export { getClientIp } from './rateLimiter/identity.js';

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

type RateLimitScope = 'api' | 'auth' | 'support' | 'verification-resend' | 'chat';
type AuthLockoutResult = { locked: boolean; remainingSeconds: number };

const rateLimitStore = new Map<string, RateLimitEntry>();
const authRateLimitStore = new Map<string, RateLimitEntry>();
const verificationResendRateLimitStore = new Map<string, RateLimitEntry>();
const lockoutStore = new Map<string, LockoutEntry>();

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = readPositiveIntegerEnv('API_RATE_LIMIT_MAX', 1000);
const AUTH_WINDOW_MS = 60 * 1000;
const AUTH_MAX_REQUESTS = readPositiveIntegerEnv(
  'AUTH_RATE_LIMIT_MAX',
  process.env.NODE_ENV === 'production' ? 10 : 50,
);
const VERIFICATION_RESEND_WINDOW_MS = 24 * 60 * 60 * 1000;
const VERIFICATION_RESEND_MAX_REQUESTS = readPositiveIntegerEnv(
  'VERIFICATION_RESEND_RATE_LIMIT_MAX',
  3,
);
const SUPPORT_WINDOW_MS = 60 * 1000;
const CHAT_WINDOW_MS = 60 * 1000;
const CHAT_MAX_REQUESTS = readPositiveIntegerEnv('CHAT_RATE_LIMIT_MAX', 20);
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
  cleanupRateLimitMap(verificationResendRateLimitStore, VERIFICATION_RESEND_WINDOW_MS);
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

function consumeMemoryRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number,
): RateLimitResult {
  const now = Date.now();
  const store = key.startsWith('auth:')
    ? authRateLimitStore
    : key.startsWith('verification-resend:')
      ? verificationResendRateLimitStore
      : rateLimitStore;
  let entry = store.get(key);

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

async function getLockoutStateForKey(key: string): Promise<AuthLockoutResult> {
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
 * Check if a source IP or source/principal pair is currently locked out.
 */
export async function isLockedOut(
  ip: string,
  principal?: string | null,
): Promise<AuthLockoutResult> {
  const sourceLockout = await getLockoutStateForKey(getSourceLockoutKey(ip));
  if (sourceLockout.locked) {
    return sourceLockout;
  }

  const principalKey = getPrincipalLockoutKey(ip, principal);
  if (!principalKey) {
    return sourceLockout;
  }

  return getLockoutStateForKey(principalKey);
}

async function recordFailedAuthAttemptForKey(
  key: string,
  lockoutLabel: 'source' | 'source/principal',
): Promise<void> {
  const now = new Date();

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
        `[SECURITY] Authentication ${lockoutLabel} locked for ${LOCKOUT_DURATION / 60000} minutes after ${entry.failedAttempts} failed attempts`,
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
      `[SECURITY] Authentication ${lockoutLabel} locked for ${LOCKOUT_DURATION / 60000} minutes after ${Number(entry.failed_attempts)} failed attempts`,
    );
  }
}

/**
 * Record a failed auth attempt. Call this from auth routes on failed login/MFA.
 *
 * Failures are recorded against both the source IP and, when available, the attempted
 * account principal. A later successful login can clear the account bucket without
 * clearing the source-IP abuse bucket for every other principal on that IP.
 */
export async function recordFailedAuthAttempt(
  ip: string,
  principal?: string | null,
): Promise<void> {
  const sourceKey = getSourceLockoutKey(ip);
  const principalKey = getPrincipalLockoutKey(ip, principal);
  const entries: Array<{ key: string; lockoutLabel: 'source' | 'source/principal' }> = principalKey
    ? [
        { key: sourceKey, lockoutLabel: 'source' },
        { key: principalKey, lockoutLabel: 'source/principal' },
      ]
    : [{ key: sourceKey, lockoutLabel: 'source' }];

  await Promise.all(
    entries.map(({ key, lockoutLabel }) => recordFailedAuthAttemptForKey(key, lockoutLabel)),
  );
}

/**
 * Clear failed attempts after a successful login.
 *
 * Passing a principal clears only that source/principal bucket. Omitting the principal
 * clears the source bucket, which is reserved for tests and explicit administrative
 * cleanup; successful authentication paths should pass the authenticated principal.
 */
export async function clearFailedAuthAttempts(
  ip: string,
  principal?: string | null,
): Promise<void> {
  const key = getPrincipalLockoutKey(ip, principal) ?? getSourceLockoutKey(ip);

  if (!usesDatabaseRateLimitStore()) {
    lockoutStore.delete(key);
    return;
  }

  await prisma.authLockout.deleteMany({ where: { key } });
}

async function handleAuthRateLimit(req: Request, res: Response, next: NextFunction) {
  if (isRoutineAuthEndpoint(req)) {
    next();
    return;
  }

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

function isRoutineAuthEndpoint(req: Request): boolean {
  const descriptor = `${req.method.toUpperCase()} ${req.path}`;
  if (
    descriptor === 'GET /me' ||
    descriptor === 'POST /onboarding/complete' ||
    descriptor === 'POST /logout' ||
    descriptor === 'POST /logout-all-devices' ||
    descriptor === 'PATCH /profile' ||
    descriptor === 'POST /avatar' ||
    descriptor === 'DELETE /avatar'
  ) {
    return true;
  }

  return req.method.toUpperCase() === 'GET' && req.path.startsWith('/avatar/file/');
}

/**
 * Stricter rate limiter for auth endpoints.
 */
export function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  void handleAuthRateLimit(req, res, next).catch(next);
}

function getVerificationResendTarget(req: Request): string | null {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  if (typeof email !== 'string') {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  return normalizedEmail.length > 0 ? normalizedEmail : null;
}

async function handleVerificationResendRateLimit(req: Request, res: Response, next: NextFunction) {
  const targetEmail = getVerificationResendTarget(req);
  if (!targetEmail) {
    next();
    return;
  }

  const result = await consumeRateLimit(
    'verification-resend',
    targetEmail,
    VERIFICATION_RESEND_WINDOW_MS,
    VERIFICATION_RESEND_MAX_REQUESTS,
  );
  setRateLimitHeaders(res, VERIFICATION_RESEND_MAX_REQUESTS, result.remaining, result.resetSeconds);

  if (!result.allowed) {
    throw new AppError(
      429,
      `Too many verification email requests. Please try again in ${result.resetSeconds} seconds.`,
      'RATE_LIMITED',
      { retryAfter: result.resetSeconds },
    );
  }

  next();
}

/**
 * Daily per-target limiter for verification email resends.
 */
export function verificationResendLimiter(req: Request, res: Response, next: NextFunction) {
  void handleVerificationResendRateLimit(req, res, next).catch(next);
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

async function handleChatRateLimit(req: Request, res: Response, next: NextFunction) {
  // Per-user limit (requireAuth runs first, so req.user is set); fall back to
  // the source IP if somehow unauthenticated.
  const identifier = req.user?.id || getClientIp(req);
  const result = await consumeRateLimit('chat', identifier, CHAT_WINDOW_MS, CHAT_MAX_REQUESTS);
  setRateLimitHeaders(res, CHAT_MAX_REQUESTS, result.remaining, result.resetSeconds);

  if (!result.allowed) {
    throw new AppError(
      429,
      `Too many chat requests. Maximum ${CHAT_MAX_REQUESTS} per minute. Please try again in ${result.resetSeconds} seconds.`,
      'RATE_LIMITED',
      { retryAfter: result.resetSeconds },
    );
  }

  next();
}

/**
 * Per-user limiter for the Jack chat copilot endpoint.
 */
export function chatRateLimiter(req: Request, res: Response, next: NextFunction) {
  void handleChatRateLimit(req, res, next).catch(next);
}
