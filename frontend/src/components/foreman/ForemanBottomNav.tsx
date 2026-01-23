// ForemanBottomNav - Mobile bottom navigation for foreman role
// Updated to show project-context navigation with More drawer
import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Calendar,
  FileCheck,
  MapPin,
  AlertTriangle,
  MoreHorizontal,
  ClipboardCheck,
  TestTube,
  Camera,
  Zap,
  X,
  Home,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useForemanMobileStore } from '@/stores/foremanMobileStore'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

interface NavItem {
  id: string
  label: string
  icon: typeof Calendar
  href?: string
  action?: 'more' | 'capture' | 'quick'
}

// Main bottom nav items when inside a project
const projectNavItems: NavItem[] = [
  { id: 'diary', label: 'Diary', icon: Calendar, href: 'diary' },
  { id: 'dockets', label: 'Dockets', icon: FileCheck, href: 'dockets' },
  { id: 'lots', label: 'Lots', icon: MapPin, href: 'lots' },
  { id: 'ncr', label: 'NCRs', icon: AlertTriangle, href: 'ncr' },
  { id: 'more', label: 'More', icon: MoreHorizontal, action: 'more' },
]

// Items shown in the "More" drawer
const moreMenuItems: NavItem[] = [
  { id: 'itp', label: 'ITPs', icon: ClipboardCheck, href: 'itp' },
  { id: 'hold-points', label: 'Hold Points', icon: AlertTriangle, href: 'hold-points' },
  { id: 'tests', label: 'Test Results', icon: TestTube, href: 'tests' },
  { id: 'capture', label: 'Photo Capture', icon: Camera, action: 'capture' },
  { id: 'quick', label: 'Quick Actions', icon: Zap, action: 'quick' },
]

// Nav items when NOT inside a project (dashboard view)
const dashboardNavItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, href: '/dashboard' },
  { id: 'capture', label: 'Capture', icon: Camera, action: 'capture' },
  { id: 'quick', label: 'Quick', icon: Zap, action: 'quick' },
]

export function ForemanBottomNav() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { setIsCameraOpen, setIsQuickActionsOpen } = useForemanMobileStore()
  const { isOnline, pendingSyncCount } = useOnlineStatus()
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  // Determine which nav items to show
  const navItems = projectId ? projectNavItems : dashboardNavItems

  // Check if current route matches nav item
  const isActive = (item: NavItem): boolean => {
    if (!item.href) return false
    if (item.href.startsWith('/')) {
      return location.pathname === item.href
    }
    return location.pathname.includes(`/${item.href}`)
  }

  const handleNavClick = (item: NavItem) => {
    // Handle action items
    if (item.action === 'more') {
      setIsMoreOpen(true)
      return
    }

    if (item.action === 'capture') {
      setIsCameraOpen(true)
      setIsMoreOpen(false)
      return
    }

    if (item.action === 'quick') {
      setIsQuickActionsOpen(true)
      setIsMoreOpen(false)
      return
    }

    // Handle navigation
    if (item.href) {
      setIsMoreOpen(false)
      if (item.href.startsWith('/')) {
        navigate(item.href)
      } else if (projectId) {
        navigate(`/projects/${projectId}/${item.href}`)
      }
    }
  }

  return (
    <>
      {/* More Menu Drawer */}
      {isMoreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsMoreOpen(false)}
          />
          {/* Drawer */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-50 animate-slide-up">
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b">
              <h3 className="font-semibold text-lg">More Options</h3>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-2 -mr-2 rounded-lg hover:bg-muted touch-manipulation"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Menu items */}
            <div className="p-4 pb-8 grid grid-cols-3 gap-3">
              {moreMenuItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item)

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-2 p-4 rounded-xl',
                      'min-h-[80px] touch-manipulation transition-all',
                      'border border-transparent',
                      active
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-muted/50 hover:bg-muted text-foreground'
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center justify-center w-10 h-10 rounded-full',
                        active ? 'bg-primary text-primary-foreground' : 'bg-background'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-30 pb-safe max-w-full overflow-hidden">
        {/* Offline indicator */}
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
                {pendingSyncCount} item{pendingSyncCount !== 1 ? 's' : ''} pending sync
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Offline - changes will sync when connected
              </>
            )}
          </div>
        )}

        {/* Nav items */}
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item)
            const isMoreButton = item.action === 'more'

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={cn(
                  'flex flex-col items-center justify-center w-full h-full gap-1',
                  'min-h-[48px] min-w-[48px] touch-manipulation',
                  'transition-colors duration-150',
                  active ? 'text-primary' : 'text-muted-foreground',
                  isMoreButton && isMoreOpen && 'text-primary'
                )}
                aria-label={item.label}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
