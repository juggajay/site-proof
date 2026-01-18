import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'

export const dashboardRouter = Router()

// Apply authentication middleware to all dashboard routes
dashboardRouter.use(requireAuth)

// GET /api/dashboard/stats - Get dashboard statistics including attention items
dashboardRouter.get('/stats', async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id
    const companyId = req.user?.companyId

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      })
    }

    // Get all projects the user has access to
    const projectAccess = await prisma.projectUser.findMany({
      where: { userId },
      select: { projectId: true }
    })

    const projectIds = projectAccess.map(pa => pa.projectId)

    // If no projects, return empty stats
    if (projectIds.length === 0) {
      return res.json({
        totalProjects: 0,
        activeProjects: 0,
        totalLots: 0,
        openHoldPoints: 0,
        openNCRs: 0,
        attentionItems: {
          overdueNCRs: [],
          staleHoldPoints: [],
          total: 0
        },
        recentActivities: []
      })
    }

    // Get project stats
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true,
        name: true,
        projectNumber: true,
        status: true
      }
    })

    const totalProjects = projects.length
    const activeProjects = projects.filter(p => p.status === 'active').length

    // Get lot count
    const totalLots = await prisma.lot.count({
      where: { projectId: { in: projectIds } }
    })

    // Get open hold points count (HoldPoint connects to project via lot)
    const openHoldPoints = await prisma.holdPoint.count({
      where: {
        lot: { projectId: { in: projectIds } },
        status: { in: ['pending', 'scheduled', 'requested'] }
      }
    })

    // Get open NCRs count
    const openNCRs = await prisma.nCR.count({
      where: {
        projectId: { in: projectIds },
        status: { notIn: ['closed', 'closed_concession'] }
      }
    })

    // Calculate date thresholds
    const today = new Date()
    const staleHPThreshold = new Date(today)
    staleHPThreshold.setDate(staleHPThreshold.getDate() - 7) // Hold points older than 7 days without activity

    // Get overdue NCRs (due date has passed and not closed)
    const overdueNCRs = await prisma.nCR.findMany({
      where: {
        projectId: { in: projectIds },
        status: { notIn: ['closed', 'closed_concession'] },
        dueDate: { lt: today }
      },
      select: {
        id: true,
        ncrNumber: true,
        description: true,
        status: true,
        dueDate: true,
        category: true,
        project: {
          select: {
            id: true,
            name: true,
            projectNumber: true
          }
        }
      },
      orderBy: { dueDate: 'asc' },
      take: 10
    })

    // Get stale hold points (open for more than 7 days with no recent activity)
    // HoldPoint connects to project via lot
    const staleHoldPoints = await prisma.holdPoint.findMany({
      where: {
        lot: { projectId: { in: projectIds } },
        status: { in: ['pending', 'scheduled', 'requested'] },
        createdAt: { lt: staleHPThreshold }
      },
      select: {
        id: true,
        description: true,
        status: true,
        scheduledDate: true,
        createdAt: true,
        lot: {
          select: {
            id: true,
            lotNumber: true,
            project: {
              select: {
                id: true,
                name: true,
                projectNumber: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' },
      take: 10
    })

    // Format attention items
    const formattedOverdueNCRs = overdueNCRs.map(ncr => ({
      id: ncr.id,
      type: 'ncr' as const,
      title: `NCR ${ncr.ncrNumber}`,
      description: ncr.description?.substring(0, 100) || 'No description',
      status: ncr.status,
      category: ncr.category,
      dueDate: ncr.dueDate?.toISOString(),
      daysOverdue: ncr.dueDate ? Math.ceil((today.getTime() - new Date(ncr.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
      project: {
        id: ncr.project.id,
        name: ncr.project.name,
        projectNumber: ncr.project.projectNumber
      },
      link: `/projects/${ncr.project.id}/ncr?ncrId=${ncr.id}`
    }))

    const formattedStaleHPs = staleHoldPoints.map(hp => ({
      id: hp.id,
      type: 'holdpoint' as const,
      title: hp.description || 'Hold Point',
      description: hp.lot ? `Lot ${hp.lot.lotNumber}` : 'No lot assigned',
      status: hp.status,
      scheduledDate: hp.scheduledDate?.toISOString(),
      createdAt: hp.createdAt.toISOString(),
      daysStale: Math.ceil((today.getTime() - new Date(hp.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      project: hp.lot?.project ? {
        id: hp.lot.project.id,
        name: hp.lot.project.name,
        projectNumber: hp.lot.project.projectNumber
      } : { id: '', name: 'Unknown', projectNumber: '' },
      lotId: hp.lot?.id,
      link: hp.lot?.project ? `/projects/${hp.lot.project.id}/holdpoints` : '/projects'
    }))

    // Get recent activities
    const recentActivities = [
      // Recent NCR updates
      ...(await prisma.nCR.findMany({
        where: { projectId: { in: projectIds } },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          ncrNumber: true,
          status: true,
          updatedAt: true,
          project: { select: { id: true, name: true } }
        }
      })).map(ncr => ({
        id: `ncr-${ncr.id}`,
        type: 'ncr' as const,
        description: `NCR ${ncr.ncrNumber} status: ${ncr.status}`,
        timestamp: ncr.updatedAt.toISOString(),
        link: `/projects/${ncr.project.id}/ncr?ncrId=${ncr.id}`
      })),
      // Recent lot updates
      ...(await prisma.lot.findMany({
        where: { projectId: { in: projectIds } },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          lotNumber: true,
          status: true,
          updatedAt: true,
          project: { select: { id: true, name: true } }
        }
      })).map(lot => ({
        id: `lot-${lot.id}`,
        type: 'lot' as const,
        description: `Lot ${lot.lotNumber} status: ${lot.status}`,
        timestamp: lot.updatedAt.toISOString(),
        link: `/projects/${lot.project.id}/lots/${lot.id}`
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5)

    res.json({
      totalProjects,
      activeProjects,
      totalLots,
      openHoldPoints,
      openNCRs,
      attentionItems: {
        overdueNCRs: formattedOverdueNCRs,
        staleHoldPoints: formattedStaleHPs,
        total: formattedOverdueNCRs.length + formattedStaleHPs.length
      },
      recentActivities
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
