import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, mockAuthenticatedUserState } from './helpers';

const E2E_OWNER_USER = {
  ...E2E_ADMIN_USER,
  id: 'e2e-owner-user',
  role: 'admin',
  roleInCompany: 'owner',
};

type MockCompany = {
  id: string;
  name: string;
  abn: string | null;
  address: string | null;
  logoUrl: string | null;
  subscriptionTier: string;
  projectCount: number;
  projectLimit: number | null;
  userCount: number;
  userLimit: number | null;
  createdAt: string;
  updatedAt: string;
};

const seededCompany: MockCompany = {
  id: 'e2e-company',
  name: 'E2E Civil Pty Ltd',
  abn: '12 345 678 901',
  address: '1 Test Street, Sydney NSW',
  logoUrl: null,
  subscriptionTier: 'professional',
  projectCount: 8,
  projectLimit: 10,
  userCount: 20,
  userLimit: 25,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-08T00:00:00.000Z',
};

type MockCompanySettingsApiOptions = {
  failCompanyLoadsUntil?: number;
  failMemberLoadsUntil?: number;
  companyOverride?: Partial<MockCompany>;
  patchDelayMs?: number;
  transferDelayMs?: number;
  logoUploadFailure?: boolean;
};

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function mockCompanySettingsApi(page: Page, options: MockCompanySettingsApiOptions = {}) {
  let company: MockCompany = { ...structuredClone(seededCompany), ...options.companyOverride };
  const patchRequests: unknown[] = [];
  const transferRequests: unknown[] = [];
  let companyLoadCount = 0;
  let memberLoadCount = 0;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: E2E_OWNER_USER });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await json({ notifications: [], unreadCount: 0 });
      return;
    }

    if (url.pathname === '/api/projects') {
      await json({ projects: [] });
      return;
    }

    if (url.pathname === '/api/support/contact') {
      await json({
        email: 'configured-support@example.com',
        phone: null,
        phoneLabel: null,
        emergencyPhone: null,
        address: null,
        hours: 'Mon-Fri, 8am-6pm AEST',
        responseTime: {
          critical: 'Within 2 hours',
          standard: 'Within 24 hours',
          general: 'Within 48 hours',
        },
      });
      return;
    }

    if (url.pathname === '/api/company') {
      if (route.request().method() === 'GET') {
        companyLoadCount += 1;
        if (companyLoadCount <= (options.failCompanyLoadsUntil ?? 0)) {
          await json({ message: 'Company service unavailable' }, 500);
          return;
        }

        await json({ company });
        return;
      }

      if (route.request().method() === 'PATCH') {
        if (options.patchDelayMs) {
          await delay(options.patchDelayMs);
        }

        const body = route.request().postDataJSON();
        patchRequests.push(body);
        company = {
          ...company,
          ...(body as Partial<typeof seededCompany>),
          updatedAt: '2026-05-09T00:00:00.000Z',
        };
        await json({ company, message: 'Company updated successfully' });
        return;
      }
    }

    if (url.pathname === '/api/company/logo' && route.request().method() === 'POST') {
      if (options.logoUploadFailure) {
        await json({ error: { message: 'Logo rejected by server' } }, 400);
        return;
      }

      company = {
        ...company,
        logoUrl: '/uploads/logos/e2e-logo.png',
        updatedAt: '2026-05-09T00:00:00.000Z',
      };
      await json({ company, logoUrl: company.logoUrl });
      return;
    }

    if (url.pathname === '/api/company/members') {
      memberLoadCount += 1;
      if (memberLoadCount <= (options.failMemberLoadsUntil ?? 0)) {
        await json({ message: 'Company members service unavailable' }, 500);
        return;
      }

      await json({
        members: [
          {
            id: E2E_OWNER_USER.id,
            email: E2E_OWNER_USER.email,
            fullName: E2E_OWNER_USER.fullName,
            roleInCompany: 'owner',
          },
          {
            id: 'e2e-company-admin',
            email: 'company.admin@example.com',
            fullName: 'E2E Company Admin',
            roleInCompany: 'admin',
          },
        ],
      });
      return;
    }

    if (url.pathname === '/api/company/transfer-ownership') {
      if (options.transferDelayMs) {
        await delay(options.transferDelayMs);
      }

      transferRequests.push(route.request().postDataJSON());
      await json({ success: true });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, E2E_OWNER_USER);

  return {
    getPatchRequests: () => patchRequests,
    getTransferRequests: () => transferRequests,
    getCompanyLoadCount: () => companyLoadCount,
    getMemberLoadCount: () => memberLoadCount,
  };
}

test.describe('Company settings seeded owner contract', () => {
  test('saves company profile details and shows owner-only billing controls', async ({ page }) => {
    const api = await mockCompanySettingsApi(page);

    await page.goto('/company-settings');

    await expect(page.getByRole('heading', { name: 'Company Settings' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Company Information' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Billing & Subscription' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Transfer Ownership' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Upgrade Plan' })).toHaveAttribute(
      'href',
      'mailto:configured-support@example.com?subject=Upgrade%20SiteProof%20plan',
    );
    await expect(page.getByRole('link', { name: 'Manage Payment Method' })).toHaveAttribute(
      'href',
      'mailto:configured-support@example.com?subject=SiteProof%20billing%20inquiry',
    );

    await page.getByLabel(/Company Name/).fill('');
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await expect(page.getByText('Company name is required')).toBeVisible();
    expect(api.getPatchRequests()).toHaveLength(0);

    await page.getByLabel(/Company Name/).fill('E2E Civil Group');
    await page.getByLabel('ABN').fill('98 765 432 109');
    await page.getByLabel('Address').fill('22 Verified Road, Melbourne VIC');
    await page.getByRole('button', { name: 'Save Settings' }).click();

    await expect(page.getByText('Settings saved successfully!')).toBeVisible();
    expect(api.getPatchRequests()).toHaveLength(1);
    expect(api.getPatchRequests()[0]).toMatchObject({
      name: 'E2E Civil Group',
      abn: '98 765 432 109',
      address: '22 Verified Road, Melbourne VIC',
      logoUrl: null,
    });
  });

  test('prevents duplicate company profile saves and trims payload fields', async ({ page }) => {
    const api = await mockCompanySettingsApi(page, { patchDelayMs: 250 });

    await page.goto('/company-settings');

    await page.getByLabel(/Company Name/).fill('  E2E Civil Trimmed  ');
    await page.getByLabel('ABN').fill('  11 222 333 444  ');
    const saveButton = page.getByRole('button', { name: 'Save Settings' });
    await saveButton.evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    await expect(page.getByText('Settings saved successfully!')).toBeVisible();
    expect(api.getPatchRequests()).toHaveLength(1);
    expect(api.getPatchRequests()[0]).toMatchObject({
      name: 'E2E Civil Trimmed',
      abn: '11 222 333 444',
    });
  });

  test('shows nested backend logo upload errors as readable messages', async ({ page }) => {
    await mockCompanySettingsApi(page, { logoUploadFailure: true });

    await page.goto('/company-settings');
    await page.locator('#company-logo-upload').setInputFiles({
      name: 'company-logo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not-a-real-image'),
    });

    await expect(page.getByText('Logo rejected by server')).toBeVisible();
  });

  test('renders unlimited plan billing without falling back to free/basic labels', async ({
    page,
  }) => {
    await mockCompanySettingsApi(page, {
      companyOverride: {
        subscriptionTier: 'unlimited',
        projectLimit: null,
        userLimit: null,
      },
    });

    await page.goto('/company-settings');

    const billingSection = page.getByTestId('billing-section');
    await expect(billingSection).toContainText('unlimited');
    await expect(billingSection).toContainText('Custom pricing');
    await expect(billingSection).toContainText('Unlimited');
    await expect(billingSection.getByText('Free', { exact: true })).toHaveCount(0);
    await expect(billingSection.getByText('1 GB', { exact: true })).toHaveCount(0);
  });

  test('transfers ownership to another company member', async ({ page }) => {
    const api = await mockCompanySettingsApi(page);

    await page.goto('/company-settings');
    await page.getByRole('button', { name: 'Transfer Ownership' }).click();

    const transferDialog = page.getByRole('dialog').filter({ hasText: 'Transfer Ownership' });
    await expect(transferDialog.getByText('Choose another company member')).toBeVisible();
    await transferDialog.getByLabel('Select New Owner').selectOption('e2e-company-admin');
    await expect(transferDialog.getByText('E2E Company Admin', { exact: true })).toBeVisible();
    await transferDialog.getByRole('button', { name: 'Transfer Ownership' }).click();

    await expect(page.getByText('Ownership transferred successfully.')).toBeVisible();
    expect(api.getTransferRequests()).toHaveLength(1);
    expect(api.getTransferRequests()[0]).toMatchObject({
      newOwnerId: 'e2e-company-admin',
    });
  });

  test('prevents duplicate ownership transfer submissions', async ({ page }) => {
    const api = await mockCompanySettingsApi(page, { transferDelayMs: 250 });

    await page.goto('/company-settings');
    await page.getByRole('button', { name: 'Transfer Ownership' }).click();

    const transferDialog = page.getByRole('dialog').filter({ hasText: 'Transfer Ownership' });
    await transferDialog.getByLabel('Select New Owner').selectOption('e2e-company-admin');
    const transferButton = transferDialog.getByRole('button', { name: 'Transfer Ownership' });
    await transferButton.evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    await expect(page.getByText('Ownership transferred successfully.')).toBeVisible();
    expect(api.getTransferRequests()).toHaveLength(1);
  });

  test('shows member load failure before empty transfer state and retries', async ({ page }) => {
    const api = await mockCompanySettingsApi(page, { failMemberLoadsUntil: 2 });

    await page.goto('/company-settings');
    await page.getByRole('button', { name: 'Transfer Ownership' }).click();

    const transferDialog = page.getByRole('dialog').filter({ hasText: 'Transfer Ownership' });
    await expect(transferDialog.getByRole('alert')).toContainText(
      'Company members service unavailable',
    );
    await expect(transferDialog.getByText('No other members in your company')).toBeHidden();

    const tryAgainButton = transferDialog.getByRole('button', { name: 'Try again' });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (
        await transferDialog
          .getByLabel('Select New Owner')
          .isVisible()
          .catch(() => false)
      )
        break;
      if (await tryAgainButton.isVisible().catch(() => false)) {
        await tryAgainButton.click();
      }
      await page.waitForTimeout(100);
    }

    await expect(transferDialog.getByLabel('Select New Owner')).toBeVisible();
    await expect.poll(() => api.getMemberLoadCount()).toBeGreaterThan(2);
  });

  test('recovers from company settings load failure without false settings content', async ({
    page,
  }) => {
    const api = await mockCompanySettingsApi(page, { failCompanyLoadsUntil: 4 });

    await page.goto('/company-settings');

    await expect(page.getByRole('heading', { name: 'Company Settings' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Company service unavailable');
    await expect(page.getByRole('heading', { name: 'Company Information' })).toBeHidden();

    const tryAgainButton = page.getByRole('button', { name: 'Try again' });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (
        await page
          .getByRole('heading', { name: 'Company Information' })
          .isVisible()
          .catch(() => false)
      )
        break;
      if (await tryAgainButton.isVisible().catch(() => false)) {
        await tryAgainButton.click();
      }
      await page.waitForTimeout(100);
    }

    await expect(page.getByRole('heading', { name: 'Company Information' })).toBeVisible();
    await expect.poll(() => api.getCompanyLoadCount()).toBeGreaterThan(4);
  });
});
