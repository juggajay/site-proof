/**
 * NotificationsPage — audit M62 (server-side unread filter + load-more pagination)
 * and M66 (wire the existing per-item DELETE /:id action).
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationsPage } from './NotificationsPage';

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

interface TestNotification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
  project?: null;
}

function buildNotification(overrides: Partial<TestNotification> = {}): TestNotification {
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
  it('shows a retry action after notifications fail to load', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce({
      notifications: [buildNotification({ title: 'Recovered notification' })],
      unreadCount: 1,
    });

    renderPage();

    expect(await screen.findByText('Notifications could not be loaded.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Recovered notification')).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it('M66: deletes a notification via DELETE /:id without navigating', async () => {
    apiFetchMock.mockImplementation((_path: string, options?: { method?: string }) => {
      if (options?.method === 'DELETE') {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({
        notifications: [buildNotification({ id: 'n1', isRead: true, linkUrl: '/lots/1' })],
        unreadCount: 0,
      });
    });

    renderPage();

    const row = await screen.findByText('A notification');
    const listItem = row.closest('li');
    expect(listItem).not.toBeNull();
    const deleteButton = within(listItem as HTMLElement).getByRole('button', {
      name: /delete notification/i,
    });
    await userEvent.click(deleteButton);

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
      if (options?.method === 'PUT') {
        return Promise.reject(new Error('mark read failed'));
      }
      return Promise.resolve({
        notifications: [
          buildNotification({ id: 'n1', isRead: false, linkUrl: '/projects/p1/hold-points' }),
        ],
        unreadCount: 1,
      });
    });

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /A notification/i }));

    expect(navigateMock).toHaveBeenCalledWith('/projects/p1/hold-points');
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/notifications/n1/read', {
        method: 'PUT',
      });
    });
  });

  it('M62: unread tab requests the server-side unreadOnly filter', async () => {
    apiFetchMock.mockResolvedValue({
      notifications: [buildNotification()],
      unreadCount: 1,
    });

    renderPage();
    await screen.findByText('A notification');

    await userEvent.click(screen.getByRole('button', { name: /^unread$/i }));

    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some(
          ([path]) => typeof path === 'string' && path.includes('unreadOnly=true'),
        ),
      ).toBe(true);
    });
  });

  it('M62: Load more requests the next page at offset=100', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) =>
      buildNotification({ id: `n${i}`, title: `Notification ${i}` }),
    );
    apiFetchMock.mockResolvedValue({ notifications: fullPage, unreadCount: 100 });

    renderPage();
    await screen.findByText('Notification 0');

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some(
          ([path]) => typeof path === 'string' && path.includes('offset=100'),
        ),
      ).toBe(true);
    });
  });

  it('keeps Load more available when a client-side filter has no matches on the loaded page', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) =>
      buildNotification({ id: `n${i}`, title: `General notification ${i}`, type: 'info' }),
    );
    apiFetchMock.mockResolvedValue({ notifications: fullPage, unreadCount: 100 });

    renderPage();
    await screen.findByText('General notification 0');

    await userEvent.click(screen.getByRole('button', { name: /@mentions/i }));

    expect(await screen.findByText('No notifications')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some(
          ([path]) => typeof path === 'string' && path.includes('offset=100'),
        ),
      ).toBe(true);
    });
  });
});
