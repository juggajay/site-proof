// TodayWorklist - Unified "Today" view showing everything foreman needs to action
// Research-backed: Foremen need to see "what needs attention NOW" in one place
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  CheckSquare,
  Clock,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Shield,
  ClipboardList,
  Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

type WorklistItemType = 'hold_point' | 'itp_item' | 'inspection' | 'task'
type UrgencyLevel = 'blocking' | 'due_today' | 'upcoming'

interface WorklistItem {
  id: string
  type: WorklistItemType
  title: string
  subtitle: string
  urgency: UrgencyLevel
  link: string
  metadata?: {
    lotNumber?: string
    lotId?: string
    itpName?: string
    dueTime?: string
    status?: string
  }
}

interface TodayWorklistData {
  blocking: WorklistItem[]
  dueToday: WorklistItem[]
  upcoming: WorklistItem[]
  summary: {
    totalBlocking: number
    totalDueToday: number
    totalUpcoming: number
  }
}

const urgencyConfig = {
  blocking: {
    label: 'Blocking Work',
    description: 'Cannot proceed until resolved',
    color: 'bg-red-500',
    textColor: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: AlertCircle,
  },
  due_today: {
    label: 'Due Today',
    description: 'Must complete today',
    color: 'bg-amber-500',
    textColor: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    icon: Clock,
  },
  upcoming: {
    label: 'Coming Up',
    description: 'Next 24-48 hours',
    color: 'bg-blue-500',
    textColor: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    icon: Calendar,
  },
}

const typeIcons: Record<WorklistItemType, typeof Shield> = {
  hold_point: Shield,
  itp_item: ClipboardList,
  inspection: CheckSquare,
  task: CheckSquare,
}

export function TodayWorklist() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { isOnline } = useOnlineStatus()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TodayWorklistData>({
    blocking: [],
    dueToday: [],
    upcoming: [],
    summary: { totalBlocking: 0, totalDueToday: 0, totalUpcoming: 0 }
  })

  const fetchWorklist = useCallback(async () => {
    if (!projectId) {
      setLoading(false)
      return
    }

    setError(null)

    try {
      const result = await apiFetch<TodayWorklistData>(
        `/api/dashboard/projects/${projectId}/foreman/today`
      )
      setData(result)
    } catch (err) {
      console.error('Error fetching today worklist:', err)
      setError('Unable to connect. Check your connection.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchWorklist()
  }, [fetchWorklist])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchWorklist()
  }

  const handleItemClick = (item: WorklistItem) => {
    navigate(item.link)
  }

  const totalItems = data.blocking.length + data.dueToday.length + data.upcoming.length
  const allClear = totalItems === 0 && !loading && !error

  // Get today's date for header
  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Loading your worklist...</p>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Today</h1>
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
              'flex items-center justify-center active:bg-muted'
            )}
          >
            <RefreshCw className={cn('h-5 w-5', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Summary badges */}
        {!allClear && !error && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {data.blocking.length > 0 && (
              <span className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              )}>
                <AlertCircle className="h-3 w-3" />
                {data.blocking.length} blocking
              </span>
            )}
            {data.dueToday.length > 0 && (
              <span className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              )}>
                <Clock className="h-3 w-3" />
                {data.dueToday.length} due today
              </span>
            )}
            {data.upcoming.length > 0 && (
              <span className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              )}>
                <Calendar className="h-3 w-3" />
                {data.upcoming.length} upcoming
              </span>
            )}
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-300">{error}</p>
                {!isOnline && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    You appear to be offline
                  </p>
                )}
                <button
                  onClick={handleRefresh}
                  className="mt-2 text-sm text-red-700 dark:text-red-400 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Clear State */}
      {allClear && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">You're all caught up</h2>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            No hold points, inspections, or ITP items need your attention right now.
          </p>
          <button
            onClick={handleRefresh}
            className={cn(
              'mt-6 px-4 py-2 rounded-lg border',
              'text-sm font-medium',
              'active:bg-muted touch-manipulation'
            )}
          >
            Check again
          </button>
        </div>
      )}

      {/* Worklist Sections */}
      {!allClear && !error && (
        <div className="p-4 space-y-6">
          {/* Blocking Work (Red - Most Critical) */}
          {data.blocking.length > 0 && (
            <WorklistSection
              title="Blocking Work"
              subtitle="These items are stopping work from proceeding"
              items={data.blocking}
              urgency="blocking"
              onItemClick={handleItemClick}
            />
          )}

          {/* Due Today (Amber) */}
          {data.dueToday.length > 0 && (
            <WorklistSection
              title="Due Today"
              subtitle="Must be completed today"
              items={data.dueToday}
              urgency="due_today"
              onItemClick={handleItemClick}
            />
          )}

          {/* Upcoming (Blue) */}
          {data.upcoming.length > 0 && (
            <WorklistSection
              title="Coming Up"
              subtitle="Next 24-48 hours"
              items={data.upcoming}
              urgency="upcoming"
              onItemClick={handleItemClick}
            />
          )}
        </div>
      )}
    </div>
  )
}

interface WorklistSectionProps {
  title: string
  subtitle: string
  items: WorklistItem[]
  urgency: UrgencyLevel
  onItemClick: (item: WorklistItem) => void
}

function WorklistSection({ title, subtitle, items, urgency, onItemClick }: WorklistSectionProps) {
  const config = urgencyConfig[urgency]

  return (
    <div>
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('w-2 h-2 rounded-full', config.color)} />
        <div className="flex-1">
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className={cn(
          'text-xs font-medium px-2 py-0.5 rounded-full',
          config.bgColor, config.textColor
        )}>
          {items.length}
        </span>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item) => (
          <WorklistItemCard
            key={item.id}
            item={item}
            urgency={urgency}
            onClick={() => onItemClick(item)}
          />
        ))}
      </div>
    </div>
  )
}

interface WorklistItemCardProps {
  item: WorklistItem
  urgency: UrgencyLevel
  onClick: () => void
}

function WorklistItemCard({ item, urgency, onClick }: WorklistItemCardProps) {
  const config = urgencyConfig[urgency]
  const TypeIcon = typeIcons[item.type] || CheckSquare

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-4 rounded-lg border',
        'text-left transition-colors',
        'active:bg-muted/50 touch-manipulation min-h-[72px]',
        config.bgColor,
        config.borderColor
      )}
    >
      {/* Icon */}
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
        'bg-white dark:bg-gray-800 shadow-sm'
      )}>
        <TypeIcon className={cn('h-5 w-5', config.textColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.title}</p>
        <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
        {item.metadata?.lotNumber && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Lot {item.metadata.lotNumber}
          </p>
        )}
      </div>

      {/* Chevron */}
      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
    </button>
  )
}

export default TodayWorklist
