import { useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
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
  Menu,
  X,
  Briefcase,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'

// Role-based access definitions
const COMMERCIAL_ROLES = ['owner', 'admin', 'project_manager']
const ADMIN_ROLES = ['owner', 'admin']
const MANAGEMENT_ROLES = ['owner', 'admin', 'project_manager', 'site_manager']
const FOREMAN_MENU_ITEMS = ['Lots', 'ITPs', 'Hold Points', 'Test Results', 'NCRs', 'Daily Diary', 'Docket Approvals']
export const SUBCONTRACTOR_ROLES = ['subcontractor', 'subcontractor_admin']

// Subcontractor-specific navigation
const subcontractorNavigation = [
  { name: 'Portal', href: '/subcontractor-portal', icon: Briefcase },
  { name: 'My Company', href: '/my-company', icon: Building2 },
]

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
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, requiresProject: false, excludeRoles: SUBCONTRACTOR_ROLES },
  { name: 'Projects', href: '/projects', icon: FolderKanban, requiresProject: false, excludeRoles: SUBCONTRACTOR_ROLES },
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

// Bottom nav - most important items for quick access
const bottomNavItems: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, excludeRoles: SUBCONTRACTOR_ROLES },
  { name: 'Projects', href: '/projects', icon: FolderKanban, excludeRoles: SUBCONTRACTOR_ROLES },
  { name: 'Lots', href: 'lots', icon: MapPin, requiresProject: true, excludeRoles: SUBCONTRACTOR_ROLES },
  { name: 'Settings', href: '/settings', icon: Settings, excludeRoles: SUBCONTRACTOR_ROLES },
]

// Subcontractor bottom nav items
const subcontractorBottomNavItems: NavigationItem[] = [
  { name: 'Portal', href: '/subcontractor-portal', icon: Briefcase },
  { name: 'My Company', href: '/my-company', icon: Building2 },
]

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)
  const { projectId } = useParams()
  const { user } = useAuth()

  const userRole = user?.role || ''
  const hasCommercialAccess = COMMERCIAL_ROLES.includes(userRole)
  const hasAdminAccess = ADMIN_ROLES.includes(userRole)
  const hasManagementAccess = MANAGEMENT_ROLES.includes(userRole)
  const isForeman = userRole === 'foreman'
  const isSubcontractor = SUBCONTRACTOR_ROLES.includes(userRole)

  const shouldShowItem = (item: NavigationItem): boolean => {
    if (item.requiresCommercialAccess && !hasCommercialAccess) return false
    if (item.requiresAdmin && !hasAdminAccess) return false
    if (item.requiresManagement && !hasManagementAccess) return false
    if (item.allowedRoles && !item.allowedRoles.includes(userRole)) return false
    if (item.excludeRoles && item.excludeRoles.includes(userRole)) return false
    return true
  }

  let filteredProjectNavigation = projectNavigation.filter(shouldShowItem)
  if (isForeman) {
    filteredProjectNavigation = filteredProjectNavigation.filter(
      (item) => FOREMAN_MENU_ITEMS.includes(item.name)
    )
  }

  return (
    <>
      {/* Hamburger Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden p-2.5 min-h-[44px] min-w-[44px] rounded-lg hover:bg-muted touch-manipulation flex items-center justify-center"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile Slide-out Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsOpen(false)}
          />
          {/* Menu Panel */}
          <div className="md:hidden fixed inset-y-0 left-0 w-64 bg-card border-r z-50 flex flex-col">
            <div className="flex h-16 items-center justify-between border-b px-6">
              <span className="text-xl font-bold text-primary">SiteProof</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-muted"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-4 overflow-auto">
              {navigation.filter(shouldShowItem).map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </NavLink>
              ))}

              {/* Subcontractor Navigation */}
              {isSubcontractor && (
                <>
                  <div className="my-4 border-t pt-4">
                    <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
                      Subcontractor
                    </p>
                  </div>
                  {subcontractorNavigation.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={() => setIsOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </NavLink>
                  ))}
                </>
              )}

              {/* Hide project navigation for subcontractors */}
              {projectId && !isSubcontractor && (
                <>
                  <div className="my-4 border-t pt-4">
                    <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
                      Project
                    </p>
                  </div>
                  {filteredProjectNavigation.map((item) => (
                    <NavLink
                      key={item.name}
                      to={`/projects/${projectId}/${item.href}`}
                      onClick={() => setIsOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </NavLink>
                  ))}
                </>
              )}
            </nav>
            {/* Hide settings for subcontractors */}
            {!isSubcontractor && (
              <div className="border-t p-4">
                <NavLink
                  to="/settings"
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )
                  }
                >
                  <Settings className="h-5 w-5" />
                  Settings
                </NavLink>
              </div>
            )}
          </div>
        </>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-30 safe-area-inset-bottom">
        <div className="flex justify-around items-center h-16">
          {/* Use subcontractor nav items if subcontractor */}
          {(isSubcontractor ? subcontractorBottomNavItems : bottomNavItems).map((item) => {
            // Skip items excluded by role
            if (!shouldShowItem(item)) return null
            // Skip project-specific items if no project selected
            if (item.requiresProject && !projectId) return null

            const href = item.requiresProject && projectId
              ? `/projects/${projectId}/${item.href}`
              : item.href

            return (
              <NavLink
                key={item.name}
                to={href}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center w-full h-full gap-1 text-xs transition-colors',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </>
  )
}

export function MobileMenuButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="md:hidden p-2 rounded-lg hover:bg-muted"
      aria-label="Toggle menu"
    >
      <Menu className="h-6 w-6" />
    </button>
  )
}
