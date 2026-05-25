import { expect, test } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

test.describe('not found recovery', () => {
  test('gives authenticated project users useful recovery links', async ({ page }) => {
    await mockAuthenticatedUserState(page);
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: E2E_ADMIN_USER }),
      });
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/unknown-tool`);

    await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /open project dashboard/i })).toHaveAttribute(
      'href',
      `/projects/${E2E_PROJECT_ID}`,
    );
    await expect(page.getByRole('link', { name: /view projects/i })).toHaveAttribute(
      'href',
      '/projects',
    );
    await expect(page.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });
});
