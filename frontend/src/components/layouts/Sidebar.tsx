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
  Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { useUIStore } from '@/stores/uiStore'  // Feature #442: Zustand client state
import { ROLE_GROUPS, hasRoleInGroup, isAdminRole, isSubcontractorRole, hasCommercialAccess } from '@/lib/roles'

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
  allowedRoles?: readonly string[]
  excludeRoles?: readonly string[]
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, requiresProject: false, excludeRoles: ROLE_GROUPS.SUBCONTRACTOR },
  { name: 'Portfolio', href: '/portfolio', icon: PieChart, requiresProject: false, requiresAdmin: true },
  { name: 'Projects', href: '/projects', icon: FolderKanban, requiresProject: false, excludeRoles: ROLE_GROUPS.SUBCONTRACTOR },
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
  { name: 'Settings', href: '/settings', icon: Settings, excludeRoles: ROLE_GROUPS.SUBCONTRACTOR },
  { name: 'Help & Support', href: '/support', icon: HelpCircle },
  { name: 'Company Settings', href: '/company-settings', icon: Building2, requiresAdmin: true },
  { name: 'Audit Log', href: '/audit-log', icon: ClipboardList, requiresAdmin: true },
]

// Subcontractor-specific navigation
const subcontractorNavigation: NavigationItem[] = [
  { name: 'Portal', href: '/subcontractor-portal', icon: Briefcase, allowedRoles: ROLE_GROUPS.SUBCONTRACTOR },
  { name: 'My Company', href: '/my-company', icon: Building2, allowedRoles: ROLE_GROUPS.SUBCONTRACTOR },
]

// Module to navigation mapping (Feature #700)
const MODULE_NAV_MAPPING: Record<string, string[]> = {
  costTracking: ['Costs'],
  progressClaims: ['Progress Claims'],
  subcontractors: ['Subcontractors'],
  dockets: ['Docket Approvals'],
  dailyDiary: ['Daily Diary'],
}

export function Sidebar() {
  const { projectId } = useParams()
  const { user } = useAuth()

  // Feature #442: Use Zustand store for sidebar state (persists during navigation)
  const { sidebar, toggleSidebar: zustandToggleSidebar, setCurrentProject } = useUIStore()
  const isCollapsed = sidebar.isCollapsed

  // Feature #700 - Enabled modules state
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({
    costTracking: true,
    progressClaims: true,
    subcontractors: true,
    dockets: true,
    dailyDiary: true,
  })

  // Fetch project's enabled modules when projectId changes
  useEffect(() => {
    async function fetchProjectModules() {
      if (!projectId) return

      try {
        const data = await apiFetch<{ project?: { name?: string; settings?: any } }>(`/api/projects/${projectId}`)
        console.log('[Sidebar] Project data received:', data.project?.name)
        if (data.project?.settings) {
          try {
            const settings = typeof data.project.settings === 'string'
              ? JSON.parse(data.project.settings)
              : data.project.settings
            console.log('[Sidebar] Parsed settings.enabledModules:', settings.enabledModules)
            if (settings.enabledModules) {
              console.log('[Sidebar] Setting enabledModules state:', settings.enabledModules)
              setEnabledModules(prev => ({ ...prev, ...settings.enabledModules }))
            }
          } catch (e) {
            console.error('[Sidebar] Failed to parse settings:', e)
            // Invalid JSON, use defaults
          }
        }
      } catch (error) {
        console.error('Failed to fetch project modules:', error)
      }
    }

    fetchProjectModules()
  }, [projectId])

  // Feature #442: Update current project in Zustand store when projectId changes
  useEffect(() => {
    setCurrentProject(projectId || null)
  }, [projectId, setCurrentProject])

  // Use Zustand toggle instead of local state
  const toggleSidebar = zustandToggleSidebar

  const userRole = user?.role || ''

  // Role-based access checks
  const hasCommercial = hasCommercialAccess(userRole)
  const hasAdmin = isAdminRole(userRole)
  const hasManagement = hasRoleInGroup(userRole, ROLE_GROUPS.MANAGEMENT)
  const isForeman = userRole === 'foreman'
  const isSubcontractor = isSubcontractorRole(userRole)

  // Helper function to check if a menu item should be visible
  const shouldShowItem = (item: NavigationItem): boolean => {
    // Check commercial access requirement
    if (item.requiresCommercialAccess && !hasCommercial) {
      return false
    }
    // Check admin access requirement
    if (item.requiresAdmin && !hasAdmin) {
      return false
    }
    // Check management access requirement
    if (item.requiresManagement && !hasManagement) {
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

  // Feature #700 - Filter by enabled modules
  filteredProjectNavigation = filteredProjectNavigation.filter((item) => {
    // Check if this nav item is controlled by a module
    for (const [moduleKey, navNames] of Object.entries(MODULE_NAV_MAPPING)) {
      if (navNames.includes(item.name)) {
        // If the module is disabled, hide the nav item
        return enabledModules[moduleKey] !== false
      }
    }
    // If not controlled by a module, always show
    return true
  })

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

        {/* Hide project navigation for subcontractors */}
        {projectId && !isSubcontractor && (
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
