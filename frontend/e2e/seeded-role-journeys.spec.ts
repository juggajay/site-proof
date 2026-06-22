import { expect, test } from '@playwright/test';
import { E2E_PROJECT_ID, login, loginAsAdmin, loginAsSubcontractor } from './helpers';

test.describe('seeded real-backend role journeys', () => {
  test('admin sees the modern lot subcontractor ITP permission assignment', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots/e2e-lot?tab=itp`);

    await expect(page.getByRole('heading', { name: 'LOT-001' })).toBeVisible();
    await expect(page.getByText('Assigned Subcontractors')).toBeVisible();
    await expect(page.getByText('E2E Subcontractors').last()).toBeVisible();
    await expect(page.getByText('Can complete').first()).toBeVisible();
    await expect(page.getByText('Requires verification').first()).toBeVisible();
    await expect(
      page.getByText('Legacy assignment - click Add to set ITP permissions'),
    ).toHaveCount(0);
  });

  test('assigned subcontractor can open the seeded lot ITP with completion access', async ({
    page,
  }) => {
    await loginAsSubcontractor(page);

    await page.goto(`/subcontractor-portal/lots/e2e-lot/itp?projectId=${E2E_PROJECT_ID}`);

    await expect(page.getByRole('heading', { name: 'LOT-001' }).first()).toBeVisible();
    await expect(page.getByText('Verify formation is ready for inspection')).toBeVisible();
    await expect(page.getByText(/View only/i)).toHaveCount(0);
    await expect(page.getByText(/do not have permission to complete/i)).toHaveCount(0);
  });

  test('seeded foreman reaches the mobile shell against the real backend', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'foreman@example.com', /\/(dashboard|m|projects)/);

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/m$/);
    await expect(page.getByRole('banner').getByText('SITEPROOF', { exact: true })).toBeVisible();
    await expect(page.getByRole('banner').getByText('FOREMAN', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E Highway Upgrade')).toBeVisible();
    await expect(page.getByText('Lots')).toBeVisible();
    await expect(page.getByText('1 due')).toBeVisible();
  });
});
