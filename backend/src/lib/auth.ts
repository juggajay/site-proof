import jwt from 'jsonwebtoken'
import { prisma } from './prisma.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

interface TokenPayload {
  userId: string
  email: string
  role: string
}

export async function verifyToken(token: string) {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyId: true,
        isActive: true,
      },
    })

    if (!user || !user.isActive) {
      return null
    }

    return user
  } catch {
    return null
  }
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' })
}
