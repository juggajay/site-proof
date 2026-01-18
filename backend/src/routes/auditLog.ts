import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'

export const auditLogRouter = Router()

// Apply authentication middleware to all audit log routes
auditLogRouter.use(requireAuth)

// GET /api/audit-logs - List audit logs with filtering
auditLogRouter.get('/', async (req, res) => {
  try {
    const {
      projectId,
      entityType,
      action,
      userId,
      search,
      startDate,
      endDate,
      page = '1',
      limit = '50'
    } = req.query

    const pageNum = parseInt(page as string) || 1
    const limitNum = Math.min(parseInt(limit as string) || 50, 100) // Max 100 per page
    const skip = (pageNum - 1) * limitNum

    // Build where clause
    const where: any = {}

    if (projectId) {
      where.projectId = projectId as string
    }

    if (entityType) {
      where.entityType = entityType as string
    }

    if (action) {
      where.action = {
        contains: action as string
      }
    }

    if (userId) {
      where.userId = userId as string
    }

    // Search in action, entityType, entityId
    if (search) {
      where.OR = [
        { action: { contains: search as string } },
        { entityType: { contains: search as string } },
        { entityId: { contains: search as string } },
      ]
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string)
      }
      if (endDate) {
        const end = new Date(endDate as string)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    // Get total count for pagination
    const total = await prisma.auditLog.count({ where })

    // Get audit logs with user info
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          }
        },
        project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    })

    // Parse changes JSON
    const parsedLogs = logs.map(log => ({
      ...log,
      changes: log.changes ? JSON.parse(log.changes) : null
    }))

    res.json({
      logs: parsedLogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    console.error('List audit logs error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/audit-logs/actions - Get list of distinct actions for filtering
auditLogRouter.get('/actions', async (req, res) => {
  try {
    const actions = await prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' }
    })

    res.json({
      actions: actions.map(a => a.action)
    })
  } catch (error) {
    console.error('Get audit actions error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/audit-logs/entity-types - Get list of distinct entity types for filtering
auditLogRouter.get('/entity-types', async (req, res) => {
  try {
    const entityTypes = await prisma.auditLog.findMany({
      select: { entityType: true },
      distinct: ['entityType'],
      orderBy: { entityType: 'asc' }
    })

    res.json({
      entityTypes: entityTypes.map(e => e.entityType)
    })
  } catch (error) {
    console.error('Get entity types error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/audit-logs/users - Get list of users who have audit log entries
auditLogRouter.get('/users', async (req, res) => {
  try {
    const usersWithLogs = await prisma.auditLog.findMany({
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          }
        }
      },
      distinct: ['userId'],
      where: {
        userId: { not: null }
      }
    })

    const users = usersWithLogs
      .filter(log => log.user)
      .map(log => ({
        id: log.user!.id,
        email: log.user!.email,
        fullName: log.user!.fullName,
      }))
      .sort((a, b) => (a.email || '').localeCompare(b.email || ''))

    res.json({ users })
  } catch (error) {
    console.error('Get audit users error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
