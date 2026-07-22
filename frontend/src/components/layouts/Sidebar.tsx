import { NavLink, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  Building2,
  PieChart,
  HelpCircle,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/queryKeys';
import { useUIStore } from '@/stores/uiStore'; // Feature #442: Zustand client state
import {
  getCompanyRole,
  getProjectScopedRole,
  hasSubcontractorPortalIdentity,
} from '@/lib/subcontractorIdentity';
import {
  ROLE_GROUPS,
  canManageProjectSettings,
  hasRoleInGroup,
  isAdminRole,
  isSubcontractorRole,
  hasCommercialAccess,
  isViewerRole,
} from '@/lib/roles';
import {
  getEnabledProjectModules,
  isProjectModuleNavigationItemEnabled,
} from './projectModuleNavigation';
import {
  FOREMAN_MENU_ITEMS,
  VIEWER_PROJECT_MENU_ITEMS,
  OFFICE_SECTION_ORDER,
  projectNavigation,
  type NavigationItem,
} from './navItems';

const navigation: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    requiresProject: false,
    excludeRoles: ROLE_GROUPS.SUBCONTRACTOR,
  },
  {
    name: 'Portfolio',
    href: '/portfolio',
    icon: PieChart,
    requiresProject: false,
    requiresAdmin: true,
  },
  {
    name: 'Projects',
    href: '/projects',
    icon: FolderKanban,
    requiresProject: false,
    excludeRoles: ROLE_GROUPS.SUBCONTRACTOR,
  },
];

// Settings navigation items
const settingsNavigation: NavigationItem[] = [
  { name: 'Settings', href: '/settings', icon: Settings, excludeRoles: ROLE_GROUPS.SUBCONTRACTOR },
  { name: 'Documentation', href: '/docs', icon: BookOpen },
  { name: 'Help & Support', href: '/support', icon: HelpCircle },
  { name: 'Company Settings', href: '/company-settings', icon: Building2, requiresAdmin: true },
  { name: 'Audit Log', href: '/audit-log', icon: ClipboardList, requiresAuditLogAccess: true },
];

// Subcontractor-specific navigation
const subcontractorNavigation: NavigationItem[] = [
  {
    name: 'Portal',
    href: '/subcontractor-portal',
    icon: Briefcase,
    allowedRoles: ROLE_GROUPS.SUBCONTRACTOR,
  },
  {
    name: 'My Company',
    href: '/my-company',
    icon: Building2,
    allowedRoles: ROLE_GROUPS.SUBCONTRACTOR,
  },
];

// "Quiet Authority" nav item styling (docs/DESIGN.md). Monochrome by default;
// the single active item carries THE brand signature: a deep-amber (--brand)
// left rail + amber icon on a subtle warm bg. Everything else stays neutral.
// Shared across every nav group so there is exactly one active treatment.
function navLinkClass(isActive: boolean, isCollapsed: boolean): string {
  return cn(
    'group relative flex items-center rounded-lg py-2 text-sm transition-colors duration-200',
    isCollapsed ? 'justify-center px-2' : 'gap-3 px-3',
    // Amber left rail — the one signature. Hidden when idle, ~2.5px when active.
    'before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2.5px] before:rounded-r-full before:bg-brand before:transition-opacity before:duration-200',
    isActive
      ? 'bg-accent font-medium text-foreground before:opacity-100'
      : 'text-muted-foreground before:opacity-0 hover:bg-muted hover:text-foreground',
  );
}

// Idle icons are muted; the active item's icon is amber to match its rail.
function navIconClass(isActive: boolean): string {
  return cn(
    'h-5 w-5 flex-shrink-0 transition-colors duration-200',
    isActive ? 'text-brand' : 'text-muted-foreground group-hover:text-foreground',
  );
}

export function Sidebar() {
  const { projectId } = useParams();
  const { user } = useAuth();

  // Feature #442: Use Zustand store for sidebar state (persists during navigation)
  const { sidebar, toggleSidebar: zustandToggleSidebar, setCurrentProject } = useUIStore();
  const isCollapsed = sidebar.isCollapsed;

  // Feature #700 - Enabled modules via TanStack Query
  const { data: projectData } = useQuery({
    queryKey: queryKeys.projectModules(projectId!),
    queryFn: () =>
      apiFetch<{
        project?: { name?: string; settings?: unknown; currentUserRole?: string | null };
      }>(`/api/projects/${projectId}`),
    enabled: !!projectId,
  });

  const enabledModules = getEnabledProjectModules(projectData?.project?.settings);

  // Feature #442: Update current project in Zustand store when projectId changes
  useEffect(() => {
    setCurrentProject(projectId || null);
  }, [projectId, setCurrentProject]);

  // Use Zustand toggle instead of local state
  const toggleSidebar = zustandToggleSidebar;

  const userRole = getCompanyRole(user);
  const projectScopedRole = projectId
    ? (projectData?.project?.currentUserRole ?? 'viewer')
    : getProjectScopedRole(user);
  const hasPortalIdentity = hasSubcontractorPortalIdentity(user);

  // Role-based access checks
  const hasCommercial = hasCommercialAccess(projectScopedRole);
  const hasAdmin = isAdminRole(userRole);
  const hasAuditLogAccess =
    hasAdmin || projectScopedRole === 'project_manager' || projectScopedRole === 'quality_manager';
  const hasManagement = hasRoleInGroup(projectScopedRole, ROLE_GROUPS.MANAGEMENT);
  const hasProjectSettingsAccess = canManageProjectSettings(projectScopedRole);
  const isForeman = projectScopedRole === 'foreman';
  const isSubcontractor = isSubcontractorRole(userRole);
  const isViewer = isViewerRole(projectScopedRole);
  // Office roles = owner/admin/PM/QM (ROLE_GROUPS.QUALITY). They get a grouped,
  // pruned project menu; field roles keep the current flat list.
  const isOfficeRole = hasRoleInGroup(projectScopedRole, ROLE_GROUPS.QUALITY);

  // Helper function to check if a menu item should be visible
  const shouldShowItem = (item: NavigationItem): boolean => {
    // Check commercial access requirement
    if (item.requiresCommercialAccess && !hasCommercial) {
      return false;
    }
    // Check admin access requirement
    if (item.requiresAdmin && !hasAdmin) {
      return false;
    }
    if (item.requiresAuditLogAccess && !hasAuditLogAccess) {
      return false;
    }
    // Check management access requirement
    if (item.requiresManagement && !hasManagement) {
      return false;
    }
    if (item.requiresProjectSettingsAccess && !hasProjectSettingsAccess) {
      return false;
    }
    // Check allowed roles
    if (
      item.allowedRoles &&
      !item.allowedRoles.includes(userRole) &&
      !(item.allowedRoles.some((role) => isSubcontractorRole(role)) && hasPortalIdentity)
    ) {
      return false;
    }
    // Check excluded roles
    if (
      item.excludeRoles &&
      (item.excludeRoles.includes(userRole) ||
        (item.excludeRoles.some((role) => isSubcontractorRole(role)) && hasPortalIdentity))
    ) {
      return false;
    }
    return true;
  };

  // Filter main navigation
  const filteredNavigation = navigation.filter(shouldShowItem);

  // Filter project navigation based on user role
  let filteredProjectNavigation = projectNavigation.filter(shouldShowItem);

  // Foreman gets simplified menu
  if (isForeman) {
    filteredProjectNavigation = filteredProjectNavigation.filter((item) =>
      FOREMAN_MENU_ITEMS.includes(item.name),
    );
  }

  if (isViewer) {
    filteredProjectNavigation = filteredProjectNavigation.filter((item) =>
      VIEWER_PROJECT_MENU_ITEMS.includes(item.name),
    );
  }

  // Feature #700 - Filter by enabled modules
  filteredProjectNavigation = filteredProjectNavigation.filter((item) =>
    isProjectModuleNavigationItemEnabled(item.name, enabledModules),
  );

  // Owner decision 2026-07-05: office roles drop Daily Diary from nav (diary
  // records still readable via Reports → Diary; this is nav-only).
  if (isOfficeRole) {
    filteredProjectNavigation = filteredProjectNavigation.filter(
      (item) => item.name !== 'Daily Diary',
    );
  }
  // Docket amounts are for owner/admin/PM only; QM and site_engineer lose the
  // Docket Approvals menu item (route gates unchanged).
  if (projectScopedRole === 'quality_manager' || projectScopedRole === 'site_engineer') {
    filteredProjectNavigation = filteredProjectNavigation.filter(
      (item) => item.name !== 'Docket Approvals',
    );
  }

  // Filter settings navigation
  const filteredSettingsNavigation = settingsNavigation.filter(shouldShowItem);

  // Filter subcontractor navigation (only for subcontractors)
  const filteredSubcontractorNavigation = hasPortalIdentity
    ? subcontractorNavigation.filter(shouldShowItem)
    : [];

  const renderProjectNavLink = (item: NavigationItem) => (
    <NavLink
      key={item.name}
      to={`/projects/${projectId}/${item.href}`}
      title={isCollapsed ? item.name : undefined}
      className={({ isActive }) => navLinkClass(isActive, isCollapsed)}
    >
      {({ isActive }) => (
        <>
          <item.icon className={navIconClass(isActive)} aria-hidden="true" />
          {!isCollapsed && <span className="transition-opacity duration-200">{item.name}</span>}
        </>
      )}
    </NavLink>
  );

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r bg-card transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-16' : 'w-64',
      )}
      data-testid="sidebar"
    >
      <div
        className={cn(
          'flex h-16 items-center border-b transition-all duration-300',
          isCollapsed ? 'justify-center px-2' : 'px-6',
        )}
      >
        {isCollapsed ? (
          <span className="text-lg font-semibold tracking-tight text-foreground">SP</span>
        ) : (
          <span className="text-lg font-semibold tracking-tight text-foreground whitespace-nowrap overflow-hidden">
            CIVOS
            <span className="font-mono text-sm font-normal text-muted-foreground">·v3</span>
          </span>
        )}
      </div>
      {/* min-h-0 + overflow-y-auto: on short screens (laptops ~768px) the
          project nav is taller than the viewport; without its own scroller it
          overflowed the h-screen layout root and stretched the document, so
          the main content column clipped mid-viewport on window scroll. The
          nav scrolls; the utility cluster below stays pinned. */}
      <nav
        className={cn(
          'min-h-0 flex-1 space-y-1 overflow-y-auto transition-all duration-300',
          isCollapsed ? 'p-2' : 'p-4',
        )}
      >
        {filteredNavigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            title={isCollapsed ? item.name : undefined}
            className={({ isActive }) => navLinkClass(isActive, isCollapsed)}
          >
            {({ isActive }) => (
              <>
                <item.icon className={navIconClass(isActive)} aria-hidden="true" />
                {!isCollapsed && (
                  <span className="transition-opacity duration-200">{item.name}</span>
                )}
              </>
            )}
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
                className={({ isActive }) => navLinkClass(isActive, isCollapsed)}
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={navIconClass(isActive)} aria-hidden="true" />
                    {!isCollapsed && (
                      <span className="transition-opacity duration-200">{item.name}</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}

        {/* Hide project navigation for subcontractors */}
        {projectId && !isSubcontractor && !hasPortalIdentity && (
          <>
            <div className="my-4 border-t pt-4">
              {!isCollapsed && !isOfficeRole && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
                  Project
                </p>
              )}
            </div>
            {isOfficeRole
              ? OFFICE_SECTION_ORDER.map((section) => {
                  const items = filteredProjectNavigation.filter(
                    (item) => item.section === section,
                  );
                  if (items.length === 0) return null;
                  return (
                    <div key={section} className="mt-4 first:mt-0 space-y-1">
                      {!isCollapsed && (
                        <p className="mb-1 px-3 text-xs font-semibold uppercase text-muted-foreground">
                          {section}
                        </p>
                      )}
                      {items.map(renderProjectNavLink)}
                    </div>
                  );
                })
              : filteredProjectNavigation.map(renderProjectNavLink)}
          </>
        )}
      </nav>
      <div
        className={cn(
          'border-t space-y-1 transition-all duration-300',
          isCollapsed ? 'p-2' : 'p-4',
        )}
      >
        {filteredSettingsNavigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            title={isCollapsed ? item.name : undefined}
            className={({ isActive }) => navLinkClass(isActive, isCollapsed)}
          >
            {({ isActive }) => (
              <>
                <item.icon className={navIconClass(isActive)} aria-hidden="true" />
                {!isCollapsed && (
                  <span className="transition-opacity duration-200">{item.name}</span>
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Collapse/Expand Toggle Button */}
        <Button
          variant="ghost"
          onClick={toggleSidebar}
          className={cn(
            'w-full text-muted-foreground hover:text-foreground',
            isCollapsed ? 'justify-center px-2' : 'justify-start gap-3 px-3',
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
        </Button>
      </div>
    </aside>
  );
}
