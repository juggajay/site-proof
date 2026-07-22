import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LogOut,
  UserCircle,
  Settings,
  Building2,
  ClipboardList,
  BookOpen,
  HelpCircle,
  Compass,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { isAdminRole, isSubcontractorRole } from '@/lib/roles';
import {
  getCompanyRole,
  getProjectScopedRole,
  hasSubcontractorPortalIdentity,
} from '@/lib/subcontractorIdentity';
import { useTheme } from '@/lib/theme';
import { startOnboardingTour, useOnboarding } from '@/components/OnboardingTour';
import { useUnsyncedSignOut } from '@/components/UnsyncedSignOutDialog';

/**
 * The user identity menu: avatar trigger + popover with theme, Profile, the
 * relocated utility destinations (Settings / Company Settings / Audit Log /
 * Documentation / Help & Support), and Sign out. Rendered in two chrome
 * surfaces from a single source of truth:
 *   - `variant="sidebar"` — bottom-left of the desktop sidebar (md+), the
 *     Linear/Slack identity slot; the popover drops UP. When the sidebar is
 *     collapsed it shows the avatar only and the popover may overflow right.
 *   - `variant="header"` — the top-right avatar, kept only below md (the
 *     sidebar is hidden there and MobileNav has no Profile/Sign out); drops DOWN.
 *
 * Gating mirrors the old Sidebar utility cluster exactly.
 */
interface UserMenuProps {
  variant: 'header' | 'sidebar';
  /** Sidebar collapsed (w-16): avatar only, name hidden. */
  collapsed?: boolean;
  className?: string;
}

export function UserMenu({ variant, collapsed = false, className }: UserMenuProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { setTheme, resolvedTheme } = useTheme();
  const { resetOnboarding } = useOnboarding();
  const { requestSignOut, dialog: signOutDialog } = useUnsyncedSignOut();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Project detail for the current context — same query key as Sidebar, so this
  // shares the cache (no extra request). Drives the utility gates below.
  const { data: projectData } = useQuery({
    queryKey: queryKeys.projectModules(projectId!),
    queryFn: () =>
      apiFetch<{ project?: { currentUserRole?: string | null } }>(`/api/projects/${projectId}`),
    enabled: !!projectId,
  });

  // Gating mirrors Sidebar.tsx faithfully — keep in sync. Settings hides for
  // subcontractors, Company Settings needs company admin, Audit Log needs admin
  // OR a project-scoped PM/QM.
  const companyRole = getCompanyRole(user);
  const projectScopedRole = projectId
    ? (projectData?.project?.currentUserRole ?? 'viewer')
    : getProjectScopedRole(user);
  const isSubcontractor = isSubcontractorRole(companyRole) || hasSubcontractorPortalIdentity(user);
  const hasAdmin = isAdminRole(companyRole);
  const hasAuditLogAccess =
    hasAdmin || projectScopedRole === 'project_manager' || projectScopedRole === 'quality_manager';
  // Mirrors the ProtectedAppShell tour audience gate: subcontractors get no
  // tour entry point (the tour walks the company-side app).
  const canTakeTour = Boolean(user?.companyId) && !isSubcontractor;

  // Close on outside click + Escape; return focus to the trigger on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const go = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleSignOut = () => {
    setIsOpen(false);
    // Warn before wiping unsynced offline work, then navigate to login.
    void requestSignOut(() => navigate('/login', { replace: true }));
  };

  const displayName = user?.name || user?.fullName || user?.email?.split('@')[0] || 'User';
  const initial = (user?.fullName || user?.name || user?.email || 'U').charAt(0).toUpperCase();

  const avatar = user?.avatarUrl ? (
    <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
  ) : (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <span className="text-sm font-semibold" aria-hidden="true">
        {initial}
      </span>
    </div>
  );

  const rowClass = 'flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {variant === 'sidebar' ? (
        <button
          ref={triggerRef}
          onClick={() => setIsOpen((open) => !open)}
          className={cn(
            'flex w-full items-center rounded-lg py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            collapsed ? 'justify-center px-2' : 'gap-3 px-3',
          )}
          aria-label="User menu"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          title={collapsed ? displayName : undefined}
        >
          {avatar}
          {!collapsed && <span className="truncate">{displayName}</span>}
        </button>
      ) : (
        <button
          ref={triggerRef}
          onClick={() => setIsOpen((open) => !open)}
          className="rounded-lg p-1 hover:bg-muted"
          aria-label="User menu"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          {avatar}
        </button>
      )}

      {isOpen && (
        <div
          className={cn(
            'absolute z-50 min-w-[200px] rounded-lg border bg-card shadow-lg',
            // Sidebar popover drops up; header popover drops down.
            variant === 'sidebar' ? 'bottom-full left-0 mb-1' : 'right-0 top-full mt-1',
          )}
          role="menu"
        >
          <div className="border-b px-4 py-3">
            <p className="text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>

          {/* Me: theme, profile, tour */}
          <div className="p-1">
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className={rowClass}
              role="menuitem"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
              {resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            </button>
            <button onClick={() => go('/profile')} className={rowClass} role="menuitem">
              <UserCircle className="h-4 w-4" aria-hidden="true" />
              Profile
            </button>
            {canTakeTour && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  resetOnboarding();
                  startOnboardingTour();
                }}
                className={rowClass}
                role="menuitem"
              >
                <Compass className="h-4 w-4" aria-hidden="true" />
                Take the tour
              </button>
            )}
          </div>

          {/* System settings — group hidden entirely for subcontractors
              (Settings excluded, and they can't be admin). */}
          {!isSubcontractor && (
            <div className="border-t p-1">
              <button onClick={() => go('/settings')} className={rowClass} role="menuitem">
                <Settings className="h-4 w-4" aria-hidden="true" />
                Settings
              </button>
              {hasAdmin && (
                <button
                  onClick={() => go('/company-settings')}
                  className={rowClass}
                  role="menuitem"
                >
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                  Company Settings
                </button>
              )}
              {hasAuditLogAccess && (
                <button onClick={() => go('/audit-log')} className={rowClass} role="menuitem">
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  Audit Log
                </button>
              )}
            </div>
          )}

          {/* Help — always available */}
          <div className="border-t p-1">
            <button onClick={() => go('/docs')} className={rowClass} role="menuitem">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Documentation
            </button>
            <button onClick={() => go('/support')} className={rowClass} role="menuitem">
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
              Help & Support
            </button>
          </div>

          <div className="border-t p-1">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}
      {signOutDialog}
    </div>
  );
}
