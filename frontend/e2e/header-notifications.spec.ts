import { expect, test, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const project = {
  id: E2E_PROJECT_ID,
  name: 'E2E Highway Upgrade',
  projectNumber: 'E2E-001',
  status: 'active',
};

const dashboard = {
  project: {
    ...project,
    client: 'Transport NSW',
    state: 'NSW',
  },
  stats: {
    lots: { total: 1, completed: 0, inProgress: 1, notStarted: 0, onHold: 0, progressPct: 0 },
    ncrs: { open: 1, total: 1, overdue: 1, major: 1, minor: 0, observation: 0 },
    holdPoints: { pending: 0, released: 0 },
    itps: { pending: 0, completed: 0 },
    dockets: { pendingApproval: 0 },
    tests: { total: 0 },
    documents: { total: 0 },
    diary: { todayStatus: 'draft' },
  },
  attentionItems: [],
  recentActivity: [],
};

const emailPreferences = {
  enabled: true,
  mentions: true,
  mentionsTiming: 'immediate',
  ncrAssigned: true,
  ncrAssignedTiming: 'immediate',
  ncrStatusChange: true,
  ncrStatusChangeTiming: 'immediate',
  holdPointReminder: true,
  holdPointReminderTiming: 'immediate',
  holdPointRelease: true,
  holdPointReleaseTiming: 'immediate',
  commentReply: true,
  commentReplyTiming: 'immediate',
  scheduledReports: true,
  scheduledReportsTiming: 'immediate',
  dailyDigest: false,
  diaryReminder: true,
  diaryReminderTiming: 'immediate',
};

async function mockHeaderApis(page: Page) {
  const notifications = [
    {
      id: 'alert-1',
      type: 'alert_overdue_ncr',
      title: 'Overdue NCR',
      message: 'NCR response is overdue',
      linkUrl: `/projects/${E2E_PROJECT_ID}/ncr?ncr=ncr-1`,
      isRead: false,
      createdAt: '2026-05-01T00:00:00.000Z',
      project,
    },
    {
      id: 'mention-1',
      type: 'mention',
      title: 'Mentioned in a comment',
      message: 'Please review this comment',
      linkUrl: `/projects/${E2E_PROJECT_ID}/lots/lot-1?tab=comments`,
      isRead: false,
      createdAt: 'not-a-date',
      project,
    },
    {
      id: 'external-1',
      type: 'info',
      title: 'External destination',
      message: 'This link should not navigate',
      linkUrl: 'https://example.invalid/phish',
      isRead: false,
      createdAt: '2026-05-01T00:00:00.000Z',
      project,
    },
  ];

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: E2E_ADMIN_USER });
      return;
    }

    if (url.pathname === '/api/projects') {
      await json({ projects: [project] });
      return;
    }

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}/dashboard`) {
      await json(dashboard);
      return;
    }

    if (url.pathname === '/api/notifications' && method === 'GET') {
      await json({
        notifications,
        unreadCount: notifications.filter((notification) => !notification.isRead).length,
      });
      return;
    }

    const readMatch = /^\/api\/notifications\/([^/]+)\/read$/.exec(url.pathname);
    if (readMatch && method === 'PUT') {
      const notification = notifications.find((item) => item.id === readMatch[1]);
      if (notification) {
        notification.isRead = true;
        await json({ notification });
        return;
      }
      await json({ message: 'Not found' }, 404);
      return;
    }

    if (url.pathname === '/api/notifications/read-all' && method === 'PUT') {
      notifications.forEach((notification) => {
        notification.isRead = true;
      });
      await json({ success: true });
      return;
    }

    if (url.pathname === '/api/notifications/email-preferences') {
      await json({ preferences: emailPreferences });
      return;
    }

    if (url.pathname === '/api/mfa/status') {
      await json({ mfaEnabled: false });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, E2E_ADMIN_USER);
}

test.describe('Header notifications', () => {
  test('filters alert notifications and routes footer to settings', async ({ page }) => {
    await mockHeaderApis(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}`);
    await page.getByRole('button', { name: 'Notifications' }).click();

    await page.getByRole('button', { name: 'Alerts' }).click();
    await expect(page.getByRole('button', { name: /Overdue NCR/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mentioned in a comment/ })).toBeHidden();
    await expect(page.getByText('View all notifications')).toBeHidden();

    await page.getByRole('button', { name: 'Notification settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('does not navigate unsafe notification links', async ({ page }) => {
    await mockHeaderApis(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}`);
    await page.getByRole('button', { name: 'Notifications' }).click();
    await page.getByRole('button', { name: /External destination/ }).click();

    await expect(page).toHaveURL(new RegExp(`/projects/${E2E_PROJECT_ID}$`));
  });
});
