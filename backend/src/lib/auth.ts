import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma.js'

// JWT_SECRET is required - no fallback for security
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  // Allow dev-secret only in development mode
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[AUTH] WARNING: JWT_SECRET not set, using development fallback. DO NOT use in production!')
  } else {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production')
  }
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-secret-change-in-production'

// Bcrypt configuration
const BCRYPT_ROUNDS = 12

interface TokenPayload {
  userId: string
  email: string
  role: string
  iat?: number  // Issued at timestamp (added by JWT)
}

export interface AuthUser {
  id?: string
  userId: string
  email: string
  role: string
  fullName?: string | null
  name?: string | null
  phone?: string | null
  companyId?: string | null
  createdAt?: Date
  avatarUrl?: string | null
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const payload = jwt.verify(token, EFFECTIVE_JWT_SECRET) as TokenPayload

    // Get user from database, including token_invalidated_at for session invalidation check
    const userResult = await prisma.$queryRaw<Array<{
      id: string
      email: string
      full_name: string | null
      phone: string | null
      role_in_company: string
      company_id: string | null
      created_at: Date
      avatar_url: string | null
      token_invalidated_at: Date | null
    }>>`SELECT id, email, full_name, phone, role_in_company, company_id, created_at, avatar_url, token_invalidated_at FROM users WHERE id = ${payload.userId}`

    const user = userResult[0]

    if (!user) {
      return null
    }

    // Check if token was issued before user invalidated all tokens (logout-all-devices)
    if (user.token_invalidated_at && payload.iat) {
      const tokenIssuedAt = payload.iat * 1000 // JWT iat is in seconds, convert to ms
      if (tokenIssuedAt < user.token_invalidated_at.getTime()) {
        // Token was issued before invalidation - reject it
        return null
      }
    }

    return {
      id: user.id,
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      name: user.full_name,
      phone: user.phone,
      companyId: user.company_id,
      role: user.role_in_company,
      createdAt: user.created_at,
      avatarUrl: user.avatar_url,
    }
  } catch {
    return null
  }
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, { expiresIn: '24h' })
}

// For testing: generate an already-expired token
export function generateExpiredToken(payload: TokenPayload): string {
  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, { expiresIn: '-1h' }) // Already expired
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, EFFECTIVE_JWT_SECRET, { expiresIn: '7d' })
}

/**
 * Hash a password using bcrypt
 * Uses 12 rounds of salting for security
 */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS)
}

/**
 * Verify a password against a hash
 * Supports both bcrypt hashes (new) and legacy SHA256 hashes (migration period)
 */
export function verifyPassword(password: string, hash: string): boolean {
  // Check if hash is bcrypt format (starts with $2a$, $2b$, or $2y$)
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    return bcrypt.compareSync(password, hash)
  }

  // Legacy SHA256 hash support (for migration period)
  // SHA256 hashes are 64 character hex strings
  if (hash.length === 64 && /^[a-f0-9]+$/i.test(hash)) {
    const sha256Hash = crypto.createHash('sha256').update(password + EFFECTIVE_JWT_SECRET).digest('hex')
    if (sha256Hash === hash) {
      // Log that this user needs password rehash (for monitoring migration progress)
      console.log('[AUTH] Legacy SHA256 hash verified - user should be prompted to update password')
      return true
    }
  }

  return false
}

/**
 * Check if a password hash needs to be upgraded to bcrypt
 */
export function needsPasswordRehash(hash: string): boolean {
  // SHA256 hashes need upgrading
  return hash.length === 64 && /^[a-f0-9]+$/i.test(hash)
}
