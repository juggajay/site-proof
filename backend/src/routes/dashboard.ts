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

// Feature #275: GET /api/dashboard/cost-trend - Get daily cost trend chart data
// Shows daily costs with labour vs plant split, filterable by subcontractor
dashboardRouter.get('/cost-trend', async (req, res) => {
  try {
    const { projectId, subcontractorId, startDate, endDate, days } = req.query
    const userId = req.user?.userId || req.user?.id

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      })
    }

    // Get accessible projects
    const projectAccess = await prisma.projectUser.findMany({
      where: { userId },
      select: { projectId: true }
    })
    const accessibleProjectIds = projectAccess.map(pa => pa.projectId)

    // Determine which project(s) to query
    let targetProjectIds: string[] = []
    if (projectId) {
      // Verify user has access to specified project
      if (!accessibleProjectIds.includes(projectId as string)) {
        return res.status(403).json({ error: 'Access denied to project' })
      }
      targetProjectIds = [projectId as string]
    } else {
      targetProjectIds = accessibleProjectIds
    }

    if (targetProjectIds.length === 0) {
      return res.json({
        dailyCosts: [],
        totals: { labour: 0, plant: 0, combined: 0 },
        runningAverage: 0,
        subcontractors: []
      })
    }

    // Calculate date range
    const daysToFetch = days ? parseInt(days as string) : 30
    const end = endDate ? new Date(endDate as string) : new Date()
    const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - daysToFetch * 24 * 60 * 60 * 1000)

    // Build docket filter
    const docketWhere: any = {
      projectId: { in: targetProjectIds },
      date: {
        gte: start,
        lte: end
      },
      status: { in: ['approved', 'pending_approval'] } // Only approved or pending dockets
    }

    if (subcontractorId) {
      docketWhere.subcontractorCompanyId = subcontractorId as string
    }

    // Get dockets grouped by date
    const dockets = await prisma.dailyDocket.findMany({
      where: docketWhere,
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true }
        }
      },
      orderBy: { date: 'asc' }
    })

    // Aggregate by date
    const dailyMap = new Map<string, { date: string; labour: number; plant: number; combined: number }>()
    const subcontractorTotals = new Map<string, { id: string; name: string; labour: number; plant: number }>()

    for (const docket of dockets) {
      const dateKey = docket.date.toISOString().split('T')[0]
      const labour = Number(docket.totalLabourSubmitted || 0)
      const plant = Number(docket.totalPlantSubmitted || 0)

      // Aggregate by date
      const existing = dailyMap.get(dateKey) || { date: dateKey, labour: 0, plant: 0, combined: 0 }
      existing.labour += labour
      existing.plant += plant
      existing.combined += labour + plant
      dailyMap.set(dateKey, existing)

      // Track subcontractor totals
      if (docket.subcontractorCompany) {
        const subKey = docket.subcontractorCompanyId
        const subExisting = subcontractorTotals.get(subKey) || {
          id: subKey,
          name: docket.subcontractorCompany.companyName,
          labour: 0,
          plant: 0
        }
        subExisting.labour += labour
        subExisting.plant += plant
        subcontractorTotals.set(subKey, subExisting)
      }
    }

    // Convert to sorted array
    const dailyCosts = Array.from(dailyMap.values()).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Calculate totals
    const totals = dailyCosts.reduce(
      (acc, day) => ({
        labour: acc.labour + day.labour,
        plant: acc.plant + day.plant,
        combined: acc.combined + day.combined
      }),
      { labour: 0, plant: 0, combined: 0 }
    )

    // Calculate running average (average daily cost)
    const runningAverage = dailyCosts.length > 0 ? totals.combined / dailyCosts.length : 0

    // Add cumulative and running average to each day
    let cumulative = 0
    let runningSum = 0
    const dailyCostsWithTrend = dailyCosts.map((day, index) => {
      cumulative += day.combined
      runningSum += day.combined
      const dayRunningAverage = runningSum / (index + 1)
      return {
        ...day,
        cumulative,
        runningAverage: Math.round(dayRunningAverage * 100) / 100
      }
    })

    // Format subcontractor breakdown
    const subcontractors = Array.from(subcontractorTotals.values())
      .sort((a, b) => (b.labour + b.plant) - (a.labour + a.plant)) // Sort by total cost descending

    res.json({
      dailyCosts: dailyCostsWithTrend,
      totals,
      runningAverage: Math.round(runningAverage * 100) / 100,
      subcontractors,
      dateRange: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        daysWithData: dailyCosts.length
      }
    })
  } catch (error) {
    console.error('Cost trend error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Feature #292: GET /api/dashboard/foreman - Simplified dashboard for foreman role
// Shows today's diary status, pending dockets, inspections due today, and weather
dashboardRouter.get('/foreman', async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      })
    }

    // Get accessible projects
    const projectAccess = await prisma.projectUser.findMany({
      where: { userId },
      select: { projectId: true, project: { select: { id: true, name: true, projectNumber: true, status: true } } },
      orderBy: { project: { updatedAt: 'desc' } }
    })

    const activeProjects = projectAccess
      .filter(pa => pa.project.status === 'active')
      .map(pa => pa.project)

    // Use the most recently updated active project, or first project if none active
    const primaryProject = activeProjects[0] || (projectAccess[0]?.project || null)
    const projectId = primaryProject?.id

    // Return empty data if no project access
    if (!projectId) {
      return res.json({
        todayDiary: { exists: false, status: null, id: null },
        pendingDockets: { count: 0, totalLabourHours: 0, totalPlantHours: 0 },
        inspectionsDueToday: { count: 0, items: [] },
        weather: { conditions: null, temperatureMin: null, temperatureMax: null, rainfallMm: null },
        project: null
      })
    }

    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // 1. Today's Diary Status
    const todayDiary = await prisma.dailyDiary.findFirst({
      where: {
        projectId,
        date: {
          gte: today,
          lt: tomorrow
        }
      },
      select: {
        id: true,
        status: true
      }
    })

    // 2. Pending Dockets
    const pendingDockets = await prisma.dailyDocket.findMany({
      where: {
        projectId,
        status: 'pending_approval'
      },
      select: {
        totalLabourSubmitted: true,
        totalPlantSubmitted: true
      }
    })

    const docketStats = {
      count: pendingDockets.length,
      totalLabourHours: pendingDockets.reduce((sum, d) => sum + Number(d.totalLabourSubmitted || 0), 0),
      totalPlantHours: pendingDockets.reduce((sum, d) => sum + Number(d.totalPlantSubmitted || 0), 0)
    }

    // 3. Inspections Due Today (Hold Points + ITPs that are scheduled for today)
    const holdPointsDueToday = await prisma.holdPoint.findMany({
      where: {
        lot: { projectId },
        status: { in: ['scheduled', 'requested'] },
        scheduledDate: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        lot: { select: { lotNumber: true, id: true, projectId: true } }
      },
      take: 10
    })

    // Also check ITP completions due today
    const itpsDueToday = await prisma.iTPChecklistItem.findMany({
      where: {
        template: {
          itpInstances: {
            some: {
              lot: { projectId }
            }
          }
        }
      },
      include: {
        template: {
          include: {
            itpInstances: {
              where: {
                lot: { projectId }
              },
              include: {
                lot: { select: { lotNumber: true, id: true, projectId: true } }
              },
              take: 1
            }
          }
        }
      },
      take: 10
    })

    const inspectionItems = [
      ...holdPointsDueToday.map(hp => ({
        id: hp.id,
        type: 'Hold Point',
        description: hp.description || 'Hold Point',
        lotNumber: hp.lot.lotNumber,
        link: `/projects/${hp.lot.projectId}/lots/${hp.lot.id}/holdpoints?hp=${hp.id}`
      })),
      ...itpsDueToday.map(item => ({
        id: item.id,
        type: 'ITP',
        description: item.description,
        lotNumber: item.template?.itpInstances?.[0]?.lot?.lotNumber || 'Unknown',
        link: `/projects/${projectId}/itp`
      }))
    ]

    // 4. Weather from today's diary or recent diary
    let weather = {
      conditions: null as string | null,
      temperatureMin: null as number | null,
      temperatureMax: null as number | null,
      rainfallMm: null as number | null
    }

    const recentDiary = await prisma.dailyDiary.findFirst({
      where: {
        projectId,
        date: {
          gte: today,
          lt: tomorrow
        }
      },
      select: {
        weatherConditions: true,
        temperatureMin: true,
        temperatureMax: true,
        rainfallMm: true
      }
    })

    if (recentDiary) {
      weather = {
        conditions: recentDiary.weatherConditions,
        temperatureMin: recentDiary.temperatureMin ? Number(recentDiary.temperatureMin) : null,
        temperatureMax: recentDiary.temperatureMax ? Number(recentDiary.temperatureMax) : null,
        rainfallMm: recentDiary.rainfallMm ? Number(recentDiary.rainfallMm) : null
      }
    }

    res.json({
      todayDiary: {
        exists: !!todayDiary,
        status: todayDiary?.status || null,
        id: todayDiary?.id || null
      },
      pendingDockets: docketStats,
      inspectionsDueToday: {
        count: inspectionItems.length,
        items: inspectionItems
      },
      weather,
      project: primaryProject
    })
  } catch (error) {
    console.error('Foreman dashboard error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Feature #293: GET /api/dashboard/quality-manager - Dashboard for QM role
// Shows conformance rate, NCRs by category, pending verifications, HP release rate, ITP trends, audit readiness
dashboardRouter.get('/quality-manager', async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      })
    }

    // Get accessible projects
    const projectAccess = await prisma.projectUser.findMany({
      where: { userId },
      select: { projectId: true, project: { select: { id: true, name: true, projectNumber: true, status: true } } },
      orderBy: { project: { updatedAt: 'desc' } }
    })

    const activeProjects = projectAccess
      .filter(pa => pa.project.status === 'active')
      .map(pa => pa.project)

    const primaryProject = activeProjects[0] || (projectAccess[0]?.project || null)
    const projectId = primaryProject?.id

    // Default empty response
    const emptyResponse = {
      lotConformance: { totalLots: 0, conformingLots: 0, nonConformingLots: 0, rate: 100 },
      ncrsByCategory: { major: 0, minor: 0, observation: 0, total: 0 },
      openNCRs: [],
      pendingVerifications: { count: 0, items: [] },
      holdPointMetrics: { totalReleased: 0, totalPending: 0, releaseRate: 100, avgTimeToRelease: 0 },
      itpTrends: { completedThisWeek: 0, completedLastWeek: 0, trend: 'stable' as const, completionRate: 100 },
      auditReadiness: { score: 100, status: 'ready' as const, issues: [] },
      project: null
    }

    if (!projectId) {
      return res.json(emptyResponse)
    }

    // 1. Lot Conformance Rate
    const totalLots = await prisma.lot.count({ where: { projectId } })
    // Count lots that have at least one open NCR via the ncrLots junction table
    const nonConformingLots = await prisma.lot.count({
      where: {
        projectId,
        ncrLots: { some: { ncr: { status: { notIn: ['closed', 'closed_concession'] } } } }
      }
    })
    const conformingLots = totalLots - nonConformingLots
    const conformanceRate = totalLots > 0 ? (conformingLots / totalLots) * 100 : 100

    // 2. NCRs by Category
    const majorNCRs = await prisma.nCR.count({
      where: { projectId, category: 'major', status: { notIn: ['closed', 'closed_concession'] } }
    })
    const minorNCRs = await prisma.nCR.count({
      where: { projectId, category: 'minor', status: { notIn: ['closed', 'closed_concession'] } }
    })
    const observationNCRs = await prisma.nCR.count({
      where: { projectId, category: 'observation', status: { notIn: ['closed', 'closed_concession'] } }
    })

    // Get open NCRs list
    const openNCRs = await prisma.nCR.findMany({
      where: {
        projectId,
        status: { notIn: ['closed', 'closed_concession'] }
      },
      select: {
        id: true,
        ncrNumber: true,
        description: true,
        category: true,
        status: true,
        dueDate: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    const formattedNCRs = openNCRs.map(ncr => ({
      id: ncr.id,
      ncrNumber: ncr.ncrNumber,
      description: ncr.description,
      category: ncr.category,
      status: ncr.status,
      dueDate: ncr.dueDate?.toISOString() || null,
      daysOpen: Math.floor((Date.now() - ncr.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      link: `/projects/${projectId}/ncr?ncrId=${ncr.id}`
    }))

    // 3. Pending Verifications (ITP items pending HC verification)
    const pendingVerifications = await prisma.iTPCompletion.findMany({
      where: {
        verificationStatus: 'pending_verification',
        itpInstance: {
          lot: { projectId }
        }
      },
      include: {
        checklistItem: { select: { description: true } },
        itpInstance: {
          include: {
            lot: { select: { lotNumber: true, id: true } }
          }
        }
      },
      take: 20
    })

    const pendingVerificationItems = pendingVerifications.map(pv => ({
      id: pv.id,
      description: pv.checklistItem.description,
      lotNumber: pv.itpInstance.lot?.lotNumber || 'Unknown',
      link: `/projects/${projectId}/lots/${pv.itpInstance.lot?.id}/itp`
    }))

    // 4. Hold Point Metrics
    const releasedHPs = await prisma.holdPoint.count({
      where: { lot: { projectId }, status: 'released' }
    })
    const pendingHPs = await prisma.holdPoint.count({
      where: { lot: { projectId }, status: { in: ['pending', 'scheduled', 'requested'] } }
    })
    const totalHPs = releasedHPs + pendingHPs
    const releaseRate = totalHPs > 0 ? (releasedHPs / totalHPs) * 100 : 100

    // Calculate avg time to release (simplified - would need more complex logic for accuracy)
    const recentReleased = await prisma.holdPoint.findMany({
      where: {
        lot: { projectId },
        status: 'released',
        releasedAt: { not: null }
      },
      select: { createdAt: true, releasedAt: true },
      take: 20,
      orderBy: { releasedAt: 'desc' }
    })

    let avgTimeToRelease = 0
    if (recentReleased.length > 0) {
      const totalHours = recentReleased.reduce((sum, hp) => {
        if (hp.releasedAt) {
          return sum + (hp.releasedAt.getTime() - hp.createdAt.getTime()) / (1000 * 60 * 60)
        }
        return sum
      }, 0)
      avgTimeToRelease = Math.round(totalHours / recentReleased.length)
    }

    // 5. ITP Completion Trends
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const completedThisWeek = await prisma.iTPCompletion.count({
      where: {
        itpInstance: { lot: { projectId } },
        completedAt: { gte: oneWeekAgo }
      }
    })

    const completedLastWeek = await prisma.iTPCompletion.count({
      where: {
        itpInstance: { lot: { projectId } },
        completedAt: { gte: twoWeeksAgo, lt: oneWeekAgo }
      }
    })

    const totalITPItems = await prisma.iTPChecklistItem.count({
      where: {
        template: {
          itpInstances: { some: { lot: { projectId } } }
        }
      }
    })

    const completedITPItems = await prisma.iTPCompletion.count({
      where: {
        itpInstance: { lot: { projectId } },
        verificationStatus: 'verified'
      }
    })

    const itpCompletionRate = totalITPItems > 0 ? (completedITPItems / totalITPItems) * 100 : 100
    const trend = completedThisWeek > completedLastWeek ? 'up' : completedThisWeek < completedLastWeek ? 'down' : 'stable'

    // 6. Audit Readiness Score
    const auditIssues: string[] = []
    let auditScore = 100

    // Check for major NCRs
    if (majorNCRs > 0) {
      auditIssues.push(`${majorNCRs} major NCR(s) open`)
      auditScore -= majorNCRs * 10
    }

    // Check for pending verifications
    if (pendingVerifications.length > 5) {
      auditIssues.push(`${pendingVerifications.length} ITP items pending verification`)
      auditScore -= 15
    }

    // Check for low conformance rate
    if (conformanceRate < 90) {
      auditIssues.push('Lot conformance rate below 90%')
      auditScore -= 15
    }

    // Check for pending hold points
    if (pendingHPs > 10) {
      auditIssues.push(`${pendingHPs} hold points pending release`)
      auditScore -= 10
    }

    // Check for low ITP completion
    if (itpCompletionRate < 80) {
      auditIssues.push('ITP completion rate below 80%')
      auditScore -= 10
    }

    auditScore = Math.max(0, auditScore)
    const auditStatus = auditScore >= 80 ? 'ready' : auditScore >= 50 ? 'needs_attention' : 'not_ready'

    res.json({
      lotConformance: {
        totalLots,
        conformingLots,
        nonConformingLots,
        rate: Math.round(conformanceRate * 10) / 10
      },
      ncrsByCategory: {
        major: majorNCRs,
        minor: minorNCRs,
        observation: observationNCRs,
        total: majorNCRs + minorNCRs + observationNCRs
      },
      openNCRs: formattedNCRs,
      pendingVerifications: {
        count: pendingVerifications.length,
        items: pendingVerificationItems
      },
      holdPointMetrics: {
        totalReleased: releasedHPs,
        totalPending: pendingHPs,
        releaseRate: Math.round(releaseRate * 10) / 10,
        avgTimeToRelease
      },
      itpTrends: {
        completedThisWeek,
        completedLastWeek,
        trend,
        completionRate: Math.round(itpCompletionRate * 10) / 10
      },
      auditReadiness: {
        score: auditScore,
        status: auditStatus,
        issues: auditIssues
      },
      project: primaryProject
    })
  } catch (error) {
    console.error('Quality manager dashboard error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Feature #294: GET /api/dashboard/project-manager - Dashboard for PM role
// Shows lot progress, NCRs, HP pipeline, claims, cost tracking, attention items
dashboardRouter.get('/project-manager', async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      })
    }

    // Get accessible projects
    const projectAccess = await prisma.projectUser.findMany({
      where: { userId },
      select: { projectId: true, project: { select: { id: true, name: true, projectNumber: true, status: true } } },
      orderBy: { project: { updatedAt: 'desc' } }
    })

    const activeProjects = projectAccess
      .filter(pa => pa.project.status === 'active')
      .map(pa => pa.project)

    const primaryProject = activeProjects[0] || (projectAccess[0]?.project || null)
    const projectId = primaryProject?.id

    // Default empty response
    const emptyResponse = {
      lotProgress: { total: 0, notStarted: 0, inProgress: 0, onHold: 0, completed: 0, progressPercentage: 0 },
      openNCRs: { total: 0, major: 0, minor: 0, overdue: 0, items: [] },
      holdPointPipeline: { pending: 0, scheduled: 0, requested: 0, released: 0, thisWeek: 0, items: [] },
      claimStatus: { totalClaimed: 0, totalCertified: 0, totalPaid: 0, outstanding: 0, pendingClaims: 0, recentClaims: [] },
      costTracking: { budgetTotal: 0, actualSpend: 0, variance: 0, variancePercentage: 0, labourCost: 0, plantCost: 0, trend: 'on_track' as const },
      attentionItems: [],
      project: null
    }

    if (!projectId) {
      return res.json(emptyResponse)
    }

    // 1. Lot Progress
    const lotStats = await prisma.lot.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true
    })

    const lotProgress = {
      total: 0,
      notStarted: 0,
      inProgress: 0,
      onHold: 0,
      completed: 0,
      progressPercentage: 0
    }

    lotStats.forEach(stat => {
      lotProgress.total += stat._count
      switch (stat.status) {
        case 'not_started':
          lotProgress.notStarted = stat._count
          break
        case 'in_progress':
          lotProgress.inProgress = stat._count
          break
        case 'on_hold':
          lotProgress.onHold = stat._count
          break
        case 'completed':
        case 'conformed':
          lotProgress.completed += stat._count
          break
      }
    })

    lotProgress.progressPercentage = lotProgress.total > 0
      ? (lotProgress.completed / lotProgress.total) * 100
      : 0

    // 2. Open NCRs
    const today = new Date()
    const majorNCRs = await prisma.nCR.count({
      where: { projectId, category: 'major', status: { notIn: ['closed', 'closed_concession'] } }
    })
    const minorNCRs = await prisma.nCR.count({
      where: { projectId, category: 'minor', status: { notIn: ['closed', 'closed_concession'] } }
    })
    const overdueNCRs = await prisma.nCR.count({
      where: { projectId, status: { notIn: ['closed', 'closed_concession'] }, dueDate: { lt: today } }
    })

    const recentNCRs = await prisma.nCR.findMany({
      where: { projectId, status: { notIn: ['closed', 'closed_concession'] } },
      select: { id: true, ncrNumber: true, description: true, category: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    // 3. HP Pipeline
    const hpPending = await prisma.holdPoint.count({ where: { lot: { projectId }, status: 'pending' } })
    const hpScheduled = await prisma.holdPoint.count({ where: { lot: { projectId }, status: 'scheduled' } })
    const hpRequested = await prisma.holdPoint.count({ where: { lot: { projectId }, status: 'requested' } })
    const hpReleased = await prisma.holdPoint.count({ where: { lot: { projectId }, status: 'released' } })

    const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    const hpThisWeek = await prisma.holdPoint.count({
      where: {
        lot: { projectId },
        status: { in: ['scheduled', 'requested'] },
        scheduledDate: { gte: today, lte: oneWeekFromNow }
      }
    })

    const upcomingHPs = await prisma.holdPoint.findMany({
      where: { lot: { projectId }, status: { in: ['pending', 'scheduled', 'requested'] } },
      include: { lot: { select: { lotNumber: true, id: true, projectId: true } } },
      orderBy: { scheduledDate: 'asc' },
      take: 5
    })

    // 4. Claims Status
    const claims = await prisma.progressClaim.findMany({
      where: { projectId },
      select: {
        id: true,
        claimNumber: true,
        totalClaimedAmount: true,
        certifiedAmount: true,
        paidAmount: true,
        status: true
      }
    })

    let totalClaimed = 0
    let totalCertified = 0
    let totalPaid = 0
    let pendingClaims = 0

    claims.forEach(claim => {
      totalClaimed += Number(claim.totalClaimedAmount || 0)
      totalCertified += Number(claim.certifiedAmount || 0)
      totalPaid += Number(claim.paidAmount || 0)
      if (claim.status === 'submitted' || claim.status === 'pending') {
        pendingClaims++
      }
    })

    const recentClaims = await prisma.progressClaim.findMany({
      where: { projectId },
      select: { id: true, claimNumber: true, totalClaimedAmount: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    // 5. Cost Tracking
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { contractValue: true }
    })

    const dockets = await prisma.dailyDocket.findMany({
      where: { projectId, status: 'approved' },
      select: { totalLabourSubmitted: true, totalPlantSubmitted: true }
    })

    let labourCost = 0
    let plantCost = 0
    dockets.forEach(d => {
      labourCost += Number(d.totalLabourSubmitted || 0)
      plantCost += Number(d.totalPlantSubmitted || 0)
    })

    const budgetTotal = Number(project?.contractValue || 0)
    const actualSpend = labourCost + plantCost
    const variance = actualSpend - budgetTotal
    const variancePercentage = budgetTotal > 0 ? (variance / budgetTotal) * 100 : 0
    const trend = variancePercentage < -5 ? 'under' : variancePercentage > 5 ? 'over' : 'on_track'

    // 6. Attention Items
    const attentionItems: Array<{
      id: string
      type: 'ncr' | 'holdpoint' | 'claim' | 'diary'
      title: string
      description: string
      urgency: 'critical' | 'warning' | 'info'
      link: string
    }> = []

    // Add overdue NCRs
    const overdueNCRList = await prisma.nCR.findMany({
      where: { projectId, status: { notIn: ['closed', 'closed_concession'] }, dueDate: { lt: today } },
      select: { id: true, ncrNumber: true, description: true },
      take: 3
    })
    overdueNCRList.forEach(ncr => {
      attentionItems.push({
        id: `ncr-${ncr.id}`,
        type: 'ncr',
        title: `NCR ${ncr.ncrNumber} overdue`,
        description: ncr.description,
        urgency: 'critical',
        link: `/projects/${projectId}/ncr?ncrId=${ncr.id}`
      })
    })

    // Add major NCRs
    const majorNCRList = await prisma.nCR.findMany({
      where: { projectId, category: 'major', status: { notIn: ['closed', 'closed_concession'] }, dueDate: { gte: today } },
      select: { id: true, ncrNumber: true, description: true },
      take: 2
    })
    majorNCRList.forEach(ncr => {
      attentionItems.push({
        id: `ncr-major-${ncr.id}`,
        type: 'ncr',
        title: `Major NCR: ${ncr.ncrNumber}`,
        description: ncr.description,
        urgency: 'warning',
        link: `/projects/${projectId}/ncr?ncrId=${ncr.id}`
      })
    })

    res.json({
      lotProgress,
      openNCRs: {
        total: majorNCRs + minorNCRs,
        major: majorNCRs,
        minor: minorNCRs,
        overdue: overdueNCRs,
        items: recentNCRs.map(ncr => ({
          id: ncr.id,
          ncrNumber: ncr.ncrNumber,
          description: ncr.description,
          category: ncr.category,
          status: ncr.status,
          daysOpen: Math.floor((Date.now() - ncr.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
          link: `/projects/${projectId}/ncr?ncrId=${ncr.id}`
        }))
      },
      holdPointPipeline: {
        pending: hpPending,
        scheduled: hpScheduled,
        requested: hpRequested,
        released: hpReleased,
        thisWeek: hpThisWeek,
        items: upcomingHPs.map(hp => ({
          id: hp.id,
          description: hp.description || 'Hold Point',
          lotNumber: hp.lot.lotNumber,
          status: hp.status,
          scheduledDate: hp.scheduledDate?.toISOString() || null,
          link: `/projects/${hp.lot.projectId}/lots/${hp.lot.id}/holdpoints?hp=${hp.id}`
        }))
      },
      claimStatus: {
        totalClaimed,
        totalCertified,
        totalPaid,
        outstanding: totalCertified - totalPaid,
        pendingClaims,
        recentClaims: recentClaims.map(c => ({
          id: c.id,
          claimNumber: c.claimNumber,
          amount: Number(c.totalClaimedAmount || 0),
          status: c.status,
          link: `/projects/${projectId}/claims/${c.id}`
        }))
      },
      costTracking: {
        budgetTotal,
        actualSpend,
        variance,
        variancePercentage: Math.round(variancePercentage * 10) / 10,
        labourCost,
        plantCost,
        trend
      },
      attentionItems,
      project: primaryProject
    })
  } catch (error) {
    console.error('Project manager dashboard error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
