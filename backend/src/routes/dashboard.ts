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

// GET /api/dashboard/portfolio-cashflow - Get portfolio-wide cash flow summary
dashboardRouter.get('/portfolio-cashflow', async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id

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

    // If no projects, return empty cash flow
    if (projectIds.length === 0) {
      return res.json({
        totalClaimed: 0,
        totalCertified: 0,
        totalPaid: 0,
        outstanding: 0
      })
    }

    // Get all progress claims for accessible projects
    const claims = await prisma.progressClaim.findMany({
      where: { projectId: { in: projectIds } },
      select: {
        totalClaimedAmount: true,
        certifiedAmount: true,
        paidAmount: true,
        status: true
      }
    })

    // Calculate totals across all claims
    let totalClaimed = 0
    let totalCertified = 0
    let totalPaid = 0

    for (const claim of claims) {
      totalClaimed += claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0
      totalCertified += claim.certifiedAmount ? Number(claim.certifiedAmount) : 0
      totalPaid += claim.paidAmount ? Number(claim.paidAmount) : 0
    }

    // Outstanding = Certified - Paid (amount approved but not yet paid)
    const outstanding = totalCertified - totalPaid

    res.json({
      totalClaimed,
      totalCertified,
      totalPaid,
      outstanding
    })
  } catch (error) {
    console.error('Portfolio cash flow error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/dashboard/portfolio-ncrs - Get critical NCRs across all projects
dashboardRouter.get('/portfolio-ncrs', async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id

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

    // If no projects, return empty list
    if (projectIds.length === 0) {
      return res.json({ ncrs: [] })
    }

    // Get major NCRs (critical) that are not closed
    const criticalNCRs = await prisma.nCR.findMany({
      where: {
        projectId: { in: projectIds },
        category: 'major',
        status: { notIn: ['closed', 'closed_concession'] }
      },
      select: {
        id: true,
        ncrNumber: true,
        description: true,
        category: true,
        status: true,
        dueDate: true,
        createdAt: true,
        project: {
          select: {
            id: true,
            name: true,
            projectNumber: true
          }
        }
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ],
      take: 10
    })

    const today = new Date()
    const formattedNCRs = criticalNCRs.map(ncr => ({
      id: ncr.id,
      ncrNumber: ncr.ncrNumber,
      description: ncr.description?.substring(0, 100) || 'No description',
      category: ncr.category,
      status: ncr.status,
      dueDate: ncr.dueDate?.toISOString(),
      isOverdue: ncr.dueDate ? new Date(ncr.dueDate) < today : false,
      daysUntilDue: ncr.dueDate ? Math.ceil((new Date(ncr.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null,
      project: {
        id: ncr.project.id,
        name: ncr.project.name,
        projectNumber: ncr.project.projectNumber
      },
      link: `/projects/${ncr.project.id}/ncr?ncrId=${ncr.id}`
    }))

    res.json({ ncrs: formattedNCRs })
  } catch (error) {
    console.error('Portfolio NCRs error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/dashboard/portfolio-risks - Get projects at risk with risk indicators
dashboardRouter.get('/portfolio-risks', async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id

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

    if (projectIds.length === 0) {
      return res.json({ projectsAtRisk: [] })
    }

    const today = new Date()
    const thirtyDaysFromNow = new Date(today)
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    // Get all active projects with their risk indicators
    const projects = await prisma.project.findMany({
      where: {
        id: { in: projectIds },
        status: 'active'
      },
      select: {
        id: true,
        name: true,
        projectNumber: true,
        targetCompletion: true,
        status: true
      }
    })

    const projectsAtRisk = []

    for (const project of projects) {
      const riskIndicators = []

      // Check for timeline risk (due within 30 days)
      if (project.targetCompletion) {
        const targetDate = new Date(project.targetCompletion)
        const daysUntilTarget = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        if (daysUntilTarget <= 30 && daysUntilTarget > 0) {
          riskIndicators.push({
            type: 'timeline',
            severity: 'warning',
            message: `Target completion in ${daysUntilTarget} days`,
            explanation: 'Project is approaching its target completion date'
          })
        } else if (daysUntilTarget <= 0) {
          riskIndicators.push({
            type: 'timeline',
            severity: 'critical',
            message: `Overdue by ${Math.abs(daysUntilTarget)} days`,
            explanation: 'Project has exceeded its target completion date'
          })
        }
      }

      // Check for major open NCRs
      const majorNCRCount = await prisma.nCR.count({
        where: {
          projectId: project.id,
          category: 'major',
          status: { notIn: ['closed', 'closed_concession'] }
        }
      })
      if (majorNCRCount > 0) {
        riskIndicators.push({
          type: 'ncr',
          severity: majorNCRCount >= 3 ? 'critical' : 'warning',
          message: `${majorNCRCount} open major NCR${majorNCRCount > 1 ? 's' : ''}`,
          explanation: 'Major non-conformances require attention and may impact project delivery'
        })
      }

      // Check for overdue NCRs
      const overdueNCRCount = await prisma.nCR.count({
        where: {
          projectId: project.id,
          status: { notIn: ['closed', 'closed_concession'] },
          dueDate: { lt: today }
        }
      })
      if (overdueNCRCount > 0) {
        riskIndicators.push({
          type: 'overdue_ncr',
          severity: 'critical',
          message: `${overdueNCRCount} overdue NCR${overdueNCRCount > 1 ? 's' : ''}`,
          explanation: 'NCRs have exceeded their due date and require immediate action'
        })
      }

      // Check for stale hold points
      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const staleHPCount = await prisma.holdPoint.count({
        where: {
          lot: { projectId: project.id },
          status: { in: ['pending', 'scheduled', 'requested'] },
          createdAt: { lt: sevenDaysAgo }
        }
      })
      if (staleHPCount > 0) {
        riskIndicators.push({
          type: 'holdpoint',
          severity: 'warning',
          message: `${staleHPCount} stale hold point${staleHPCount > 1 ? 's' : ''}`,
          explanation: 'Hold points have been pending for more than 7 days without progress'
        })
      }

      // Only include projects that have risk indicators
      if (riskIndicators.length > 0) {
        // Sort by severity (critical first)
        riskIndicators.sort((a, b) => {
          const severityOrder = { critical: 0, warning: 1 }
          return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder]
        })

        projectsAtRisk.push({
          id: project.id,
          name: project.name,
          projectNumber: project.projectNumber,
          riskIndicators,
          riskLevel: riskIndicators.some(r => r.severity === 'critical') ? 'critical' : 'warning',
          link: `/projects/${project.id}/ncr`
        })
      }
    }

    // Sort by risk level (critical first)
    projectsAtRisk.sort((a, b) => {
      const levelOrder = { critical: 0, warning: 1 }
      return levelOrder[a.riskLevel as keyof typeof levelOrder] - levelOrder[b.riskLevel as keyof typeof levelOrder]
    })

    res.json({ projectsAtRisk })
  } catch (error) {
    console.error('Portfolio risks error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
