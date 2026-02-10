import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/auth.js'

// Type alias for requests that will have user populated
export type AuthRequest = Request

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        userId: string
        email: string
        fullName: string | null
        roleInCompany: string
        role: string
        companyId: string | null
      }
      apiKey?: {
        id: string
        scopes: string[]
      }
    }
  }
}

/**
 * Middleware to require authentication for API routes
 * Returns 401 if no valid token is provided
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Please provide a valid token.'
      })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    const user = await verifyToken(token)

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token. Please sign in again.'
      })
    }

    // Attach user to request for use in route handlers
    // Map userId to id for consistency with some routes
    req.user = {
      id: user.userId,
      userId: user.userId,
      email: user.email,
      fullName: user.fullName || null,
      roleInCompany: user.role,
      role: user.role,
      companyId: user.companyId || null,
    }

    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed.'
    })
  }
}

/**
 * Optional middleware that attaches user if token is provided
 * Does not reject requests without token
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const user = await verifyToken(token)
      if (user) {
        req.user = {
          id: user.userId,
          userId: user.userId,
          email: user.email,
          fullName: user.fullName || null,
          roleInCompany: user.role,
          role: user.role,
          companyId: user.companyId || null,
        }
      }
    }

    next()
  } catch {
    // Silently continue without auth
    next()
  }
}

// Role hierarchy for permission checks
const ROLE_HIERARCHY: Record<string, number> = {
  owner: 100,
  admin: 90,
  project_manager: 80,
  site_manager: 70,
  foreman: 60,
  site_engineer: 50,
  subcontractor_admin: 40,
  subcontractor: 30,
  viewer: 20,
  member: 10,
}

/**
 * Middleware factory that checks if user has required role level
 * Returns 403 if user's role is below the required level
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.'
      })
    }

    const userRole = user.roleInCompany || 'member'

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to perform this action.'
      })
    }

    next()
  }
}

/**
 * Middleware factory that checks if user's role meets minimum level
 * Returns 403 if user's role is below the minimum
 */
export function requireMinRole(minRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.'
      })
    }

    const userRole = user.roleInCompany || 'member'
    const userLevel = ROLE_HIERARCHY[userRole] || 0
    const requiredLevel = ROLE_HIERARCHY[minRole] || 100

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to perform this action.'
      })
    }

    next()
  }
}
