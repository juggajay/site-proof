import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from './prisma.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

interface TokenPayload {
  userId: string
  email: string
  role: string
}

export interface AuthUser {
  userId: string
  email: string
  role: string
  fullName?: string | null
  companyId?: string | null
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        roleInCompany: true,
        companyId: true,
      },
    })

    if (!user) {
      return null
    }

    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      companyId: user.companyId,
      role: user.roleInCompany,
    }
  } catch {
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
