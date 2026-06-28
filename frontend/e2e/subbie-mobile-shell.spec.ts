import { expect, test, type Page, type Route } from '@playwright/test';
import { mockAuthenticatedUserState } from './helpers';

const PROJECT_ID = 'project/alpha & beta';
const PROJECT_NAME = 'Awkward Query Project';
const SUBCONTRACTOR_COMPANY_ID = 'e2e-subbie-mobile-shell-company';

const SUBBIE_USER = {
  id: 'e2e-subbie-mobile-shell-user',
  email: 'subbie-mobile-shell@example.com',
  fullName: 'Morgan Mobile Subbie',
  role: 'subcontractor_admin',
  roleInCompany: 'subcontractor_admin',
  companyId: null,
  companyName: null,
  hasSubcontractorPortalAccess: true,
  hasPassword: true,
};

const PORTAL_ACCESS = {
  lots: true,
  itps: true,
  holdPoints: true,
  testResults: true,
  ncrs: true,
  documents: true,
};

function selectedProjectId(url: URL): string {
  return url.searchParams.get('projectId') || PROJECT_ID;
}

function selectedSubcontractorCompanyId(url: URL): string {
  return url.searchParams.get('subcontractorCompanyId') || SUBCONTRACTOR_COMPANY_ID;
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockSubbieShellApi(page: Page) {
  const myCompanyProjectIds: Array<string | null> = [];
  const lotsProjectIds: Array<string | null> = [];
  const lotsSubcontractorCompanyIds: Array<string | null> = [];

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/auth/me') {
      await fulfillJson(route, { user: SUBBIE_USER });
      return;
    }

    if (url.pathname === '/api/notifications/unread-count') {
      await fulfillJson(route, { count: 0 });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await fulfillJson(route, { notifications: [], unreadCount: 0 });
      return;
    }

    if (url.pathname === '/api/projects') {
      await fulfillJson(route, { projects: [] });
      return;
    }

    if (url.pathname === '/api/subcontractors/my-company') {
      const requestedProjectId = url.searchParams.get('projectId');
      myCompanyProjectIds.push(requestedProjectId);
      await fulfillJson(route, {
        company: {
          id: selectedSubcontractorCompanyId(url),
          companyName: 'Mobile Shell Civil',
          projectId: selectedProjectId(url),
          projectName: PROJECT_NAME,
          employees: [{ id: 'emp-1', name: 'Worker One', status: 'approved' }],
          plant: [],
          portalAccess: PORTAL_ACCESS,
          availableProjects: [
            {
              id: 'portal-company-1',
              subcontractorCompanyId: SUBCONTRACTOR_COMPANY_ID,
              companyName: 'Mobile Shell Civil',
              projectId: PROJECT_ID,
              projectName: PROJECT_NAME,
              status: 'approved',
              portalAccess: PORTAL_ACCESS,
            },
          ],
        },
      });
      return;
    }

    if (url.pathname === '/api/lots') {
      lotsProjectIds.push(url.searchParams.get('projectId'));
      lotsSubcontractorCompanyIds.push(url.searchParams.get('subcontractorCompanyId'));
      await fulfillJson(route, {
        lots: [
          {
            id: 'lot-1',
            lotNumber: 'QA-001',
            activity: 'Drainage',
            activityType: 'Drainage',
            status: 'in_progress',
            area: 42,
          },
        ],
      });
      return;
    }

    if (url.pathname === '/api/dockets') {
      await fulfillJson(route, { dockets: [] });
      return;
    }

    await fulfillJson(route, { message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, SUBBIE_USER);

  return {
    myCompanyProjectIds: () => myCompanyProjectIds,
    lotsProjectIds: () => lotsProjectIds,
    lotsSubcontractorCompanyIds: () => lotsSubcontractorCompanyIds,
  };
}

test.describe('Subbie mobile shell direct routes', () => {
  test('desktop direct /p/work falls back to the classic portal and preserves project scope', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const api = await mockSubbieShellApi(page);

    await page.goto(`/p/work?projectId=${encodeURIComponent(PROJECT_ID)}`);

    await expect.poll(() => new URL(page.url()).pathname).toBe('/subcontractor-portal/work');
    expect(new URL(page.url()).searchParams.get('projectId')).toBe(PROJECT_ID);
    await expect(page.getByRole('heading', { name: 'Assigned Work' })).toBeVisible();
    await expect(page.getByText('QA-001')).toBeVisible();
    expect(api.myCompanyProjectIds()).toContain(PROJECT_ID);
    expect(api.lotsProjectIds()).toContain(PROJECT_ID);
  });

  test('mobile direct /p/work stays in the shell and preserves project scope', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const api = await mockSubbieShellApi(page);

    await page.goto(`/p/work?projectId=${encodeURIComponent(PROJECT_ID)}`);

    await expect.poll(() => new URL(page.url()).pathname).toBe('/p/work');
    expect(new URL(page.url()).searchParams.get('projectId')).toBe(PROJECT_ID);
    await expect(page.getByRole('heading', { name: 'My Work' })).toBeVisible();
    await expect(page.getByText('QA-001')).toBeVisible();
    expect(api.myCompanyProjectIds()).toContain(PROJECT_ID);
    expect(api.lotsProjectIds()).toContain(PROJECT_ID);
  });

  test('mobile direct /p/docket scopes assigned lots to the selected subcontractor company', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const api = await mockSubbieShellApi(page);
    const selectedCompanyId = 'subbie/company & two';

    await page.goto(
      `/p/docket?projectId=${encodeURIComponent(PROJECT_ID)}&subcontractorCompanyId=${encodeURIComponent(
        selectedCompanyId,
      )}`,
    );

    await expect.poll(() => new URL(page.url()).pathname).toBe('/p/docket');
    await expect(page.getByRole('heading', { name: "Today's Docket" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add crew hours' })).toBeVisible();
    expect(api.myCompanyProjectIds()).toContain(PROJECT_ID);
    expect(api.lotsProjectIds()).toContain(PROJECT_ID);
    expect(api.lotsSubcontractorCompanyIds()).toContain(selectedCompanyId);
  });
});
