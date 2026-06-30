import { expect, test, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

async function mockDocumentationShellApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
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

    if (url.pathname === '/api/notifications/unread-count') {
      await json({ count: 0 });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await json({ notifications: [], unreadCount: 0 });
      return;
    }

    if (url.pathname === '/api/projects') {
      await json({
        projects: [
          {
            id: E2E_PROJECT_ID,
            name: 'E2E Highway Upgrade',
            projectNumber: 'E2E-001',
            status: 'active',
          },
        ],
      });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);
}

test.describe('Public and compatibility routes', () => {
  test('renders logged-out marketing and legal routes', async ({ page }) => {
    const routes = [
      {
        path: '/',
        heading: 'Every lot. Every ITP. Every docket. One answer: claim-ready or not.',
      },
      {
        path: '/landing',
        heading: 'Every lot. Every ITP. Every docket. One answer: claim-ready or not.',
      },
      { path: '/privacy-policy', heading: 'Privacy Policy' },
      { path: '/terms-of-service', heading: 'Terms of Service' },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
      await expect(page.getByText('Page Not Found')).toHaveCount(0);
    }
  });

  test('redirects authenticated /documentation requests to /docs', async ({ page }) => {
    await mockDocumentationShellApi(page);

    await page.goto('/documentation');

    await expect(page).toHaveURL('/docs');
    await expect(
      page.getByRole('heading', { name: 'User guide and workflow reference' }),
    ).toBeVisible();
  });

  test('renders the short accept-invite alias with invitation context', async ({ page }) => {
    await page.route('**/api/subcontractors/invitation/invite-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          invitation: {
            id: 'invite-1',
            companyName: 'QA Civil Pty Ltd',
            projectName: 'North Road Upgrade',
            headContractorName: 'Head Contractor Co',
            primaryContactEmail: 'invitee@example.com',
            primaryContactName: 'Invitee Tester',
            status: 'pending_approval',
          },
        }),
      });
    });

    await page.goto('/accept-invite?id=invite-1');

    await expect(page.getByText('QA Civil Pty Ltd')).toBeVisible();
    await expect(page.getByText('North Road Upgrade')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
  });
});
