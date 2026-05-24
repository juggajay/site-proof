import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, mockAuthenticatedUserState } from './helpers';

const noCompanyUser = {
  ...E2E_ADMIN_USER,
  id: 'e2e-no-company-user',
  role: 'member',
  roleInCompany: 'member',
  companyId: null,
  companyName: null,
};

async function mockOnboardingApi(page: Page) {
  let currentUser = { ...noCompanyUser };
  let companyCreateRequest: unknown = null;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: currentUser });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await json({ notifications: [], unreadCount: 0 });
      return;
    }

    if (url.pathname === '/api/company' && route.request().method() === 'POST') {
      companyCreateRequest = route.request().postDataJSON();
      currentUser = {
        ...currentUser,
        role: 'owner',
        roleInCompany: 'owner',
        companyId: 'e2e-company',
        companyName: 'E2E Civil Pty Ltd',
      };
      await json(
        {
          company: {
            id: 'e2e-company',
            name: 'E2E Civil Pty Ltd',
            abn: '12345678901',
            address: '10 Test Street, Sydney NSW 2000',
            subscriptionTier: 'basic',
          },
          user: currentUser,
        },
        201,
      );
      return;
    }

    if (url.pathname === '/api/projects') {
      await json({ projects: [] });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, noCompanyUser);

  return {
    getCompanyCreateRequest: () => companyCreateRequest,
  };
}

test.describe('Company onboarding', () => {
  test('redirects company-less users to onboarding and creates their first company', async ({
    page,
  }) => {
    const api = await mockOnboardingApi(page);

    await page.goto('/projects');

    await expect(page).toHaveURL('/onboarding');
    await expect(page.getByRole('heading', { name: 'Set up your company' })).toBeVisible();

    await page.getByLabel('Company name').fill('  E2E Civil Pty Ltd  ');
    await page.getByLabel('ABN').fill('  12345678901  ');
    await page.getByLabel('Business address').fill('  10 Test Street, Sydney NSW 2000  ');
    await page.getByRole('button', { name: 'Create Company' }).click();

    await expect(page).toHaveURL('/projects');
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
    expect(api.getCompanyCreateRequest()).toMatchObject({
      name: 'E2E Civil Pty Ltd',
      abn: '12345678901',
      address: '10 Test Street, Sydney NSW 2000',
    });
  });
});
