/**
 * Header bell — unread badge, and the dropdown over the grouped endpoint that
 * shows needs-action groups first with repeats collapsed.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationBell } from './NotificationBell';
import type {
  GroupedNotificationsResponse,
  Notification,
  NotificationGroup,
  TriageCategory,
} from '@/lib/notificationGroups';

const apiFetchMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

function buildNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    type: 'info',
    title: 'A notification',
    message: 'Body',
    linkUrl: null,
    isRead: false,
    createdAt: new Date().toISOString(),
    project: null,
    ...overrides,
  };
}

function buildGroup(category: TriageCategory, notifications: Notification[]): NotificationGroup {
  return {
    key: `${category}-${notifications[0].id}`,
    type: notifications[0].type,
    category,
    notifications,
  };
}

/** The endpoint returns needs-action first; these fixtures keep that order. */
function mockApis(groups: NotificationGroup[]) {
  const unreadCount = groups
    .filter((group) => group.category !== 'read')
    .reduce((total, group) => total + group.notifications.length, 0);

  const grouped: GroupedNotificationsResponse = {
    groups,
    unreadCount,
    windowSize: 200,
    truncated: false,
  };

  apiFetchMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (options?.method === 'PUT') return Promise.resolve({ success: true });
    if (path === '/api/notifications/unread-count') return Promise.resolve({ count: unreadCount });
    if (path === '/api/notifications/grouped') return Promise.resolve(grouped);
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });

  return grouped;
}

function renderBell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
  navigateMock.mockReset();
});

describe('NotificationBell', () => {
  it('shows the unread badge without opening the dropdown', async () => {
    mockApis([buildGroup('needs_action', [buildNotification()])]);

    renderBell();

    expect(await screen.findByTestId('notification-badge')).toHaveTextContent('1');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // The grouped window is only fetched once the panel is opened.
    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/notifications/grouped');
  });

  it('caps the badge at 9+', async () => {
    mockApis([
      buildGroup(
        'needs_action',
        Array.from({ length: 12 }, (_, index) => buildNotification({ id: `n${index}` })),
      ),
    ]);

    renderBell();

    expect(await screen.findByTestId('notification-badge')).toHaveTextContent('9+');
  });

  it('lists needs-action groups before FYI and read', async () => {
    mockApis([
      buildGroup('needs_action', [
        buildNotification({ id: 'a', title: 'Approve this docket', type: 'docket_pending' }),
      ]),
      buildGroup('fyi', [buildNotification({ id: 'f', title: 'Claim paid', type: 'claim_paid' })]),
      buildGroup('read', [buildNotification({ id: 'r', title: 'Old news', isRead: true })]),
    ]);

    renderBell();
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    const items = await screen.findAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Approve this docket'),
      expect.stringContaining('Claim paid'),
      expect.stringContaining('Old news'),
    ]);
  });

  it('collapses repeats into one row with a count', async () => {
    mockApis([
      buildGroup(
        'needs_action',
        ['a', 'b', 'c', 'd', 'e'].map((id) =>
          buildNotification({ id, title: 'ESCALATED: Missing Daily Diary' }),
        ),
      ),
    ]);

    renderBell();
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    const items = await screen.findAllByRole('menuitem');
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText('×5')).toBeInTheDocument();
    expect(within(items[0]).getByText(/^latest /)).toBeInTheDocument();
  });

  it('marks exactly the group members read and navigates to the latest link', async () => {
    mockApis([
      buildGroup(
        'needs_action',
        ['a', 'b'].map((id) =>
          buildNotification({
            id,
            title: 'Hold point escalation',
            linkUrl: '/projects/p1/hold-points',
          }),
        ),
      ),
    ]);

    renderBell();
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Hold point escalation/i }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/projects/p1/hold-points');
    });

    const readCalls = apiFetchMock.mock.calls.filter(
      ([, options]) => (options as { method?: string } | undefined)?.method === 'PUT',
    );
    expect(readCalls.map(([path]) => path).sort()).toEqual([
      '/api/notifications/a/read',
      '/api/notifications/b/read',
    ]);
  });

  it('does not navigate to an unsafe notification link', async () => {
    mockApis([
      buildGroup('needs_action', [
        buildNotification({ id: 'x', title: 'External destination', linkUrl: '//evil.example' }),
      ]),
    ]);

    renderBell();
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /External destination/i }));

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('agrees with the badge on how many notifications are unread', async () => {
    const grouped = mockApis([
      buildGroup('needs_action', [buildNotification({ id: 'a' })]),
      buildGroup('fyi', [buildNotification({ id: 'b' }), buildNotification({ id: 'c' })]),
      buildGroup('read', [buildNotification({ id: 'd', isRead: true })]),
    ]);

    renderBell();

    expect(await screen.findByTestId('notification-badge')).toHaveTextContent('3');
    expect(grouped.unreadCount).toBe(3);
  });

  it('keeps a route to the full notifications page and closes on Escape', async () => {
    mockApis([buildGroup('needs_action', [buildNotification()])]);

    renderBell();
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    const viewAll = await screen.findByRole('link', { name: /view all notifications/i });
    expect(viewAll).toHaveAttribute('href', '/notifications');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });
});
