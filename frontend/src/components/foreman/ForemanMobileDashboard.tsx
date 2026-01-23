// ForemanMobileDashboard - Mobile-optimized dashboard for foreman role
import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth, getAuthToken } from '@/lib/auth'
import {
  RefreshCw,
  Calendar,
  FileText,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  Plus,
  ChevronRight,
  Users,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DashboardCard, DashboardStat } from './DashboardCard'
import { WeatherWidget } from './WeatherWidget'
import { ForemanBottomNav } from './ForemanBottomNav'
import { QuickCaptureButton } from './QuickCaptureButton'
import { PhotoCaptureModal } from './PhotoCaptureModal'
import { useForemanMobileStore } from '@/stores/foremanMobileStore'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3031'

interface DashboardData {
  todayDiary: {
    exists: boolean
    status: 'draft' | 'submitted' | null
    id: string | null
  }
  pendingDockets: {
    count: number
    totalLabourHours: number
    totalPlantHours: number
  }
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
  weather: {
    conditions: string | null
    temperatureMin: number | null
    temperatureMax: number | null
    rainfallMm: number | null
  }
  project: {
    id: string
    name: string
    projectNumber: string
  } | null
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

export function ForemanMobileDashboard() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isCameraOpen, setIsCameraOpen } = useForemanMobileStore()
  useOnlineStatus() // Initialize online status tracking

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<DashboardData>({
    todayDiary: { exists: false, status: null, id: null },
    pendingDockets: { count: 0, totalLabourHours: 0, totalPlantHours: 0 },
    inspectionsDueToday: { count: 0, items: [] },
    weather: { conditions: null, temperatureMin: null, temperatureMax: null, rainfallMm: null },
    project: null,
  })

  const fetchDashboardData = useCallback(async () => {
    const token = getAuthToken()
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/dashboard/foreman`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (err) {
      console.error('Error fetching foreman dashboard:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchDashboardData()
  }

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })

  // Quick action handlers
  const handleCapturePhoto = () => setIsCameraOpen(true)
  const handleAddDelay = () => navigate(projectId ? `/projects/${projectId}/diary?tab=delays` : '/diary')
  const handleRaiseNCR = () => navigate(projectId ? `/projects/${projectId}/ncr/new` : '/ncr/new')
  const handleAddNote = () => navigate(projectId ? `/projects/${projectId}/diary` : '/diary')
  const handleRequestHoldPoint = () => navigate(projectId ? `/projects/${projectId}/hold-points` : '/hold-points')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const effectiveProjectId = projectId || data.project?.id

  return (
    <div className="pb-24 md:pb-6">
      {/* Header - optimized for mobile */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">
              Good {getTimeOfDay()}, {user?.fullName?.split(' ')[0] || 'Foreman'}!
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {today}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn(
              'p-2 rounded-lg border touch-manipulation min-h-[44px] min-w-[44px]',
              'flex items-center justify-center',
              'active:bg-muted'
            )}
          >
            <RefreshCw className={cn('h-5 w-5', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Project context */}
        {data.project && (
          <div className="mt-2 text-sm text-muted-foreground border-l-4 border-primary pl-2">
            {data.project.name}
            {data.project.projectNumber && ` (${data.project.projectNumber})`}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="p-4 space-y-4 md:p-6 md:space-y-6">
        {/* Weather Widget */}
        <WeatherWidget weather={data.weather} />

        {/* Diary & Dockets Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Today's Diary */}
          <DashboardCard
            title="Today's Diary"
            icon={<FileText className="h-5 w-5" />}
            badge={
              data.todayDiary.status === 'submitted'
                ? 'Submitted'
                : data.todayDiary.exists
                ? 'Draft'
                : 'Not Started'
            }
            badgeVariant={
              data.todayDiary.status === 'submitted'
                ? 'success'
                : data.todayDiary.exists
                ? 'warning'
                : 'default'
            }
            onClick={() => navigate(effectiveProjectId ? `/projects/${effectiveProjectId}/diary?date=${formatDateForUrl(new Date())}` : `/diary?date=${formatDateForUrl(new Date())}`)}
          >
            {data.todayDiary.exists ? (
              <p className="text-sm text-muted-foreground">
                {data.todayDiary.status === 'submitted'
                  ? 'Diary submitted for today'
                  : 'Diary started but not submitted'}
              </p>
            ) : (
              <div className="flex items-center gap-2 text-primary">
                <Plus className="h-4 w-4" />
                <span className="text-sm font-medium">Start Today's Diary</span>
              </div>
            )}
          </DashboardCard>

          {/* Pending Dockets */}
          <DashboardCard
            title="Pending Dockets"
            icon={<ClipboardCheck className="h-5 w-5" />}
            badge={data.pendingDockets.count > 0 ? `${data.pendingDockets.count} pending` : undefined}
            badgeVariant="warning"
            onClick={() => navigate(effectiveProjectId ? `/projects/${effectiveProjectId}/dockets?status=pending_approval` : '/dockets?status=pending_approval')}
          >
            {data.pendingDockets.count > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                <DashboardStat
                  label="Labour"
                  value={`${data.pendingDockets.totalLabourHours}h`}
                  icon={<Users className="h-4 w-4" />}
                />
                <DashboardStat
                  label="Plant"
                  value={`${data.pendingDockets.totalPlantHours}h`}
                  icon={<Truck className="h-4 w-4" />}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm">All dockets reviewed</span>
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Inspections Due */}
        <DashboardCard
          title="Inspections Due Today"
          icon={<Clock className="h-5 w-5" />}
          badge={data.inspectionsDueToday.count > 0 ? `${data.inspectionsDueToday.count} due` : undefined}
          badgeVariant="warning"
        >
          {data.inspectionsDueToday.count > 0 ? (
            <div className="space-y-2">
              {data.inspectionsDueToday.items.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.link)}
                  className={cn(
                    'w-full flex items-center justify-between p-3',
                    'bg-muted/30 rounded-lg',
                    'active:bg-muted/50 transition-colors',
                    'touch-manipulation min-h-[48px]'
                  )}
                >
                  <div className="text-left">
                    <p className="font-medium text-sm">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.type} • Lot {item.lotNumber}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
              {data.inspectionsDueToday.count > 3 && (
                <Link
                  to={effectiveProjectId ? `/projects/${effectiveProjectId}/hold-points` : '/hold-points'}
                  className="block text-center text-sm text-primary py-2"
                >
                  View all {data.inspectionsDueToday.count} inspections
                </Link>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm">No inspections scheduled for today</span>
            </div>
          )}
        </DashboardCard>
      </div>

      {/* Quick Capture FAB */}
      <QuickCaptureButton
        onCapturePhoto={handleCapturePhoto}
        onAddDelay={handleAddDelay}
        onRaiseNCR={handleRaiseNCR}
        onAddNote={handleAddNote}
        onRequestHoldPointRelease={handleRequestHoldPoint}
      />

      {/* Photo Capture Modal */}
      {isCameraOpen && effectiveProjectId && (
        <PhotoCaptureModal
          projectId={effectiveProjectId}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {/* Bottom Navigation */}
      <ForemanBottomNav />
    </div>
  )
}
