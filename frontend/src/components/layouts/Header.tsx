import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import {
  Bell,
  LogOut,
  ChevronDown,
  FolderKanban,
  Settings,
  UserCircle,
  Search,
  Sparkles,
  Sun,
  Moon,
  BookOpen,
  Compass,
} from 'lucide-react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { isSubcontractorRole } from '@/lib/roles';
import { getCompanyRole, hasSubcontractorPortalIdentity } from '@/lib/subcontractorIdentity';
import { Breadcrumbs } from './Breadcrumbs';
import { GlobalSearch } from '@/components/GlobalSearch';
import { useClancyEnabled } from '@/components/copilot/clancyAccess';
import { toggleClancy, useClancyStore } from '@/components/copilot/clancyChatState';
import { startOnboardingTour, useOnboarding } from '@/components/OnboardingTour';
import { useUnsyncedSignOut } from '@/components/UnsyncedSignOutDialog';
import { useTheme } from '@/lib/theme';
import { Input } from '@/components/ui/input';
import { buildProjectSwitchPath } from './projectSwitchPath';

interface Project {
  id: string;
  name: string;
  projectNumber: string;
}

export function Header() {
  const { user } = useAuth();
  const { resetOnboarding } = useOnboarding();
  const { requestSignOut, dialog: signOutDialog } = useUnsyncedSignOut();
  // Mirrors the ProtectedAppShell tour audience gate: subcontractor portal
  // users get no tour entry point (the tour walks the company-side app).
  const canTakeTour =
    Boolean(user?.companyId) &&
    !isSubcontractorRole(getCompanyRole(user)) &&
    !hasSubcontractorPortalIdentity(user);
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const { setTheme, resolvedTheme } = useTheme();
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const projectSelectorRef = useRef<HTMLDivElement>(null);
  const projectSearchInputRef = useRef<HTMLInputElement>(null);

  // User menu state
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Global search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Clancy copilot entry point — gated to office roles + AI configured.
  const clancyEnabled = useClancyEnabled();
  const { open: clancyOpen, unseen: clancyUnseen } = useClancyStore();

  // Fetch user's projects via TanStack Query
  const { data: projectsData } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => apiFetch<{ projects: Project[] }>('/api/projects'),
  });
  const projects = projectsData?.projects || [];

  // Fetch notification badge count with polling (every 60 seconds)
  const { data: unreadCountData } = useQuery({
    queryKey: queryKeys.notificationUnreadCount,
    queryFn: () => apiFetch<{ count: number }>('/api/notifications/unread-count'),
    refetchInterval: 60000,
  });
  const unreadCount = unreadCountData?.count || 0;

  // Find the current project from the list
  const currentProject = projects.find((p) => p.id === projectId);

  // Filter projects by search term
  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(projectSearchTerm.toLowerCase()) ||
      p.projectNumber.toLowerCase().includes(projectSearchTerm.toLowerCase()),
  );

  // Focus search input when project selector opens and reset search when closing
  useEffect(() => {
    if (isProjectSelectorOpen) {
      setTimeout(() => projectSearchInputRef.current?.focus(), 100);
    } else {
      setProjectSearchTerm('');
    }
  }, [isProjectSelectorOpen]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        projectSelectorRef.current &&
        !projectSelectorRef.current.contains(event.target as Node)
      ) {
        setIsProjectSelectorOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdowns on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProjectSelectorOpen(false);
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Cmd+K keyboard shortcut for global search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSignOut = async () => {
    // Manual sign-out: warn before wiping unsynced offline work, then navigate.
    await requestSignOut(() => navigate('/login', { replace: true }));
  };

  const handleProjectSelect = (project: Project) => {
    setIsProjectSelectorOpen(false);
    navigate(buildProjectSwitchPath(location.pathname, projectId, project.id));
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-2">
        {/* Quick Search Button */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-xs font-medium">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>

        {/* Project Selector - only show when in a project context */}
        {projectId && projects.length > 0 && (
          <div ref={projectSelectorRef} className="relative">
            <button
              onClick={() => setIsProjectSelectorOpen(!isProjectSelectorOpen)}
              className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm hover:bg-muted"
              aria-label="Select project"
              aria-expanded={isProjectSelectorOpen}
              aria-haspopup="listbox"
            >
              <FolderKanban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="max-w-[150px] truncate font-medium">
                {currentProject?.name || 'Select Project'}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${isProjectSelectorOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            <div
              className={`absolute right-0 top-full z-50 mt-1 min-w-[260px] rounded-lg border bg-card shadow-lg transition-all duration-200 origin-top-right ${
                isProjectSelectorOpen
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
              }`}
            >
              <div className="p-2">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Switch Project
                </div>
                {/* Search input */}
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={projectSearchInputRef}
                    type="text"
                    placeholder="Search projects..."
                    value={projectSearchTerm}
                    onChange={(e) => setProjectSearchTerm(e.target.value)}
                    className="pl-8"
                    aria-label="Search projects"
                  />
                </div>
                <ul role="listbox" className="max-h-[300px] overflow-auto">
                  {filteredProjects.length === 0 ? (
                    <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                      No projects found
                    </li>
                  ) : (
                    filteredProjects.map((project) => (
                      <li key={project.id}>
                        <button
                          onClick={() => handleProjectSelect(project)}
                          className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted ${
                            project.id === projectId ? 'bg-primary/10 text-primary' : ''
                          }`}
                          role="option"
                          aria-selected={project.id === projectId}
                        >
                          <FolderKanban className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{project.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {project.projectNumber}
                            </div>
                          </div>
                          {project.id === projectId && (
                            <span className="ml-auto text-xs text-primary">Current</span>
                          )}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Ask Clancy — copilot entry, styled to match the search button */}
        {clancyEnabled && (
          <button
            id="clancy-header-button"
            type="button"
            onClick={() => toggleClancy()}
            className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Ask Clancy (⌘J)"
            aria-label="Ask Clancy (⌘J)"
            aria-expanded={clancyOpen}
          >
            <span className="relative flex">
              <Sparkles className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
              {clancyUnseen && !clancyOpen && (
                <span
                  className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-[#2563EB]"
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="hidden md:inline">Ask Clancy</span>
          </button>
        )}

        {/* Notification Bell */}
        <div className="relative">
          <Link
            to="/notifications"
            className="relative rounded-full p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground touch-manipulation"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {unreadCount > 0 && (
              <>
                {/* Animated ping effect */}
                <span className="absolute -right-0.5 -top-0.5 h-5 w-5 rounded-full bg-destructive/60 animate-ping opacity-75" />
                {/* Badge with count — destructive token: an unread count is a
                    real signal the user needs to act on (INV-3). */}
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-medium text-destructive-foreground"
                  data-testid="notification-badge"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </>
            )}
          </Link>
        </div>
        {/* User Profile Menu */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="rounded-lg p-1 hover:bg-muted"
            aria-label="User menu"
            aria-expanded={isUserMenuOpen}
            aria-haspopup="menu"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-sm font-semibold" aria-hidden="true">
                  {(user?.fullName || user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border bg-card shadow-lg">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-medium">{user?.name || user?.email?.split('@')[0]}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <div className="p-1">
                <button
                  onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted"
                  role="menuitem"
                >
                  {resolvedTheme === 'dark' ? (
                    <Sun className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Moon className="h-4 w-4" aria-hidden="true" />
                  )}
                  {resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                </button>
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/profile');
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted"
                  role="menuitem"
                >
                  <UserCircle className="h-4 w-4" aria-hidden="true" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/docs');
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted"
                  role="menuitem"
                >
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  Documentation
                </button>
                {canTakeTour && (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      resetOnboarding();
                      startOnboardingTour();
                    }}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted"
                    role="menuitem"
                  >
                    <Compass className="h-4 w-4" aria-hidden="true" />
                    Take the tour
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/settings');
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted"
                  role="menuitem"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  Settings
                </button>
              </div>
              <div className="border-t p-1">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    handleSignOut();
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Search Modal */}
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Confirm dialog shown when signing out would discard unsynced offline work */}
      {signOutDialog}
    </header>
  );
}
