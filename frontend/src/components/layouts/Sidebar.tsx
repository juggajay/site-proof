import { NavLink, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  FolderKanban,
  MapPin,
  ClipboardCheck,
  AlertTriangle,
  TestTube,
  FileWarning,
  Calendar,
  DollarSign,
  FileText,
  Users,
  BarChart3,
  Settings,
  FileCheck,
  Building2,
  PieChart,
  HelpCircle,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'

// Storage key for persisting sidebar state
const SIDEBAR_COLLAPSED_KEY = 'siteproof_sidebar_collapsed'

// Role-based access definitions
const COMMERCIAL_ROLES = ['owner', 'admin', 'project_manager']
const ADMIN_ROLES = ['owner', 'admin']
const MANAGEMENT_ROLES = ['owner', 'admin', 'project_manager', 'site_manager']
const FIELD_ROLES = ['owner', 'admin', 'project_manager', 'site_manager', 'site_engineer', 'foreman']
const SUBCONTRACTOR_ROLES = ['subcontractor', 'subcontractor_admin']

// Roles that can only view (read-only access)
const VIEW_ONLY_ROLES = ['viewer']

// Foreman simplified menu - only sees essential field items
const FOREMAN_MENU_ITEMS = ['Lots', 'ITPs', 'Hold Points', 'Test Results', 'NCRs', 'Daily Diary', 'Docket Approvals']

interface NavigationItem {
  name: string
  href: string
  icon: typeof LayoutDashboard
  requiresProject?: boolean
  requiresCommercialAccess?: boolean
  requiresAdmin?: boolean
  requiresManagement?: boolean
  allowedRoles?: string[]
  excludeRoles?: string[]
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, requiresProject: false },
  { name: 'Portfolio', href: '/portfolio', icon: PieChart, requiresProject: false, requiresAdmin: true },
  { name: 'Projects', href: '/projects', icon: FolderKanban, requiresProject: false },
]

const projectNavigation: NavigationItem[] = [
  { name: 'Lots', href: 'lots', icon: MapPin },
  { name: 'ITPs', href: 'itp', icon: ClipboardCheck },
  { name: 'Hold Points', href: 'hold-points', icon: AlertTriangle },
  { name: 'Test Results', href: 'tests', icon: TestTube },
  { name: 'NCRs', href: 'ncr', icon: FileWarning },
  { name: 'Daily Diary', href: 'diary', icon: Calendar },
  { name: 'Docket Approvals', href: 'dockets', icon: FileCheck },
  { name: 'Progress Claims', href: 'claims', icon: DollarSign, requiresCommercialAccess: true },
  { name: 'Costs', href: 'costs', icon: DollarSign, requiresCommercialAccess: true },
  { name: 'Documents', href: 'documents', icon: FileText },
  { name: 'Subcontractors', href: 'subcontractors', icon: Users, requiresManagement: true },
  { name: 'Reports', href: 'reports', icon: BarChart3 },
  { name: 'Project Settings', href: 'settings', icon: Settings, requiresManagement: true },
]

// Settings navigation items
const settingsNavigation: NavigationItem[] = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help & Support', href: '/support', icon: HelpCircle },
  { name: 'Company Settings', href: '/company-settings', icon: Building2, requiresAdmin: true },
  { name: 'Audit Log', href: '/audit-log', icon: ClipboardList, requiresAdmin: true },
]

// Subcontractor-specific navigation
const subcontractorNavigation: NavigationItem[] = [
  { name: 'My Company', href: '/my-company', icon: Building2, allowedRoles: SUBCONTRACTOR_ROLES },
]

export function Sidebar() {
  const { projectId } = useParams()
  const { user } = useAuth()

  // Initialize collapsed state from localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    return stored === 'true'
  })

  // Persist collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed))
  }, [isCollapsed])

  const toggleSidebar = () => {
    setIsCollapsed((prev) => !prev)
  }

  const userRole = user?.role || ''

  // Role-based access checks
  const hasCommercialAccess = COMMERCIAL_ROLES.includes(userRole)
  const hasAdminAccess = ADMIN_ROLES.includes(userRole)
  const hasManagementAccess = MANAGEMENT_ROLES.includes(userRole)
  const isForeman = userRole === 'foreman'
  const isViewer = VIEW_ONLY_ROLES.includes(userRole)
  const isSubcontractor = SUBCONTRACTOR_ROLES.includes(userRole)

  // Helper function to check if a menu item should be visible
  const shouldShowItem = (item: NavigationItem): boolean => {
    // Check commercial access requirement
    if (item.requiresCommercialAccess && !hasCommercialAccess) {
      return false
    }
    // Check admin access requirement
    if (item.requiresAdmin && !hasAdminAccess) {
      return false
    }
    // Check management access requirement
    if (item.requiresManagement && !hasManagementAccess) {
      return false
    }
    // Check allowed roles
    if (item.allowedRoles && !item.allowedRoles.includes(userRole)) {
      return false
    }
    // Check excluded roles
    if (item.excludeRoles && item.excludeRoles.includes(userRole)) {
      return false
    }
    return true
  }

  // Filter main navigation
  const filteredNavigation = navigation.filter(shouldShowItem)

  // Filter project navigation based on user role
  let filteredProjectNavigation = projectNavigation.filter(shouldShowItem)

  // Foreman gets simplified menu
  if (isForeman) {
    filteredProjectNavigation = filteredProjectNavigation.filter(
      (item) => FOREMAN_MENU_ITEMS.includes(item.name)
    )
  }

  // Viewer gets read-only items (no create/edit features - just viewing)
  // For now, viewers can see most items but actions will be disabled elsewhere

  // Filter settings navigation
  const filteredSettingsNavigation = settingsNavigation.filter(shouldShowItem)

  // Filter subcontractor navigation (only for subcontractors)
  const filteredSubcontractorNavigation = isSubcontractor
    ? subcontractorNavigation.filter(shouldShowItem)
    : []

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r bg-card transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-16' : 'w-64'
      )}
      data-testid="sidebar"
    >
      <div className={cn(
        'flex h-16 items-center border-b transition-all duration-300',
        isCollapsed ? 'justify-center px-2' : 'px-6'
      )}>
        {isCollapsed ? (
          <span className="text-xl font-bold text-primary">SP</span>
        ) : (
          <span className="text-xl font-bold text-primary whitespace-nowrap overflow-hidden">SiteProof</span>
        )}
      </div>
      <nav className={cn(
        'flex-1 space-y-1 transition-all duration-300',
        isCollapsed ? 'p-2' : 'p-4'
      )}>
        {filteredNavigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            title={isCollapsed ? item.name : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-lg py-2 text-sm transition-all duration-200',
                isCollapsed ? 'justify-center px-2' : 'gap-3 px-3',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            {!isCollapsed && <span className="transition-opacity duration-200">{item.name}</span>}
          </NavLink>
        ))}

        {/* Subcontractor Navigation */}
        {filteredSubcontractorNavigation.length > 0 && (
          <>
            <div className="my-4 border-t pt-4">
              {!isCollapsed && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
                  My Company
                </p>
              )}
            </div>
            {filteredSubcontractorNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                title={isCollapsed ? item.name : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center rounded-lg py-2 text-sm transition-all duration-200',
                    isCollapsed ? 'justify-center px-2' : 'gap-3 px-3',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {!isCollapsed && <span className="transition-opacity duration-200">{item.name}</span>}
              </NavLink>
            ))}
          </>
        )}

        {projectId && (
          <>
            <div className="my-4 border-t pt-4">
              {!isCollapsed && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
                  Project
                </p>
              )}
            </div>
            {filteredProjectNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={`/projects/${projectId}/${item.href}`}
                title={isCollapsed ? item.name : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center rounded-lg py-2 text-sm transition-all duration-200',
                    isCollapsed ? 'justify-center px-2' : 'gap-3 px-3',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {!isCollapsed && <span className="transition-opacity duration-200">{item.name}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>
      <div className={cn(
        'border-t space-y-1 transition-all duration-300',
        isCollapsed ? 'p-2' : 'p-4'
      )}>
        {filteredSettingsNavigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            title={isCollapsed ? item.name : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-lg py-2 text-sm transition-all duration-200',
                isCollapsed ? 'justify-center px-2' : 'gap-3 px-3',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            {!isCollapsed && <span className="transition-opacity duration-200">{item.name}</span>}
          </NavLink>
        ))}

        {/* Collapse/Expand Toggle Button */}
        <button
          onClick={toggleSidebar}
          className={cn(
            'flex items-center rounded-lg py-2 text-sm transition-all duration-200 w-full text-muted-foreground hover:bg-muted hover:text-foreground',
            isCollapsed ? 'justify-center px-2' : 'gap-3 px-3'
          )}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          data-testid="sidebar-toggle"
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <span className="transition-opacity duration-200">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
