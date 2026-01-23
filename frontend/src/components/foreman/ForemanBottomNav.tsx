// ForemanBottomNav - Mobile bottom navigation for foreman role
import { useParams, useNavigate } from 'react-router-dom'
import { Home, BookOpen, Camera, CheckSquare, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useForemanMobileStore, ForemanTab } from '@/stores/foremanMobileStore'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

interface NavItem {
  id: ForemanTab
  label: string
  icon: typeof Home
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'diary', label: 'Diary', icon: BookOpen },
  { id: 'capture', label: 'Capture', icon: Camera },
  { id: 'approve', label: 'Approve', icon: CheckSquare },
  { id: 'quick', label: 'Quick', icon: Zap },
]

export function ForemanBottomNav() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { activeTab, setActiveTab, setIsCameraOpen, setIsQuickActionsOpen } = useForemanMobileStore()
  const { isOnline, pendingSyncCount } = useOnlineStatus()

  const handleNavClick = (item: NavItem) => {
    setActiveTab(item.id)

    if (item.id === 'capture') {
      setIsCameraOpen(true)
      return
    }

    if (item.id === 'quick') {
      setIsQuickActionsOpen(true)
      return
    }

    // Navigate based on tab
    switch (item.id) {
      case 'home':
        navigate('/dashboard')
        break
      case 'diary':
        navigate(projectId ? `/projects/${projectId}/diary` : '/diary')
        break
      case 'approve':
        navigate(projectId ? `/projects/${projectId}/dockets?status=pending_approval` : '/dockets')
        break
    }
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-30 pb-safe">
      {/* Offline indicator */}
      {(!isOnline || pendingSyncCount > 0) && (
        <div
          className={cn(
            'flex items-center justify-center gap-2 py-1.5 text-xs font-medium',
            isOnline ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
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
          const isActive = activeTab === item.id
          const isCapture = item.id === 'capture'

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={cn(
                'flex flex-col items-center justify-center w-full h-full gap-1',
                'min-h-[48px] min-w-[48px] touch-manipulation',
                'transition-colors duration-150',
                isActive && !isCapture ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {isCapture ? (
                <div
                  className={cn(
                    'flex items-center justify-center w-12 h-12 -mt-4 rounded-full',
                    'bg-primary text-primary-foreground shadow-lg',
                    'active:scale-95 transition-transform'
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
              ) : (
                <>
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{item.label}</span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
