// Feature #742: API rate limiting middleware
import { Request, Response, NextFunction } from 'express'

interface RateLimitEntry {
  count: number
  firstRequestTime: number
}

// In-memory store for rate limiting (per IP)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Configuration
const WINDOW_MS = 60 * 1000 // 1 minute window
const MAX_REQUESTS = 1000 // Max requests per window (increased for dev/testing)
const CLEANUP_INTERVAL = 5 * 60 * 1000 // Clean up old entries every 5 minutes
const MAX_MAP_SIZE = 10000 // Prevent unbounded memory growth

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now - entry.firstRequestTime > WINDOW_MS * 2) {
      rateLimitStore.delete(ip)
    }
  }
  // Hard cap: if still too large, remove oldest entries
  if (rateLimitStore.size > MAX_MAP_SIZE) {
    const entries = Array.from(rateLimitStore.entries())
    entries.sort((a, b) => a[1].firstRequestTime - b[1].firstRequestTime)
    const toRemove = entries.slice(0, entries.length - MAX_MAP_SIZE)
    for (const [key] of toRemove) {
      rateLimitStore.delete(key)
    }
  }
}, CLEANUP_INTERVAL)
// TODO: Migrate to Redis-backed rate limiter for multi-instance scaling (Phase 6)

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  // Check X-Forwarded-For header (for proxied requests)
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) {
    const ips = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(',')
    return ips[0].trim()
  }
  // Fall back to connection remote address
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

/**
 * Rate limiting middleware
 * Limits requests to MAX_REQUESTS per WINDOW_MS per IP address
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const clientIp = getClientIp(req)
  const now = Date.now()

  // Get or create entry for this IP
  let entry = rateLimitStore.get(clientIp)

  if (!entry) {
    // First request from this IP
    entry = { count: 1, firstRequestTime: now }
    rateLimitStore.set(clientIp, entry)
    setRateLimitHeaders(res, MAX_REQUESTS - 1, Math.ceil(WINDOW_MS / 1000))
    return next()
  }

  // Check if window has expired
  if (now - entry.firstRequestTime > WINDOW_MS) {
    // Reset the window
    entry.count = 1
    entry.firstRequestTime = now
    rateLimitStore.set(clientIp, entry)
    setRateLimitHeaders(res, MAX_REQUESTS - 1, Math.ceil(WINDOW_MS / 1000))
    return next()
  }

  // Within window - increment count
  entry.count++
  const remaining = Math.max(0, MAX_REQUESTS - entry.count)
  const resetTime = Math.ceil((entry.firstRequestTime + WINDOW_MS - now) / 1000)

  setRateLimitHeaders(res, remaining, resetTime)

  // Check if over limit
  if (entry.count > MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Maximum ${MAX_REQUESTS} requests per minute. Please try again in ${resetTime} seconds.`,
      retryAfter: resetTime
    })
  }

  next()
}

/**
 * Set rate limit headers on response
 */
function setRateLimitHeaders(res: Response, remaining: number, resetSeconds: number) {
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS)
  res.setHeader('X-RateLimit-Remaining', remaining)
  res.setHeader('X-RateLimit-Reset', resetSeconds)
}

/**
 * Stricter rate limiter for auth endpoints
 * Prevents brute force attacks with exponential backoff
 */
const authRateLimitStore = new Map<string, RateLimitEntry>()
const AUTH_WINDOW_MS = 60 * 1000 // 1 minute
// Production-safe rate limit: 10 auth attempts per minute
const AUTH_MAX_REQUESTS = process.env.NODE_ENV === 'production' ? 10 : 50

// Account lockout tracking
interface LockoutEntry {
  failedAttempts: number
  lockedUntil: number | null
  lastAttemptTime: number
}
const lockoutStore = new Map<string, LockoutEntry>()
const LOCKOUT_THRESHOLD = 5 // Lock after 5 failed attempts
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minute lockout

// Cleanup lockout entries every 30 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of lockoutStore.entries()) {
    // Remove entries that haven't been accessed in 1 hour
    if (now - entry.lastAttemptTime > 60 * 60 * 1000) {
      lockoutStore.delete(key)
    }
  }
}, 30 * 60 * 1000)

/**
 * Check if an IP is currently locked out
 */
export function isLockedOut(ip: string): { locked: boolean; remainingSeconds: number } {
  const entry = lockoutStore.get(ip)
  if (!entry || !entry.lockedUntil) {
    return { locked: false, remainingSeconds: 0 }
  }

  const now = Date.now()
  if (now < entry.lockedUntil) {
    return {
      locked: true,
      remainingSeconds: Math.ceil((entry.lockedUntil - now) / 1000)
    }
  }

  // Lockout expired, reset
  entry.lockedUntil = null
  entry.failedAttempts = 0
  return { locked: false, remainingSeconds: 0 }
}

/**
 * Record a failed auth attempt (call this from auth routes on failed login)
 */
export function recordFailedAuthAttempt(ip: string): void {
  const now = Date.now()
  let entry = lockoutStore.get(ip)

  if (!entry) {
    entry = { failedAttempts: 1, lockedUntil: null, lastAttemptTime: now }
    lockoutStore.set(ip, entry)
    return
  }

  entry.failedAttempts++
  entry.lastAttemptTime = now

  // Apply lockout if threshold exceeded
  if (entry.failedAttempts >= LOCKOUT_THRESHOLD) {
    entry.lockedUntil = now + LOCKOUT_DURATION
    console.log(`[SECURITY] IP ${ip} locked out for ${LOCKOUT_DURATION / 60000} minutes after ${entry.failedAttempts} failed attempts`)
  }
}

/**
 * Clear failed attempts on successful login
 */
export function clearFailedAuthAttempts(ip: string): void {
  lockoutStore.delete(ip)
}

export function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  const clientIp = getClientIp(req)
  const now = Date.now()

  // Check for account lockout first
  const lockout = isLockedOut(clientIp)
  if (lockout.locked) {
    return res.status(429).json({
      error: 'Account Temporarily Locked',
      message: `Too many failed attempts. Please try again in ${Math.ceil(lockout.remainingSeconds / 60)} minutes.`,
      retryAfter: lockout.remainingSeconds,
      locked: true
    })
  }

  let entry = authRateLimitStore.get(clientIp)

  if (!entry) {
    entry = { count: 1, firstRequestTime: now }
    authRateLimitStore.set(clientIp, entry)
    setRateLimitHeaders(res, AUTH_MAX_REQUESTS - 1, Math.ceil(AUTH_WINDOW_MS / 1000))
    return next()
  }

  if (now - entry.firstRequestTime > AUTH_WINDOW_MS) {
    entry.count = 1
    entry.firstRequestTime = now
    authRateLimitStore.set(clientIp, entry)
    setRateLimitHeaders(res, AUTH_MAX_REQUESTS - 1, Math.ceil(AUTH_WINDOW_MS / 1000))
    return next()
  }

  entry.count++
  const remaining = Math.max(0, AUTH_MAX_REQUESTS - entry.count)
  const resetTime = Math.ceil((entry.firstRequestTime + AUTH_WINDOW_MS - now) / 1000)

  setRateLimitHeaders(res, remaining, resetTime)

  if (entry.count > AUTH_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Too many authentication attempts. Please try again in ${resetTime} seconds.`,
      retryAfter: resetTime
    })
  }

  next()
}
