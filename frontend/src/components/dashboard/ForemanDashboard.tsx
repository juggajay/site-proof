// Feature #292: Foreman Dashboard - Simplified view for foreman role
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import {
  Sun,
  Cloud,
  CloudRain,
  Thermometer,
  FileText,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Users,
  RefreshCw,
  ChevronRight,
  Plus
} from 'lucide-react'

interface ForemanDashboardData {
  // Today's diary
  todayDiary: {
    exists: boolean
    status: 'draft' | 'submitted' | null
    id: string | null
  }
  // Pending dockets
  pendingDockets: {
    count: number
    totalLabourHours: number
    totalPlantHours: number
  }
  // Inspections due today
  inspectionsDueToday: {
    count: number
    items: Array<{
      id: string
      type: string
      description: string
      lotNumber: string
      link: string
    }>
  }
  // Weather
  weather: {
    conditions: string | null
    temperatureMin: number | null
    temperatureMax: number | null
    rainfallMm: number | null
  }
  // Active project info
  project: {
    id: string
    name: string
    projectNumber: string
  } | null
}

const getWeatherIcon = (conditions: string | null) => {
  if (!conditions) return <Sun className="h-8 w-8 text-yellow-500" />
  const lower = conditions.toLowerCase()
  if (lower.includes('rain') || lower.includes('shower')) {
    return <CloudRain className="h-8 w-8 text-blue-500" />
  }
  if (lower.includes('cloud') || lower.includes('overcast')) {
    return <Cloud className="h-8 w-8 text-gray-500" />
  }
  return <Sun className="h-8 w-8 text-yellow-500" />
}

export function ForemanDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<ForemanDashboardData>({
    todayDiary: { exists: false, status: null, id: null },
    pendingDockets: { count: 0, totalLabourHours: 0, totalPlantHours: 0 },
    inspectionsDueToday: { count: 0, items: [] },
    weather: { conditions: null, temperatureMin: null, temperatureMax: null, rainfallMm: null },
    project: null
  })

  const fetchDashboardData = async () => {
    try {
      const result = await apiFetch<ForemanDashboardData>('/api/dashboard/foreman')
      setData(result)
    } catch (err) {
      console.error('Error fetching foreman dashboard:', err)
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

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const projectId = data.project?.id

  // Helper to build project-scoped paths
  const getProjectPath = (path: string) => {
    return projectId ? `/projects/${projectId}/${path}` : '/projects'
  }

  // If no project is assigned, show a message
  if (!projectId) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Good {getTimeOfDay()}, {user?.fullName?.split(' ')[0] || user?.name?.split(' ')[0] || 'Foreman'}!</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {today}
          </p>
        </div>

        <div className="bg-card rounded-lg border p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">No Project Assigned</h2>
          <p className="text-muted-foreground mb-4">
            You need to be assigned to a project before you can access the foreman dashboard features.
          </p>
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            View Projects
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Good {getTimeOfDay()}, {user?.fullName?.split(' ')[0] || user?.name?.split(' ')[0] || 'Foreman'}!</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {today}
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
          Active Project: <strong>{data.project.name}</strong>
          {data.project.projectNumber && ` (${data.project.projectNumber})`}
        </div>
      )}

      {/* Weather Card */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {getWeatherIcon(data.weather.conditions)}
            <div>
              <h2 className="text-lg font-semibold">Today's Weather</h2>
              <p className="text-muted-foreground">
                {data.weather.conditions || 'Weather data not available'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {data.weather.temperatureMin !== null && data.weather.temperatureMax !== null && (
              <div className="flex items-center gap-2">
                <Thermometer className="h-5 w-5 text-red-500" />
                <span className="text-lg font-medium">
                  {data.weather.temperatureMin}° - {data.weather.temperatureMax}°C
                </span>
              </div>
            )}
            {data.weather.rainfallMm !== null && data.weather.rainfallMm > 0 && (
              <div className="flex items-center gap-2">
                <CloudRain className="h-5 w-5 text-blue-500" />
                <span className="text-lg font-medium">{data.weather.rainfallMm}mm</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's Diary Status */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Today's Diary</h2>
            </div>
            <DiaryStatusBadge status={data.todayDiary.status} exists={data.todayDiary.exists} />
          </div>
          <div className="p-4">
            {data.todayDiary.exists ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {data.todayDiary.status === 'submitted'
                    ? 'Diary submitted for today'
                    : 'Diary started but not yet submitted'}
                </p>
                <Link
                  to={getProjectPath(`diary?date=${formatDateForUrl(new Date())}`)}
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  View/Edit Diary <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No diary entry started for today
                </p>
                <Link
                  to={getProjectPath(`diary?date=${formatDateForUrl(new Date())}`)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  Start Today's Diary
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Pending Dockets */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold">Pending Dockets</h2>
            </div>
            {data.pendingDockets.count > 0 && (
              <span className="bg-amber-100 text-amber-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                {data.pendingDockets.count} pending
              </span>
            )}
          </div>
          <div className="p-4">
            {data.pendingDockets.count > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm text-muted-foreground">Labour Hours</p>
                    <p className="text-xl font-bold">{data.pendingDockets.totalLabourHours}h</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm text-muted-foreground">Plant Hours</p>
                    <p className="text-xl font-bold">{data.pendingDockets.totalPlantHours}h</p>
                  </div>
                </div>
                <Link
                  to={getProjectPath('dockets?status=pending_approval')}
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  Review Dockets <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span>All dockets reviewed</span>
              </div>
            )}
          </div>
        </div>

        {/* Inspections Due Today */}
        <div className="bg-card rounded-lg border md:col-span-2">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold">Inspections Due Today</h2>
            </div>
            {data.inspectionsDueToday.count > 0 && (
              <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                {data.inspectionsDueToday.count} due
              </span>
            )}
          </div>
          <div className="p-4">
            {data.inspectionsDueToday.count > 0 ? (
              <div className="space-y-2">
                {data.inspectionsDueToday.items.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.link)}
                    className="w-full flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.type} • Lot {item.lotNumber}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
                {data.inspectionsDueToday.count > 5 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    +{data.inspectionsDueToday.count - 5} more inspections
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span>No inspections scheduled for today</span>
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
            to={getProjectPath(`diary?date=${formatDateForUrl(new Date())}`)}
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
          >
            <FileText className="h-5 w-5 text-blue-600" />
            <span className="font-medium">Daily Diary</span>
          </Link>
          <Link
            to={getProjectPath('dockets')}
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
          >
            <ClipboardCheck className="h-5 w-5 text-amber-600" />
            <span className="font-medium">Docket Approvals</span>
          </Link>
          <Link
            to={getProjectPath('lots')}
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
          >
            <Users className="h-5 w-5 text-green-600" />
            <span className="font-medium">View Lots</span>
          </Link>
          <Link
            to={getProjectPath('itp')}
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
          >
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="font-medium">ITPs</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

// Helper components and functions

function DiaryStatusBadge({ status, exists }: { status: string | null; exists: boolean }) {
  if (!exists) {
    return (
      <span className="bg-gray-100 text-gray-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
        Not Started
      </span>
    )
  }
  if (status === 'submitted') {
    return (
      <span className="bg-green-100 text-green-800 text-sm font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Submitted
      </span>
    )
  }
  return (
    <span className="bg-yellow-100 text-yellow-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
      Draft
    </span>
  )
}

function getTimeOfDay(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function formatDateForUrl(date: Date): string {
  return date.toISOString().split('T')[0]
}
