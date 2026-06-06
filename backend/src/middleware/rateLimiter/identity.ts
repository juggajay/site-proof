import crypto from 'crypto';
import type { Request } from 'express';

export function readPositiveIntegerEnv(name: string, fallback: number): number {
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

export function hashStorageKey(scope: string, identifier: string): string {
  const salt = process.env.RATE_LIMIT_KEY_SALT || process.env.JWT_SECRET || '';
  return `${scope}:${crypto.createHash('sha256').update(`${scope}:${identifier}:${salt}`).digest('hex')}`;
}

function normalizeAuthPrincipal(principal: string | null | undefined): string | null {
  const normalized = principal?.trim().toLowerCase();
  return normalized || null;
}

export function getSourceLockoutKey(ip: string): string {
  return hashStorageKey('auth-lockout', ip);
}

export function getPrincipalLockoutKey(
  ip: string,
  principal: string | null | undefined,
): string | null {
  const normalizedPrincipal = normalizeAuthPrincipal(principal);
  if (!normalizedPrincipal) {
    return null;
  }

  return hashStorageKey('auth-lockout-principal', `${ip}:${normalizedPrincipal}`);
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
