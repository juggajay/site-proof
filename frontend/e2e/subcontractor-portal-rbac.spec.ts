import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const linkedHeadContractorPortalUser = {
  ...E2E_ADMIN_USER,
  id: 'e2e-linked-hc-portal-user',
  email: 'linked-hc-portal@example.com',
  fullName: 'Linked HC Portal User',
  role: 'owner',
  roleInCompany: 'owner',
  hasSubcontractorPortalAccess: true,
};

const subcontractorPortalUser = {
  ...E2E_ADMIN_USER,
  id: 'e2e-subcontractor-portal-user',
  email: 'subbie-portal@example.com',
  fullName: 'Sam Subbie',
  role: 'subcontractor_admin',
  roleInCompany: 'subcontractor_admin',
  companyId: null,
  companyName: null,
};

const linkedPortalMemberUser = {
  ...E2E_ADMIN_USER,
  id: 'e2e-linked-portal-member-user',
  email: 'linked-portal-member@example.com',
  fullName: 'Linked Portal Member',
  role: 'member',
  roleInCompany: null,
  companyId: null,
  companyName: null,
  hasSubcontractorPortalAccess: true,
};

const portalCompany = {
  id: 'e2e-subcontractor-company',
  companyName: 'E2E Civil Subcontractors',
  projectId: E2E_PROJECT_ID,
  projectName: 'E2E Highway Upgrade',
  employees: [],
  plant: [],
  portalAccess: {
    lots: true,
    itps: true,
    holdPoints: true,
    testResults: true,
    ncrs: true,
    documents: true,
  },
};

async function mockSubcontractorPortalApi(
  page: Page,
  user:
    | typeof linkedHeadContractorPortalUser
    | typeof subcontractorPortalUser
    | typeof linkedPortalMemberUser,
) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user });
      return;
    }

    if (url.pathname === '/api/subcontractors/my-company') {
      await json({ company: portalCompany });
      return;
    }

    if (url.pathname === '/api/dockets') {
      await json({ dockets: [] });
      return;
    }

    if (url.pathname === '/api/lots' && url.searchParams.get('projectId') === E2E_PROJECT_ID) {
      await json({
        lots: [
          {
            id: 'e2e-assigned-lot',
            lotNumber: 'SUB-LOT-001',
            activity: 'Drainage',
            activityType: 'Drainage',
            status: 'in_progress',
          },
        ],
      });
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
            contractValue: null,
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
        },
      });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, user);
}

test.describe('Subcontractor portal RBAC', () => {
  test('denies a head-contractor company user even when a stale subcontractor link exists', async ({
    page,
  }) => {
    await mockSubcontractorPortalApi(page, linkedHeadContractorPortalUser);

    await page.goto('/subcontractor-portal');

    await expect(page.getByText('Access Denied')).toBeVisible();
    await expect(page.getByText('E2E Civil Subcontractors')).toHaveCount(0);
  });

  test('keeps subcontractor users out of the head-contractor project workspace', async ({
    page,
  }) => {
    await mockSubcontractorPortalApi(page, subcontractorPortalUser);

    await page.goto('/projects');

    await page.waitForURL('**/subcontractor-portal', { timeout: 15000 });
    await expect(page.getByRole('button', { name: 'New Project' })).toHaveCount(0);
    await expect(page.getByText('E2E Civil Subcontractors')).toBeVisible();
  });

  test('routes linked portal identities to subcontractor dashboard instead of HC dashboard', async ({
    page,
  }) => {
    await mockSubcontractorPortalApi(page, linkedPortalMemberUser);

    await page.goto('/dashboard');

    await expect(page.getByText('E2E Civil Subcontractors')).toBeVisible();
    await expect(page.getByRole('link', { name: /projects/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /portal/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create lot/i })).toHaveCount(0);
  });

  test('redirects linked portal identities away from the projects index', async ({ page }) => {
    await mockSubcontractorPortalApi(page, linkedPortalMemberUser);

    await page.goto('/projects');

    await page.waitForURL('**/subcontractor-portal', { timeout: 15000 });
    await expect(page.getByRole('button', { name: 'New Project' })).toHaveCount(0);
    await expect(page.getByText('E2E Civil Subcontractors')).toBeVisible();
  });
});
