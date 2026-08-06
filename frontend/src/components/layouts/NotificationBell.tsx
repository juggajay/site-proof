import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { createMutationErrorHandler } from '@/lib/errorHandling';
import { queryKeys } from '@/lib/queryKeys';
import {
  GROUPED_NOTIFICATIONS_URL,
  formatRelativeTime,
  getSafeInternalPath,
  stripProjectEcho,
  unreadIdsIn,
  type GroupedNotificationsResponse,
  type NotificationGroup,
} from '@/lib/notificationGroups';

/**
 * Header bell: unread badge plus a dropdown of the triaged, repeat-collapsed
 * groups. The endpoint already returns needs-action groups first, so this
 * renders them in order and does not re-sort.
 *
 * Only the first few groups are shown — the bell is a glance, the full triage
 * lives on /notifications, which the footer link goes to.
 */
const BELL_GROUP_LIMIT = 6;

export function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // The badge keeps its own lightweight count query: every authenticated screen
  // renders the bell, and the count endpoint is far cheaper than the grouped
  // window. The dropdown's own query is what the panel renders.
  const { data: unreadCountData } = useQuery({
    queryKey: queryKeys.notificationUnreadCount,
    queryFn: () => apiFetch<{ count: number }>('/api/notifications/unread-count'),
    refetchInterval: 60000,
  });
  const unreadCount = unreadCountData?.count || 0;

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.notifications, 'grouped'],
    queryFn: () => apiFetch<GroupedNotificationsResponse>(GROUPED_NOTIFICATIONS_URL),
    // Only fetched once the dropdown is opened — this component mounts on every
    // authenticated screen.
    enabled: isOpen,
  });

  /** Marks EXACTLY the ids this group held when it was rendered. */
  const markReadMutation = useMutation({
    mutationFn: (notificationIds: string[]) =>
      Promise.all(
        notificationIds.map((id) => apiFetch(`/api/notifications/${id}/read`, { method: 'PUT' })),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationUnreadCount });
    },
    onError: createMutationErrorHandler('Failed to mark notification as read'),
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const groups = data?.groups ?? [];
  const visibleGroups = groups.slice(0, BELL_GROUP_LIMIT);

  const handleOpenGroup = (group: NotificationGroup) => {
    const latest = group.notifications[0];
    const unreadIds = unreadIdsIn(group);
    if (unreadIds.length > 0) {
      markReadMutation.mutate(unreadIds);
    }

    const safeLinkUrl = getSafeInternalPath(latest.linkUrl);
    setIsOpen(false);
    if (safeLinkUrl) {
      navigate(safeLinkUrl);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Notifications"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="relative rounded-full p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground touch-manipulation"
      >
        {/* The badge anchors to the ICON, not the 44px tap target. Anchored
            to the target it sat at the box's top-right — visually adrift
            between the bell and the next button, with the ping ring
            overflowing the header's top edge. */}
        <span className="relative flex">
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <>
              {/* Animated ping effect */}
              <span className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-destructive/60 animate-ping opacity-75" />
              {/* Badge with count — destructive token: an unread count is a
                  real signal the user needs to act on (INV-3). */}
              <span
                className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-destructive-foreground"
                data-testid="notification-badge"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </>
          )}
        </span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Recent notifications"
          className="absolute right-0 top-full z-50 mt-1 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border bg-card shadow-lg"
        >
          <div className="border-b px-4 py-2 text-sm font-semibold">Notifications</div>

          {isLoading ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p role="alert" className="p-4 text-center text-sm text-destructive">
              Notifications could not be loaded.
            </p>
          ) : visibleGroups.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">You are caught up.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y overflow-auto">
              {visibleGroups.map((group) => {
                const latest = group.notifications[0];
                const count = group.notifications.length;

                return (
                  <li key={group.key}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleOpenGroup(group)}
                      className={`block w-full px-4 py-3 text-left hover:bg-muted/60 ${
                        group.category === 'read' ? '' : 'bg-primary/5'
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        {group.category === 'needs_action' && (
                          <span
                            className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-destructive"
                            aria-hidden="true"
                          />
                        )}
                        <span className="min-w-0 flex-1 text-sm font-medium">
                          {stripProjectEcho(latest.title, latest.project?.name)}
                          {count > 1 && (
                            <span className="ml-2 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              ×{count}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {count > 1 ? 'latest ' : ''}
                        {formatRelativeTime(latest.createdAt)}
                        {latest.project ? ` · ${latest.project.name}` : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            to="/notifications"
            onClick={() => setIsOpen(false)}
            className="block border-t px-4 py-3 text-center text-sm font-medium text-primary hover:bg-muted/60"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
