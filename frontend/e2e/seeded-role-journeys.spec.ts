import { expect, test, type Locator, type Page } from '@playwright/test';
import { E2E_PROJECT_ID, login, loginAsAdmin, loginAsSubcontractor } from './helpers';

function futureDateKey(daysAhead: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

async function drawSignature(page: Page, scope: Locator) {
  const signaturePad = scope.getByTestId('signature-pad-container');
  await signaturePad.scrollIntoViewIfNeeded();
  const canvas = signaturePad.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Signature canvas was not measurable');

  const startX = box.x + box.width * 0.2;
  const y = box.y + box.height * 0.55;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, y + 18, { steps: 4 });
  await page.mouse.move(box.x + box.width * 0.65, y - 12, { steps: 4 });
  await page.mouse.move(box.x + box.width * 0.82, y + 10, { steps: 4 });
  await page.mouse.up();
}

test.describe.serial('seeded real-backend role journeys', () => {
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
    await expect(page.getByText('ITP checks & hold points')).toBeVisible();
  });

  test('hold point release completes the seeded ITP item and enables normal conformance', async ({
    browser,
  }) => {
    const adminContext = await browser.newContext();
    const subbieContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const subbiePage = await subbieContext.newPage();

    try {
      await loginAsSubcontractor(subbiePage);
      await subbiePage.goto(`/subcontractor-portal/lots/e2e-lot/itp?projectId=${E2E_PROJECT_ID}`);

      await expect(subbiePage.getByRole('heading', { name: 'LOT-001' }).first()).toBeVisible();
      await subbiePage.getByText('Verify formation is ready for inspection').click();
      await expect(subbiePage.getByText('Release Required')).toBeVisible();
      await expect(subbiePage.getByRole('button', { name: /PASS/ })).toBeDisabled();
      await subbiePage.getByRole('button', { name: 'Close' }).click();

      await loginAsAdmin(adminPage);
      await adminPage.goto(`/projects/${E2E_PROJECT_ID}/hold-points`);
      await expect(adminPage.getByRole('heading', { name: 'Hold Points' })).toBeVisible();
      await expect(adminPage.getByText('LOT-001')).toBeVisible();

      await adminPage.getByRole('button', { name: 'Request Release' }).click();
      const requestModal = adminPage
        .getByRole('dialog')
        .filter({ hasText: 'Request Hold Point Release' });
      await expect(requestModal.getByText('All prerequisites completed')).toBeVisible();
      await requestModal.locator('input[type="date"]').fill(futureDateKey(14));
      await requestModal.locator('input[type="time"]').fill('09:30');
      await requestModal
        .getByPlaceholder('inspector@example.com, superintendent@example.com')
        .fill('stage57-super@example.com');

      await Promise.all([
        adminPage.waitForResponse(
          (response) =>
            response.url().includes('/api/holdpoints/request-release') &&
            response.request().method() === 'POST' &&
            response.status() === 200,
        ),
        requestModal.getByRole('button', { name: 'Request Release' }).click(),
      ]);

      await expect(adminPage.getByRole('button', { name: 'Record Manual Release' })).toBeVisible();
      await adminPage.getByRole('button', { name: 'Record Manual Release' }).click();

      const recordModal = adminPage
        .getByRole('dialog')
        .filter({ hasText: 'Record Manual Hold Point Release' });
      await expect(recordModal.getByText('Record Manual Hold Point Release')).toBeVisible();
      await recordModal.getByPlaceholder('Enter name of person releasing').fill('Stage 57 Super');
      await recordModal.getByPlaceholder(/Enter organisation/).fill('Stage 57 QA');
      await drawSignature(adminPage, recordModal);
      await expect(recordModal.getByText('Signature captured')).toBeVisible();

      await Promise.all([
        adminPage.waitForResponse(
          (response) =>
            response.url().includes('/api/holdpoints/e2e-hold-point/release') &&
            response.request().method() === 'POST' &&
            response.status() === 200,
        ),
        recordModal.getByRole('button', { name: 'Record Manual Release' }).click(),
      ]);

      await expect(adminPage.getByText('Stage 57 Super')).toBeVisible();
      await expect(adminPage.getByText('Stage 57 QA')).toBeVisible();

      await adminPage.goto(`/projects/${E2E_PROJECT_ID}/lots/e2e-lot?tab=itp`);
      await expect(adminPage.getByText('ITP Completed (1/1 items)')).toBeVisible();
      await expect(
        adminPage.getByRole('button', { name: 'Conform Lot', exact: true }),
      ).toBeEnabled();

      await adminPage.getByRole('button', { name: 'Conform Lot', exact: true }).click();
      const conformDialog = adminPage.getByRole('alertdialog').filter({ hasText: 'Conform Lot' });

      await Promise.all([
        adminPage.waitForResponse(
          (response) =>
            response.url().includes('/api/lots/e2e-lot/conform') &&
            response.request().method() === 'POST' &&
            response.status() === 200,
        ),
        conformDialog.getByRole('button', { name: 'Conform Lot' }).click(),
      ]);

      await expect(adminPage.getByRole('heading', { name: 'Lot Conformed' })).toBeVisible();
    } finally {
      await adminContext.close();
      await subbieContext.close();
    }
  });
});
