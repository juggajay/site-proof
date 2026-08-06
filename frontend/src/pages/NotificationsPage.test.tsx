/**
 * NotificationsPage — triage sections (Needs action / FYI / Read) over the
 * grouped endpoint, collapsed repeat rows, and the per-item DELETE action
 * (audit M66) that survived the rewrite.
 *
 * The page reads GET /api/notifications/grouped. The old flat list endpoint is
 * untouched and is covered on the backend by a characterization test.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationsPage } from './NotificationsPage';
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

function buildGroup(
  category: TriageCategory,
  notifications: Notification[],
  overrides: Partial<NotificationGroup> = {},
): NotificationGroup {
  return {
    key: `${category}-${notifications[0].id}`,
    type: notifications[0].type,
    category,
    notifications,
    ...overrides,
  };
}

function buildResponse(
  groups: NotificationGroup[],
  overrides: Partial<GroupedNotificationsResponse> = {},
): GroupedNotificationsResponse {
  const unreadCount = groups
    .filter((group) => group.category !== 'read')
    .reduce((total, group) => total + group.notifications.length, 0);

  return { groups, unreadCount, windowSize: 200, truncated: false, ...overrides };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
  navigateMock.mockReset();
});

describe('NotificationsPage', () => {
  it('reads the grouped endpoint, not the flat list endpoint', async () => {
    apiFetchMock.mockResolvedValue(buildResponse([buildGroup('fyi', [buildNotification()])]));

    renderPage();
    await screen.findByText('A notification');

    expect(apiFetchMock).toHaveBeenCalledWith('/api/notifications/grouped');
  });

  it('shows a retry action after notifications fail to load', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(
        buildResponse([
          buildGroup('fyi', [buildNotification({ title: 'Recovered notification' })]),
        ]),
      );

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Notifications could not be loaded.',
    );
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Recovered notification')).toBeInTheDocument();
  });

  it('splits notifications into Needs action, FYI and Read sections in that order', async () => {
    apiFetchMock.mockResolvedValue(
      buildResponse([
        buildGroup('needs_action', [
          buildNotification({ id: 'a', title: 'Approve this docket', type: 'docket_pending' }),
        ]),
        buildGroup('fyi', [
          buildNotification({ id: 'f', title: 'Claim paid', type: 'claim_paid' }),
        ]),
        buildGroup('read', [buildNotification({ id: 'r', title: 'Old news', isRead: true })]),
      ]),
    );

    renderPage();
    await screen.findByText('Approve this docket');

    const sections = screen.getAllByRole('region', { hidden: true });
    expect(sections.map((section) => section.getAttribute('aria-label'))).toEqual([
      'Needs action',
      'FYI',
      'Read',
    ]);

    // The third bucket is READ, never "Actioned"/"Done" — marking read is not
    // evidence the work happened.
    expect(screen.queryByText(/Actioned/)).not.toBeInTheDocument();
    expect(within(sections[2]).getByText('Old news')).toBeInTheDocument();
  });

  it('collapses a repeat group into one row with a count and expands on demand', async () => {
    const members = [3, 2, 1].map((day) =>
      buildNotification({
        id: `hp${day}`,
        title: 'Hold point escalation',
        type: 'hold_point_escalation',
        message: `Escalation ${day}`,
        createdAt: new Date(`2026-08-0${day}T00:00:00.000Z`).toISOString(),
      }),
    );
    apiFetchMock.mockResolvedValue(buildResponse([buildGroup('needs_action', members)]));

    renderPage();

    expect(await screen.findByText('Hold point escalation')).toBeInTheDocument();
    expect(screen.getByText('×3')).toBeInTheDocument();
    // Only the summary row until expanded.
    expect(screen.queryByText(/Escalation 1$/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /show all 3/i }));

    expect(screen.getByText(/Escalation 1/)).toBeInTheDocument();
    expect(screen.getByText(/Escalation 2/)).toBeInTheDocument();
    // The newest member also appears as the collapsed row's own message.
    expect(screen.getAllByText(/Escalation 3/).length).toBeGreaterThanOrEqual(1);
  });

  it('marks exactly the ids the group held, and not a newer arrival', async () => {
    const members = ['a', 'b'].map((id) =>
      buildNotification({
        id,
        title: 'Hold point escalation',
        linkUrl: '/projects/p1/hold-points',
      }),
    );
    apiFetchMock.mockImplementation((_path: string, options?: { method?: string }) => {
      if (options?.method === 'PUT') return Promise.resolve({ success: true });
      return Promise.resolve(buildResponse([buildGroup('needs_action', members)]));
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Hold point escalation/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/notifications/a/read', { method: 'PUT' });
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/notifications/b/read', { method: 'PUT' });

    // Exactly the rendered members — no bulk "mark everything of this type"
    // call that could swallow a notification that arrived after render.
    const readCalls = apiFetchMock.mock.calls.filter(
      ([, options]) => (options as { method?: string } | undefined)?.method === 'PUT',
    );
    expect(readCalls.map(([path]) => path).sort()).toEqual([
      '/api/notifications/a/read',
      '/api/notifications/b/read',
    ]);
    expect(readCalls.some(([path]) => String(path).includes('read-all'))).toBe(false);
  });

  it('M66: deletes a notification via DELETE /:id without navigating', async () => {
    apiFetchMock.mockImplementation((_path: string, options?: { method?: string }) => {
      if (options?.method === 'DELETE') return Promise.resolve({ success: true });
      return Promise.resolve(
        buildResponse([
          buildGroup('read', [buildNotification({ id: 'n1', isRead: true, linkUrl: '/lots/1' })]),
        ]),
      );
    });

    renderPage();

    const row = await screen.findByText('A notification');
    const listItem = row.closest('li');
    expect(listItem).not.toBeNull();
    await userEvent.click(
      within(listItem as HTMLElement).getByRole('button', { name: /delete notification/i }),
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/notifications/n1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('opens a notification link even when marking it as read fails', async () => {
    apiFetchMock.mockImplementation((_path: string, options?: { method?: string }) => {
      if (options?.method === 'PUT') return Promise.reject(new Error('mark read failed'));
      return Promise.resolve(
        buildResponse([
          buildGroup('needs_action', [
            buildNotification({ id: 'n1', linkUrl: '/projects/p1/hold-points' }),
          ]),
        ]),
      );
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /A notification/i }));

    expect(navigateMock).toHaveBeenCalledWith('/projects/p1/hold-points');
  });

  it('does not navigate to notification links containing control characters', async () => {
    apiFetchMock.mockImplementation((_path: string, options?: { method?: string }) => {
      if (options?.method === 'PUT') return Promise.resolve({ success: true });
      return Promise.resolve(
        buildResponse([
          buildGroup('needs_action', [
            buildNotification({ id: 'n1', linkUrl: '/projects/p1\n/hold-points' }),
          ]),
        ]),
      );
    });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /A notification/i }));

    expect(navigateMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/notifications/n1/read', { method: 'PUT' });
    });
  });

  it('says the view is windowed rather than pretending it is complete', async () => {
    apiFetchMock.mockResolvedValue(
      buildResponse([buildGroup('fyi', [buildNotification()])], { truncated: true }),
    );

    renderPage();
    await screen.findByText('A notification');

    expect(screen.getByText(/Showing recent notifications \(latest 200\)/)).toBeInTheDocument();
  });

  it('drops the project name the title echoes from the meta line', async () => {
    const project = { id: 'p1', name: 'Demo Walkthrough 2026', projectNumber: 'PRJ-DEMO-001' };
    apiFetchMock.mockResolvedValue(
      buildResponse([
        buildGroup('needs_action', [
          buildNotification({
            id: 'echo',
            title: 'ESCALATED: Missing Daily Diary: Demo Walkthrough 2026',
            project,
          }),
        ]),
        buildGroup('fyi', [
          buildNotification({ id: 'no-echo', title: 'Hold Point Released', project }),
        ]),
      ]),
    );

    renderPage();

    expect(await screen.findByText('ESCALATED: Missing Daily Diary')).toBeInTheDocument();
    expect(screen.getByText('Hold Point Released')).toBeInTheDocument();
    expect(screen.getAllByText(/Demo Walkthrough 2026 · PRJ-DEMO-001/)).toHaveLength(2);
  });

  it('filters groups and exposes the selected filter to assistive technology', async () => {
    apiFetchMock.mockResolvedValue(
      buildResponse([
        buildGroup('needs_action', [
          buildNotification({ id: 'm', type: 'mention', title: 'Mentioned in a comment' }),
        ]),
        buildGroup('fyi', [
          buildNotification({ id: 'c', type: 'claim_paid', title: 'Claim paid' }),
        ]),
      ]),
    );

    renderPage();
    await screen.findByText('Mentioned in a comment');

    expect(screen.getByRole('button', { name: /^all$/i })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: /@mentions/i }));

    expect(screen.getByText('Mentioned in a comment')).toBeInTheDocument();
    expect(screen.queryByText('Claim paid')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /@mentions/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
