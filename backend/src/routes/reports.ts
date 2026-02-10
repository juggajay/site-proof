import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'

export const reportsRouter = Router()

// Apply authentication middleware to all report routes
reportsRouter.use(requireAuth)

// GET /api/reports/lot-status - Lot status report
reportsRouter.get('/lot-status', async (req, res) => {
  try {
    const { projectId, page = '1', limit = '100' } = req.query

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId query parameter is required'
      })
    }

    // Pagination parameters
    const pageNum = parseInt(page as string) || 1
    const limitNum = Math.min(parseInt(limit as string) || 100, 500) // Max 500 per page
    const skip = (pageNum - 1) * limitNum

    // Get total count for pagination
    const total = await prisma.lot.count({
      where: { projectId: projectId as string }
    })

    // Get paginated lots for the project
    const lots = await prisma.lot.findMany({
      where: { projectId: projectId as string },
      select: {
        id: true,
        lotNumber: true,
        description: true,
        status: true,
        activityType: true,
        chainageStart: true,
        chainageEnd: true,
        offset: true,
        layer: true,
        areaZone: true,
        createdAt: true,
        conformedAt: true,
      },
      orderBy: { lotNumber: 'asc' },
      skip,
      take: limitNum,
    })

    // Calculate status counts
    const statusCounts = lots.reduce((acc: Record<string, number>, lot) => {
      const status = lot.status || 'not_started'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    // Calculate period comparison data
    const today = new Date()
    const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0) // Last day of previous month

    // Count lots conformed this period (this month)
    const conformedThisPeriod = lots.filter(lot =>
      lot.conformedAt && new Date(lot.conformedAt) >= startOfThisMonth
    ).length

    // Count lots conformed last period (last month)
    const conformedLastPeriod = lots.filter(lot =>
      lot.conformedAt &&
      new Date(lot.conformedAt) >= startOfLastMonth &&
      new Date(lot.conformedAt) <= endOfLastMonth
    ).length

    // Calculate change from previous period
    const periodChange = conformedThisPeriod - conformedLastPeriod
    const periodChangePercent = conformedLastPeriod > 0
      ? ((periodChange / conformedLastPeriod) * 100).toFixed(1)
      : conformedThisPeriod > 0 ? '+100.0' : '0.0'

    // Calculate activity type counts
    const activityCounts = lots.reduce((acc: Record<string, number>, lot) => {
      const activity = lot.activityType || 'Unknown'
      acc[activity] = (acc[activity] || 0) + 1
      return acc
    }, {})

    // Generate report summary
    const report = {
      generatedAt: new Date().toISOString(),
      projectId,
      totalLots: total,
      statusCounts,
      activityCounts,
      lots: lots.map(lot => ({
        ...lot,
        status: lot.status || 'not_started'
      })),
      summary: {
        notStarted: statusCounts['not_started'] || 0,
        inProgress: statusCounts['in_progress'] || 0,
        awaitingTest: statusCounts['awaiting_test'] || 0,
        holdPoint: statusCounts['hold_point'] || 0,
        ncrRaised: statusCounts['ncr_raised'] || 0,
        conformed: statusCounts['conformed'] || 0,
        claimed: statusCounts['claimed'] || 0,
      },
      periodComparison: {
        conformedThisPeriod,
        conformedLastPeriod,
        periodChange,
        periodChangePercent,
        currentPeriodLabel: startOfThisMonth.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }),
        previousPeriodLabel: startOfLastMonth.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }),
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    }

    res.json(report)
  } catch (error) {
    console.error('Lot status report error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/reports/ncr - NCR report
reportsRouter.get('/ncr', async (req, res) => {
  try {
    const { projectId, page = '1', limit = '100' } = req.query

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId query parameter is required'
      })
    }

    // Pagination parameters
    const pageNum = parseInt(page as string) || 1
    const limitNum = Math.min(parseInt(limit as string) || 100, 500) // Max 500 per page
    const skip = (pageNum - 1) * limitNum

    // Get total count for pagination
    const total = await prisma.nCR.count({
      where: { projectId: projectId as string }
    })

    // Get paginated NCRs for the project
    const ncrs = await prisma.nCR.findMany({
      where: { projectId: projectId as string },
      select: {
        id: true,
        ncrNumber: true,
        description: true,
        category: true,
        status: true,
        raisedAt: true,
        closedAt: true,
        dueDate: true,
        rootCauseCategory: true,
      },
      orderBy: { ncrNumber: 'asc' },
      skip,
      take: limitNum,
    })

    // Calculate status counts
    const statusCounts = ncrs.reduce((acc: Record<string, number>, ncr) => {
      const status = ncr.status || 'open'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    // Calculate category counts
    const categoryCounts = ncrs.reduce((acc: Record<string, number>, ncr) => {
      const category = ncr.category || 'minor'
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {})

    // Calculate root cause counts
    const rootCauseCounts = ncrs.reduce((acc: Record<string, number>, ncr) => {
      const rootCause = ncr.rootCauseCategory || 'Not specified'
      acc[rootCause] = (acc[rootCause] || 0) + 1
      return acc
    }, {})

    // Calculate overdue NCRs
    const today = new Date()
    const overdueCount = ncrs.filter(ncr =>
      ncr.dueDate &&
      new Date(ncr.dueDate) < today &&
      !['closed', 'closed_concession'].includes(ncr.status || '')
    ).length

    // Calculate closed this month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const closedThisMonth = ncrs.filter(ncr =>
      ncr.closedAt &&
      new Date(ncr.closedAt) >= startOfMonth &&
      ['closed', 'closed_concession'].includes(ncr.status || '')
    ).length

    // Calculate average closure time (in days)
    const closedNcrs = ncrs.filter(ncr => ncr.closedAt && ncr.raisedAt)
    let averageClosureTime = 0
    if (closedNcrs.length > 0) {
      const totalClosureTime = closedNcrs.reduce((sum, ncr) => {
        const raisedDate = new Date(ncr.raisedAt)
        const closedDate = new Date(ncr.closedAt!)
        const diffDays = Math.ceil((closedDate.getTime() - raisedDate.getTime()) / (1000 * 60 * 60 * 24))
        return sum + diffDays
      }, 0)
      averageClosureTime = Math.round(totalClosureTime / closedNcrs.length)
    }

    // Get NCRs with responsible user info for responsible party breakdown
    const ncrsWithResponsible = await prisma.nCR.findMany({
      where: { projectId: projectId as string },
      select: {
        id: true,
        responsibleUser: {
          select: {
            fullName: true,
            email: true,
          }
        }
      },
    })

    // Calculate responsible party counts
    const responsiblePartyCounts = ncrsWithResponsible.reduce((acc: Record<string, number>, ncr) => {
      const responsible = ncr.responsibleUser?.fullName || ncr.responsibleUser?.email || 'Unassigned'
      acc[responsible] = (acc[responsible] || 0) + 1
      return acc
    }, {})

    // Calculate closure rate
    const totalClosed = (statusCounts['closed'] || 0) + (statusCounts['closed_concession'] || 0)
    const closureRate = ncrs.length > 0
      ? ((totalClosed / ncrs.length) * 100).toFixed(1)
      : '0.0'

    const report = {
      generatedAt: new Date().toISOString(),
      projectId,
      totalNCRs: total,
      statusCounts,
      categoryCounts,
      rootCauseCounts,
      responsiblePartyCounts,
      overdueCount,
      closedThisMonth,
      averageClosureTime,
      closureRate,
      ncrs,
      summary: {
        open: statusCounts['open'] || 0,
        investigating: statusCounts['investigating'] || 0,
        rectification: statusCounts['rectification'] || 0,
        verification: statusCounts['verification'] || 0,
        closed: statusCounts['closed'] || 0,
        closedConcession: statusCounts['closed_concession'] || 0,
        minor: categoryCounts['minor'] || 0,
        major: categoryCounts['major'] || 0,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    }

    res.json(report)
  } catch (error) {
    console.error('NCR report error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/reports/test - Test results report (Feature #208)
reportsRouter.get('/test', async (req, res) => {
  try {
    const { projectId, startDate, endDate, testTypes, lotIds, page = '1', limit = '100' } = req.query

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId query parameter is required'
      })
    }

    // Pagination parameters
    const pageNum = parseInt(page as string) || 1
    const limitNum = Math.min(parseInt(limit as string) || 100, 500) // Max 500 per page
    const skip = (pageNum - 1) * limitNum

    // Build where clause with optional filters
    const whereClause: any = { projectId: projectId as string }

    // Filter by date range (using sample date)
    if (startDate || endDate) {
      whereClause.sampleDate = {}
      if (startDate) {
        whereClause.sampleDate.gte = new Date(startDate as string)
      }
      if (endDate) {
        const end = new Date(endDate as string)
        end.setHours(23, 59, 59, 999)
        whereClause.sampleDate.lte = end
      }
    }

    // Filter by test types
    if (testTypes) {
      const types = (testTypes as string).split(',').filter(t => t.trim())
      if (types.length > 0) {
        whereClause.testType = { in: types }
      }
    }

    // Filter by lot IDs
    if (lotIds) {
      const lots = (lotIds as string).split(',').filter(l => l.trim())
      if (lots.length > 0) {
        whereClause.lotId = { in: lots }
      }
    }

    // Get total count for pagination
    const total = await prisma.testResult.count({
      where: whereClause
    })

    // Get paginated test results for the project with filters
    const tests = await prisma.testResult.findMany({
      where: whereClause,
      select: {
        id: true,
        testRequestNumber: true,
        testType: true,
        laboratoryName: true,
        laboratoryReportNumber: true,
        sampleDate: true,
        resultDate: true,
        resultValue: true,
        resultUnit: true,
        specificationMin: true,
        specificationMax: true,
        passFail: true,
        status: true,
        lotId: true,
      },
      orderBy: { sampleDate: 'desc' },
      skip,
      take: limitNum,
    })

    // Calculate pass/fail counts
    const passFailCounts = tests.reduce((acc: Record<string, number>, test) => {
      const result = test.passFail || 'pending'
      acc[result] = (acc[result] || 0) + 1
      return acc
    }, {})

    // Calculate test type counts
    const testTypeCounts = tests.reduce((acc: Record<string, number>, test) => {
      const testType = test.testType || 'Unknown'
      acc[testType] = (acc[testType] || 0) + 1
      return acc
    }, {})

    // Calculate status counts
    const statusCounts = tests.reduce((acc: Record<string, number>, test) => {
      const status = test.status || 'requested'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    const report = {
      generatedAt: new Date().toISOString(),
      projectId,
      totalTests: total,
      passFailCounts,
      testTypeCounts,
      statusCounts,
      tests,
      summary: {
        pass: passFailCounts['pass'] || 0,
        fail: passFailCounts['fail'] || 0,
        pending: passFailCounts['pending'] || 0,
        passRate: total > 0
          ? ((passFailCounts['pass'] || 0) / total * 100).toFixed(1)
          : '0.0',
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    }

    res.json(report)
  } catch (error) {
    console.error('Test report error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/reports/diary - Diary report with section selection
reportsRouter.get('/diary', async (req, res) => {
  try {
    const { projectId, startDate, endDate, sections, page = '1', limit = '100' } = req.query

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId query parameter is required'
      })
    }

    // Pagination parameters
    const pageNum = parseInt(page as string) || 1
    const limitNum = Math.min(parseInt(limit as string) || 100, 500) // Max 500 per page
    const skip = (pageNum - 1) * limitNum

    // Parse sections parameter (comma-separated) - default to all sections
    const selectedSections = sections
      ? (sections as string).split(',')
      : ['weather', 'personnel', 'plant', 'activities', 'delays']

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate as string)
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate as string)
    }

    // Build where clause
    const whereClause = {
      projectId: projectId as string,
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
    }

    // Get total count for pagination
    const total = await prisma.dailyDiary.count({ where: whereClause })

    // Get paginated diaries with selected sections
    const diaries = await prisma.dailyDiary.findMany({
      where: whereClause,
      include: {
        personnel: selectedSections.includes('personnel'),
        plant: selectedSections.includes('plant'),
        activities: selectedSections.includes('activities')
          ? { include: { lot: { select: { id: true, lotNumber: true } } } }
          : undefined,
        delays: selectedSections.includes('delays'),
        submittedBy: {
          select: { id: true, fullName: true, email: true }
        },
      },
      orderBy: { date: 'desc' },
      skip,
      take: limitNum,
    }) as any[]

    // Calculate summary statistics (from paginated results)
    const submittedCount = diaries.filter(d => d.status === 'submitted').length
    const draftCount = diaries.filter(d => d.status === 'draft').length

    // Weather summary (if section selected)
    let weatherSummary: Record<string, number> = {}
    if (selectedSections.includes('weather')) {
      weatherSummary = diaries.reduce((acc: Record<string, number>, diary) => {
        const condition = diary.weatherConditions || 'Not recorded'
        acc[condition] = (acc[condition] || 0) + 1
        return acc
      }, {})
    }

    // Personnel summary (if section selected)
    let personnelSummary = { totalPersonnel: 0, totalHours: 0, byCompany: {} as Record<string, { count: number; hours: number }> }
    if (selectedSections.includes('personnel')) {
      for (const diary of diaries) {
        if (diary.personnel) {
          for (const person of diary.personnel) {
            personnelSummary.totalPersonnel++
            const hours = person.hours ? parseFloat(person.hours.toString()) : 0
            personnelSummary.totalHours += hours

            const company = person.company || 'Unspecified'
            if (!personnelSummary.byCompany[company]) {
              personnelSummary.byCompany[company] = { count: 0, hours: 0 }
            }
            personnelSummary.byCompany[company].count++
            personnelSummary.byCompany[company].hours += hours
          }
        }
      }
    }

    // Plant summary (if section selected)
    let plantSummary = { totalPlant: 0, totalHours: 0, byCompany: {} as Record<string, { count: number; hours: number }> }
    if (selectedSections.includes('plant')) {
      for (const diary of diaries) {
        if (diary.plant) {
          for (const item of diary.plant) {
            plantSummary.totalPlant++
            const hours = item.hoursOperated ? parseFloat(item.hoursOperated.toString()) : 0
            plantSummary.totalHours += hours

            const company = item.company || 'Unspecified'
            if (!plantSummary.byCompany[company]) {
              plantSummary.byCompany[company] = { count: 0, hours: 0 }
            }
            plantSummary.byCompany[company].count++
            plantSummary.byCompany[company].hours += hours
          }
        }
      }
    }

    // Activities summary (if section selected)
    let activitiesSummary = { totalActivities: 0, byLot: {} as Record<string, number> }
    if (selectedSections.includes('activities')) {
      for (const diary of diaries) {
        if (diary.activities) {
          for (const activity of diary.activities) {
            activitiesSummary.totalActivities++
            const lotNumber = activity.lot?.lotNumber || 'No Lot'
            activitiesSummary.byLot[lotNumber] = (activitiesSummary.byLot[lotNumber] || 0) + 1
          }
        }
      }
    }

    // Delays summary (if section selected)
    let delaysSummary = { totalDelays: 0, totalHours: 0, byType: {} as Record<string, { count: number; hours: number }> }
    if (selectedSections.includes('delays')) {
      for (const diary of diaries) {
        if (diary.delays) {
          for (const delay of diary.delays) {
            delaysSummary.totalDelays++
            const hours = delay.durationHours ? parseFloat(delay.durationHours.toString()) : 0
            delaysSummary.totalHours += hours

            const delayType = delay.delayType || 'Other'
            if (!delaysSummary.byType[delayType]) {
              delaysSummary.byType[delayType] = { count: 0, hours: 0 }
            }
            delaysSummary.byType[delayType].count++
            delaysSummary.byType[delayType].hours += hours
          }
        }
      }
    }

    const report = {
      generatedAt: new Date().toISOString(),
      projectId,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      selectedSections,
      totalDiaries: total,
      submittedCount,
      draftCount,
      diaries: diaries.map(diary => ({
        id: diary.id,
        date: diary.date,
        status: diary.status,
        isLate: diary.isLate,
        submittedBy: diary.submittedBy,
        submittedAt: diary.submittedAt,
        ...(selectedSections.includes('weather') ? {
          weatherConditions: diary.weatherConditions,
          temperatureMin: diary.temperatureMin,
          temperatureMax: diary.temperatureMax,
          rainfallMm: diary.rainfallMm,
          weatherNotes: diary.weatherNotes,
          generalNotes: diary.generalNotes,
        } : {}),
        ...(selectedSections.includes('personnel') ? { personnel: diary.personnel } : {}),
        ...(selectedSections.includes('plant') ? { plant: diary.plant } : {}),
        ...(selectedSections.includes('activities') ? { activities: diary.activities } : {}),
        ...(selectedSections.includes('delays') ? { delays: diary.delays } : {}),
      })),
      summary: {
        ...(selectedSections.includes('weather') ? { weather: weatherSummary } : {}),
        ...(selectedSections.includes('personnel') ? { personnel: personnelSummary } : {}),
        ...(selectedSections.includes('plant') ? { plant: plantSummary } : {}),
        ...(selectedSections.includes('activities') ? { activities: activitiesSummary } : {}),
        ...(selectedSections.includes('delays') ? { delays: delaysSummary } : {}),
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    }

    res.json(report)
  } catch (error) {
    console.error('Diary report error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/reports/summary - Dashboard summary report
reportsRouter.get('/summary', async (req, res) => {
  try {
    const { projectId } = req.query

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId query parameter is required'
      })
    }

    // Get lot counts by status
    const lotCounts = await prisma.lot.groupBy({
      by: ['status'],
      where: { projectId: projectId as string },
      _count: true,
    })

    const lotStatusMap = lotCounts.reduce((acc: Record<string, number>, item) => {
      acc[item.status || 'not_started'] = item._count
      return acc
    }, {})

    const totalLots = lotCounts.reduce((sum, item) => sum + item._count, 0)

    // Get NCR counts by status
    const ncrCounts = await prisma.nCR.groupBy({
      by: ['status'],
      where: { projectId: projectId as string },
      _count: true,
    })

    const ncrStatusMap = ncrCounts.reduce((acc: Record<string, number>, item) => {
      acc[item.status || 'open'] = item._count
      return acc
    }, {})

    const totalNCRs = ncrCounts.reduce((sum, item) => sum + item._count, 0)
    const openNCRs = (ncrStatusMap['open'] || 0) +
                     (ncrStatusMap['investigating'] || 0) +
                     (ncrStatusMap['rectification'] || 0) +
                     (ncrStatusMap['verification'] || 0)

    // Get test result counts
    const testCounts = await prisma.testResult.groupBy({
      by: ['passFail'],
      where: { projectId: projectId as string },
      _count: true,
    })

    const testResultMap = testCounts.reduce((acc: Record<string, number>, item) => {
      acc[item.passFail || 'pending'] = item._count
      return acc
    }, {})

    const totalTests = testCounts.reduce((sum, item) => sum + item._count, 0)

    // Get hold point counts
    const holdPointCounts = await prisma.holdPoint.groupBy({
      by: ['status'],
      where: {
        lot: {
          projectId: projectId as string
        }
      },
      _count: true,
    })

    const holdPointStatusMap = holdPointCounts.reduce((acc: Record<string, number>, item) => {
      acc[item.status || 'pending'] = item._count
      return acc
    }, {})

    const totalHoldPoints = holdPointCounts.reduce((sum, item) => sum + item._count, 0)

    const summary = {
      generatedAt: new Date().toISOString(),
      projectId,
      lots: {
        total: totalLots,
        notStarted: lotStatusMap['not_started'] || 0,
        inProgress: lotStatusMap['in_progress'] || 0,
        awaitingTest: lotStatusMap['awaiting_test'] || 0,
        holdPoint: lotStatusMap['hold_point'] || 0,
        ncrRaised: lotStatusMap['ncr_raised'] || 0,
        conformed: lotStatusMap['conformed'] || 0,
        claimed: lotStatusMap['claimed'] || 0,
        conformedPercent: totalLots > 0
          ? ((lotStatusMap['conformed'] || 0) / totalLots * 100).toFixed(1)
          : '0.0',
      },
      ncrs: {
        total: totalNCRs,
        open: openNCRs,
        closed: (ncrStatusMap['closed'] || 0) + (ncrStatusMap['closed_concession'] || 0),
      },
      tests: {
        total: totalTests,
        pass: testResultMap['pass'] || 0,
        fail: testResultMap['fail'] || 0,
        pending: testResultMap['pending'] || 0,
        passRate: totalTests > 0
          ? ((testResultMap['pass'] || 0) / totalTests * 100).toFixed(1)
          : '0.0',
      },
      holdPoints: {
        total: totalHoldPoints,
        pending: holdPointStatusMap['pending'] || 0,
        notified: holdPointStatusMap['notified'] || 0,
        released: holdPointStatusMap['released'] || 0,
      }
    }

    res.json(summary)
  } catch (error) {
    console.error('Summary report error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Feature #287: GET /api/reports/claims - Claim history report
reportsRouter.get('/claims', async (req, res) => {
  try {
    const { projectId, startDate, endDate, status } = req.query

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId query parameter is required'
      })
    }

    // Build where clause with optional filters
    const whereClause: any = { projectId: projectId as string }

    // Filter by date range (using claimPeriodEnd)
    if (startDate || endDate) {
      whereClause.claimPeriodEnd = {}
      if (startDate) {
        whereClause.claimPeriodEnd.gte = new Date(startDate as string)
      }
      if (endDate) {
        const end = new Date(endDate as string)
        end.setHours(23, 59, 59, 999)
        whereClause.claimPeriodEnd.lte = end
      }
    }

    // Filter by status
    if (status) {
      const statuses = (status as string).split(',').filter(s => s.trim())
      if (statuses.length > 0) {
        whereClause.status = { in: statuses }
      }
    }

    // Get all claims for the project
    const claims = await prisma.progressClaim.findMany({
      where: whereClause,
      include: {
        claimedLots: {
          include: {
            lot: {
              select: { id: true, lotNumber: true, description: true, activityType: true }
            }
          }
        },
        preparedBy: {
          select: { id: true, fullName: true, email: true }
        }
      },
      orderBy: { claimNumber: 'desc' }
    })

    // Calculate status counts
    const statusCounts = claims.reduce((acc: Record<string, number>, claim) => {
      const claimStatus = claim.status || 'draft'
      acc[claimStatus] = (acc[claimStatus] || 0) + 1
      return acc
    }, {})

    // Calculate financial summary
    let totalClaimed = 0
    let totalCertified = 0
    let totalPaid = 0
    let totalLots = 0

    for (const claim of claims) {
      totalClaimed += claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0
      totalCertified += claim.certifiedAmount ? Number(claim.certifiedAmount) : 0
      totalPaid += claim.paidAmount ? Number(claim.paidAmount) : 0
      totalLots += claim.claimedLots.length
    }

    const outstanding = totalCertified - totalPaid
    const certificationRate = totalClaimed > 0
      ? ((totalCertified / totalClaimed) * 100).toFixed(1)
      : '0.0'
    const collectionRate = totalCertified > 0
      ? ((totalPaid / totalCertified) * 100).toFixed(1)
      : '0.0'

    // Calculate monthly breakdown
    const monthlyData: Record<string, { claimed: number; certified: number; paid: number; count: number }> = {}
    for (const claim of claims) {
      const monthKey = claim.claimPeriodEnd.toISOString().slice(0, 7) // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { claimed: 0, certified: 0, paid: 0, count: 0 }
      }
      monthlyData[monthKey].claimed += claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0
      monthlyData[monthKey].certified += claim.certifiedAmount ? Number(claim.certifiedAmount) : 0
      monthlyData[monthKey].paid += claim.paidAmount ? Number(claim.paidAmount) : 0
      monthlyData[monthKey].count++
    }

    // Convert monthly data to sorted array
    const monthlyBreakdown = Object.entries(monthlyData)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        ...data,
        variance: data.claimed - data.certified
      }))

    // Transform claims for export
    const claimsData = claims.map(claim => ({
      id: claim.id,
      claimNumber: claim.claimNumber,
      periodStart: claim.claimPeriodStart.toISOString().split('T')[0],
      periodEnd: claim.claimPeriodEnd.toISOString().split('T')[0],
      status: claim.status,
      totalClaimedAmount: claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0,
      certifiedAmount: claim.certifiedAmount ? Number(claim.certifiedAmount) : null,
      paidAmount: claim.paidAmount ? Number(claim.paidAmount) : null,
      variance: claim.certifiedAmount && claim.totalClaimedAmount
        ? Number(claim.totalClaimedAmount) - Number(claim.certifiedAmount)
        : null,
      outstanding: claim.certifiedAmount && claim.paidAmount
        ? Number(claim.certifiedAmount) - Number(claim.paidAmount)
        : claim.certifiedAmount ? Number(claim.certifiedAmount) : null,
      submittedAt: claim.submittedAt?.toISOString().split('T')[0] || null,
      certifiedAt: claim.certifiedAt?.toISOString().split('T')[0] || null,
      paidAt: claim.paidAt?.toISOString().split('T')[0] || null,
      paymentReference: claim.paymentReference || null,
      lotCount: claim.claimedLots.length,
      lots: claim.claimedLots.map(cl => ({
        lotNumber: cl.lot.lotNumber,
        description: cl.lot.description,
        activityType: cl.lot.activityType,
        amountClaimed: cl.amountClaimed ? Number(cl.amountClaimed) : 0
      })),
      preparedBy: claim.preparedBy ? {
        name: claim.preparedBy.fullName || claim.preparedBy.email,
        email: claim.preparedBy.email
      } : null,
      preparedAt: claim.preparedAt?.toISOString().split('T')[0] || null
    }))

    const report = {
      generatedAt: new Date().toISOString(),
      projectId,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null
      },
      totalClaims: claims.length,
      statusCounts,
      financialSummary: {
        totalClaimed,
        totalCertified,
        totalPaid,
        outstanding,
        certificationRate,
        collectionRate,
        totalLots
      },
      monthlyBreakdown,
      claims: claimsData,
      // Excel-friendly flat format for export
      exportData: claimsData.map(claim => ({
        'Claim #': claim.claimNumber,
        'Period Start': claim.periodStart,
        'Period End': claim.periodEnd,
        'Status': claim.status,
        'Claimed Amount': claim.totalClaimedAmount,
        'Certified Amount': claim.certifiedAmount,
        'Paid Amount': claim.paidAmount,
        'Variance': claim.variance,
        'Outstanding': claim.outstanding,
        'Submitted Date': claim.submittedAt,
        'Certified Date': claim.certifiedAt,
        'Paid Date': claim.paidAt,
        'Payment Reference': claim.paymentReference,
        'Lot Count': claim.lotCount,
        'Prepared By': claim.preparedBy?.name
      }))
    }

    res.json(report)
  } catch (error) {
    console.error('Claim history report error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ============================================================================
// Scheduled Reports API
// ============================================================================

// Helper to calculate the next run time based on frequency
function calculateNextRunAt(frequency: string, dayOfWeek: number | null, dayOfMonth: number | null, timeOfDay: string): Date {
  const now = new Date()
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  const nextRun = new Date()
  nextRun.setHours(hours, minutes, 0, 0)

  switch (frequency) {
    case 'daily':
      // If time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
      break
    case 'weekly':
      // Find next occurrence of dayOfWeek (0 = Sunday)
      const targetDay = dayOfWeek ?? 1 // Default to Monday
      const currentDay = nextRun.getDay()
      let daysUntil = targetDay - currentDay
      if (daysUntil < 0 || (daysUntil === 0 && nextRun <= now)) {
        daysUntil += 7
      }
      nextRun.setDate(nextRun.getDate() + daysUntil)
      break
    case 'monthly':
      // Find next occurrence of dayOfMonth
      const targetDayOfMonth = dayOfMonth ?? 1 // Default to 1st
      nextRun.setDate(targetDayOfMonth)
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1)
      }
      // Handle months that don't have the target day (e.g., Feb 30)
      if (nextRun.getDate() !== targetDayOfMonth) {
        nextRun.setDate(0) // Last day of previous month
      }
      break
  }

  return nextRun
}

// GET /api/reports/schedules - List scheduled reports for a project
reportsRouter.get('/schedules', async (req, res) => {
  try {
    const { projectId } = req.query

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId query parameter is required'
      })
    }

    const schedules = await prisma.scheduledReport.findMany({
      where: { projectId: projectId as string },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ schedules })
  } catch (error) {
    console.error('List scheduled reports error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/reports/schedules - Create a new scheduled report
reportsRouter.post('/schedules', async (req, res) => {
  try {
    const { projectId, reportType, frequency, dayOfWeek, dayOfMonth, timeOfDay, recipients } = req.body
    const userId = req.user?.id

    if (!projectId || !reportType || !frequency || !recipients) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId, reportType, frequency, and recipients are required'
      })
    }

    // Validate frequency
    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'frequency must be daily, weekly, or monthly'
      })
    }

    // Validate reportType
    if (!['lot-status', 'ncr', 'test', 'diary'].includes(reportType)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'reportType must be lot-status, ncr, test, or diary'
      })
    }

    // Calculate next run time
    const nextRunAt = calculateNextRunAt(
      frequency,
      dayOfWeek ?? null,
      dayOfMonth ?? null,
      timeOfDay || '09:00'
    )

    const schedule = await prisma.scheduledReport.create({
      data: {
        projectId,
        reportType,
        frequency,
        dayOfWeek: dayOfWeek ?? null,
        dayOfMonth: dayOfMonth ?? null,
        timeOfDay: timeOfDay || '09:00',
        recipients: Array.isArray(recipients) ? recipients.join(',') : recipients,
        nextRunAt,
        createdById: userId,
        isActive: true,
      },
    })

    res.status(201).json({ schedule })
  } catch (error) {
    console.error('Create scheduled report error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/reports/schedules/:id - Update a scheduled report
reportsRouter.put('/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { reportType, frequency, dayOfWeek, dayOfMonth, timeOfDay, recipients, isActive } = req.body

    // Check if schedule exists
    const existing = await prisma.scheduledReport.findUnique({
      where: { id },
    })

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Scheduled report not found'
      })
    }

    // Calculate new next run time if scheduling parameters changed
    const newFrequency = frequency ?? existing.frequency
    const newDayOfWeek = dayOfWeek ?? existing.dayOfWeek
    const newDayOfMonth = dayOfMonth ?? existing.dayOfMonth
    const newTimeOfDay = timeOfDay ?? existing.timeOfDay

    const nextRunAt = calculateNextRunAt(
      newFrequency,
      newDayOfWeek,
      newDayOfMonth,
      newTimeOfDay
    )

    const schedule = await prisma.scheduledReport.update({
      where: { id },
      data: {
        ...(reportType !== undefined && { reportType }),
        ...(frequency !== undefined && { frequency }),
        ...(dayOfWeek !== undefined && { dayOfWeek }),
        ...(dayOfMonth !== undefined && { dayOfMonth }),
        ...(timeOfDay !== undefined && { timeOfDay }),
        ...(recipients !== undefined && {
          recipients: Array.isArray(recipients) ? recipients.join(',') : recipients
        }),
        ...(isActive !== undefined && { isActive }),
        nextRunAt,
      },
    })

    res.json({ schedule })
  } catch (error) {
    console.error('Update scheduled report error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/reports/schedules/:id - Delete a scheduled report
reportsRouter.delete('/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Check if schedule exists
    const existing = await prisma.scheduledReport.findUnique({
      where: { id },
    })

    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Scheduled report not found'
      })
    }

    await prisma.scheduledReport.delete({
      where: { id },
    })

    res.json({ success: true, message: 'Scheduled report deleted' })
  } catch (error) {
    console.error('Delete scheduled report error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
