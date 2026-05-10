import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

type SeededCostsApiOptions = {
  failCostsUntil?: number;
};

function seededCostData() {
  return {
    summary: {
      totalLabourCost: 18500,
      totalPlantCost: 9500,
      totalCost: 28000,
      budgetTotal: 26000,
      budgetVariance: -2000,
      approvedDockets: 7,
      pendingDockets: 2,
    },
    subcontractorCosts: [
      {
        id: 'e2e-cost-sub-alpha',
        companyName: 'Alpha Civil Pty Ltd',
        labourCost: 12000,
        plantCost: 6000,
        totalCost: 18000,
        approvedDockets: 4,
      },
      {
        id: 'e2e-cost-sub-beta',
        companyName: 'Beta Plant Hire',
        labourCost: 6500,
        plantCost: 3500,
        totalCost: 10000,
        approvedDockets: 3,
      },
    ],
    lotCosts: [
      {
        id: 'e2e-cost-lot-1',
        lotNumber: 'LOT-COST-001',
        activity: 'Earthworks',
        budgetAmount: 14000,
        actualCost: 12000,
        variance: 2000,
      },
      {
        id: 'e2e-cost-lot-2',
        lotNumber: 'LOT-COST-002',
        activity: 'Drainage',
        budgetAmount: 12000,
        actualCost: 16000,
        variance: -4000,
      },
    ],
  };
}

async function mockCostsShellApi(page: Page) {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: E2E_ADMIN_USER }),
    });
  });

  await page.route('**/api/notifications', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    });
  });

  await page.route('**/api/projects', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projects: [
          {
            id: E2E_PROJECT_ID,
            name: 'E2E Highway Upgrade',
            projectNumber: 'E2E-001',
            status: 'active',
          },
        ],
      }),
    });
  });

  await page.route(`**/api/projects/${E2E_PROJECT_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        project: {
          id: E2E_PROJECT_ID,
          name: 'E2E Highway Upgrade',
          projectNumber: 'E2E-001',
        },
      }),
    });
  });
}

async function mockSeededCostsApi(page: Page, options: SeededCostsApiOptions = {}) {
  let costsRequestCount = 0;
  await mockCostsShellApi(page);

  await page.route(`**/api/projects/${E2E_PROJECT_ID}/costs`, async (route) => {
    costsRequestCount += 1;
    if (costsRequestCount <= (options.failCostsUntil ?? 0)) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Cost service unavailable' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(seededCostData()),
    });
  });

  await mockAuthenticatedUserState(page);

  return {
    getCostsRequestCount: () => costsRequestCount,
  };
}

test.describe('Costs seeded commercial contract', () => {
  test('renders cost data, filters tables, and exports filtered CSV', async ({ page }) => {
    const api = await mockSeededCostsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/costs`);

    await expect(page.getByRole('heading', { name: 'Project Costs' })).toBeVisible();
    await expect(
      page.getByText('Track labour, plant, and budget across all subcontractors'),
    ).toBeVisible();
    await expect(
      page.locator('.rounded-xl').filter({ hasText: 'Total Cost' }).getByText('$28,000'),
    ).toBeVisible();
    await expect(page.getByText('Over budget by $2,000')).toBeVisible();
    await expect(page.getByText('Approved Dockets')).toBeVisible();
    expect(api.getCostsRequestCount()).toBe(1);

    await expect(page.getByRole('tab', { name: 'Summary' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('button', { name: 'Filter' }).click();
    await page.getByLabel('Search costs').fill('Alpha');
    await page.getByRole('tab', { name: 'By Subcontractor' }).click();

    await expect(page.getByText('Alpha Civil Pty Ltd')).toBeVisible();
    await expect(page.getByText('Beta Plant Hire')).toBeHidden();
    await expect(page.getByRole('cell', { name: '$18,000' })).toHaveCount(2);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Report' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^cost-report-\d{4}-\d{2}-\d{2}\.csv$/);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const csv = await readFile(downloadPath!, 'utf8');
    expect(csv).toContain('Alpha Civil Pty Ltd');
    expect(csv).not.toContain('Beta Plant Hire');
    await download.delete();

    await page.getByLabel('Search costs').fill('LOT-COST');
    await page.getByLabel('Over-budget lots only').check();
    await page.getByRole('tab', { name: 'By Lot' }).click();

    await expect(page.getByText('LOT-COST-002')).toBeVisible();
    await expect(page.getByText('Drainage')).toBeVisible();
    await expect(page.getByText('LOT-COST-001')).toBeHidden();
    await expect(page.getByText('-$4,000')).toBeVisible();
  });

  test('shows a retryable load failure instead of synthetic zero-cost data', async ({ page }) => {
    const api = await mockSeededCostsApi(page, { failCostsUntil: 2 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/costs`);

    await expect(page.getByRole('heading', { name: 'Project Costs' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Cost service unavailable');
    await expect(page.getByText('Total Cost')).toBeHidden();
    await expect(page.getByText('Cost Breakdown')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Summary' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Filter' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Export Report' })).toBeDisabled();

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect.poll(() => api.getCostsRequestCount()).toBeGreaterThan(2);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(
      page.locator('.rounded-xl').filter({ hasText: 'Total Cost' }).getByText('$28,000'),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Summary' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
