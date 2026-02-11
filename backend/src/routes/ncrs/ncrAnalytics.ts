// NCR analytics and role-check endpoints
import { Router } from 'express'
import { prisma } from '../../lib/prisma.js'
import { type AuthUser } from '../../lib/auth.js'
import { requireAuth } from '../../middleware/authMiddleware.js'
import { AppError } from '../../lib/AppError.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

export const ncrAnalyticsRouter = Router()

// GET /api/ncrs/analytics/:projectId - Get NCR analytics for a project
ncrAnalyticsRouter.get('/analytics/:projectId', requireAuth, asyncHandler(async (req: any, res) => {

  const user = req.user as AuthUser
  const { projectId } = req.params
  const { startDate, endDate } = req.query

  // Check access
  const projectUser = await prisma.projectUser.findFirst({
    where: {
      projectId,
      userId: user.userId,
    },
  })

  if (!projectUser) {
    throw AppError.forbidden('Access denied')
  }

  // Build date filter
  const dateFilter: any = {}
  if (startDate) {
    dateFilter.gte = new Date(startDate as string)
  }
  if (endDate) {
    dateFilter.lte = new Date(endDate as string)
  }

  const where: any = { projectId }
  if (Object.keys(dateFilter).length > 0) {
    where.raisedAt = dateFilter
  }

  // Get all NCRs for analytics
  const ncrs = await prisma.nCR.findMany({
    where,
    select: {
      id: true,
      ncrNumber: true,
      status: true,
      severity: true,
      category: true,
      rootCauseCategory: true,
      raisedAt: true,
      closedAt: true,
      dueDate: true,
      responsibleSubcontractorId: true,
      description: true,
    },
  })

  // Root cause breakdown
  const rootCauseBreakdown: Record<string, number> = {}
  ncrs.forEach(ncr => {
    const cause = ncr.rootCauseCategory || 'Not categorized'
    rootCauseBreakdown[cause] = (rootCauseBreakdown[cause] || 0) + 1
  })

  // Category breakdown
  const categoryBreakdown: Record<string, number> = {}
  ncrs.forEach(ncr => {
    const cat = ncr.category || 'Uncategorized'
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1
  })

  // Severity breakdown
  const severityBreakdown: Record<string, number> = {
    minor: 0,
    major: 0,
  }
  ncrs.forEach(ncr => {
    severityBreakdown[ncr.severity] = (severityBreakdown[ncr.severity] || 0) + 1
  })

  // Status breakdown
  const statusBreakdown: Record<string, number> = {}
  ncrs.forEach(ncr => {
    statusBreakdown[ncr.status] = (statusBreakdown[ncr.status] || 0) + 1
  })

  // Calculate metrics
  const totalNCRs = ncrs.length
  const openNCRs = ncrs.filter(n => !['closed', 'closed_concession'].includes(n.status)).length
  const closedNCRs = ncrs.filter(n => ['closed', 'closed_concession'].includes(n.status)).length
  const overdueNCRs = ncrs.filter(n => {
    if (!n.dueDate || ['closed', 'closed_concession'].includes(n.status)) return false
    return new Date(n.dueDate) < new Date()
  }).length

  // Average time to close (for closed NCRs)
  const closedWithDates = ncrs.filter(n => n.closedAt && n.raisedAt)
  let avgDaysToClose = 0
  if (closedWithDates.length > 0) {
    const totalDays = closedWithDates.reduce((sum, n) => {
      const diff = new Date(n.closedAt!).getTime() - new Date(n.raisedAt).getTime()
      return sum + diff / (1000 * 60 * 60 * 24)
    }, 0)
    avgDaysToClose = Math.round(totalDays / closedWithDates.length * 10) / 10
  }

  // Format for chart data
  const rootCauseChartData = Object.entries(rootCauseBreakdown).map(([name, value]) => ({
    name,
    value,
    percentage: Math.round((value / totalNCRs) * 100)
  })).sort((a, b) => b.value - a.value)

  const categoryChartData = Object.entries(categoryBreakdown).map(([name, value]) => ({
    name,
    value,
    percentage: Math.round((value / totalNCRs) * 100)
  })).sort((a, b) => b.value - a.value)

  // Closure time trend - group by month
  const closureTimeTrend: Record<string, { totalDays: number; count: number }> = {}
  closedWithDates.forEach(ncr => {
    const closedMonth = new Date(ncr.closedAt!).toISOString().substring(0, 7) // YYYY-MM format
    const daysToClose = (new Date(ncr.closedAt!).getTime() - new Date(ncr.raisedAt).getTime()) / (1000 * 60 * 60 * 24)

    if (!closureTimeTrend[closedMonth]) {
      closureTimeTrend[closedMonth] = { totalDays: 0, count: 0 }
    }
    closureTimeTrend[closedMonth].totalDays += daysToClose
    closureTimeTrend[closedMonth].count += 1
  })

  const closureTimeTrendData = Object.entries(closureTimeTrend)
    .map(([month, data]) => ({
      month,
      avgDays: Math.round(data.totalDays / data.count * 10) / 10,
      count: data.count
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // NCR volume trend - group by month
  const volumeTrend: Record<string, number> = {}
  ncrs.forEach(ncr => {
    const raisedMonth = new Date(ncr.raisedAt).toISOString().substring(0, 7)
    volumeTrend[raisedMonth] = (volumeTrend[raisedMonth] || 0) + 1
  })

  const volumeTrendData = Object.entries(volumeTrend)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // Feature #475: Repeat issue identification
  // Group NCRs by category + root cause to identify repeat issues
  const repeatIssueGroups: Record<string, {
    category: string
    rootCause: string
    ncrs: { id: string; ncrNumber: string; raisedAt: Date; status: string }[]
    count: number
  }> = {}

  ncrs.forEach(ncr => {
    const category = ncr.category || 'Uncategorized'
    const rootCause = ncr.rootCauseCategory || 'Not categorized'
    const key = `${category}::${rootCause}`

    if (!repeatIssueGroups[key]) {
      repeatIssueGroups[key] = {
        category,
        rootCause,
        ncrs: [],
        count: 0
      }
    }
    repeatIssueGroups[key].ncrs.push({
      id: ncr.id,
      ncrNumber: ncr.ncrNumber,
      raisedAt: ncr.raisedAt,
      status: ncr.status
    })
    repeatIssueGroups[key].count++
  })

  // Filter to only show groups with 2+ NCRs (actual repeats)
  const repeatIssues = Object.values(repeatIssueGroups)
    .filter(group => group.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10) // Top 10 repeat issues

  // Also identify subcontractors with repeat issues
  const subcontractorIssues: Record<string, {
    subcontractorId: string
    ncrCount: number
    ncrIds: string[]
    categories: string[]
  }> = {}

  ncrs.forEach(ncr => {
    if (ncr.responsibleSubcontractorId) {
      const subId = ncr.responsibleSubcontractorId
      if (!subcontractorIssues[subId]) {
        subcontractorIssues[subId] = {
          subcontractorId: subId,
          ncrCount: 0,
          ncrIds: [],
          categories: []
        }
      }
      subcontractorIssues[subId].ncrCount++
      subcontractorIssues[subId].ncrIds.push(ncr.id)
      if (!subcontractorIssues[subId].categories.includes(ncr.category || 'Uncategorized')) {
        subcontractorIssues[subId].categories.push(ncr.category || 'Uncategorized')
      }
    }
  })

  // Filter to subcontractors with 2+ NCRs
  const repeatOffenders = Object.values(subcontractorIssues)
    .filter(sub => sub.ncrCount >= 2)
    .sort((a, b) => b.ncrCount - a.ncrCount)

  res.json({
    summary: {
      total: totalNCRs,
      open: openNCRs,
      closed: closedNCRs,
      overdue: overdueNCRs,
      avgDaysToClose,
      closureRate: totalNCRs > 0 ? Math.round((closedNCRs / totalNCRs) * 100) : 0,
    },
    charts: {
      rootCause: {
        title: 'NCRs by Root Cause',
        data: rootCauseChartData,
      },
      category: {
        title: 'NCRs by Category',
        data: categoryChartData,
      },
      severity: {
        title: 'NCRs by Severity',
        data: Object.entries(severityBreakdown).map(([name, value]) => ({
          name,
          value,
          percentage: totalNCRs > 0 ? Math.round((value / totalNCRs) * 100) : 0
        })),
      },
      status: {
        title: 'NCRs by Status',
        data: Object.entries(statusBreakdown).map(([name, value]) => ({
          name,
          value,
          percentage: totalNCRs > 0 ? Math.round((value / totalNCRs) * 100) : 0
        })),
      },
      closureTimeTrend: {
        title: 'Average Closure Time Trend',
        description: 'Average days to close NCRs by month',
        data: closureTimeTrendData,
        overallAvg: avgDaysToClose,
      },
      volumeTrend: {
        title: 'NCR Volume Trend',
        description: 'Number of NCRs raised by month',
        data: volumeTrendData,
      },
    },
    drillDown: {
      // Provide NCR IDs for each root cause for drill-down capability
      rootCause: Object.fromEntries(
        Object.keys(rootCauseBreakdown).map(cause => [
          cause,
          ncrs.filter(n => (n.rootCauseCategory || 'Not categorized') === cause).map(n => n.id)
        ])
      ),
      category: Object.fromEntries(
        Object.keys(categoryBreakdown).map(cat => [
          cat,
          ncrs.filter(n => (n.category || 'Uncategorized') === cat).map(n => n.id)
        ])
      ),
    },
    // Feature #475: Repeat issue identification
    repeatIssues: {
      title: 'Repeat Issues',
      description: 'NCRs grouped by category and root cause showing recurring problems',
      data: repeatIssues,
      totalRepeatGroups: repeatIssues.length,
    },
    repeatOffenders: {
      title: 'Subcontractors with Multiple NCRs',
      description: 'Subcontractors responsible for 2 or more NCRs',
      data: repeatOffenders,
    },
  })
  
}))

// Helper endpoint to get user's role on a project
ncrAnalyticsRouter.get('/check-role/:projectId', requireAuth, asyncHandler(async (req: any, res) => {

  const user = req.user as AuthUser
  const { projectId } = req.params

  const projectUser = await prisma.projectUser.findFirst({
    where: {
      projectId,
      userId: user.userId,
    },
    select: {
      role: true,
    },
  })

  if (!projectUser) {
    throw AppError.forbidden('Access denied')
  }

  const isQualityManager = ['quality_manager', 'admin', 'project_manager'].includes(projectUser.role)

  res.json({
    role: projectUser.role,
    isQualityManager,
    canApproveNCRs: isQualityManager,
  })
  
}))
