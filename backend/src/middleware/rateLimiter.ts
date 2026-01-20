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

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now - entry.firstRequestTime > WINDOW_MS * 2) {
      rateLimitStore.delete(ip)
    }
  }
}, CLEANUP_INTERVAL)

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
 * Prevents brute force attacks
 */
const authRateLimitStore = new Map<string, RateLimitEntry>()
const AUTH_WINDOW_MS = 60 * 1000 // 1 minute
const AUTH_MAX_REQUESTS = 100 // Max login attempts per minute (increased for dev/testing)

export function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  const clientIp = getClientIp(req)
  const now = Date.now()

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
