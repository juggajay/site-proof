// ProjectDashboard - Landing page when entering a project
// Shows project health at a glance: attention items, progress, stats ribbon, activity
import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiFetch, ApiError } from '@/lib/api'
import {
  MapPin,
  Calendar,
  AlertTriangle,
  ClipboardCheck,
  FileCheck,
  Clock,
  FlaskConical,
  FileText,
  Settings,
  RefreshCw,
  Activity,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AttentionItem {
  id: string
  type: 'ncr' | 'holdpoint'
  title: string
  description: string
  urgency: 'critical' | 'warning'
  daysOverdue: number
  link: string
}

interface ProjectDashboardData {
  project: {
    id: string
    name: string
    projectNumber: string
    status: string
    client?: string
    state?: string
  }
  stats: {
    lots: {
      total: number
      completed: number
      inProgress: number
      notStarted: number
      onHold: number
      progressPct: number
    }
    ncrs: {
      open: number
      total: number
      overdue: number
      major: number
      minor: number
      observation: number
    }
    holdPoints: { pending: number; released: number }
    itps: { pending: number; completed: number }
    dockets: { pendingApproval: number }
    tests: { total: number }
    documents: { total: number }
    diary: { todayStatus: 'not_started' | 'draft' | 'submitted' | null }
  }
  attentionItems: AttentionItem[]
  recentActivity: Array<{
    id: string
    type: 'lot' | 'ncr' | 'holdpoint' | 'diary' | 'docket'
    description: string
    timestamp: string
    link?: string
  }>
}

export function ProjectDashboard() {
  const { projectId } = useParams()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ProjectDashboardData | null>(null)

  const fetchDashboardData = async () => {
    if (!projectId) {
      setLoading(false)
      return
    }

    try {
      const result = await apiFetch<ProjectDashboardData>(`/api/projects/${projectId}/dashboard`)
      setData(result)
      setError(null)
    } catch (err) {
      console.error('Error fetching project dashboard:', err)
      if (err instanceof ApiError && err.status === 404) {
        setError('Project not found')
      } else {
        setError('Failed to load project dashboard')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [projectId])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchDashboardData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          {error || 'Failed to load project dashboard'}
        </div>
      </div>
    )
  }

  const { project, stats, attentionItems, recentActivity } = data

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    on_hold: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    pending: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  }

  const getDiaryLabel = () => {
    switch (stats.diary.todayStatus) {
      case 'submitted': return 'Submitted'
      case 'draft': return 'Draft'
      default: return 'Not started'
    }
  }

  const getDiaryColor = () => {
    switch (stats.diary.todayStatus) {
      case 'submitted': return 'text-green-600 dark:text-green-400'
      case 'draft': return 'text-amber-600 dark:text-amber-400'
      default: return 'text-muted-foreground'
    }
  }

  const hasAttentionItems = attentionItems.length > 0
  const criticalCount = attentionItems.filter(i => i.urgency === 'critical').length

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <span className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-medium',
              statusColors[project.status?.toLowerCase()] || statusColors.draft
            )}>
              {project.status || 'Draft'}
            </span>
          </div>
          <p className="text-muted-foreground mt-1">
            {project.projectNumber}
            {project.client && ` \u2022 ${project.client}`}
            {project.state && ` \u2022 ${project.state}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
          <Link
            to={`/projects/${projectId}/settings`}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-muted"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>

      {/* Attention Banner */}
      {hasAttentionItems && (
        <div className={cn(
          'rounded-lg border p-4',
          criticalCount > 0
            ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900'
            : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'
        )}>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className={cn(
              'h-5 w-5',
              criticalCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
            )} />
            <h2 className={cn(
              'text-sm font-semibold',
              criticalCount > 0 ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
            )}>
              {attentionItems.length} item{attentionItems.length !== 1 ? 's' : ''} need{attentionItems.length === 1 ? 's' : ''} attention
            </h2>
          </div>
          <div className="space-y-2">
            {attentionItems.slice(0, 4).map((item) => (
              <Link
                key={item.id}
                to={item.link}
                className={cn(
                  'flex items-center justify-between p-2.5 rounded-md transition-colors text-sm',
                  item.urgency === 'critical'
                    ? 'bg-red-100/60 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40'
                    : 'bg-amber-100/60 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {item.urgency === 'critical' ? (
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  )}
                  <span className={cn(
                    'font-medium truncate',
                    item.urgency === 'critical' ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
                  )}>
                    {item.title}
                  </span>
                </div>
                <span className={cn(
                  'text-xs flex-shrink-0 ml-3',
                  item.urgency === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                )}>
                  {item.daysOverdue}d overdue
                </span>
              </Link>
            ))}
            {attentionItems.length > 4 && (
              <p className={cn(
                'text-xs pl-2',
                criticalCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
              )}>
                + {attentionItems.length - 4} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Compact Stat Ribbon */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-px bg-border rounded-lg overflow-hidden border">
        <StatPill
          label="Lots"
          value={stats.lots.total}
          sub={`${stats.lots.progressPct}%`}
          icon={<MapPin className="h-3.5 w-3.5" />}
          color="text-blue-600 dark:text-blue-400"
        />
        <StatPill
          label="NCRs"
          value={stats.ncrs.open}
          sub={stats.ncrs.overdue > 0 ? `${stats.ncrs.overdue} late` : 'open'}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          color="text-red-600 dark:text-red-400"
          alert={stats.ncrs.overdue > 0}
        />
        <StatPill
          label="Hold Pts"
          value={stats.holdPoints.pending}
          sub="pending"
          icon={<Clock className="h-3.5 w-3.5" />}
          color="text-orange-600 dark:text-orange-400"
        />
        <StatPill
          label="ITPs"
          value={stats.itps.pending}
          sub={`${stats.itps.completed} done`}
          icon={<ClipboardCheck className="h-3.5 w-3.5" />}
          color="text-green-600 dark:text-green-400"
        />
        <StatPill
          label="Dockets"
          value={stats.dockets.pendingApproval}
          sub="pending"
          icon={<FileCheck className="h-3.5 w-3.5" />}
          color="text-amber-600 dark:text-amber-400"
        />
        <StatPill
          label="Tests"
          value={stats.tests.total}
          sub="results"
          icon={<FlaskConical className="h-3.5 w-3.5" />}
          color="text-teal-600 dark:text-teal-400"
        />
        <StatPill
          label="Docs"
          value={stats.documents.total}
          sub="files"
          icon={<FileText className="h-3.5 w-3.5" />}
          color="text-gray-600 dark:text-gray-400"
        />
        <StatPill
          label="Diary"
          value={getDiaryLabel()}
          sub="today"
          icon={<Calendar className="h-3.5 w-3.5" />}
          color={getDiaryColor()}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Left Column - Project Progress */}
        <div className="space-y-5">
          {/* Lot Progress */}
          <div className="bg-card rounded-lg border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Lot Progress
              </h2>
              <Link
                to={`/projects/${projectId}/lots`}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {stats.lots.total === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No lots created yet.{' '}
                <Link to={`/projects/${projectId}/lots`} className="text-primary hover:underline">
                  Create your first lot
                </Link>
              </div>
            ) : (
              <>
                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-2xl font-bold">{stats.lots.progressPct}%</span>
                    <span className="text-xs text-muted-foreground">
                      {stats.lots.completed} of {stats.lots.total} lots completed
                    </span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden flex">
                    {stats.lots.completed > 0 && (
                      <div
                        className="bg-green-500 dark:bg-green-400 transition-all"
                        style={{ width: `${(stats.lots.completed / stats.lots.total) * 100}%` }}
                      />
                    )}
                    {stats.lots.inProgress > 0 && (
                      <div
                        className="bg-blue-500 dark:bg-blue-400 transition-all"
                        style={{ width: `${(stats.lots.inProgress / stats.lots.total) * 100}%` }}
                      />
                    )}
                    {stats.lots.onHold > 0 && (
                      <div
                        className="bg-amber-500 dark:bg-amber-400 transition-all"
                        style={{ width: `${(stats.lots.onHold / stats.lots.total) * 100}%` }}
                      />
                    )}
                  </div>
                </div>

                {/* Status breakdown */}
                <div className="grid grid-cols-4 gap-3 text-center">
                  <StatusCount label="Not Started" count={stats.lots.notStarted} color="bg-gray-400" />
                  <StatusCount label="In Progress" count={stats.lots.inProgress} color="bg-blue-500" />
                  <StatusCount label="On Hold" count={stats.lots.onHold} color="bg-amber-500" />
                  <StatusCount label="Complete" count={stats.lots.completed} color="bg-green-500" />
                </div>
              </>
            )}
          </div>

          {/* Quality Overview */}
          <div className="bg-card rounded-lg border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                Quality Overview
              </h2>
              <Link
                to={`/projects/${projectId}/ncr`}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View NCRs <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {stats.ncrs.total === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                No non-conformances recorded
              </div>
            ) : (
              <div className="space-y-3">
                {/* Open NCR summary */}
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">{stats.ncrs.open}</span>
                  <span className="text-xs text-muted-foreground">
                    open of {stats.ncrs.total} total
                  </span>
                </div>

                {/* Category breakdown */}
                {stats.ncrs.open > 0 && (
                  <div className="space-y-2">
                    {stats.ncrs.major > 0 && (
                      <NCRCategoryBar
                        label="Major"
                        count={stats.ncrs.major}
                        total={stats.ncrs.open}
                        color="bg-red-500"
                      />
                    )}
                    {stats.ncrs.minor > 0 && (
                      <NCRCategoryBar
                        label="Minor"
                        count={stats.ncrs.minor}
                        total={stats.ncrs.open}
                        color="bg-amber-500"
                      />
                    )}
                    {stats.ncrs.observation > 0 && (
                      <NCRCategoryBar
                        label="Observation"
                        count={stats.ncrs.observation}
                        total={stats.ncrs.open}
                        color="bg-blue-400"
                      />
                    )}
                  </div>
                )}

                {/* Overdue warning */}
                {stats.ncrs.overdue > 0 && (
                  <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 pt-1">
                    <XCircle className="h-3.5 w-3.5" />
                    {stats.ncrs.overdue} overdue NCR{stats.ncrs.overdue !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Activity */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </h2>
          </div>
          <div className="divide-y">
            {recentActivity.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No recent activity
              </div>
            ) : (
              recentActivity.slice(0, 10).map((activity) => (
                <div key={activity.id} className="hover:bg-muted/50 transition-colors">
                  {activity.link ? (
                    <Link to={activity.link} className="flex items-start gap-3 p-3">
                      <ActivityIcon type={activity.type} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatRelativeTime(activity.timestamp)}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 p-3">
                      <ActivityIcon type={activity.type} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatRelativeTime(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Sub-components ---

function StatPill({
  label,
  value,
  sub,
  icon,
  color,
  alert,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ReactNode
  color: string
  alert?: boolean
}) {
  return (
    <div className={cn(
      'bg-card px-3 py-2.5 text-center',
      alert && 'ring-1 ring-inset ring-red-200 dark:ring-red-800'
    )}>
      <div className={cn('flex items-center justify-center mb-1', color)}>
        {icon}
      </div>
      <p className={cn(
        'text-lg font-bold leading-tight',
        alert && 'text-red-600 dark:text-red-400'
      )}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{sub}</p>
      <p className="text-[10px] text-muted-foreground font-medium leading-tight">{label}</p>
    </div>
  )
}

function StatusCount({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5 mb-0.5">
        <div className={cn('w-2 h-2 rounded-full', color)} />
        <span className="text-lg font-semibold">{count}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

function NCRCategoryBar({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-20 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-6 text-right">{count}</span>
    </div>
  )
}

function ActivityIcon({ type }: { type: string }) {
  const base = 'h-4 w-4 mt-0.5 flex-shrink-0'
  switch (type) {
    case 'ncr':
      return <AlertTriangle className={cn(base, 'text-red-500')} />
    case 'lot':
      return <MapPin className={cn(base, 'text-blue-500')} />
    case 'holdpoint':
      return <Clock className={cn(base, 'text-orange-500')} />
    case 'docket':
      return <FileCheck className={cn(base, 'text-amber-500')} />
    case 'diary':
      return <Calendar className={cn(base, 'text-purple-500')} />
    default:
      return <Activity className={cn(base, 'text-muted-foreground')} />
  }
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
