import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

async function mockDocumentationApi(page: Page) {
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

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}`) {
      await json({
        project: {
          id: E2E_PROJECT_ID,
          name: 'E2E Highway Upgrade',
          projectNumber: 'E2E-001',
          status: 'active',
          settings: {},
        },
      });
      return;
    }

    if (url.pathname === '/api/support/contact') {
      await json({
        email: 'helpdesk@example.com',
        phone: null,
        phoneLabel: null,
        emergencyPhone: null,
        address: null,
        hours: 'Mon-Fri, 7am-7pm AEST',
        responseTime: {
          critical: 'Within 1 hour',
          standard: 'Same business day',
          general: 'Within 2 business days',
        },
      });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);
}

test.describe('Documentation', () => {
  test('renders first-party workflow documentation', async ({ page }) => {
    await mockDocumentationApi(page);

    await page.goto('/docs');

    await expect(
      page.getByRole('heading', { name: 'User guide and workflow reference' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Projects and lots' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Evidence Readiness' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Subcontractor portal and dockets' }),
    ).toBeVisible();
    await expect(page.getByText('Blockers stop the action.')).toBeVisible();
  });

  test('links support documentation card to the in-app docs route', async ({ page }) => {
    await mockDocumentationApi(page);

    await page.goto('/support');

    const documentationLink = page
      .locator('main')
      .getByRole('link', { name: /Documentation User guides/ });
    await expect(documentationLink).toHaveAttribute('href', '/docs');
    await documentationLink.click();

    await expect(page).toHaveURL(/\/docs$/);
    await expect(
      page.getByRole('heading', { name: 'User guide and workflow reference' }),
    ).toBeVisible();
  });

  test('exposes documentation in desktop navigation', async ({ page }) => {
    await mockDocumentationApi(page);

    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Documentation' })).toHaveAttribute(
      'href',
      '/docs',
    );
  });
});
