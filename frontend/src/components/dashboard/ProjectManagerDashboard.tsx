// Feature #294: Project Manager Dashboard
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAuthToken, useAuth } from '@/lib/auth'
import {
  FolderKanban,
  AlertTriangle,
  ClipboardCheck,
  DollarSign,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle2,
  FileText,
  BarChart3,
  Users,
  Layers
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3031'

interface PMDashboardData {
  // Lot progress summary
  lotProgress: {
    total: number
    notStarted: number
    inProgress: number
    onHold: number
    completed: number
    progressPercentage: number
  }
  // Open NCRs summary
  openNCRs: {
    total: number
    major: number
    minor: number
    overdue: number
    items: Array<{
      id: string
      ncrNumber: string
      description: string
      category: string
      status: string
      daysOpen: number
      link: string
    }>
  }
  // HP pipeline
  holdPointPipeline: {
    pending: number
    scheduled: number
    requested: number
    released: number
    thisWeek: number
    items: Array<{
      id: string
      description: string
      lotNumber: string
      status: string
      scheduledDate: string | null
      link: string
    }>
  }
  // Claim status
  claimStatus: {
    totalClaimed: number
    totalCertified: number
    totalPaid: number
    outstanding: number
    pendingClaims: number
    recentClaims: Array<{
      id: string
      claimNumber: string
      amount: number
      status: string
      link: string
    }>
  }
  // Cost tracking
  costTracking: {
    budgetTotal: number
    actualSpend: number
    variance: number
    variancePercentage: number
    labourCost: number
    plantCost: number
    trend: 'under' | 'over' | 'on_track'
  }
  // Items requiring attention
  attentionItems: Array<{
    id: string
    type: 'ncr' | 'holdpoint' | 'claim' | 'diary'
    title: string
    description: string
    urgency: 'critical' | 'warning' | 'info'
    link: string
  }>
  // Project context
  project: {
    id: string
    name: string
    projectNumber: string
    status: string
  } | null
}

export function ProjectManagerDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<PMDashboardData>({
    lotProgress: { total: 0, notStarted: 0, inProgress: 0, onHold: 0, completed: 0, progressPercentage: 0 },
    openNCRs: { total: 0, major: 0, minor: 0, overdue: 0, items: [] },
    holdPointPipeline: { pending: 0, scheduled: 0, requested: 0, released: 0, thisWeek: 0, items: [] },
    claimStatus: { totalClaimed: 0, totalCertified: 0, totalPaid: 0, outstanding: 0, pendingClaims: 0, recentClaims: [] },
    costTracking: { budgetTotal: 0, actualSpend: 0, variance: 0, variancePercentage: 0, labourCost: 0, plantCost: 0, trend: 'on_track' },
    attentionItems: [],
    project: null
  })

  const fetchDashboardData = async () => {
    const token = getAuthToken()
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/dashboard/project-manager`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (err) {
      console.error('Error fetching PM dashboard:', err)
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Project Dashboard</h1>
          <p className="text-muted-foreground">
            Project overview and key metrics
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
          <strong>{data.project.name}</strong>
          {data.project.projectNumber && ` (${data.project.projectNumber})`}
          <span className={`ml-2 px-2 py-0.5 rounded text-xs ${data.project.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            {data.project.status}
          </span>
        </div>
      )}

      {/* Items Requiring Attention */}
      {data.attentionItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg">
          <div className="p-4 border-b border-red-200 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-red-700">Items Requiring Attention</h2>
            <span className="ml-auto bg-red-100 text-red-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {data.attentionItems.length}
            </span>
          </div>
          <div className="divide-y divide-red-100">
            {data.attentionItems.slice(0, 5).map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.link)}
                className="w-full flex items-center justify-between p-3 hover:bg-red-100/50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      item.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                      item.urgency === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {item.type.toUpperCase()}
                    </span>
                    <span className="font-medium text-sm">{item.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-1">{item.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top Metrics Row */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Lot Progress */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Layers className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lot Progress</p>
              <p className="text-2xl font-bold">{data.lotProgress.progressPercentage.toFixed(0)}%</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${data.lotProgress.progressPercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.lotProgress.completed} of {data.lotProgress.total} lots complete
            </p>
          </div>
        </div>

        {/* Open NCRs */}
        <button
          onClick={() => navigate('/ncr')}
          className="bg-card rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${data.openNCRs.total > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
              <AlertTriangle className={`h-5 w-5 ${data.openNCRs.total > 0 ? 'text-red-600' : 'text-green-600'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Open NCRs</p>
              <p className="text-2xl font-bold">{data.openNCRs.total}</p>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {data.openNCRs.major > 0 && <span className="text-red-600">{data.openNCRs.major} major • </span>}
            {data.openNCRs.overdue > 0 && <span className="text-orange-600">{data.openNCRs.overdue} overdue</span>}
            {data.openNCRs.total === 0 && <span className="text-green-600">All clear</span>}
          </div>
        </button>

        {/* Claim Status */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-bold">{formatCurrency(data.claimStatus.outstanding)}</p>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Certified: {formatCurrency(data.claimStatus.totalCertified)}
          </div>
        </div>

        {/* Cost Variance */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              data.costTracking.trend === 'under' ? 'bg-green-100' :
              data.costTracking.trend === 'over' ? 'bg-red-100' :
              'bg-blue-100'
            }`}>
              <TrendingUp className={`h-5 w-5 ${
                data.costTracking.trend === 'under' ? 'text-green-600' :
                data.costTracking.trend === 'over' ? 'text-red-600' :
                'text-blue-600'
              }`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cost Variance</p>
              <p className={`text-2xl font-bold ${
                data.costTracking.variance < 0 ? 'text-green-600' :
                data.costTracking.variance > 0 ? 'text-red-600' :
                ''
              }`}>
                {data.costTracking.variance >= 0 ? '+' : ''}{data.costTracking.variancePercentage.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {data.costTracking.trend === 'under' ? 'Under budget' :
             data.costTracking.trend === 'over' ? 'Over budget' :
             'On track'}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lot Progress Breakdown */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Lot Status Breakdown</h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <span className="text-sm">Not Started</span>
              </div>
              <span className="font-medium">{data.lotProgress.notStarted}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm">In Progress</span>
              </div>
              <span className="font-medium">{data.lotProgress.inProgress}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-sm">On Hold</span>
              </div>
              <span className="font-medium">{data.lotProgress.onHold}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm">Completed</span>
              </div>
              <span className="font-medium">{data.lotProgress.completed}</span>
            </div>
          </div>
        </div>

        {/* HP Pipeline */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold">Hold Point Pipeline</h2>
            </div>
            <span className="text-sm text-muted-foreground">
              {data.holdPointPipeline.thisWeek} this week
            </span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-4 gap-2 text-center mb-4">
              <div className="bg-gray-50 rounded p-2">
                <p className="text-lg font-bold">{data.holdPointPipeline.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="bg-blue-50 rounded p-2">
                <p className="text-lg font-bold">{data.holdPointPipeline.scheduled}</p>
                <p className="text-xs text-muted-foreground">Scheduled</p>
              </div>
              <div className="bg-yellow-50 rounded p-2">
                <p className="text-lg font-bold">{data.holdPointPipeline.requested}</p>
                <p className="text-xs text-muted-foreground">Requested</p>
              </div>
              <div className="bg-green-50 rounded p-2">
                <p className="text-lg font-bold">{data.holdPointPipeline.released}</p>
                <p className="text-xs text-muted-foreground">Released</p>
              </div>
            </div>
            {data.holdPointPipeline.items.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                {data.holdPointPipeline.items.slice(0, 3).map((hp) => (
                  <button
                    key={hp.id}
                    onClick={() => navigate(hp.link)}
                    className="w-full flex items-center justify-between p-2 bg-muted/30 rounded hover:bg-muted/50 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{hp.description}</p>
                      <p className="text-xs text-muted-foreground">Lot {hp.lotNumber}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      hp.status === 'pending' ? 'bg-gray-100' :
                      hp.status === 'scheduled' ? 'bg-blue-100' :
                      hp.status === 'requested' ? 'bg-yellow-100' :
                      'bg-green-100'
                    }`}>
                      {hp.status}
                    </span>
                  </button>
                ))}
                <Link to="/holdpoints" className="block text-sm text-primary hover:underline pt-1">
                  View all hold points →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Cost Tracking */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold">Cost Tracking</h2>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Budget</span>
                  <span className="font-medium">{formatCurrency(data.costTracking.budgetTotal)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-gray-400 h-2 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Actual Spend</span>
                  <span className="font-medium">{formatCurrency(data.costTracking.actualSpend)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${data.costTracking.trend === 'over' ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, data.costTracking.budgetTotal > 0 ? (data.costTracking.actualSpend / data.costTracking.budgetTotal) * 100 : 0)}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="text-center">
                  <p className="text-lg font-bold">{formatCurrency(data.costTracking.labourCost)}</p>
                  <p className="text-xs text-muted-foreground">Labour</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{formatCurrency(data.costTracking.plantCost)}</p>
                  <p className="text-xs text-muted-foreground">Plant</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Claims */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-500" />
              <h2 className="text-lg font-semibold">Claims Status</h2>
            </div>
            {data.claimStatus.pendingClaims > 0 && (
              <span className="bg-purple-100 text-purple-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                {data.claimStatus.pendingClaims} pending
              </span>
            )}
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              <div>
                <p className="text-lg font-bold">{formatCurrency(data.claimStatus.totalClaimed)}</p>
                <p className="text-xs text-muted-foreground">Claimed</p>
              </div>
              <div>
                <p className="text-lg font-bold">{formatCurrency(data.claimStatus.totalCertified)}</p>
                <p className="text-xs text-muted-foreground">Certified</p>
              </div>
              <div>
                <p className="text-lg font-bold">{formatCurrency(data.claimStatus.totalPaid)}</p>
                <p className="text-xs text-muted-foreground">Paid</p>
              </div>
            </div>
            {data.claimStatus.recentClaims.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                {data.claimStatus.recentClaims.slice(0, 3).map((claim) => (
                  <button
                    key={claim.id}
                    onClick={() => navigate(claim.link)}
                    className="w-full flex items-center justify-between p-2 bg-muted/30 rounded hover:bg-muted/50 text-left"
                  >
                    <span className="text-sm font-medium">{claim.claimNumber}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{formatCurrency(claim.amount)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        claim.status === 'paid' ? 'bg-green-100 text-green-700' :
                        claim.status === 'certified' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {claim.status}
                      </span>
                    </div>
                  </button>
                ))}
                <Link to="/claims" className="block text-sm text-primary hover:underline pt-1">
                  View all claims →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
        </div>
        <div className="p-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <Link
            to="/lots"
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
          >
            <Layers className="h-5 w-5 text-blue-600" />
            <span className="font-medium">Manage Lots</span>
          </Link>
          <Link
            to="/claims"
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
          >
            <DollarSign className="h-5 w-5 text-green-600" />
            <span className="font-medium">Progress Claims</span>
          </Link>
          <Link
            to="/reports"
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
          >
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <span className="font-medium">Reports</span>
          </Link>
          <Link
            to="/dockets"
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
          >
            <ClipboardCheck className="h-5 w-5 text-amber-600" />
            <span className="font-medium">Docket Approvals</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
