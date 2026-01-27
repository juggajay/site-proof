// ForemanBottomNavV2 - Research-backed mobile navigation for foreman role
// 5 primary actions: Today, Approve, [Capture], Diary, Lots
// Camera button centered between 4 nav tabs
// Reference: docs/Foreman persona document (AU civil).md
import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Camera, ListChecks, CheckSquare, BookOpen, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getAuthToken } from '@/lib/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3031'

type NavTab = 'capture' | 'today' | 'approve' | 'diary' | 'lots'

interface NavItem {
  id: NavTab
  label: string
  icon: typeof Camera
  getPath: (projectId: string) => string
  isAction?: boolean // For capture which opens modal instead of navigating
}

const navItems: NavItem[] = [
  {
    id: 'today',
    label: 'Today',
    icon: ListChecks,
    getPath: (projectId) => `/projects/${projectId}/foreman/today`
  },
  {
    id: 'approve',
    label: 'Approve',
    icon: CheckSquare,
    getPath: (projectId) => `/projects/${projectId}/dockets?status=pending_approval`
  },
  {
    id: 'capture',
    label: 'Capture',
    icon: Camera,
    getPath: () => '', // Special handling - opens modal
    isAction: true
  },
  {
    id: 'diary',
    label: 'Diary',
    icon: BookOpen,
    getPath: (projectId) => `/projects/${projectId}/diary`
  },
  {
    id: 'lots',
    label: 'Lots',
    icon: MapPin,
    getPath: (projectId) => `/projects/${projectId}/lots`
  },
]

interface ForemanBottomNavV2Props {
  onCapturePress: () => void
  todayBadgeCount?: number // If provided, skips internal fetch
}

export function ForemanBottomNavV2({ onCapturePress, todayBadgeCount: externalBadgeCount }: ForemanBottomNavV2Props) {
  const { projectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { isOnline, pendingSyncCount } = useOnlineStatus()
  const [internalBadgeCount, setInternalBadgeCount] = useState(0)

  // Self-manage badge count when no external count provided
  const fetchBadgeCount = useCallback(async () => {
    if (externalBadgeCount !== undefined || !projectId) return

    const token = getAuthToken()
    if (!token) return

    try {
      const response = await fetch(
        `${API_URL}/api/dashboard/projects/${projectId}/foreman/today`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (response.ok) {
        const data = await response.json()
        const count = (data.blocking?.length || 0) + (data.dueToday?.length || 0)
        setInternalBadgeCount(count)
      }
    } catch {
      // Silently fail - badge is non-critical
    }
  }, [projectId, externalBadgeCount])

  useEffect(() => {
    fetchBadgeCount()
    const interval = setInterval(fetchBadgeCount, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchBadgeCount])

  const todayBadgeCount = externalBadgeCount ?? internalBadgeCount

  // Determine active tab from current path
  const getActiveTab = (): NavTab | null => {
    const path = location.pathname
    if (path.includes('/foreman/today')) return 'today'
    if (path.includes('/dockets')) return 'approve'
    if (path.includes('/diary')) return 'diary'
    if (path.includes('/lots')) return 'lots'
    return null
  }

  const activeTab = getActiveTab()

  const handleNavClick = (item: NavItem) => {
    if (item.isAction) {
      onCapturePress()
      return
    }

    if (projectId) {
      navigate(item.getPath(projectId))
    }
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-30 pb-safe">
      {/* Offline/Sync indicator */}
      {(!isOnline || pendingSyncCount > 0) && (
        <div
          className={cn(
            'flex items-center justify-center gap-2 py-1.5 text-xs font-medium',
            isOnline
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
          )}
        >
          {isOnline ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              {pendingSyncCount} pending sync
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Offline - changes saved locally
            </>
          )}
        </div>
      )}

      {/* Nav items */}
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          const isCapture = item.id === 'capture'
          const showBadge = item.id === 'today' && todayBadgeCount && todayBadgeCount > 0

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-1',
                'min-h-[48px] touch-manipulation',
                'transition-colors duration-150',
                'active:bg-muted/50',
                isCapture ? 'text-primary' : (isActive ? 'text-primary' : 'text-muted-foreground')
              )}
              aria-label={item.label}
            >
              {isCapture ? (
                // Capture button - centered circle
                <div className={cn(
                  'flex items-center justify-center w-12 h-12 rounded-full',
                  'bg-primary text-primary-foreground shadow-lg',
                  'active:scale-95 transition-transform'
                )}>
                  <Icon className="h-6 w-6" />
                </div>
              ) : (
                <>
                  <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                  <div className="flex items-center gap-1">
                    <span className={cn('text-xs', isActive && 'font-medium')}>{item.label}</span>
                    {showBadge && (
                      <span className={cn(
                        'flex items-center justify-center',
                        'min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full',
                        'bg-red-500 text-white'
                      )}>
                        {todayBadgeCount > 9 ? '9+' : todayBadgeCount}
                      </span>
                    )}
                  </div>
                </>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default ForemanBottomNavV2
