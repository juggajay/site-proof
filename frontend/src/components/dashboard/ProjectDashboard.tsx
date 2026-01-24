// ProjectDashboard - Landing page when entering a project
import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAuthToken } from '@/lib/auth'
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
  ChevronRight,
  RefreshCw,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3031'

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
    lots: { total: number; completed: number; inProgress: number }
    ncrs: { open: number; total: number }
    holdPoints: { pending: number; released: number }
    itps: { pending: number; completed: number }
    dockets: { pendingApproval: number }
    tests: { total: number }
    documents: { total: number }
    diary: { todayStatus: 'not_started' | 'draft' | 'submitted' | null }
  }
  recentActivity: Array<{
    id: string
    type: 'lot' | 'ncr' | 'holdpoint' | 'diary' | 'docket'
    description: string
    timestamp: string
    link?: string
  }>
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  href: string
  color: string
}

function StatCard({ title, value, subtitle, icon, href, color }: StatCardProps) {
  return (
    <Link
      to={href}
      className={cn(
        'bg-card rounded-lg border p-4 hover:border-primary hover:shadow-md transition-all',
        'flex flex-col gap-2'
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn('p-2 rounded-lg', color)}>
          {icon}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm font-medium">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </Link>
  )
}

export function ProjectDashboard() {
  const { projectId } = useParams()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ProjectDashboardData | null>(null)

  const fetchDashboardData = async () => {
    const token = getAuthToken()
    if (!token || !projectId) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const result = await response.json()
        setData(result)
        setError(null)
      } else if (response.status === 404) {
        setError('Project not found')
      } else {
        setError('Failed to load project dashboard')
      }
    } catch (err) {
      console.error('Error fetching project dashboard:', err)
      setError('Failed to load project dashboard')
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
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || 'Failed to load project dashboard'}
        </div>
      </div>
    )
  }

  const { project, stats, recentActivity } = data

  // Status badge colors
  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    on_hold: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    pending: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  }

  const getDiarySubtitle = () => {
    switch (stats.diary.todayStatus) {
      case 'submitted': return 'Submitted today'
      case 'draft': return 'Draft in progress'
      default: return 'Not started today'
    }
  }

  return (
    <div className="space-y-6 p-6">
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
            {project.client && ` • ${project.client}`}
            {project.state && ` • ${project.state}`}
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

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard
          title="Lots"
          value={stats.lots.total}
          subtitle={`${stats.lots.completed} completed, ${stats.lots.inProgress} in progress`}
          icon={<MapPin className="h-5 w-5 text-blue-600" />}
          href={`/projects/${projectId}/lots`}
          color="bg-blue-100 dark:bg-blue-900/30"
        />
        <StatCard
          title="Daily Diary"
          value={stats.diary.todayStatus === 'submitted' ? '✓' : stats.diary.todayStatus === 'draft' ? '◐' : '○'}
          subtitle={getDiarySubtitle()}
          icon={<Calendar className="h-5 w-5 text-purple-600" />}
          href={`/projects/${projectId}/diary`}
          color="bg-purple-100 dark:bg-purple-900/30"
        />
        <StatCard
          title="Open NCRs"
          value={stats.ncrs.open}
          subtitle={`${stats.ncrs.total} total`}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          href={`/projects/${projectId}/ncr`}
          color="bg-red-100 dark:bg-red-900/30"
        />
        <StatCard
          title="ITPs"
          value={stats.itps.pending}
          subtitle={`${stats.itps.completed} completed`}
          icon={<ClipboardCheck className="h-5 w-5 text-green-600" />}
          href={`/projects/${projectId}/itp`}
          color="bg-green-100 dark:bg-green-900/30"
        />
        <StatCard
          title="Dockets"
          value={stats.dockets.pendingApproval}
          subtitle="Pending approval"
          icon={<FileCheck className="h-5 w-5 text-amber-600" />}
          href={`/projects/${projectId}/dockets`}
          color="bg-amber-100 dark:bg-amber-900/30"
        />
        <StatCard
          title="Hold Points"
          value={stats.holdPoints.pending}
          subtitle={`${stats.holdPoints.released} released`}
          icon={<Clock className="h-5 w-5 text-orange-600" />}
          href={`/projects/${projectId}/hold-points`}
          color="bg-orange-100 dark:bg-orange-900/30"
        />
        <StatCard
          title="Test Results"
          value={stats.tests.total}
          subtitle="Total results"
          icon={<FlaskConical className="h-5 w-5 text-teal-600" />}
          href={`/projects/${projectId}/tests`}
          color="bg-teal-100 dark:bg-teal-900/30"
        />
        <StatCard
          title="Documents"
          value={stats.documents.total}
          subtitle="Files uploaded"
          icon={<FileText className="h-5 w-5 text-gray-600" />}
          href={`/projects/${projectId}/documents`}
          color="bg-gray-100 dark:bg-gray-700"
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Recent Activity</h2>
        </div>
        <div className="divide-y">
          {recentActivity.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No recent activity
            </div>
          ) : (
            recentActivity.slice(0, 8).map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-muted/50 transition-colors">
                {activity.link ? (
                  <Link to={activity.link} className="block">
                    <p className="text-sm">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelativeTime(activity.timestamp)}
                    </p>
                  </Link>
                ) : (
                  <>
                    <p className="text-sm">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelativeTime(activity.timestamp)}
                    </p>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// Helper to format relative time
function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}
