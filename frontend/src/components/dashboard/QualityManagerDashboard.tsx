// Feature #293: Quality Manager Dashboard
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAuthToken, useAuth } from '@/lib/auth'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ClipboardCheck,
  FileCheck,
  Clock,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  Shield,
  BarChart3,
  AlertCircle
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3031'

interface QMDashboardData {
  // Lot conformance
  lotConformance: {
    totalLots: number
    conformingLots: number
    nonConformingLots: number
    rate: number // percentage
  }
  // NCRs by category
  ncrsByCategory: {
    major: number
    minor: number
    observation: number
    total: number
  }
  // Open NCRs breakdown
  openNCRs: Array<{
    id: string
    ncrNumber: string
    description: string
    category: string
    status: string
    dueDate: string | null
    daysOpen: number
    link: string
  }>
  // Pending verifications (ITP items awaiting verification)
  pendingVerifications: {
    count: number
    items: Array<{
      id: string
      description: string
      lotNumber: string
      link: string
    }>
  }
  // Hold point release rate
  holdPointMetrics: {
    totalReleased: number
    totalPending: number
    releaseRate: number // percentage
    avgTimeToRelease: number // hours
  }
  // ITP completion trends
  itpTrends: {
    completedThisWeek: number
    completedLastWeek: number
    trend: 'up' | 'down' | 'stable'
    completionRate: number // percentage
  }
  // Audit readiness
  auditReadiness: {
    score: number // 0-100
    status: 'ready' | 'needs_attention' | 'not_ready'
    issues: string[]
  }
  // Project context
  project: {
    id: string
    name: string
    projectNumber: string
  } | null
}

export function QualityManagerDashboard() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user: _user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<QMDashboardData>({
    lotConformance: { totalLots: 0, conformingLots: 0, nonConformingLots: 0, rate: 0 },
    ncrsByCategory: { major: 0, minor: 0, observation: 0, total: 0 },
    openNCRs: [],
    pendingVerifications: { count: 0, items: [] },
    holdPointMetrics: { totalReleased: 0, totalPending: 0, releaseRate: 0, avgTimeToRelease: 0 },
    itpTrends: { completedThisWeek: 0, completedLastWeek: 0, trend: 'stable', completionRate: 0 },
    auditReadiness: { score: 0, status: 'not_ready', issues: [] },
    project: null
  })

  const fetchDashboardData = async () => {
    const token = getAuthToken()
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/dashboard/quality-manager`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (err) {
      console.error('Error fetching QM dashboard:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchDashboardData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const getAuditStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'text-green-600 bg-green-100'
      case 'needs_attention': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-red-600 bg-red-100'
    }
  }

  const getAuditStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <CheckCircle2 className="h-5 w-5" />
      case 'needs_attention': return <AlertCircle className="h-5 w-5" />
      default: return <XCircle className="h-5 w-5" />
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quality Dashboard</h1>
          <p className="text-muted-foreground">
            Quality metrics and conformance overview
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Project Context */}
      {data.project && (
        <div className="text-sm text-muted-foreground border-l-4 border-primary pl-3">
          Project: <strong>{data.project.name}</strong>
          {data.project.projectNumber && ` (${data.project.projectNumber})`}
        </div>
      )}

      {/* Top Metrics Row */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Lot Conformance Rate */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${data.lotConformance.rate >= 90 ? 'bg-green-100' : data.lotConformance.rate >= 70 ? 'bg-yellow-100' : 'bg-red-100'}`}>
              <CheckCircle2 className={`h-5 w-5 ${data.lotConformance.rate >= 90 ? 'text-green-600' : data.lotConformance.rate >= 70 ? 'text-yellow-600' : 'text-red-600'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lot Conformance</p>
              <p className="text-2xl font-bold">{data.lotConformance.rate.toFixed(1)}%</p>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {data.lotConformance.conformingLots} of {data.lotConformance.totalLots} lots conforming
          </div>
        </div>

        {/* HP Release Rate */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ClipboardCheck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">HP Release Rate</p>
              <p className="text-2xl font-bold">{data.holdPointMetrics.releaseRate.toFixed(1)}%</p>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {data.holdPointMetrics.totalPending} pending • Avg {data.holdPointMetrics.avgTimeToRelease}h to release
          </div>
        </div>

        {/* ITP Completion */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileCheck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ITP Completion</p>
              <p className="text-2xl font-bold">{data.itpTrends.completionRate.toFixed(1)}%</p>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
            {data.itpTrends.trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
            {data.itpTrends.completedThisWeek} completed this week
            {data.itpTrends.trend === 'up' && ' (↑)'}
            {data.itpTrends.trend === 'down' && ' (↓)'}
          </div>
        </div>

        {/* Audit Readiness */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${getAuditStatusColor(data.auditReadiness.status)}`}>
              {getAuditStatusIcon(data.auditReadiness.status)}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Audit Readiness</p>
              <p className="text-2xl font-bold">{data.auditReadiness.score}%</p>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {data.auditReadiness.status === 'ready' ? 'Ready for audit' : `${data.auditReadiness.issues.length} issue(s) to address`}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Open NCRs by Category */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-semibold">Open NCRs by Category</h2>
            </div>
            <span className="bg-red-100 text-red-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {data.ncrsByCategory.total} total
            </span>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm">Major</span>
                </div>
                <span className="font-bold text-red-600">{data.ncrsByCategory.major}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-sm">Minor</span>
                </div>
                <span className="font-bold text-yellow-600">{data.ncrsByCategory.minor}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm">Observation</span>
                </div>
                <span className="font-bold text-blue-600">{data.ncrsByCategory.observation}</span>
              </div>
            </div>

            {data.openNCRs.length > 0 && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Recent NCRs</p>
                {data.openNCRs.slice(0, 3).map((ncr) => (
                  <button
                    key={ncr.id}
                    onClick={() => navigate(ncr.link)}
                    className="w-full flex items-center justify-between p-2 bg-muted/30 rounded hover:bg-muted/50 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ncr.ncrNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">{ncr.description}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${ncr.category === 'major' ? 'bg-red-100 text-red-700' : ncr.category === 'minor' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                      {ncr.category}
                    </span>
                  </button>
                ))}
                <Link
                  to="/ncr"
                  className="block text-sm text-primary hover:underline pt-2"
                >
                  View all NCRs →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Pending Verifications */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold">Pending Verifications</h2>
            </div>
            {data.pendingVerifications.count > 0 && (
              <span className="bg-amber-100 text-amber-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                {data.pendingVerifications.count} pending
              </span>
            )}
          </div>
          <div className="p-4">
            {data.pendingVerifications.count > 0 ? (
              <div className="space-y-2">
                {data.pendingVerifications.items.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.link)}
                    className="w-full flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">Lot {item.lotNumber}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
                {data.pendingVerifications.count > 5 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    +{data.pendingVerifications.count - 5} more items
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600 py-4">
                <CheckCircle2 className="h-5 w-5" />
                <span>All verifications complete</span>
              </div>
            )}
          </div>
        </div>

        {/* Audit Readiness Details */}
        {data.auditReadiness.issues.length > 0 && (
          <div className="bg-card rounded-lg border lg:col-span-2">
            <div className="p-4 border-b flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Audit Readiness Issues</h2>
            </div>
            <div className="p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {data.auditReadiness.issues.map((issue, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-amber-800">{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
        </div>
        <div className="p-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <Link
            to="/ncr"
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
          >
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="font-medium">NCR Register</span>
          </Link>
          <Link
            to="/itp"
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
          >
            <FileCheck className="h-5 w-5 text-purple-600" />
            <span className="font-medium">ITP Management</span>
          </Link>
          <Link
            to="/holdpoints"
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
          >
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            <span className="font-medium">Hold Points</span>
          </Link>
          <Link
            to="/reports"
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
          >
            <BarChart3 className="h-5 w-5 text-green-600" />
            <span className="font-medium">Quality Reports</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
