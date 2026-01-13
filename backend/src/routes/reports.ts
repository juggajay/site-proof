import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'

export const reportsRouter = Router()

// Apply authentication middleware to all report routes
reportsRouter.use(requireAuth)

// GET /api/reports/lot-status - Lot status report
reportsRouter.get('/lot-status', async (req, res) => {
  try {
    const { projectId } = req.query

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId query parameter is required'
      })
    }

    // Get all lots for the project
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
    })

    // Calculate status counts
    const statusCounts = lots.reduce((acc: Record<string, number>, lot) => {
      const status = lot.status || 'not_started'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

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
      totalLots: lots.length,
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
    const { projectId } = req.query

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId query parameter is required'
      })
    }

    // Get all NCRs for the project
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

    const report = {
      generatedAt: new Date().toISOString(),
      projectId,
      totalNCRs: ncrs.length,
      statusCounts,
      categoryCounts,
      rootCauseCounts,
      responsiblePartyCounts,
      overdueCount,
      closedThisMonth,
      averageClosureTime,
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
      }
    }

    res.json(report)
  } catch (error) {
    console.error('NCR report error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/reports/test - Test results report
reportsRouter.get('/test', async (req, res) => {
  try {
    const { projectId } = req.query

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId query parameter is required'
      })
    }

    // Get all test results for the project
    const tests = await prisma.testResult.findMany({
      where: { projectId: projectId as string },
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
      totalTests: tests.length,
      passFailCounts,
      testTypeCounts,
      statusCounts,
      tests,
      summary: {
        pass: passFailCounts['pass'] || 0,
        fail: passFailCounts['fail'] || 0,
        pending: passFailCounts['pending'] || 0,
        passRate: tests.length > 0
          ? ((passFailCounts['pass'] || 0) / tests.length * 100).toFixed(1)
          : '0.0',
      }
    }

    res.json(report)
  } catch (error) {
    console.error('Test report error:', error)
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
