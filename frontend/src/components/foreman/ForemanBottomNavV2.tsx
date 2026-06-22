// ForemanBottomNavV2 - Research-backed mobile navigation for foreman role
// 5 primary actions: Today, Issues, [Capture], Diary, Lots
// Camera button centered between 4 nav tabs
// Reference: docs/archive/2026-05-repo-hygiene/Foreman persona document (AU civil).md
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, ListChecks, AlertTriangle, BookOpen, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePublishBottomNavHeight } from '@/hooks/useBottomNavHeight';
import { apiFetch } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';

type NavTab = 'capture' | 'today' | 'issues' | 'diary' | 'lots';

interface NavItem {
  id: NavTab;
  label: string;
  icon: typeof Camera;
  getPath: (projectId: string) => string;
  isAction?: boolean; // For capture which opens modal instead of navigating
}

const navItems: NavItem[] = [
  {
    id: 'today',
    label: 'Today',
    icon: ListChecks,
    getPath: (projectId) => `/projects/${encodeURIComponent(projectId)}/foreman/today`,
  },
  {
    id: 'issues',
    label: 'Issues',
    icon: AlertTriangle,
    getPath: (projectId) => `/projects/${encodeURIComponent(projectId)}/ncr`,
  },
  {
    id: 'capture',
    label: 'Capture',
    icon: Camera,
    getPath: () => '', // Special handling - opens modal
    isAction: true,
  },
  {
    id: 'diary',
    label: 'Diary',
    icon: BookOpen,
    getPath: (projectId) => `/projects/${encodeURIComponent(projectId)}/diary`,
  },
  {
    id: 'lots',
    label: 'Lots',
    icon: MapPin,
    getPath: (projectId) => `/projects/${encodeURIComponent(projectId)}/lots`,
  },
];

interface ForemanBottomNavV2Props {
  onCapturePress: () => void;
  todayBadgeCount?: number; // If provided, skips internal fetch
}

export function ForemanBottomNavV2({
  onCapturePress,
  todayBadgeCount: externalBadgeCount,
}: ForemanBottomNavV2Props) {
  const { projectId: effectiveProjectId, hasNoProject } = useEffectiveProjectId();
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = usePublishBottomNavHeight<HTMLElement>();

  // Self-manage badge count when no external count provided
  const { data: badgeData } = useQuery({
    queryKey: queryKeys.foremanBadges(effectiveProjectId!),
    queryFn: () =>
      apiFetch<{ blocking?: unknown[]; dueToday?: unknown[] }>(
        `/api/dashboard/projects/${encodeURIComponent(effectiveProjectId!)}/foreman/today`,
      ),
    enabled: externalBadgeCount === undefined && !!effectiveProjectId,
    refetchInterval: 300_000, // 5 minutes
  });

  const internalBadgeCount = badgeData
    ? (badgeData.blocking?.length || 0) + (badgeData.dueToday?.length || 0)
    : 0;

  const todayBadgeCount = externalBadgeCount ?? internalBadgeCount;

  // Determine active tab from current path
  const getActiveTab = (): NavTab | null => {
    const path = location.pathname;
    if (path.includes('/foreman/today')) return 'today';
    if (path.includes('/ncr')) return 'issues';
    if (path.includes('/diary')) return 'diary';
    if (path.includes('/lots')) return 'lots';
    return null;
  };

  const activeTab = getActiveTab();

  const handleNavClick = (item: NavItem) => {
    if (item.isAction) {
      onCapturePress();
      return;
    }

    if (effectiveProjectId) {
      navigate(item.getPath(effectiveProjectId));
    }
  };

  return (
    // Offline/pending sync state is NOT duplicated here: the global
    // OfflineIndicator pill (anchored just above this nav via
    // usePublishBottomNavHeight + .above-bottom-nav) is the single
    // interactive sync surface — it shows the counts and offers
    // tap-to-sync / retry / conflict resolution.
    <nav
      ref={navRef}
      className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-30 pb-safe ui-chrome"
    >
      {/* No active project: keep the bar honest instead of silently inert */}
      {hasNoProject && (
        <div className="px-3 py-1.5 text-center text-xs font-medium bg-muted text-muted-foreground">
          Ask your site manager to add you to a project.
        </div>
      )}

      {/* Nav items */}
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isCapture = item.id === 'capture';
          const showBadge = item.id === 'today' && todayBadgeCount && todayBadgeCount > 0;

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              disabled={hasNoProject}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-1',
                'min-h-[48px] touch-manipulation',
                'transition-colors duration-150',
                'active:bg-muted/50',
                'disabled:opacity-40 disabled:active:bg-transparent',
                isCapture ? 'text-primary' : isActive ? 'text-primary' : 'text-muted-foreground',
              )}
              aria-label={item.label}
            >
              {isCapture ? (
                // Capture button - centered circle (the single amber brand signature)
                <div
                  className={cn(
                    'flex items-center justify-center w-12 h-12 rounded-full',
                    'bg-brand text-brand-foreground shadow-lg',
                    'active:scale-95 transition-transform',
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
              ) : (
                <>
                  <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                  <div className="flex items-center gap-1">
                    <span className={cn('text-xs', isActive && 'font-medium')}>{item.label}</span>
                    {showBadge && (
                      <span
                        className={cn(
                          'flex items-center justify-center',
                          'min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full',
                          'bg-destructive text-destructive-foreground',
                        )}
                      >
                        {todayBadgeCount > 9 ? '9+' : todayBadgeCount}
                      </span>
                    )}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default ForemanBottomNavV2;
