import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
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
  ClipboardList,
  Home,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { usePublishBottomNavHeight } from '@/hooks/useBottomNavHeight';
import { ForemanBottomNavV2 } from '@/components/foreman/ForemanBottomNavV2';
import { useForemanMobileStore } from '@/stores/foremanMobileStore';
import { queryKeys } from '@/lib/queryKeys';
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

const FOREMAN_MENU_ITEMS = [
  'Lots',
  'ITPs',
  'Hold Points',
  'Test Results',
  'NCRs',
  'Daily Diary',
  'Docket Approvals',
];

const VIEWER_PROJECT_MENU_ITEMS = ['Lots', 'Reports'];

// Office roles (owner/admin/PM/QM = ROLE_GROUPS.QUALITY) get a grouped project
// menu with these section labels, in this order. Field roles keep the flat list.
const OFFICE_SECTION_ORDER = ['Quality', 'Commercial', 'Records', 'Admin'] as const;
type NavSection = (typeof OFFICE_SECTION_ORDER)[number];

// Subcontractor-specific navigation
const subcontractorNavigation = [
  { name: 'Docket', href: '/subcontractor-portal/docket/new', icon: ClipboardList },
  { name: 'Home', href: '/subcontractor-portal', icon: Home },
  { name: 'My Company', href: '/my-company', icon: Building2 },
];

interface NavigationItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  requiresProject?: boolean;
  requiresCommercialAccess?: boolean;
  requiresAdmin?: boolean;
  requiresManagement?: boolean;
  requiresProjectSettingsAccess?: boolean;
  allowedRoles?: readonly string[];
  excludeRoles?: readonly string[];
  section?: NavSection;
}

const navigation: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    requiresProject: false,
    excludeRoles: ROLE_GROUPS.SUBCONTRACTOR,
  },
  {
    name: 'Projects',
    href: '/projects',
    icon: FolderKanban,
    requiresProject: false,
    excludeRoles: ROLE_GROUPS.SUBCONTRACTOR,
  },
];

const projectNavigation: NavigationItem[] = [
  { name: 'Lots', href: 'lots', icon: MapPin, section: 'Quality' },
  { name: 'ITPs', href: 'itp', icon: ClipboardCheck, section: 'Quality' },
  { name: 'Hold Points', href: 'hold-points', icon: AlertTriangle, section: 'Quality' },
  { name: 'Test Results', href: 'tests', icon: TestTube, section: 'Quality' },
  { name: 'NCRs', href: 'ncr', icon: FileWarning, section: 'Quality' },
  { name: 'Daily Diary', href: 'diary', icon: Calendar },
  {
    name: 'Progress Claims',
    href: 'claims',
    icon: DollarSign,
    requiresCommercialAccess: true,
    section: 'Commercial',
  },
  {
    name: 'Costs',
    href: 'costs',
    icon: DollarSign,
    requiresCommercialAccess: true,
    section: 'Commercial',
  },
  { name: 'Docket Approvals', href: 'dockets', icon: FileCheck, section: 'Commercial' },
  { name: 'Documents', href: 'documents', icon: FileText, section: 'Records' },
  {
    name: 'Subcontractors',
    href: 'subcontractors',
    icon: Users,
    requiresManagement: true,
    section: 'Records',
  },
  { name: 'Reports', href: 'reports', icon: BarChart3, section: 'Records' },
  {
    name: 'Project Settings',
    href: 'settings',
    icon: Settings,
    requiresProjectSettingsAccess: true,
    section: 'Admin',
  },
];

// Bottom nav - most important items for quick access
const bottomNavItems: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    excludeRoles: ROLE_GROUPS.SUBCONTRACTOR,
  },
  {
    name: 'Projects',
    href: '/projects',
    icon: FolderKanban,
    excludeRoles: ROLE_GROUPS.SUBCONTRACTOR,
  },
  {
    name: 'Lots',
    href: 'lots',
    icon: MapPin,
    requiresProject: true,
    excludeRoles: ROLE_GROUPS.SUBCONTRACTOR,
  },
  { name: 'Settings', href: '/settings', icon: Settings, excludeRoles: ROLE_GROUPS.SUBCONTRACTOR },
];

// Subcontractor bottom nav items — Docket first so the subbie's daily action is one tap away
const subcontractorBottomNavItems: NavigationItem[] = [
  { name: 'Docket', href: '/subcontractor-portal/docket/new', icon: ClipboardList },
  { name: 'Home', href: '/subcontractor-portal', icon: Home, end: true },
  { name: 'My Company', href: '/my-company', icon: Building2 },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { projectId } = useParams();
  const { user } = useAuth();
  // Publishes the bottom bar's height so the offline sync pill can float
  // above it (see useBottomNavHeight). Unused on the foreman branch, where
  // ForemanBottomNavV2 publishes its own height.
  const navRef = usePublishBottomNavHeight<HTMLElement>();

  const userRole = getCompanyRole(user);
  const hasPortalIdentity = hasSubcontractorPortalIdentity(user);
  const { setIsCameraOpen } = useForemanMobileStore();

  const { data: projectData } = useQuery({
    queryKey: queryKeys.projectModules(projectId!),
    queryFn: () =>
      apiFetch<{
        project?: { name?: string; settings?: unknown; currentUserRole?: string | null };
      }>(`/api/projects/${projectId}`),
    enabled: !!projectId,
  });

  const enabledModules = getEnabledProjectModules(projectData?.project?.settings);
  const projectScopedRole = projectId
    ? (projectData?.project?.currentUserRole ?? 'viewer')
    : getProjectScopedRole(user);
  const hasCommercial = hasCommercialAccess(projectScopedRole);
  const hasAdmin = isAdminRole(userRole);
  const hasManagement = hasRoleInGroup(projectScopedRole, ROLE_GROUPS.MANAGEMENT);
  const hasProjectSettingsAccess = canManageProjectSettings(projectScopedRole);
  const isForeman = projectScopedRole === 'foreman';
  const isSubcontractor = isSubcontractorRole(userRole) || hasPortalIdentity;
  const isViewer = isViewerRole(projectScopedRole);
  // Office roles = owner/admin/PM/QM (ROLE_GROUPS.QUALITY): grouped, pruned menu.
  const isOfficeRole = hasRoleInGroup(projectScopedRole, ROLE_GROUPS.QUALITY);

  const shouldShowItem = (item: NavigationItem): boolean => {
    if (item.requiresCommercialAccess && !hasCommercial) return false;
    if (item.requiresAdmin && !hasAdmin) return false;
    if (item.requiresManagement && !hasManagement) return false;
    if (item.requiresProjectSettingsAccess && !hasProjectSettingsAccess) return false;
    if (
      item.allowedRoles &&
      !item.allowedRoles.includes(userRole) &&
      !(item.allowedRoles.some((role) => isSubcontractorRole(role)) && hasPortalIdentity)
    ) {
      return false;
    }
    if (
      item.excludeRoles &&
      (item.excludeRoles.includes(userRole) ||
        (item.excludeRoles.some((role) => isSubcontractorRole(role)) && hasPortalIdentity))
    ) {
      return false;
    }
    return true;
  };

  let filteredProjectNavigation = projectNavigation.filter(shouldShowItem);
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
  filteredProjectNavigation = filteredProjectNavigation.filter((item) =>
    isProjectModuleNavigationItemEnabled(item.name, enabledModules),
  );
  // Owner decision 2026-07-05: office roles drop Daily Diary from nav (records
  // still readable via Reports → Diary; nav-only).
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

  // Foreman uses research-backed 5-tab nav: Capture, Today, Approve, Diary, Lots
  if (isForeman) {
    return <ForemanBottomNavV2 onCapturePress={() => setIsCameraOpen(true)} />;
  }

  const renderProjectNavLink = (item: NavigationItem) => (
    <NavLink
      key={item.name}
      to={`/projects/${projectId}/${item.href}`}
      onClick={() => setIsOpen(false)}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      <item.icon className="h-5 w-5" />
      {item.name}
    </NavLink>
  );

  return (
    <>
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
              <span className="text-xl font-bold text-primary">CIVOS</span>
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
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </NavLink>
              ))}

              {/* Subcontractor Navigation */}
              {hasPortalIdentity && (
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
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
                    {!isOfficeRole && (
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
                            <p className="mb-1 px-3 text-xs font-semibold uppercase text-muted-foreground">
                              {section}
                            </p>
                            {items.map(renderProjectNavLink)}
                          </div>
                        );
                      })
                    : filteredProjectNavigation.map(renderProjectNavLink)}
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
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
      <nav
        ref={navRef}
        className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-30 safe-area-inset-bottom ui-chrome"
      >
        <div className="flex justify-around items-center h-16">
          {/* Use subcontractor nav items if subcontractor */}
          {(isSubcontractor ? subcontractorBottomNavItems : bottomNavItems).map((item) => {
            // Skip items excluded by role
            if (!shouldShowItem(item)) return null;
            // Skip project-specific items if no project selected
            if (item.requiresProject && !projectId) return null;

            const href =
              item.requiresProject && projectId ? `/projects/${projectId}/${item.href}` : item.href;

            return (
              <NavLink
                key={item.name}
                to={href}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center w-full h-full gap-1 text-xs transition-colors',
                    isActive
                      ? isSubcontractor
                        ? 'text-brand'
                        : 'text-primary'
                      : 'text-muted-foreground',
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}

          {/* Menu opens the slide-out drawer so non-foreman users can reach the
              full project/global nav (Test Results, Documents, Reports, etc.)
              that does not fit in the bottom bar. Subcontractors keep their
              dedicated 3-tab bar, which already covers their navigation. */}
          {!isSubcontractor && (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              aria-label="Open menu"
              aria-expanded={isOpen}
              className="flex flex-col items-center justify-center w-full h-full gap-1 text-xs text-muted-foreground transition-colors"
            >
              <Menu className="h-5 w-5" />
              <span>Menu</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
