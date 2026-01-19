import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from './prisma.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

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
  console.log('[AUTH DEBUG] verifyToken called')
  try {
    console.log('[AUTH DEBUG] Verifying JWT...')
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload
    console.log('[AUTH DEBUG] JWT verified, userId:', payload.userId)

    // Get user with tokenInvalidatedAt field
    console.log('[AUTH DEBUG] Querying user from database...')
    const userResult = await prisma.$queryRaw<Array<{
      id: string
      email: string
      full_name: string | null
      phone: string | null
      role_in_company: string
      company_id: string | null
      created_at: Date
      token_invalidated_at: Date | null
      avatar_url: string | null
    }>>`SELECT id, email, full_name, phone, role_in_company, company_id, created_at, token_invalidated_at, avatar_url FROM users WHERE id = ${payload.userId}`

    const user = userResult[0]

    if (!user) {
      return null
    }

    // Check if token was invalidated (issued before logout all devices)
    if (user.token_invalidated_at && payload.iat) {
      const tokenIssuedAt = new Date(payload.iat * 1000)
      // SQLite stores dates as strings, so we need to parse it
      const invalidatedAt = new Date(user.token_invalidated_at as unknown as string)
      console.log('[AUTH DEBUG] Token iat:', payload.iat, '→', tokenIssuedAt.toISOString())
      console.log('[AUTH DEBUG] Token invalidated at:', user.token_invalidated_at, '→', invalidatedAt.toISOString())
      console.log('[AUTH DEBUG] tokenIssuedAt < invalidatedAt?', tokenIssuedAt < invalidatedAt)
      if (tokenIssuedAt < invalidatedAt) {
        // Token was issued before the user logged out all devices
        console.log('[AUTH DEBUG] Token rejected - issued before invalidation')
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
  } catch (error) {
    console.log('[AUTH DEBUG] Error in verifyToken:', error)
    return null
  }
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
}

// For testing: generate an already-expired token
export function generateExpiredToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '-1h' }) // Already expired
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' })
}

// Simple password hashing for development (use bcrypt in production)
export function hashPassword(password: string): string {
  // In production, use bcrypt. This is a simple hash for dev.
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex')
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}
